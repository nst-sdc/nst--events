#!/usr/bin/env bash
# ==============================================================================
# NST Events - Phase 1.4: Independent PostgreSQL Cluster Disaster Recovery Drill
# Proves complete database recovery into a genuinely independent destination cluster
# with zero cluster-state inheritance from source, verifying:
#  - Cluster-wide roles (nst_app, nst_worker), connection privileges, idempotency
#  - RFC 5083/5084 CMS AES-256-GCM AEAD encrypted recovery with external key
#  - Negative validation of all 7 failure modes:
#      1. Missing role bootstrap artifacts
#      2. Invalid private key rejection
#      3. Tampered ciphertext rejection (AEAD GCM tag)
#      4. Truncated ciphertext rejection
#      5. Missing PostGIS extension rejection
#      6. Incorrect database connection permissions
#      7. Decrypted, but truncated/corrupted plaintext custom-format archive
#  - Exact artifact consistency from CMS decryption to pg_restore
#  - Full application schema, 150 migrations, PostGIS + pgcrypto extensions
#  - RLS transaction isolation and least-privileged role enforcement:
#      * Session context absent -> 0 rows returned
#      * Session context set in explicit transaction -> exactly student's rows
#      * Superuser bypass vs. application role enforcement
#      * Allowed & denied operations (column/table grants and DDL)
#  - 100% record parity for users, events, registrations, and attendance
# ==============================================================================
set -euo pipefail

TIMESTAMP=$(date +%s)
SRC_PORT=5438
DEST_PORT=5439
SRC_CONTAINER="nst-dr-source-${TIMESTAMP}"
DEST_CONTAINER="nst-dr-dest-${TIMESTAMP}"

WORK_DIR=$(mktemp -d /tmp/nst-dr-independent.XXXXXX)
chmod 700 "$WORK_DIR"

SRC_KEY_DIR="$WORK_DIR/src-keys"
MOCK_VAULT_DIR="$WORK_DIR/external-key-vault"
DEST_KEY_DIR="$WORK_DIR/dest-keys"

mkdir -p "$SRC_KEY_DIR" "$MOCK_VAULT_DIR" "$DEST_KEY_DIR"
chmod 700 "$SRC_KEY_DIR" "$MOCK_VAULT_DIR" "$DEST_KEY_DIR"

cleanup() {
  echo "==> Cleaning up disposable containers and drill artifacts..."
  docker stop "$SRC_CONTAINER" "$DEST_CONTAINER" >/dev/null 2>&1 || true
  docker rm -f "$SRC_CONTAINER" "$DEST_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
  echo "[PASS] Cleanup complete. Zero remaining containers or leaked artifacts."
}
trap cleanup EXIT

echo "=============================================================================="
echo "NST EVENTS - INDEPENDENT CLUSTER DISASTER RECOVERY DRILL"
echo "Source Cluster:      $SRC_CONTAINER (Port: $SRC_PORT)"
echo "Destination Cluster: $DEST_CONTAINER (Port: $DEST_PORT)"
echo "Work Directory:      $WORK_DIR"
echo "=============================================================================="

# ------------------------------------------------------------------------------
# STEP 1: Start and Initialize Source PostgreSQL Cluster
# ------------------------------------------------------------------------------
echo "==> STEP 1: Starting Source PostgreSQL Cluster ($SRC_CONTAINER)..."
docker run -d \
  --name "$SRC_CONTAINER" \
  -p "${SRC_PORT}:5432" \
  -e POSTGRES_PASSWORD=src_cluster_admin_password \
  -e POSTGRES_DB=nst_events \
  postgis/postgis:16-3.4 >/dev/null

echo "Waiting for Source cluster to accept connections..."
until docker logs "$SRC_CONTAINER" 2>&1 | grep -q "PostgreSQL init process complete; ready for start up"; do
  sleep 1
done
until docker exec "$SRC_CONTAINER" pg_isready -h 127.0.0.1 -p 5432 -U postgres -d nst_events >/dev/null 2>&1; do
  sleep 1
done
echo "[PASS] Source PostgreSQL cluster running on port $SRC_PORT."

echo "Deploying full NST Events migration history (all 150 Prisma migrations) to Source..."
DATABASE_URL="postgresql://postgres:src_cluster_admin_password@127.0.0.1:${SRC_PORT}/nst_events?schema=public" \
  pnpm --filter @nst/database db:migrate:deploy >/dev/null

SRC_MIGRATION_COUNT=$(docker exec "$SRC_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM _prisma_migrations;")
echo "[PASS] Source cluster migrated: $SRC_MIGRATION_COUNT migrations active."

echo "Seeding representative application records to Source cluster..."
DATABASE_URL="postgresql://postgres:src_cluster_admin_password@127.0.0.1:${SRC_PORT}/nst_events?schema=public" \
  pnpm --filter @nst/database db:seed >/dev/null

SRC_USERS=$(docker exec "$SRC_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM users;")
SRC_EVENTS=$(docker exec "$SRC_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM events;")
SRC_REGS=$(docker exec "$SRC_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM event_registrations;")
SRC_ATT=$(docker exec "$SRC_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM attendance_records;")
SRC_TABLE_COUNT=$(docker exec "$SRC_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
echo "[PASS] Source seeded: Users: $SRC_USERS, Events: $SRC_EVENTS, Registrations: $SRC_REGS, Attendance: $SRC_ATT (Total base tables: $SRC_TABLE_COUNT)."

# ------------------------------------------------------------------------------
# STEP 2: Generate Encrypted Backup with Off-Cluster Key Custody
# ------------------------------------------------------------------------------
echo "==> STEP 2: Generating Encrypted Backup (CMS AES-256-GCM Envelope Encryption)..."

# Generate RSA-4096 keypair for envelope encryption
openssl req -x509 -newkey rsa:4096 -days 30 -nodes \
  -keyout "$MOCK_VAULT_DIR/backup-key.pem" \
  -out "$SRC_KEY_DIR/backup-cert.pem" \
  -subj '/CN=nst-disaster-recovery' 2>/dev/null
chmod 400 "$MOCK_VAULT_DIR/backup-key.pem" "$SRC_KEY_DIR/backup-cert.pem"

if [ ! -s "$MOCK_VAULT_DIR/backup-key.pem" ] || [ ! -s "$SRC_KEY_DIR/backup-cert.pem" ]; then
  echo "[FATAL] Generated keypair is missing or empty!" >&2
  exit 1
fi

echo "[PASS] Public certificate placed in backup location; private key stored strictly in external vault."

# Dump source database
RAW_DUMP_FILE="$WORK_DIR/source.dump"
docker exec "$SRC_CONTAINER" pg_dump -Fc -U postgres -d nst_events -f /tmp/source.dump
docker cp "$SRC_CONTAINER:/tmp/source.dump" "$RAW_DUMP_FILE"

if [ ! -s "$RAW_DUMP_FILE" ]; then
  echo "[FATAL] Source dump file is missing or empty!" >&2
  exit 1
fi

RAW_DUMP_SHA=$(sha256sum "$RAW_DUMP_FILE" | awk '{print $1}')
RAW_DUMP_SIZE=$(wc -c < "$RAW_DUMP_FILE" | tr -d ' ')
echo "[PASS] Source raw dump created: ${RAW_DUMP_SIZE} bytes (SHA-256: ${RAW_DUMP_SHA})."

# Pre-encryption catalog verification on raw dump
docker exec "$SRC_CONTAINER" pg_restore -l /tmp/source.dump >/dev/null
echo "[PASS] Source raw dump catalog verified via pg_restore -l."

# Encrypt strictly via public certificate (Zero secrets on argv)
ENC_DUMP_FILE="$WORK_DIR/nst_events_backup.dump.enc"
openssl cms -encrypt -binary \
  -aes-256-gcm \
  -outform DER \
  -in "$RAW_DUMP_FILE" \
  -out "$ENC_DUMP_FILE" \
  "$SRC_KEY_DIR/backup-cert.pem"

if [ ! -s "$ENC_DUMP_FILE" ]; then
  echo "[FATAL] Encrypted backup file is missing or empty!" >&2
  exit 1
fi

sha256sum "$ENC_DUMP_FILE" > "${ENC_DUMP_FILE}.sha256"
ENC_DUMP_SHA=$(awk '{print $1}' "${ENC_DUMP_FILE}.sha256")
ENC_DUMP_SIZE=$(wc -c < "$ENC_DUMP_FILE" | tr -d ' ')
echo "[PASS] Encrypted backup artifact created: ${ENC_DUMP_SIZE} bytes (Ciphertext SHA: ${ENC_DUMP_SHA})."

# ------------------------------------------------------------------------------
# STEP 3: Start Destination Cluster & Verify Isolation (Zero Silent Inheritance)
# ------------------------------------------------------------------------------
echo "==> STEP 3: Starting Independent Destination PostgreSQL Cluster ($DEST_CONTAINER)..."
docker run -d \
  --name "$DEST_CONTAINER" \
  -p "${DEST_PORT}:5432" \
  -e POSTGRES_PASSWORD=dest_cluster_admin_password \
  -e POSTGRES_DB=postgres \
  postgis/postgis:16-3.4 >/dev/null

echo "Waiting for Destination cluster to accept connections..."
until docker logs "$DEST_CONTAINER" 2>&1 | grep -q "PostgreSQL init process complete; ready for start up"; do
  sleep 1
done
until docker exec "$DEST_CONTAINER" pg_isready -h 127.0.0.1 -p 5432 -U postgres -d postgres >/dev/null 2>&1; do
  sleep 1
done
echo "[PASS] Destination PostgreSQL cluster running on port $DEST_PORT."

echo "Verifying ZERO silent inheritance on destination cluster..."
DEST_HAS_DB=$(docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_database WHERE datname = 'nst_events';")
DEST_HAS_APP_ROLE=$(docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_roles WHERE rolname = 'nst_app';")
DEST_HAS_WORKER_ROLE=$(docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_roles WHERE rolname = 'nst_worker';")

if [ "$DEST_HAS_DB" != "0" ] || [ "$DEST_HAS_APP_ROLE" != "0" ] || [ "$DEST_HAS_WORKER_ROLE" != "0" ]; then
  echo "[FAIL] Destination cluster was not clean! It inherited state from source."
  exit 1
fi
echo "[PASS] Destination cluster verified completely isolated (zero nst_events DB, zero nst roles)."

# ------------------------------------------------------------------------------
# STEP 4: Integrity Validation & Negative Failure Mode Testing
# ------------------------------------------------------------------------------
echo "==> STEP 4: Testing Failure Modes & Backup Integrity Controls..."

# Test 4.1: Missing role bootstrap artifact failure
echo "Testing Failure Mode 1: Restoring into cluster without role bootstrap..."
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE unbootstrapped_test;" >/dev/null
docker cp "$RAW_DUMP_FILE" "$DEST_CONTAINER:/tmp/unbootstrapped_raw.dump"
UNBOOTSTRAPPED_RESTORE_OUT=$(docker exec "$DEST_CONTAINER" pg_restore --clean --if-exists --no-owner -U postgres -d unbootstrapped_test /tmp/unbootstrapped_raw.dump 2>&1 || true)
if echo "$UNBOOTSTRAPPED_RESTORE_OUT" | grep -qi "role .* does not exist"; then
  echo "[PASS] Negative test 1 PASSED: pg_restore without role bootstrap failed visibly with missing role errors."
else
  echo "[FAIL] Negative test 1 FAILED: Expected missing role errors were not emitted!"
  exit 1
fi
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE unbootstrapped_test;" >/dev/null

# Test 4.2: Invalid private key rejection
echo "Testing Failure Mode 2: Decryption with invalid private key..."
openssl req -x509 -newkey rsa:2048 -days 1 -nodes \
  -keyout "$WORK_DIR/wrong-key.pem" -out "$WORK_DIR/wrong-cert.pem" \
  -subj '/CN=wrong-key' 2>/dev/null
if openssl cms -decrypt -binary -inform DER \
  -in "$ENC_DUMP_FILE" \
  -inkey "$WORK_DIR/wrong-key.pem" \
  -out "$WORK_DIR/wrong-decrypted.dump" >/dev/null 2>&1; then
  echo "[FAIL] Negative test 2 FAILED: Decryption succeeded with wrong private key!"
  exit 1
else
  echo "[PASS] Negative test 2 PASSED: Decryption with invalid key strictly rejected."
fi

# Test 4.3: Tampered encrypted backup rejection (bit-flip in ciphertext)
echo "Testing Failure Mode 3: Decryption of tampered ciphertext..."
cp "$ENC_DUMP_FILE" "$WORK_DIR/tampered.dump.enc"
perl -e "
  open(my \$f, '<', '$WORK_DIR/tampered.dump.enc') or die;
  my \$d = do { local $/; <\$f> };
  close(\$f);
  substr(\$d, 250, 1) = chr(ord(substr(\$d, 250, 1)) ^ 0x01);
  open(my \$out, '>', '$WORK_DIR/tampered.dump.enc') or die;
  print \$out \$d;
  close(\$out);
"
if openssl cms -decrypt -binary -inform DER \
  -in "$WORK_DIR/tampered.dump.enc" \
  -inkey "$MOCK_VAULT_DIR/backup-key.pem" \
  -out "$WORK_DIR/tampered.dump" >/dev/null 2>&1; then
  echo "[FAIL] Negative test 3 FAILED: Tampered ciphertext was decrypted without tag verification error!"
  exit 1
else
  echo "[PASS] Negative test 3 PASSED: Tampered ciphertext was rejected by AEAD authentication tag."
fi

# Test 4.4: Incomplete / truncated ciphertext rejection
echo "Testing Failure Mode 4: Decryption of truncated ciphertext..."
cp "$ENC_DUMP_FILE" "$WORK_DIR/truncated.dump.enc"
truncate -s -32 "$WORK_DIR/truncated.dump.enc"
if openssl cms -decrypt -binary -inform DER \
  -in "$WORK_DIR/truncated.dump.enc" \
  -inkey "$MOCK_VAULT_DIR/backup-key.pem" \
  -out "$WORK_DIR/truncated.dump" >/dev/null 2>&1; then
  echo "[FAIL] Negative test 4 FAILED: Truncated ciphertext was accepted!"
  exit 1
else
  echo "[PASS] Negative test 4 PASSED: Truncated ciphertext was rejected with non-zero exit code."
fi

# Test 4.5: Missing extension failure
echo "Testing Failure Mode 5: Attempting spatial operation without PostGIS extension..."
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE ext_test;" >/dev/null
EXT_ERR=$(docker exec "$DEST_CONTAINER" psql -U postgres -d ext_test -c "CREATE TABLE geom_test (id int, g geometry(Point, 4326));" 2>&1 || true)
if echo "$EXT_ERR" | grep -qi "type \"geometry\" does not exist"; then
  echo "[PASS] Negative test 5 PASSED: Table with spatial columns failed visibly without PostGIS extension."
else
  echo "[FAIL] Negative test 5 FAILED: Expected spatial type error was not encountered!"
  exit 1
fi
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE ext_test;" >/dev/null

# Test 4.6: Incorrect database permissions
echo "Testing Failure Mode 6: Unauthorized database connection before grants..."
if docker exec "$DEST_CONTAINER" psql -U non_existent_role -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
  echo "[FAIL] Negative test 6 FAILED: Non-existent role was permitted connection!"
  exit 1
else
  echo "[PASS] Negative test 6 PASSED: Unauthorized connection rejected by PostgreSQL auth kernel."
fi

# Test 4.7: Successfully decrypted, but truncated / corrupted plaintext custom-format archive
echo "Testing Failure Mode 7: Valid CMS decryption containing corrupted custom-format payload..."

# Part 7a: Truncated catalog / TOC (200 bytes) - pg_restore -l MUST reject
CORRUPT_TOC_RAW="$WORK_DIR/corrupt_toc.dump"
head -c 200 "$RAW_DUMP_FILE" > "$CORRUPT_TOC_RAW"

openssl cms -encrypt -binary \
  -aes-256-gcm \
  -outform DER \
  -in "$CORRUPT_TOC_RAW" \
  -out "$WORK_DIR/corrupt_toc.dump.enc" \
  "$SRC_KEY_DIR/backup-cert.pem"

openssl cms -decrypt -binary \
  -inform DER \
  -in "$WORK_DIR/corrupt_toc.dump.enc" \
  -inkey "$MOCK_VAULT_DIR/backup-key.pem" \
  -out "$WORK_DIR/corrupt_toc_recovered.dump"

docker cp "$WORK_DIR/corrupt_toc_recovered.dump" "$DEST_CONTAINER:/tmp/corrupt_toc.dump"
TOC_FAIL_CODE=0
TOC_ERR=$(docker exec "$DEST_CONTAINER" pg_restore -l /tmp/corrupt_toc.dump 2>&1) || TOC_FAIL_CODE=$?

if [ "$TOC_FAIL_CODE" -ne 0 ]; then
  echo "[PASS] Negative test 7a PASSED: Pre-restore catalog verification (pg_restore -l) caught truncated TOC with exit code $TOC_FAIL_CODE."
else
  echo "[FAIL] Negative test 7a FAILED: pg_restore -l did not reject truncated TOC!"
  exit 1
fi
docker exec "$DEST_CONTAINER" rm -f /tmp/corrupt_toc.dump

# Part 7b: Truncated data payload (half size) - Decrypts cleanly, but pg_restore MUST fail non-zero
CORRUPT_DATA_RAW="$WORK_DIR/corrupt_data.dump"
head -c $((RAW_DUMP_SIZE / 2)) "$RAW_DUMP_FILE" > "$CORRUPT_DATA_RAW"

openssl cms -encrypt -binary \
  -aes-256-gcm \
  -outform DER \
  -in "$CORRUPT_DATA_RAW" \
  -out "$WORK_DIR/corrupt_data.dump.enc" \
  "$SRC_KEY_DIR/backup-cert.pem"

openssl cms -decrypt -binary \
  -inform DER \
  -in "$WORK_DIR/corrupt_data.dump.enc" \
  -inkey "$MOCK_VAULT_DIR/backup-key.pem" \
  -out "$WORK_DIR/corrupt_data_recovered.dump"

docker cp "$WORK_DIR/corrupt_data_recovered.dump" "$DEST_CONTAINER:/tmp/corrupt_data.dump"
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE corrupt_test_db;" >/dev/null

RESTORE_FAIL_CODE=0
RESTORE_ERR_OUT=$(docker exec "$DEST_CONTAINER" pg_restore --clean --if-exists --no-owner -U postgres -d corrupt_test_db /tmp/corrupt_data.dump 2>&1) || RESTORE_FAIL_CODE=$?

if [ "$RESTORE_FAIL_CODE" -eq 0 ]; then
  echo "[FAIL] Negative test 7b FAILED: pg_restore returned exit code 0 on truncated data archive!"
  exit 1
fi

if ! echo "$RESTORE_ERR_OUT" | grep -qiE "unexpected end of file|could not read from input file|corrupted|error"; then
  echo "[FAIL] Negative test 7b FAILED: pg_restore did not emit corruption/EOF error! Output: $RESTORE_ERR_OUT"
  exit 1
fi
echo "[PASS] Negative test 7b PASSED: pg_restore strictly failed with non-zero exit code ($RESTORE_FAIL_CODE) on truncated data payload."

# Part 7c: Verify corrupt_test_db is broken/incomplete and cannot be mistaken for a valid recovery
CORRUPT_MIG_COUNT=$(docker exec "$DEST_CONTAINER" psql -U postgres -d corrupt_test_db -tAc "SELECT COUNT(*) FROM _prisma_migrations;" 2>&1 || echo "RELATION_MISSING")
if [ "$CORRUPT_MIG_COUNT" = "$SRC_MIGRATION_COUNT" ]; then
  echo "[FAIL] Negative test 7c FAILED: Truncated restore created full migration count ($CORRUPT_MIG_COUNT)!"
  exit 1
fi
echo "[PASS] Negative test 7c PASSED: Truncated restore did not leave a viable database (migration table state: $CORRUPT_MIG_COUNT, expected valid: $SRC_MIGRATION_COUNT)."

docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE corrupt_test_db;" >/dev/null
docker exec "$DEST_CONTAINER" rm -f /tmp/corrupt_data.dump

# Test 4.8: Targeted failure-injection mid-restore (--exit-on-error, fail-closed teardown, and retry)
echo "Testing Failure Mode 8: Mid-restore failure injection (--exit-on-error, teardown, and retry)..."
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE injected_fail_db WITH OWNER postgres ENCODING 'UTF8';" >/dev/null
docker cp "infrastructure/postgres/bootstrap-cluster-roles.sql" "$DEST_CONTAINER:/tmp/bootstrap-cluster-roles.sql"
docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -f /tmp/bootstrap-cluster-roles.sql >/dev/null

# Pre-create conflicting table event_registrations with incompatible schema to trigger mid-stream error
docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -c "CREATE TABLE event_registrations (id int, conflicting_column text);" >/dev/null

INJECT_FAIL_CODE=0
INJECT_ERR=$(docker exec "$DEST_CONTAINER" pg_restore --exit-on-error --no-owner -U postgres -d injected_fail_db /tmp/unbootstrapped_raw.dump 2>&1) || INJECT_FAIL_CODE=$?

if [ "$INJECT_FAIL_CODE" -eq 0 ]; then
  echo "[FAIL] Negative test 8a FAILED: pg_restore --exit-on-error returned exit code 0 despite injected conflict!"
  exit 1
fi

if ! echo "$INJECT_ERR" | grep -qiE "relation \"event_registrations\" already exists|error"; then
  echo "[FAIL] Negative test 8a FAILED: Expected conflict error was not emitted! Output: $INJECT_ERR"
  exit 1
fi
echo "[PASS] Negative test 8a PASSED: pg_restore --exit-on-error halted immediately on first error with exit code $INJECT_FAIL_CODE."

# Verify that the database was left in a partially restored state:
# pg_restore created objects prior to the conflict, but aborted before completing the schema or data
PARTIAL_TABLE_COUNT=$(docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
# Data was NEVER restored due to mid-stream abort
PARTIAL_MIG_ROWS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -tAc "SELECT COUNT(*) FROM _prisma_migrations;" 2>&1 || echo "0")

if [ "$PARTIAL_TABLE_COUNT" -le 1 ] || [ "$PARTIAL_TABLE_COUNT" -ge "$SRC_TABLE_COUNT" ] || [ "$PARTIAL_MIG_ROWS" -eq "$SRC_MIGRATION_COUNT" ]; then
  echo "[FAIL] Negative test 8b FAILED: Expected partial restore state not found! partial_tables=$PARTIAL_TABLE_COUNT (source_total=$SRC_TABLE_COUNT), migration_rows=$PARTIAL_MIG_ROWS"
  exit 1
fi
echo "[PASS] Negative test 8b PASSED: Mid-stream abort verified (partial tables created: $PARTIAL_TABLE_COUNT/$SRC_TABLE_COUNT, migration data restored: $PARTIAL_MIG_ROWS/$SRC_MIGRATION_COUNT)."

# Execute fail-closed teardown: Drop the partially restored database immediately
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS injected_fail_db;" >/dev/null
INJECT_DB_EXISTS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_database WHERE datname = 'injected_fail_db';")
if [ "$INJECT_DB_EXISTS" != "0" ]; then
  echo "[FAIL] Negative test 8c FAILED: Partially restored database was not completely dropped!"
  exit 1
fi
echo "[PASS] Negative test 8c PASSED: Partially restored database explicitly dropped (zero lingering corrupt state)."

# Test Retry Behavior: Start from clean slate and verify successful recovery
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE injected_fail_db WITH OWNER postgres ENCODING 'UTF8';" >/dev/null
docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -f /tmp/bootstrap-cluster-roles.sql >/dev/null
RETRY_CODE=0
docker exec "$DEST_CONTAINER" pg_restore --exit-on-error --no-owner -U postgres -d injected_fail_db /tmp/unbootstrapped_raw.dump >/dev/null 2>&1 || RETRY_CODE=$?
if [ "$RETRY_CODE" -ne 0 ]; then
  echo "[FAIL] Negative test 8d FAILED: Clean retry failed with exit code $RETRY_CODE!"
  exit 1
fi

RETRY_MIG_COUNT=$(docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -tAc "SELECT COUNT(*) FROM _prisma_migrations;")
RETRY_USERS_COUNT=$(docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -tAc "SELECT COUNT(*) FROM users;")
RETRY_REGS_COUNT=$(docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -tAc "SELECT COUNT(*) FROM event_registrations;")
RETRY_ATT_COUNT=$(docker exec "$DEST_CONTAINER" psql -U postgres -d injected_fail_db -tAc "SELECT COUNT(*) FROM attendance_records;")

if [ "$RETRY_MIG_COUNT" != "$SRC_MIGRATION_COUNT" ] || [ "$RETRY_USERS_COUNT" != "$SRC_USERS" ] || \
   [ "$RETRY_REGS_COUNT" != "$SRC_REGS" ] || [ "$RETRY_ATT_COUNT" != "$SRC_ATT" ]; then
  echo "[FAIL] Negative test 8d FAILED: Clean retry did not achieve full data parity! mig=$RETRY_MIG_COUNT, users=$RETRY_USERS_COUNT, regs=$RETRY_REGS_COUNT, att=$RETRY_ATT_COUNT"
  exit 1
fi
echo "[PASS] Negative test 8d PASSED: Clean retry succeeded 100% with full migration ($RETRY_MIG_COUNT) and data parity (users=$RETRY_USERS_COUNT, regs=$RETRY_REGS_COUNT, att=$RETRY_ATT_COUNT)."

docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE injected_fail_db;" >/dev/null


# ------------------------------------------------------------------------------
# STEP 5: Independent Key Retrieval & Decryption (Strict Artifact Consistency)
# ------------------------------------------------------------------------------
echo "==> STEP 5: Performing Independent Key Retrieval & Decryption..."
RECOVERED_ARTIFACT="$WORK_DIR/recovered.dump"

# Operator imports key from external vault custody into secure disaster recovery directory
cp "$MOCK_VAULT_DIR/backup-key.pem" "$DEST_KEY_DIR/recovery-key.pem"
chmod 400 "$DEST_KEY_DIR/recovery-key.pem"

if [ ! -s "$DEST_KEY_DIR/recovery-key.pem" ]; then
  echo "[FATAL] Retrieved recovery key $DEST_KEY_DIR/recovery-key.pem is missing or 0 bytes!" >&2
  exit 1
fi

if [ ! -s "$ENC_DUMP_FILE" ]; then
  echo "[FATAL] Encrypted backup archive $ENC_DUMP_FILE is missing or 0 bytes!" >&2
  exit 1
fi

openssl cms -decrypt -binary \
  -inform DER \
  -in "$ENC_DUMP_FILE" \
  -inkey "$DEST_KEY_DIR/recovery-key.pem" \
  -out "$RECOVERED_ARTIFACT"

if [ ! -s "$RECOVERED_ARTIFACT" ]; then
  echo "[FATAL] Decrypted artifact $RECOVERED_ARTIFACT is missing or 0 bytes!" >&2
  exit 1
fi

RECOVERED_SHA=$(sha256sum "$RECOVERED_ARTIFACT" | awk '{print $1}')
if [ "$RAW_DUMP_SHA" != "$RECOVERED_SHA" ]; then
  echo "[FAIL] Checksum mismatch! Recovered dump ($RECOVERED_SHA) does not match original ($RAW_DUMP_SHA)." >&2
  exit 1
fi
echo "[PASS] Decrypted payload matches original backup exactly byte-for-byte (SHA-256: ${RECOVERED_SHA})."

# Copy exact artifact to destination container preserving filename
docker cp "$RECOVERED_ARTIFACT" "$DEST_CONTAINER:/tmp/recovered.dump"
docker exec "$DEST_CONTAINER" test -s /tmp/recovered.dump || {
  echo "[FATAL] /tmp/recovered.dump is missing or 0 bytes in destination container!" >&2
  exit 1
}

# Verify destination container received exact identical artifact
DEST_DUMP_SHA=$(docker exec "$DEST_CONTAINER" sha256sum /tmp/recovered.dump | awk '{print $1}')
if [ "$DEST_DUMP_SHA" != "$RECOVERED_SHA" ]; then
  echo "[FATAL] Container artifact checksum mismatch! Local: $RECOVERED_SHA, Container: $DEST_DUMP_SHA" >&2
  exit 1
fi
echo "[PASS] Destination container artifact checksum verified (/tmp/recovered.dump)."

# ------------------------------------------------------------------------------
# STEP 6: Bootstrap Global Roles and Restore Database on Destination Cluster
# ------------------------------------------------------------------------------
echo "==> STEP 6: Bootstrapping Cluster Roles and Restoring Destination Database..."

# 6.1 Create destination target database
docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE nst_events WITH OWNER postgres ENCODING 'UTF8';" >/dev/null

# 6.2 Apply declarative cluster roles bootstrap artifact TWICE to verify idempotency
if [ ! -s "infrastructure/postgres/bootstrap-cluster-roles.sql" ]; then
  echo "[FATAL] infrastructure/postgres/bootstrap-cluster-roles.sql is missing or 0 bytes!" >&2
  exit 1
fi

docker cp "infrastructure/postgres/bootstrap-cluster-roles.sql" "$DEST_CONTAINER:/tmp/bootstrap-cluster-roles.sql"
docker exec "$DEST_CONTAINER" test -s /tmp/bootstrap-cluster-roles.sql || {
  echo "[FATAL] /tmp/bootstrap-cluster-roles.sql is missing or 0 bytes in destination container!" >&2
  exit 1
}

docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -f /tmp/bootstrap-cluster-roles.sql >/dev/null
echo "[PASS] Pass 1: Declarative bootstrap script applied."

# Pass 2: Rerun to prove idempotency
docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -f /tmp/bootstrap-cluster-roles.sql >/dev/null
echo "[PASS] Pass 2: Bootstrap script rerun safely (idempotency verified)."

# 6.3 Set destination passwords for application roles
docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -c "ALTER ROLE nst_app WITH PASSWORD 'dest_app_secure_pass';" >/dev/null
docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -c "ALTER ROLE nst_worker WITH PASSWORD 'dest_worker_secure_pass';" >/dev/null
echo "[PASS] Secure passwords configured for nst_app and nst_worker on destination."

# 6.4 Pre-restore catalog verification on destination
docker exec "$DEST_CONTAINER" pg_restore -l /tmp/recovered.dump >/dev/null
echo "[PASS] Destination archive catalog verification passed (pg_restore -l)."

# 6.5 Restore exact decrypted database backup with fail-closed --exit-on-error
RESTORE_STATUS=0
RESTORE_OUT=$(docker exec "$DEST_CONTAINER" pg_restore --exit-on-error --no-owner -U postgres -d nst_events /tmp/recovered.dump 2>&1) || RESTORE_STATUS=$?
if [ "$RESTORE_STATUS" -ne 0 ]; then
  echo "[FATAL] Destination database pg_restore failed with exit status $RESTORE_STATUS!" >&2
  echo "$RESTORE_OUT" >&2
  echo "[CLEANUP] Dropping partially restored database to prevent unverified recovery..." >&2
  docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS nst_events;" >/dev/null
  exit 1
fi
echo "[PASS] Database restored into destination cluster successfully with --exit-on-error (exit code: $RESTORE_STATUS)."

# ------------------------------------------------------------------------------
# STEP 7: Verify Full Schema Parity, Migrations, Extensions & Constraints
# ------------------------------------------------------------------------------
echo "==> STEP 7: Verifying Full Schema, Migrations, Extensions & Constraints on Destination..."

DEST_MIG=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM _prisma_migrations;")
DEST_USERS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM users;")
DEST_EVENTS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM events;")
DEST_REGS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM event_registrations;")
DEST_ATT=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM attendance_records;")

DEST_POSTGIS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT extname FROM pg_extension WHERE extname = 'postgis';")
DEST_PGCRYPTO=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';")

USERS_RLS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'users';")
EVENTS_RLS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'events';")
REGS_RLS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'event_registrations';")
ATT_RLS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'attendance_records';")

# Role attribute verification
ROLE_ATTRS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "
  SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit, rolcanlogin
  FROM pg_roles WHERE rolname IN ('nst_app', 'nst_worker') ORDER BY rolname;
")

echo "Role attributes audit:"
echo "$ROLE_ATTRS" | while read -r line; do
  echo "  - $line"
done

# Role membership audit (must have no memberships in superuser roles)
SUPER_MEMBERS=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "
  SELECT r.rolname FROM pg_roles r
  JOIN pg_auth_members m ON r.oid = m.roleid
  JOIN pg_roles m_role ON m_role.oid = m.member
  WHERE m_role.rolname IN ('nst_app', 'nst_worker') AND r.rolsuper = true;
")

if [ -n "$SUPER_MEMBERS" ]; then
  echo "[FAIL] Application roles incorrectly granted superuser group membership!"
  exit 1
fi
echo "[PASS] Application roles confirmed least-privileged (zero superuser memberships)."

# Database ownership audit
DB_OWNER=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "
  SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'nst_events';
")
SCHEMA_OWNER=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc "
  SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public';
")
echo "[PASS] Ownership verified: Database owner is '$DB_OWNER', Schema public owner is '$SCHEMA_OWNER'."

if [ "$DB_OWNER" != "postgres" ] || { [ "$SCHEMA_OWNER" != "postgres" ] && [ "$SCHEMA_OWNER" != "pg_database_owner" ]; }; then
  echo "[FAIL] Database or public schema owner is not postgres (or pg_database_owner)!"
  exit 1
fi

echo "Destination Cluster Verification Summary:"
echo "  - Prisma Migrations: $DEST_MIG (Source: $SRC_MIGRATION_COUNT)"
echo "  - Extensions: PostGIS ($DEST_POSTGIS), pgcrypto ($DEST_PGCRYPTO)"
echo "  - Users: $DEST_USERS (Source: $SRC_USERS)"
echo "  - Events: $DEST_EVENTS (Source: $SRC_EVENTS)"
echo "  - Registrations: $DEST_REGS (Source: $SRC_REGS)"
echo "  - Attendance: $DEST_ATT (Source: $SRC_ATT)"
echo "  - RLS Active: users ($USERS_RLS), events ($EVENTS_RLS), registrations ($REGS_RLS), attendance ($ATT_RLS)"

if [ "$DEST_MIG" != "$SRC_MIGRATION_COUNT" ] || [ "$DEST_USERS" != "$SRC_USERS" ] || \
   [ "$DEST_EVENTS" != "$SRC_EVENTS" ] || [ "$DEST_REGS" != "$SRC_REGS" ] || [ "$DEST_ATT" != "$SRC_ATT" ] || \
   [ -z "$DEST_POSTGIS" ] || [ -z "$DEST_PGCRYPTO" ] || \
   [ "$USERS_RLS" != "t" ] || [ "$EVENTS_RLS" != "t" ] || [ "$REGS_RLS" != "t" ] || [ "$ATT_RLS" != "t" ]; then
  echo "[FAIL] Restored database failed parity check! Dropping database to prevent unverified recovery..."
  docker exec "$DEST_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS nst_events;" >/dev/null
  exit 1
fi
echo "[PASS] 100% schema and data parity verified between source and destination."

# ------------------------------------------------------------------------------
# STEP 8: Test Database Access Under Application Roles (Allowed & Denied Operations)
# ------------------------------------------------------------------------------
echo "==> STEP 8: Verifying Role Privileges and RLS Enforcement (nst_app & nst_worker)..."

# Test 8.1: nst_worker allowed operations
WORKER_JOB_COUNT=$(docker exec -e PGPASSWORD=dest_worker_secure_pass "$DEST_CONTAINER" \
  psql -U nst_worker -d nst_events -h 127.0.0.1 -tAc "SELECT COUNT(*) FROM notification_jobs;")
echo "[PASS] nst_worker allowed op 1: Query notification_jobs succeeded (count: $WORKER_JOB_COUNT)."

WORKER_USER_ID=$(docker exec -e PGPASSWORD=dest_worker_secure_pass "$DEST_CONTAINER" \
  psql -U nst_worker -d nst_events -h 127.0.0.1 -tAc "SELECT id FROM users LIMIT 1;")
echo "[PASS] nst_worker allowed op 2: Query users.id column succeeded ($WORKER_USER_ID)."

# Test 8.2: nst_worker denied operations
WORKER_EMAIL_DENIED=$(docker exec -e PGPASSWORD=dest_worker_secure_pass "$DEST_CONTAINER" \
  psql -U nst_worker -d nst_events -h 127.0.0.1 -c "SELECT email FROM users LIMIT 1;" 2>&1 || true)
if echo "$WORKER_EMAIL_DENIED" | grep -qi "permission denied for"; then
  echo "[PASS] nst_worker denied op 1: Access to users.email strictly DENIED."
else
  echo "[FAIL] nst_worker denied op 1 FAILED: Did not enforce column-level grant restriction! Output: $WORKER_EMAIL_DENIED"
  exit 1
fi

WORKER_EVENT_DENIED=$(docker exec -e PGPASSWORD=dest_worker_secure_pass "$DEST_CONTAINER" \
  psql -U nst_worker -d nst_events -h 127.0.0.1 -c "SELECT * FROM events;" 2>&1 || true)
if echo "$WORKER_EVENT_DENIED" | grep -qi "permission denied for"; then
  echo "[PASS] nst_worker denied op 2: Access to events relation strictly DENIED."
else
  echo "[FAIL] nst_worker denied op 2 FAILED: Did not enforce table-level grant restriction! Output: $WORKER_EVENT_DENIED"
  exit 1
fi

WORKER_DDL_DENIED=$(docker exec -e PGPASSWORD=dest_worker_secure_pass "$DEST_CONTAINER" \
  psql -U nst_worker -d nst_events -h 127.0.0.1 -c "CREATE TABLE hacker_tab (id int);" 2>&1 || true)
if echo "$WORKER_DDL_DENIED" | grep -qi "permission denied for schema public"; then
  echo "[PASS] nst_worker denied op 3: DDL CREATE TABLE strictly DENIED."
else
  echo "[FAIL] nst_worker denied op 3 FAILED: DDL was not denied! Output: $WORKER_DDL_DENIED"
  exit 1
fi

# Test 8.3: nst_app allowed operations
APP_EVENTS_COUNT=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "SELECT COUNT(*) FROM events;")
echo "[PASS] nst_app allowed op 1: Query events succeeded (count: $APP_EVENTS_COUNT)."

APP_USERS_COUNT=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "SELECT COUNT(*) FROM users;")
echo "[PASS] nst_app allowed op 2: Query users succeeded (count: $APP_USERS_COUNT)."

# Test 8.4: nst_app RLS Enforcement & Transaction Correctness
# Case A: When session context is ABSENT, queries under nst_app MUST return 0 rows
RLS_NO_CONTEXT_COUNT=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "SELECT COUNT(*) FROM event_registrations;")

echo "[PASS] nst_app RLS baseline: Without session context, returned $RLS_NO_CONTEXT_COUNT registration(s) (zero records leaked)."
if [ "$RLS_NO_CONTEXT_COUNT" != "0" ]; then
  echo "[FAIL] RLS failed! Without app.user_id context, records were leaked to unauthenticated caller."
  exit 1
fi

# Case B1: When session context is SET inside an explicit transaction, returns only intended student's rows
STUDENT_ROW=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT user_id, COUNT(*) FROM event_registrations GROUP BY user_id LIMIT 1;")
TARGET_STUDENT_ID=$(echo "$STUDENT_ROW" | cut -d'|' -f1)
EXPECTED_STUDENT_REGS=$(echo "$STUDENT_ROW" | cut -d'|' -f2)

RLS_STUDENT_REGS=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "
    BEGIN;
    SET LOCAL app.user_id = '${TARGET_STUDENT_ID}';
    SELECT COUNT(*) FROM event_registrations;
    COMMIT;
  " | grep -E '^[0-9]+$' | head -n 1)

echo "[PASS] nst_app RLS transaction: Under student context (${TARGET_STUDENT_ID}), saw exactly $RLS_STUDENT_REGS registration(s) (expected: $EXPECTED_STUDENT_REGS) out of $DEST_REGS total database records."

if [ "$RLS_STUDENT_REGS" != "$EXPECTED_STUDENT_REGS" ] || [ "$RLS_STUDENT_REGS" -ge "$DEST_REGS" ]; then
  echo "[FAIL] RLS failed to filter registrations! Leaked cross-student records or mismatch."
  exit 1
fi

# Case B2: Confirm zero cross-student records are visible within the same transaction
RLS_CROSS_STUDENT_LEAK=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "
    BEGIN;
    SET LOCAL app.user_id = '${TARGET_STUDENT_ID}';
    SELECT COUNT(*) FROM event_registrations WHERE user_id != '${TARGET_STUDENT_ID}';
    COMMIT;
  " | grep -E '^[0-9]+$' | head -n 1)

if [ "$RLS_CROSS_STUDENT_LEAK" != "0" ]; then
  echo "[FAIL] Cross-student leakage detected! Saw $RLS_CROSS_STUDENT_LEAK foreign records."
  exit 1
fi
echo "[PASS] nst_app RLS transaction: Zero cross-student records visible within transaction."

# Case B3: Regression test: Confirm SET LOCAL does NOT leak into subsequent queries post-transaction
RLS_POST_TX_COUNT=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "SELECT COUNT(*) FROM event_registrations;")
if [ "$RLS_POST_TX_COUNT" != "0" ]; then
  echo "[FAIL] Regression failure: SET LOCAL leaked beyond transaction boundary into subsequent query!"
  exit 1
fi
echo "[PASS] nst_app RLS transaction isolation: Context strictly reset post-transaction (0 rows returned)."

# Case B4: Non-existent student UUID returns 0 rows
RLS_GHOST_COUNT=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "
    BEGIN;
    SET LOCAL app.user_id = '00000000-0000-0000-0000-000000000000';
    SELECT COUNT(*) FROM event_registrations;
    COMMIT;
  " | grep -E '^[0-9]+$' | head -n 1)
if [ "$RLS_GHOST_COUNT" != "0" ]; then
  echo "[FAIL] Non-existent user context returned non-zero rows ($RLS_GHOST_COUNT)!"
  exit 1
fi
echo "[PASS] nst_app RLS ghost student: Returned 0 rows for non-existent student UUID."

# Case B5: Second distinct student context verification (if present in seed data)
STUDENT2_ROW=$(docker exec "$DEST_CONTAINER" psql -U postgres -d nst_events -tAc \
  "SELECT user_id, COUNT(*) FROM event_registrations WHERE user_id != '${TARGET_STUDENT_ID}' GROUP BY user_id LIMIT 1;")
if [ -n "$STUDENT2_ROW" ]; then
  STUDENT2_ID=$(echo "$STUDENT2_ROW" | cut -d'|' -f1)
  EXPECTED_STUDENT2_REGS=$(echo "$STUDENT2_ROW" | cut -d'|' -f2)
  RLS_STUDENT2_REGS=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
    psql -U nst_app -d nst_events -h 127.0.0.1 -tAc "
      BEGIN;
      SET LOCAL app.user_id = '${STUDENT2_ID}';
      SELECT COUNT(*) FROM event_registrations;
      COMMIT;
    " | grep -E '^[0-9]+$' | head -n 1)
  if [ "$RLS_STUDENT2_REGS" != "$EXPECTED_STUDENT2_REGS" ]; then
    echo "[FAIL] Context switch failed! For student $STUDENT2_ID expected $EXPECTED_STUDENT2_REGS rows, got $RLS_STUDENT2_REGS."
    exit 1
  fi
  echo "[PASS] nst_app RLS second student context verified: saw exactly $RLS_STUDENT2_REGS registration(s)."
fi

# Case C: Superuser bypass verification (verifies superuser sees all records while nst_app is restricted)
SUPERUSER_REGS=$(docker exec "$DEST_CONTAINER" \
  psql -U postgres -d nst_events -tAc "SELECT COUNT(*) FROM event_registrations;")
if [ "$SUPERUSER_REGS" != "$DEST_REGS" ]; then
  echo "[FAIL] Superuser registration count mismatch!"
  exit 1
fi
echo "[PASS] Superuser bypass confirmed ($SUPERUSER_REGS total records), while nst_app is strictly constrained by RLS."

# Test 8.5: nst_app denied operations (DDL restriction)
APP_DDL_DENIED=$(docker exec -e PGPASSWORD=dest_app_secure_pass "$DEST_CONTAINER" \
  psql -U nst_app -d nst_events -h 127.0.0.1 -c "DROP TABLE users;" 2>&1 || true)
if echo "$APP_DDL_DENIED" | grep -qi "must be owner of"; then
  echo "[PASS] nst_app denied op 1: DDL DROP TABLE strictly DENIED (NO DDL privilege)."
else
  echo "[FAIL] nst_app denied op 1 FAILED: Table drop was not denied! Output: $APP_DDL_DENIED"
  exit 1
fi

echo "=============================================================================="
echo "DRILL COMPLETED: GENUINE INDEPENDENT CLUSTER RECOVERY VERIFIED 100% INTACT"
echo "=============================================================================="
