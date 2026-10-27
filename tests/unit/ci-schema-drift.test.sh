#!/usr/bin/env bash
#
# ci-schema-drift.test.sh
# Comprehensive verification suite for Workstream 12: CI Schema-to-Migration Drift Detection
#
set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${REPO_ROOT}/scripts/check-schema-drift.sh"
CI_FILE="${REPO_ROOT}/.github/workflows/ci.yml"

TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

pass() {
  TEST_COUNT=$((TEST_COUNT + 1))
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "  ✅ PASS: $1"
}

fail() {
  TEST_COUNT=$((TEST_COUNT + 1))
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "  ❌ FAIL: $1"
  echo "     $2"
}

echo "================================================================================"
echo "RUNNING WORKSTREAM 12 VERIFICATION SUITE: CI SCHEMA-TO-MIGRATION DRIFT DETECTION"
echo "================================================================================"

# -----------------------------------------------------------------------------
# Test 1: CI Workflow Configuration
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: CI workflow (.github/workflows/ci.yml) configuration inspection"

if grep -q "Verify Schema-to-Migration Parity" "${CI_FILE}"; then
  pass "ci.yml contains dedicated 'Verify Schema-to-Migration Parity' step"
else
  fail "CI workflow step check" "Step 'Verify Schema-to-Migration Parity' missing from ${CI_FILE}"
fi

if grep -q "SHADOW_DATABASE_URL:" "${CI_FILE}" && grep -q "nst_events_shadow" "${CI_FILE}"; then
  pass "ci.yml configures an isolated disposable shadow database (nst_events_shadow)"
else
  fail "CI shadow database check" "SHADOW_DATABASE_URL or nst_events_shadow missing in ${CI_FILE}"
fi

# Verify ordering: drift check step must run before database preparation / migration deployment
DRIFT_LINE=$(grep -n "Verify Schema-to-Migration Parity" "${CI_FILE}" | cut -d: -f1)
MIGRATE_LINE=$(grep -n "db:migrate:deploy" "${CI_FILE}" | cut -d: -f1)

if [ -n "${DRIFT_LINE}" ] && [ -n "${MIGRATE_LINE}" ] && [ "${DRIFT_LINE}" -lt "${MIGRATE_LINE}" ]; then
  pass "ci.yml executes drift check before 'db:migrate:deploy' or database seeding"
else
  fail "CI step ordering check" "Drift check line (${DRIFT_LINE}) is not before migrate line (${MIGRATE_LINE})"
fi

# -----------------------------------------------------------------------------
# Test 2: Input & Parameter Validation (Fail-Closed)
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: Input and parameter validation fails closed on missing/invalid arguments"

# Missing shadow database URL
set +e
OUT=$(unset SHADOW_DATABASE_URL && "${SCRIPT}" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${OUT}" | grep -q "Missing required shadow database URL"; then
  pass "Missing shadow database URL is rejected with exit code 1"
else
  fail "Missing shadow DB URL check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
fi

# Missing schema file override
set +e
OUT=$(PRISMA_SCHEMA_OVERRIDE="/nonexistent/path/schema.prisma" "${SCRIPT}" "postgresql://localhost/dummy" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${OUT}" | grep -q "Prisma schema file not found"; then
  pass "Nonexistent schema file path fails closed with exit code 1"
else
  fail "Nonexistent schema path check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
fi

# Missing migrations directory override
set +e
OUT=$(PRISMA_MIGRATIONS_OVERRIDE="/nonexistent/path/migrations" "${SCRIPT}" "postgresql://localhost/dummy" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${OUT}" | grep -q "Migrations directory not found"; then
  pass "Nonexistent migrations directory path fails closed with exit code 1"
else
  fail "Nonexistent migrations path check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
fi

# -----------------------------------------------------------------------------
# Test 3: Secret and Credential Safety
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: Diagnostic logging sanitizes and masks connection credentials"

SECRET_PASS="sensitive_super_secret_password_xyz987"
TEST_URL="postgresql://nst_admin:${SECRET_PASS}@127.0.0.1:54399/nst_test"

set +e
OUT=$(SHADOW_DATABASE_URL="${TEST_URL}" "${SCRIPT}" 2>&1)
set -e

if ! echo "${OUT}" | grep -q "${SECRET_PASS}" && echo "${OUT}" | grep -q "nst_admin:\*\*\*@127.0.0.1"; then
  pass "Diagnostic and error output properly masks database password from logs"
else
  fail "Secret safety check" "Secret password leaked or unmasked in output: ${OUT}"
fi

# -----------------------------------------------------------------------------
# Test 4: CLI Failure / Unavailable Shadow Database Fails Closed
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: CLI failure or unavailable shadow database produces clear nonzero failure"

set +e
# Port 54399 has no listener
OUT=$(SHADOW_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54399/does_not_exist" "${SCRIPT}" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${OUT}" | grep -q "Prisma migrate diff execution failed"; then
  pass "Unavailable shadow database connection fails closed with exit code 1"
else
  fail "Unavailable shadow DB check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
fi

# -----------------------------------------------------------------------------
# Isolated Database Environment Setup for Fixture Tests
# -----------------------------------------------------------------------------
echo ""
echo "Setting up isolated disposable PostgreSQL instance for behavioral tests..."

TEST_CONTAINER=""
TEST_PORT=""

# Check if Docker is available to spin up a 100% isolated ephemeral container
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  TEST_PORT="54328"
  TEST_CONTAINER=$(docker run --rm -d -p "${TEST_PORT}:5432" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nst_events docker-postgres:latest)
  echo "  Started isolated disposable container: ${TEST_CONTAINER:0:12} on port ${TEST_PORT}"
  
  # Wait for readiness
  READY=0
  for i in $(seq 1 20); do
    if pg_isready -h localhost -p "${TEST_PORT}" -U postgres >/dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 1
  done
  
  if [ $READY -ne 1 ]; then
    echo "  Failed to start isolated test container. Falling back."
    docker rm -f "${TEST_CONTAINER}" >/dev/null 2>&1 || true
    TEST_CONTAINER=""
  fi
fi

cleanup() {
  if [ -n "${TEST_CONTAINER}" ]; then
    echo "Cleaning up isolated disposable test container..."
    docker rm -f "${TEST_CONTAINER}" >/dev/null 2>&1 || true
  fi
  if [ -n "${FIXTURE_DIR}" ] && [ -d "${FIXTURE_DIR}" ]; then
    rm -rf "${FIXTURE_DIR}"
  fi
}
trap cleanup EXIT INT TERM

if [ -n "${TEST_CONTAINER}" ]; then
  TEST_SHADOW_URL="postgresql://postgres:postgres@localhost:${TEST_PORT}/nst_fixture_shadow"
  # Create fixture shadow database in disposable container
  PGPASSWORD=postgres psql -h localhost -p "${TEST_PORT}" -U postgres -c "CREATE DATABASE nst_fixture_shadow;" >/dev/null 2>&1
  
  # ---------------------------------------------------------------------------
  # Test 5: Consistent Baseline Fixture Passes (Zero Drift)
  # ---------------------------------------------------------------------------
  echo ""
  echo "Test 5: Consistent baseline fixture: schema matches migration history exactly"

  FIXTURE_DIR=$(mktemp -d "/tmp/prisma_fixture_XXXXXX")
  mkdir -p "${FIXTURE_DIR}/migrations/20260101000000_init"
  
  cat << 'EOF' > "${FIXTURE_DIR}/schema.prisma"
datasource db {
  provider = "postgresql"
  url      = "postgresql://postgres:postgres@localhost:54328/nst_events"
}

model UserAccount {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  fullName  String   @map("full_name")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("user_accounts")
}
EOF

  cat << 'EOF' > "${FIXTURE_DIR}/migrations/migration_lock.toml"
provider = "postgresql"
EOF

  cat << 'EOF' > "${FIXTURE_DIR}/migrations/20260101000000_init/migration.sql"
CREATE TABLE "user_accounts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_accounts_email_key" ON "user_accounts"("email");
EOF

  set +e
  OUT=$(PRISMA_SCHEMA_OVERRIDE="${FIXTURE_DIR}/schema.prisma" \
        PRISMA_MIGRATIONS_OVERRIDE="${FIXTURE_DIR}/migrations" \
        SHADOW_DATABASE_URL="${TEST_SHADOW_URL}" \
        "${SCRIPT}" 2>&1)
  EXIT_CODE=$?
  set -e

  if [ $EXIT_CODE -eq 0 ] && echo "${OUT}" | grep -q "No drift detected"; then
    pass "Consistent schema/migration fixture exits 0 with 'No drift detected'"
  else
    fail "Consistent fixture check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
  fi

  # ---------------------------------------------------------------------------
  # Test 6: Missing Migration (Added Column in Schema) Fails Drift Check
  # ---------------------------------------------------------------------------
  echo ""
  echo "Test 6: Missing migration: schema contains added column not in migrations"

  # Mutate fixture schema to add a field without corresponding migration
  cat << 'EOF' > "${FIXTURE_DIR}/schema.prisma"
datasource db {
  provider = "postgresql"
  url      = "postgresql://postgres:postgres@localhost:54328/nst_events"
}

model UserAccount {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  fullName  String   @map("full_name")
  bio       String?  @map("bio")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("user_accounts")
}
EOF

  set +e
  OUT=$(PRISMA_SCHEMA_OVERRIDE="${FIXTURE_DIR}/schema.prisma" \
        PRISMA_MIGRATIONS_OVERRIDE="${FIXTURE_DIR}/migrations" \
        SHADOW_DATABASE_URL="${TEST_SHADOW_URL}" \
        "${SCRIPT}" 2>&1)
  EXIT_CODE=$?
  set -e

  if [ $EXIT_CODE -eq 2 ] && echo "${OUT}" | grep -q "Schema-to-migration drift detected" && echo "${OUT}" | grep -q "Added column \`bio\`"; then
    pass "Added column in schema without migration triggers exit code 2 and identifies missing column"
  else
    fail "Missing migration (column) check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
  fi

  # ---------------------------------------------------------------------------
  # Test 7: Missing Migration (Added Model/Table in Schema) Fails Drift Check
  # ---------------------------------------------------------------------------
  echo ""
  echo "Test 7: Missing migration: schema contains added model not in migrations"

  # Mutate fixture schema to add a second model
  cat << 'EOF' >> "${FIXTURE_DIR}/schema.prisma"

model AuditTrail {
  id        String   @id @default(uuid()) @db.Uuid
  action    String
  timestamp DateTime @default(now()) @db.Timestamptz(6)

  @@map("audit_trails")
}
EOF

  set +e
  OUT=$(PRISMA_SCHEMA_OVERRIDE="${FIXTURE_DIR}/schema.prisma" \
        PRISMA_MIGRATIONS_OVERRIDE="${FIXTURE_DIR}/migrations" \
        SHADOW_DATABASE_URL="${TEST_SHADOW_URL}" \
        "${SCRIPT}" 2>&1)
  EXIT_CODE=$?
  set -e

  if [ $EXIT_CODE -eq 2 ] && echo "${OUT}" | grep -q "audit_trails"; then
    pass "Added model in schema without migration triggers exit code 2 and identifies missing table"
  else
    fail "Missing migration (table) check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
  fi

  # ---------------------------------------------------------------------------
  # Test 8: Missing Migration (Removed Column from Schema) Fails Drift Check
  # ---------------------------------------------------------------------------
  echo ""
  echo "Test 8: Missing migration: column removed from schema but exists in migrations"

  # Reset fixture schema to remove full_name
  cat << 'EOF' > "${FIXTURE_DIR}/schema.prisma"
datasource db {
  provider = "postgresql"
  url      = "postgresql://postgres:postgres@localhost:54328/nst_events"
}

model UserAccount {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("user_accounts")
}
EOF

  set +e
  OUT=$(PRISMA_SCHEMA_OVERRIDE="${FIXTURE_DIR}/schema.prisma" \
        PRISMA_MIGRATIONS_OVERRIDE="${FIXTURE_DIR}/migrations" \
        SHADOW_DATABASE_URL="${TEST_SHADOW_URL}" \
        "${SCRIPT}" 2>&1)
  EXIT_CODE=$?
  set -e

  if [ $EXIT_CODE -eq 2 ] && echo "${OUT}" | grep -q "Removed column \`full_name\`"; then
    pass "Removed column in schema without migration triggers exit code 2 and identifies removed column"
  else
    fail "Removed column check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
  fi

  # ---------------------------------------------------------------------------
  # Test 9: Complete Parity Restored Passes Cleanly
  # ---------------------------------------------------------------------------
  echo ""
  echo "Test 9: Parity restored: adding second migration matches updated schema"

  mkdir -p "${FIXTURE_DIR}/migrations/20260102000000_remove_full_name"
  cat << 'EOF' > "${FIXTURE_DIR}/migrations/20260102000000_remove_full_name/migration.sql"
ALTER TABLE "user_accounts" DROP COLUMN "full_name";
EOF

  set +e
  OUT=$(PRISMA_SCHEMA_OVERRIDE="${FIXTURE_DIR}/schema.prisma" \
        PRISMA_MIGRATIONS_OVERRIDE="${FIXTURE_DIR}/migrations" \
        SHADOW_DATABASE_URL="${TEST_SHADOW_URL}" \
        "${SCRIPT}" 2>&1)
  EXIT_CODE=$?
  set -e

  if [ $EXIT_CODE -eq 0 ] && echo "${OUT}" | grep -q "No drift detected"; then
    pass "Adding corresponding migration restores parity and passes with exit code 0"
  else
    fail "Restored parity check" "Exit: ${EXIT_CODE}, Output: ${OUT}"
  fi

  # ---------------------------------------------------------------------------
  # Test 10: Database Isolation & Target Immutability
  # ---------------------------------------------------------------------------
  echo ""
  echo "Test 10: Database isolation: check operates exclusively on shadow DB; app DB unaffected"

  # Verify target app database 'nst_events' has zero fixture tables created by drift check
  TABLE_COUNT=$(PGPASSWORD=postgres psql -h localhost -p "${TEST_PORT}" -U postgres -d nst_events -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_accounts', 'audit_trails');")
  
  if [ "${TABLE_COUNT}" -eq 0 ]; then
    pass "Main database 'nst_events' contains 0 fixture tables; drift check operated strictly in shadow database"
  else
    fail "Database isolation check" "Main database 'nst_events' has ${TABLE_COUNT} fixture tables"
  fi

  # ---------------------------------------------------------------------------
  # Test 11: Real Repository Working-Tree Baseline Audit
  # ---------------------------------------------------------------------------
  echo ""
  echo "Test 11: Real repository baseline check honestly reports working tree state"

  set +e
  REAL_OUT=$(SHADOW_DATABASE_URL="${TEST_SHADOW_URL}" "${SCRIPT}" 2>&1)
  REAL_EXIT=$?
  set -e

  if [ $REAL_EXIT -eq 0 ] && echo "${REAL_OUT}" | grep -q "Schema and migration history are in parity"; then
    pass "Real repository working tree is verified in full parity with migration history (exit code 0)"
  elif [ $REAL_EXIT -eq 2 ] && echo "${REAL_OUT}" | grep -q "Schema-to-migration drift detected"; then
    pass "Real repository drift check accurately executes and detects existing discrepancies (exit code 2)"
  else
    fail "Real repository baseline audit check" "Exit: ${REAL_EXIT}, Output: ${REAL_OUT}"
  fi

else
  echo "  ⚠️ Warning: Docker unavailable; skipping live container fixture tests."
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "================================================================================"
echo "TEST RESULTS: ${PASS_COUNT}/${TEST_COUNT} passed (${FAIL_COUNT} failed)"
echo "================================================================================"

if [ $FAIL_COUNT -eq 0 ]; then
  exit 0
else
  exit 1
fi
