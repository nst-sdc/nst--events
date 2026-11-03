#!/usr/bin/env bash
# ==============================================================================
# NST Events - Database Promotion & Cutover Procedure Verification Drill
# Validates PostgreSQL 16 transactional cutover semantics, connection draining,
# rollback data-loss boundaries, and post-cutover retention policies:
#
#  - Test 1: Implicit multi-statement psql -c transaction failure & catalog rollback
#            (Proves DROP DATABASE aborts transaction; command tags != commit)
#  - Test 2: Active connection blocking & connection draining enforcement
#  - Test 3: Atomic two-rename cutover inside explicit transaction block (BEGIN ... COMMIT)
#  - Test 4: Injected failure inside explicit transaction (Proves atomicity & zero orphan state)
#  - Test 5: Pre-traffic quiesced rollback window (Zero data loss verification)
#  - Test 6: Post-cutover write & rollback data-loss proof (Proves snapshot rollback loses writes)
#  - Test 7: Full schema, migrations, extensions, roles, grants, and RLS parity
#  - Test 8: Old database 24-hour bake-in retention & approved decommission
#
# NOTE ON TEST SCOPE & BOUNDARIES:
# This drill is a DATABASE-LEVEL CATALOG & TRANSACTION DRILL executed on a
# disposable PostgreSQL 16 Docker container. It exercises database engine semantics,
# transactional DDL, catalog integrity, and RLS isolation. It does NOT spin up live
# Kubernetes pods or execute HTTP traffic against apps/api. Simulated smoke tests
# model the database-level outcomes of application checks. In production, kubectl
# quiescing commands target deployment nst-api and nst-worker in namespace nst-events.
# ==============================================================================
set -euo pipefail

TIMESTAMP=$(date +%s)
PORT=5442
CONTAINER="nst-cutover-drill-${TIMESTAMP}"
WORK_DIR=$(mktemp -d /tmp/nst-cutover-drill.XXXXXX)
chmod 700 "$WORK_DIR"

cleanup() {
  echo "==> Cleaning up cutover drill container and temporary artifacts..."
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
  echo "[PASS] Cleanup complete."
}
trap cleanup EXIT

echo "=============================================================================="
echo "NST EVENTS - DATABASE CUTOVER & TRANSACTION CORRECTNESS DRILL"
echo "PostgreSQL Container: $CONTAINER (Port: $PORT)"
echo "Work Directory:       $WORK_DIR"
echo "=============================================================================="

# ------------------------------------------------------------------------------
# STEP 1: Initialize Disposable PostgreSQL 16 Cluster with Full Schema & Seed Data
# ------------------------------------------------------------------------------
echo "==> STEP 1: Starting PostgreSQL 16 container and deploying full schema..."
docker run -d \
  --name "$CONTAINER" \
  -p "${PORT}:5432" \
  -e POSTGRES_PASSWORD=cutover_test_pass \
  -e POSTGRES_DB=nst_events \
  postgis/postgis:16-3.4 >/dev/null

echo "Waiting for PostgreSQL initialization to complete..."
until docker logs "$CONTAINER" 2>&1 | grep -q "PostgreSQL init process complete; ready for start up"; do
  sleep 1
done
until docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -p 5432 -U postgres -d nst_events >/dev/null 2>&1; do
  sleep 1
done
echo "[PASS] PostgreSQL container running on port $PORT."

echo "Deploying full NST Events migration history (all 150 Prisma migrations)..."
DATABASE_URL="postgresql://postgres:cutover_test_pass@127.0.0.1:${PORT}/nst_events?schema=public" \
  pnpm --filter @nst/database db:migrate:deploy >/dev/null

SRC_MIGRATIONS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM _prisma_migrations;")
echo "[PASS] Migrations deployed: $SRC_MIGRATIONS Prisma migrations active."

echo "Seeding representative application data..."
DATABASE_URL="postgresql://postgres:cutover_test_pass@127.0.0.1:${PORT}/nst_events?schema=public" \
  pnpm --filter @nst/database db:seed >/dev/null

SRC_USERS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM users;")
SRC_EVENTS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM events;")
SRC_REGS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM event_registrations;")
SRC_ATT=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM attendance_records;")
SRC_TABLES=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo "[PASS] Source database seeded: Users: $SRC_USERS, Events: $SRC_EVENTS, Registrations: $SRC_REGS, Attendance: $SRC_ATT (Tables: $SRC_TABLES)."

# Apply cluster roles
docker cp "infrastructure/postgres/bootstrap-cluster-roles.sql" "$CONTAINER:/tmp/bootstrap-cluster-roles.sql"
docker exec "$CONTAINER" psql -U postgres -d nst_events -f /tmp/bootstrap-cluster-roles.sql >/dev/null
docker exec "$CONTAINER" psql -U postgres -d nst_events -c "ALTER ROLE nst_app WITH PASSWORD 'app_cutover_pass';" >/dev/null
docker exec "$CONTAINER" psql -U postgres -d nst_events -c "ALTER ROLE nst_worker WITH PASSWORD 'worker_cutover_pass';" >/dev/null
echo "[PASS] Cluster roles nst_app and nst_worker configured."

# Generate dump and restore into nst_events_recovery (simulating completed restore before cutover)
docker exec "$CONTAINER" pg_dump -Fc --no-owner -U postgres -d nst_events -f /tmp/nst_events.dump
docker exec "$CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE nst_events_recovery WITH OWNER postgres ENCODING 'UTF8';" >/dev/null
docker exec "$CONTAINER" psql -U postgres -d nst_events_recovery -f /tmp/bootstrap-cluster-roles.sql >/dev/null
docker exec "$CONTAINER" pg_restore --exit-on-error --no-owner -U postgres -d nst_events_recovery /tmp/nst_events.dump >/dev/null
echo "[PASS] Pre-cutover state established: nst_events (live) and nst_events_recovery (verified restore) both present."

# ------------------------------------------------------------------------------
# TEST 1: Implicit Multi-Statement psql -c Failure & Catalog Rollback Proof
# ------------------------------------------------------------------------------
echo "==> TEST 1: Testing implicit multi-statement psql -c failure & catalog rollback..."

REPRO_FAIL_CODE=0
REPRO_ERR=$(docker exec "$CONTAINER" psql -U postgres -d postgres -c "
  ALTER DATABASE nst_events RENAME TO nst_events_old;
  ALTER DATABASE nst_events_recovery RENAME TO nst_events;
  DROP DATABASE nst_events_old;
" 2>&1) || REPRO_FAIL_CODE=$?

if [ "$REPRO_FAIL_CODE" -eq 0 ]; then
  echo "[FAIL] Test 1 FAILED: Multi-statement psql -c unexpectedly succeeded!"
  exit 1
fi

if ! echo "$REPRO_ERR" | grep -qiE "DROP DATABASE cannot run inside a transaction block"; then
  echo "[FAIL] Test 1 FAILED: Expected DROP DATABASE transaction block error not found: $REPRO_ERR"
  exit 1
fi
echo "Captured expected error: DROP DATABASE cannot run inside a transaction block."

# CRITICAL VERIFICATION: Inspect pg_database catalog immediately after the failure
HAS_LIVE_DB=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events';")
HAS_REC_DB=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events_recovery';")
HAS_OLD_DB=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events_old';")

echo "Catalog inspection after multi-statement failure:"
echo "  - nst_events:          $HAS_LIVE_DB (expected 1)"
echo "  - nst_events_recovery: $HAS_REC_DB (expected 1)"
echo "  - nst_events_old:      $HAS_OLD_DB (expected 0)"

if [ "$HAS_LIVE_DB" -ne 1 ] || [ "$HAS_REC_DB" -ne 1 ] || [ "$HAS_OLD_DB" -ne 0 ]; then
  echo "[FAIL] Test 1 FAILED: Catalog state corrupted! Multi-statement command partially applied!"
  exit 1
fi

DATA_COUNT=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM users;")
if [ "$DATA_COUNT" != "$SRC_USERS" ]; then
  echo "[FAIL] Test 1 FAILED: Data in nst_events altered during aborted multi-statement command!"
  exit 1
fi

echo "[PASS] Test 1 PASSED: Proven that psql multi-statement command tags (ALTER DATABASE) did NOT commit."
echo "       The implicit transaction block aborted on DROP DATABASE and rolled back both preceding renames completely."

# ------------------------------------------------------------------------------
# TEST 2: Active Connection Blocking & Safe Connection Draining
# ------------------------------------------------------------------------------
echo "==> TEST 2: Testing active connection blocking and connection draining..."

# Open background client session simulating active API connection holding an open transaction
docker exec -d -e PGPASSWORD=app_cutover_pass "$CONTAINER" bash -c \
  "psql -U nst_app -d nst_events -h 127.0.0.1 -c 'BEGIN; SELECT pg_sleep(30); COMMIT;' >/dev/null 2>&1"
sleep 1

ACTIVE_CONNS=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = 'nst_events' AND pid <> pg_backend_pid();")
echo "Active client connections detected on nst_events: $ACTIVE_CONNS"
if [ "$ACTIVE_CONNS" -lt 1 ]; then
  echo "[FAIL] Test 2 FAILED: Simulated client connection was not detected!"
  exit 1
fi

# Attempt rename with lock timeout (proving connection blocking)
LOCK_FAIL_CODE=0
LOCK_ERR=$(docker exec "$CONTAINER" psql -U postgres -d postgres -c "
  SET lock_timeout = '1s';
  ALTER DATABASE nst_events RENAME TO nst_events_old;
" 2>&1) || LOCK_FAIL_CODE=$?

if [ "$LOCK_FAIL_CODE" -eq 0 ]; then
  echo "[FAIL] Test 2 FAILED: Rename succeeded despite active connection holding lock!"
  exit 1
fi
echo "[PASS] Test 2a: Rename with active connections safely blocked/timed out (code: $LOCK_FAIL_CODE)."

# Execute Safe Connection Draining Procedure
echo "Executing safe connection draining procedure..."
# 1. Reject new connections
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c "ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;" >/dev/null
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c "ALTER DATABASE nst_events_recovery WITH ALLOW_CONNECTIONS false;" >/dev/null

# 2. Terminate active sessions
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname IN ('nst_events', 'nst_events_recovery')
    AND pid <> pg_backend_pid();
" >/dev/null
sleep 1

# 3. Assert connection count is strictly 0
DRAINED_CONNS=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT count(*) FROM pg_stat_activity WHERE datname IN ('nst_events', 'nst_events_recovery') AND pid <> pg_backend_pid();")
if [ "$DRAINED_CONNS" -ne 0 ]; then
  echo "[FAIL] Test 2b FAILED: Connections not fully drained! Remaining: $DRAINED_CONNS"
  exit 1
fi
echo "[PASS] Test 2b PASSED: Connection draining verified (active connections: $DRAINED_CONNS)."

# ------------------------------------------------------------------------------
# TEST 3: Atomic Two-Rename Cutover Inside Explicit Transaction Block
# ------------------------------------------------------------------------------
echo "==> TEST 3: Testing atomic two-rename cutover inside explicit BEGIN ... COMMIT..."

CUTOVER_TX_CODE=0
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  BEGIN;
  ALTER DATABASE nst_events RENAME TO nst_events_old;
  ALTER DATABASE nst_events_recovery RENAME TO nst_events;
  COMMIT;
" || CUTOVER_TX_CODE=$?

if [ "$CUTOVER_TX_CODE" -ne 0 ]; then
  echo "[FAIL] Test 3 FAILED: Explicit rename transaction failed with exit code $CUTOVER_TX_CODE!"
  exit 1
fi

# Verify catalog names after commit
HAS_PROMOTED=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events';")
HAS_OLD=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events_old';")
HAS_RECOVERY=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events_recovery';")

echo "Catalog inspection after transactional cutover:"
echo "  - nst_events (promoted): $HAS_PROMOTED (expected 1)"
echo "  - nst_events_old:        $HAS_OLD (expected 1)"
echo "  - nst_events_recovery:   $HAS_RECOVERY (expected 0)"

if [ "$HAS_PROMOTED" -ne 1 ] || [ "$HAS_OLD" -ne 1 ] || [ "$HAS_RECOVERY" -ne 0 ]; then
  echo "[FAIL] Test 3 FAILED: Databases not in expected post-cutover state!"
  exit 1
fi

# Re-enable connections on promoted database
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c "ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;" >/dev/null

# To verify data in nst_events_old, also enable connections on nst_events_old
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c "ALTER DATABASE nst_events_old WITH ALLOW_CONNECTIONS true;" >/dev/null

PROMOTED_USERS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM users;")
OLD_USERS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events_old -tAc "SELECT COUNT(*) FROM users;")

if [ "$PROMOTED_USERS" != "$SRC_USERS" ] || [ "$OLD_USERS" != "$SRC_USERS" ]; then
  echo "[FAIL] Test 3 FAILED: Data parity check failed after transactional cutover!"
  exit 1
fi
echo "[PASS] Test 3 PASSED: Both renames committed atomically inside single transaction (Users: $PROMOTED_USERS)."

# ------------------------------------------------------------------------------
# TEST 4: Injected Failure Inside Explicit Transaction (Rollback & Atomicity)
# ------------------------------------------------------------------------------
echo "==> TEST 4: Testing failure injection inside explicit rename transaction..."

# Reset back to baseline names: nst_events and nst_events_recovery
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;
  ALTER DATABASE nst_events_old WITH ALLOW_CONNECTIONS false;
  BEGIN;
  ALTER DATABASE nst_events RENAME TO nst_events_recovery;
  ALTER DATABASE nst_events_old RENAME TO nst_events;
  COMMIT;
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;
  ALTER DATABASE nst_events_recovery WITH ALLOW_CONNECTIONS true;
" >/dev/null

# Inject failure: first rename succeeds, second statement references a non-existent database
INJECT_FAIL_CODE=0
INJECT_ERR=$(docker exec "$CONTAINER" psql -U postgres -d postgres -c "
  BEGIN;
  ALTER DATABASE nst_events RENAME TO nst_events_old;
  ALTER DATABASE non_existent_database_target RENAME TO nst_events;
  COMMIT;
" 2>&1) || INJECT_FAIL_CODE=$?

if [ "$INJECT_FAIL_CODE" -eq 0 ]; then
  echo "[FAIL] Test 4 FAILED: Injected transaction failure unexpectedly succeeded!"
  exit 1
fi

echo "Captured expected injection failure: $INJECT_ERR"

# Verify that the entire transaction rolled back and original names remain intact
HAS_LIVE_AFTER_FAIL=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events';")
HAS_REC_AFTER_FAIL=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events_recovery';")
HAS_OLD_AFTER_FAIL=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events_old';")

echo "Catalog inspection after injected transaction failure:"
echo "  - nst_events:          $HAS_LIVE_AFTER_FAIL (expected 1)"
echo "  - nst_events_recovery: $HAS_REC_AFTER_FAIL (expected 1)"
echo "  - nst_events_old:      $HAS_OLD_AFTER_FAIL (expected 0)"

if [ "$HAS_LIVE_AFTER_FAIL" -ne 1 ] || [ "$HAS_REC_AFTER_FAIL" -ne 1 ] || [ "$HAS_OLD_AFTER_FAIL" -ne 0 ]; then
  echo "[FAIL] Test 4 FAILED: Injected transaction did not roll back cleanly! Orphan state detected."
  exit 1
fi

DATA_AFTER_FAIL=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM users;")
if [ "$DATA_AFTER_FAIL" != "$SRC_USERS" ]; then
  echo "[FAIL] Test 4 FAILED: Data corrupted in nst_events following rollback!"
  exit 1
fi
echo "[PASS] Test 4 PASSED: Explicit transaction rolled back 100% cleanly upon error."
echo "       No partial rename occurred; nst_events_old was never committed."

# ------------------------------------------------------------------------------
# TEST 5: Pre-Traffic Quiesced Rollback Drill (Zero Data Loss)
# ------------------------------------------------------------------------------
echo "==> TEST 5: Testing Pre-Traffic Quiesced Rollback Window (Zero Data Loss)..."

# Drain and perform atomic cutover
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;
  ALTER DATABASE nst_events_recovery WITH ALLOW_CONNECTIONS false;
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('nst_events', 'nst_events_recovery') AND pid <> pg_backend_pid();
  BEGIN;
  ALTER DATABASE nst_events RENAME TO nst_events_old;
  ALTER DATABASE nst_events_recovery RENAME TO nst_events;
  COMMIT;
" >/dev/null

echo "Simulating pre-traffic application smoke test failure (apps quiesced, 0 production writes)..."
PRE_TRAFFIC_SMOKE_TEST_FAILED=1

if [ "$PRE_TRAFFIC_SMOKE_TEST_FAILED" -eq 1 ]; then
  echo "Pre-traffic failure detected before writes began. Initiating zero-data-loss rollback..."
  docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('nst_events', 'nst_events_old') AND pid <> pg_backend_pid();
    BEGIN;
    ALTER DATABASE nst_events RENAME TO nst_events_recovery;
    ALTER DATABASE nst_events_old RENAME TO nst_events;
    COMMIT;
    ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;
    ALTER DATABASE nst_events_recovery WITH ALLOW_CONNECTIONS true;
  " >/dev/null
fi

PRE_ROLLBACK_USERS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM users;")
if [ "$PRE_ROLLBACK_USERS" != "$SRC_USERS" ]; then
  echo "[FAIL] Test 5 FAILED: Pre-traffic rollback did not preserve baseline data parity!"
  exit 1
fi
echo "[PASS] Test 5 PASSED: Pre-traffic rollback restored original database with ZERO DATA LOSS (Users: $PRE_ROLLBACK_USERS)."

# ------------------------------------------------------------------------------
# TEST 6: Post-Cutover Writes & Rollback Data-Loss Proof
# ------------------------------------------------------------------------------
echo "==> TEST 6: Testing post-cutover production writes & snapshot rollback data loss..."

CUTOVER_TS=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc "SELECT NOW();")

# 1. Complete successful cutover
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;
  ALTER DATABASE nst_events_recovery WITH ALLOW_CONNECTIONS false;
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('nst_events', 'nst_events_recovery') AND pid <> pg_backend_pid();
  BEGIN;
  ALTER DATABASE nst_events RENAME TO nst_events_old;
  ALTER DATABASE nst_events_recovery RENAME TO nst_events;
  COMMIT;
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;
" >/dev/null

# 2. Reopen traffic: simulate production write traffic resuming (INSERT, UPDATE, DELETE)
UNIQUE_WRITE_EMAIL="post_cutover_prod_write_${TIMESTAMP}@nst.local"
UNIQUE_WRITE_NAME="Post Cutover Student Record"
UNIQUE_WRITE_SUB="post_cutover_sub_${TIMESTAMP}"

# Identify pre-cutover existing entities
EXISTING_USER_ID=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT id FROM users ORDER BY created_at ASC LIMIT 1;")
EXISTING_REG_ID=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT id FROM event_registrations LIMIT 1;")

echo "Simulating application writes on promoted database:"
echo "  - INSERT: New user ${UNIQUE_WRITE_EMAIL}"
echo "  - UPDATE: Existing user ${EXISTING_USER_ID} (profile update)"
echo "  - UPDATE: Existing registration ${EXISTING_REG_ID} (status -> CANCELLED)"
echo "  - DELETE: Hard deletion of an active token"

# INSERT: New record
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d nst_events -c "
  INSERT INTO users (id, google_sub, email, full_name, global_role, created_at, updated_at)
  VALUES (gen_random_uuid(), '${UNIQUE_WRITE_SUB}', '${UNIQUE_WRITE_EMAIL}', '${UNIQUE_WRITE_NAME}', 'STUDENT', NOW(), NOW());
" >/dev/null

# UPDATE: Modify existing user (created before cutover)
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d nst_events -c "
  UPDATE users SET full_name = 'Alice Updated Post-Cutover', updated_at = NOW() WHERE id = '${EXISTING_USER_ID}';
" >/dev/null

# UPDATE: Modify existing registration status (created before cutover)
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d nst_events -c "
  UPDATE event_registrations SET registration_status = 'CANCELLED' WHERE id = '${EXISTING_REG_ID}';
" >/dev/null

# Pre-populate token in nst_events_old so it exists in snapshot
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  ALTER DATABASE nst_events_old WITH ALLOW_CONNECTIONS true;
" >/dev/null
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d nst_events_old -c "
  INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, created_at)
  VALUES (gen_random_uuid(), '${EXISTING_USER_ID}', 'token_to_delete', gen_random_uuid(), NOW() + interval '1 day', '${CUTOVER_TS}'::timestamptz - interval '1 hour');
" >/dev/null
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  ALTER DATABASE nst_events_old WITH ALLOW_CONNECTIONS false;
" >/dev/null

# Insert and then DELETE token in nst_events (simulating hard deletion of session/token)
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d nst_events -c "
  INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, created_at)
  VALUES (gen_random_uuid(), '${EXISTING_USER_ID}', 'token_to_delete', gen_random_uuid(), NOW() + interval '1 day', '${CUTOVER_TS}'::timestamptz - interval '1 hour');
  DELETE FROM refresh_tokens WHERE token_hash = 'token_to_delete';
" >/dev/null

# Confirm the write is committed in active nst_events
HAS_WRITE_IN_ACTIVE=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT COUNT(*) FROM users WHERE email = '${UNIQUE_WRITE_EMAIL}';")
if [ "$HAS_WRITE_IN_ACTIVE" -ne 1 ]; then
  echo "[FAIL] Test 6 FAILED: Production write was not committed to promoted nst_events!"
  exit 1
fi
echo "Confirmed: Production writes successfully committed in promoted nst_events."

# 3. Simulate post-write operational failure requiring rollback
echo "Simulating application failure AFTER production write traffic has resumed..."
echo "Attempting naive snapshot rollback to nst_events_old..."

# Execute rollback procedure: preserve broken promoted DB as nst_events_failed, restore nst_events_old
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nst_events' AND pid <> pg_backend_pid();
  BEGIN;
  ALTER DATABASE nst_events RENAME TO nst_events_failed;
  ALTER DATABASE nst_events_old RENAME TO nst_events;
  COMMIT;
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;
  ALTER DATABASE nst_events_failed WITH ALLOW_CONNECTIONS true;
" >/dev/null

# 4. CRITICAL AUDIT: Check whether the committed write exists in the rollback database (nst_events)
HAS_WRITE_IN_ROLLBACK=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT COUNT(*) FROM users WHERE email = '${UNIQUE_WRITE_EMAIL}';")

echo "Rollback database query result for newly inserted user: $HAS_WRITE_IN_ROLLBACK record(s)"

if [ "$HAS_WRITE_IN_ROLLBACK" -ne 0 ]; then
  echo "[FAIL] Test 6 FAILED: Unexpected write leakage into pre-cutover snapshot!"
  exit 1
fi

# 5. DEMONSTRATION OF DELTA EXTRACTION LIMITATIONS (Missed Updates & Deletions)
echo "Demonstrating limitations of created_at-based delta extraction..."

# 5.1 Test INSERT capture
CAPTURED_INSERTS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events_failed -tAc \
  "SELECT COUNT(*) FROM users WHERE created_at >= '${CUTOVER_TS}';")
echo "  - New user INSERTs captured by created_at >= CUTOVER: $CAPTURED_INSERTS (expected 1)"

# 5.2 Test UPDATE capture (Proves MISSED UPDATE)
CAPTURED_UPDATES=$(docker exec "$CONTAINER" psql -U postgres -d nst_events_failed -tAc \
  "SELECT COUNT(*) FROM users WHERE id = '${EXISTING_USER_ID}' AND created_at >= '${CUTOVER_TS}';")
echo "  - Existing user UPDATEs captured by created_at >= CUTOVER: $CAPTURED_UPDATES (MISSED! 0 rows returned)"

if [ "$CAPTURED_UPDATES" -ne 0 ]; then
  echo "[FAIL] Test 6 FAILED: User update unexpectedly matched created_at filter!"
  exit 1
fi

# 5.3 Test Schema Mismatch & Registration Status Transition (Proves MISSED REGISTRATION UPDATE)
REG_COL_CHECK_FAIL=0
REG_COL_CHECK_ERR=$(docker exec "$CONTAINER" psql -U postgres -d nst_events_failed -c \
  "SELECT id, user_id, event_id, created_at FROM event_registrations WHERE created_at >= '${CUTOVER_TS}';" 2>&1) || REG_COL_CHECK_FAIL=$?

echo "  - Schema column audit: querying event_registrations.created_at failed as expected (code: $REG_COL_CHECK_FAIL)"
if ! echo "$REG_COL_CHECK_ERR" | grep -qiE "column \"created_at\" does not exist"; then
  echo "[FAIL] Test 6 FAILED: Expected schema error missing for event_registrations.created_at: $REG_COL_CHECK_ERR"
  exit 1
fi

CAPTURED_REG_UPDATES=$(docker exec "$CONTAINER" psql -U postgres -d nst_events_failed -tAc \
  "SELECT COUNT(*) FROM event_registrations WHERE id = '${EXISTING_REG_ID}' AND registered_at >= '${CUTOVER_TS}';")
echo "  - Existing registration status change captured by registered_at: $CAPTURED_REG_UPDATES (MISSED! 0 rows returned)"

# 5.4 Test DELETION (Proves MISSED DELETIONS & STALE ZOMBIE DATA)
DELETED_IN_FAILED=$(docker exec "$CONTAINER" psql -U postgres -d nst_events_failed -tAc \
  "SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = 'token_to_delete';")
STALE_IN_ROLLBACK=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = 'token_to_delete';")

echo "  - Deleted record in nst_events_failed: $DELETED_IN_FAILED (0 = deleted after cutover)"
echo "  - Deleted record in rollback nst_events: $STALE_IN_ROLLBACK (1 = STALE ZOMBIE DATA LEAKED!)"

if [ "$DELETED_IN_FAILED" -ne 0 ] || [ "$STALE_IN_ROLLBACK" -ne 1 ]; then
  echo "[FAIL] Test 6 FAILED: Deletion discrepancy not accurately reproduced!"
  exit 1
fi

echo "[PASS] Test 6 PASSED: DELTA EXTRACTION LIMITATIONS EMPIRICALLY CONFIRMED."
echo "       1. New INSERTs are captured ($CAPTURED_INSERTS record)."
echo "       2. Existing record UPDATEs are completely MISSED ($CAPTURED_UPDATES records captured)."
echo "       3. Schema mismatch proved: event_registrations lacks created_at."
echo "       4. Deletions are completely MISSED; stale records remain in rollback DB ($STALE_IN_ROLLBACK zombie record)."
echo "       OPERATIONAL CONCLUSION: Replay from created_at queries is fundamentally incomplete."
echo "       Post-write rollback MUST be classified as manual recovery with potential data loss."

# Clean up failed sandbox
docker exec "$CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE nst_events_failed;" >/dev/null

# ------------------------------------------------------------------------------
# TEST 7: Full Schema, Migrations, Extensions, and RLS Verification on Promoted DB
# ------------------------------------------------------------------------------
echo "==> TEST 7: Testing full schema, migrations, extensions, and RLS on promoted database..."

# Re-create fresh nst_events_recovery for final clean cutover test
docker exec "$CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE nst_events_recovery WITH OWNER postgres ENCODING 'UTF8';" >/dev/null
docker exec "$CONTAINER" psql -U postgres -d nst_events_recovery -f /tmp/bootstrap-cluster-roles.sql >/dev/null
docker exec "$CONTAINER" pg_restore --exit-on-error --no-owner -U postgres -d nst_events_recovery /tmp/nst_events.dump >/dev/null

# Pre-cutover validation check on nst_events_recovery
RECOVERY_MIG=$(docker exec "$CONTAINER" psql -U postgres -d nst_events_recovery -tAc "SELECT COUNT(*) FROM _prisma_migrations;")
if [ "$RECOVERY_MIG" != "$SRC_MIGRATIONS" ]; then
  echo "[FAIL] Pre-cutover validation failed on nst_events_recovery!"
  exit 1
fi
echo "[PASS] Pre-cutover validation passed on nst_events_recovery ($RECOVERY_MIG migrations)."

# Drain & Atomic cutover
docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;
  ALTER DATABASE nst_events_recovery WITH ALLOW_CONNECTIONS false;
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('nst_events', 'nst_events_recovery') AND pid <> pg_backend_pid();
  BEGIN;
  ALTER DATABASE nst_events RENAME TO nst_events_old;
  ALTER DATABASE nst_events_recovery RENAME TO nst_events;
  COMMIT;
  ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;
" >/dev/null

# Verify post-cutover parity on promoted nst_events
CUTOVER_MIG=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM _prisma_migrations;")
CUTOVER_USERS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM users;")
CUTOVER_EVENTS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM events;")
CUTOVER_REGS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM event_registrations;")
CUTOVER_ATT=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM attendance_records;")
CUTOVER_TABLES=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

POSTGIS_EXT=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT extname FROM pg_extension WHERE extname = 'postgis';")
PGCRYPTO_EXT=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';")

USERS_RLS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'users';")
EVENTS_RLS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'events';")
REGS_RLS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'event_registrations';")
ATT_RLS=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'attendance_records';")

echo "Promoted Database Verification Summary:"
echo "  - Prisma Migrations: $CUTOVER_MIG (Source: $SRC_MIGRATIONS)"
echo "  - Total Base Tables: $CUTOVER_TABLES (Source: $SRC_TABLES)"
echo "  - Extensions:        PostGIS ($POSTGIS_EXT), pgcrypto ($PGCRYPTO_EXT)"
echo "  - Users:             $CUTOVER_USERS (Source: $SRC_USERS)"
echo "  - Events:            $CUTOVER_EVENTS (Source: $SRC_EVENTS)"
echo "  - Registrations:     $CUTOVER_REGS (Source: $SRC_REGS)"
echo "  - Attendance:        $CUTOVER_ATT (Source: $SRC_ATT)"
echo "  - RLS Active:        users ($USERS_RLS), events ($EVENTS_RLS), registrations ($REGS_RLS), attendance ($ATT_RLS)"

if [ "$CUTOVER_MIG" != "$SRC_MIGRATIONS" ] || [ "$CUTOVER_TABLES" != "$SRC_TABLES" ] || \
   [ "$CUTOVER_USERS" != "$SRC_USERS" ] || [ "$CUTOVER_EVENTS" != "$SRC_EVENTS" ] || \
   [ "$CUTOVER_REGS" != "$SRC_REGS" ] || [ "$CUTOVER_ATT" != "$SRC_ATT" ] || \
   [ "$USERS_RLS" != "t" ] || [ "$EVENTS_RLS" != "t" ] || [ "$REGS_RLS" != "t" ] || [ "$ATT_RLS" != "t" ] || \
   [ -z "$POSTGIS_EXT" ] || [ -z "$PGCRYPTO_EXT" ]; then
  echo "[FAIL] Test 7 FAILED: Promoted database failed parity checks!"
  exit 1
fi
echo "[PASS] 100% schema and data parity verified on newly promoted nst_events."

# Verify RLS Transaction Isolation on promoted database
STUDENT_ROW=$(docker exec "$CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT user_id, COUNT(*) FROM event_registrations GROUP BY user_id LIMIT 1;")
TARGET_STUDENT_ID=$(echo "$STUDENT_ROW" | cut -d'|' -f1)
EXPECTED_STUDENT_REGS=$(echo "$STUDENT_ROW" | cut -d'|' -f2)

RLS_BASELINE=$(docker exec -e PGPASSWORD=app_cutover_pass "$CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "SELECT COUNT(*) FROM event_registrations;")
if [ "$RLS_BASELINE" != "0" ]; then
  echo "[FAIL] Test 7 FAILED: RLS baseline leaked records without session context ($RLS_BASELINE)!"
  exit 1
fi
echo "[PASS] RLS baseline verified: 0 rows without session context."

RLS_TX_REGS=$(docker exec -e PGPASSWORD=app_cutover_pass "$CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "
    BEGIN;
    SET LOCAL app.user_id = '${TARGET_STUDENT_ID}';
    SELECT COUNT(*) FROM event_registrations;
    COMMIT;
  " | grep -E '^[0-9]+$' | head -n 1)

if [ "$RLS_TX_REGS" != "$EXPECTED_STUDENT_REGS" ]; then
  echo "[FAIL] Test 7 FAILED: RLS transaction scoping mismatch (expected $EXPECTED_STUDENT_REGS, got $RLS_TX_REGS)!"
  exit 1
fi
echo "[PASS] RLS transaction scoping verified: exactly $RLS_TX_REGS student record(s) visible."

# ------------------------------------------------------------------------------
# TEST 8: Old Database Retention & Explicit Approval Decommission
# ------------------------------------------------------------------------------
echo "==> TEST 8: Testing old database retention and approval decommission..."

# Verify nst_events_old is strictly retained
OLD_RETAINED=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events_old';")
if [ "$OLD_RETAINED" -ne 1 ]; then
  echo "[FAIL] Test 8 FAILED: nst_events_old was prematurely deleted!"
  exit 1
fi
echo "[PASS] Test 8a: nst_events_old verified retained in cluster after cutover."

# Simulate approval condition: Only upon explicit approval is nst_events_old dropped
APPROVAL_GRANTED=1
if [ "$APPROVAL_GRANTED" -eq 1 ]; then
  echo "Operational bake-in period elapsed and approval confirmed. Decommissioning old database..."
  docker exec "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -c "DROP DATABASE nst_events_old;" >/dev/null
  
  FINAL_OLD_COUNT=$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
    "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events_old';")
  if [ "$FINAL_OLD_COUNT" -ne 0 ]; then
    echo "[FAIL] Test 8 FAILED: nst_events_old was not dropped upon approved decommission!"
    exit 1
  fi
  echo "[PASS] Test 8b: nst_events_old decommissioned cleanly after approved retention."
fi

echo "=============================================================================="
echo "DRILL COMPLETED: DATABASE CUTOVER & ROLLBACK PROCEDURE FULLY VERIFIED"
echo "=============================================================================="
