#!/usr/bin/env bash
#
# check-schema-drift.sh
# Automated Schema-to-Migration Drift Detection
#
# Compares the database structure produced by the complete Prisma migration history
# against the current Prisma schema datamodel using Prisma's native `migrate diff`.
#
# Exit codes:
#   0: No drift detected (schema and migration history in parity)
#   1: Configuration, CLI, or database connection error (fail closed)
#   2: Schema-to-migration drift detected (structural differences found)
#
set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="${REPO_ROOT}/packages/database"

# Allow environment overrides for isolated testing fixtures
SCHEMA_PATH="${PRISMA_SCHEMA_OVERRIDE:-${DB_DIR}/prisma/schema.prisma}"
MIGRATIONS_DIR="${PRISMA_MIGRATIONS_OVERRIDE:-${DB_DIR}/prisma/migrations}"
SHADOW_DB_URL="${SHADOW_DATABASE_URL:-${1}}"

# 1. Input & Path Validation
if [ -z "${SHADOW_DB_URL}" ]; then
  echo "CRITICAL: Missing required shadow database URL." >&2
  echo "Usage: SHADOW_DATABASE_URL=<url> $0" >&2
  echo "   or: $0 <shadow-database-url>" >&2
  echo "Example: $0 postgresql://postgres:postgres@localhost:5432/nst_events_shadow" >&2
  exit 1
fi

if [ ! -f "${SCHEMA_PATH}" ]; then
  echo "CRITICAL: Prisma schema file not found at '${SCHEMA_PATH}'." >&2
  exit 1
fi

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "CRITICAL: Migrations directory not found at '${MIGRATIONS_DIR}'." >&2
  exit 1
fi

# Sanitize/mask credentials for log output
MASKED_SHADOW_URL=$(echo "${SHADOW_DB_URL}" | sed -E 's/:\/\/([^:]+):([^@]+)@/:\/\/\1:***@/')

echo "================================================================================"
echo "PRISMA SCHEMA-TO-MIGRATION DRIFT DETECTION"
echo "================================================================================"
echo "Schema Target:     ${SCHEMA_PATH}"
echo "Migrations Target: ${MIGRATIONS_DIR}"
echo "Shadow Database:   ${MASKED_SHADOW_URL}"
echo "================================================================================"

# 2. Execute Prisma migrate diff with exit code signaling
set +e
DIFF_OUTPUT=$(pnpm --filter @nst/database exec prisma migrate diff \
  --from-migrations "${MIGRATIONS_DIR}" \
  --to-schema-datamodel "${SCHEMA_PATH}" \
  --shadow-database-url "${SHADOW_DB_URL}" \
  --exit-code 2>&1)
RAW_EXIT=$?
set -e

# Mask any credentials that might be emitted in stderr or connection error messages
SANITIZED_DIFF_OUTPUT=$(echo "${DIFF_OUTPUT}" | sed -E 's/:\/\/([^:]+):([^@]+)@/:\/\/\1:***@/g')

# 3. Handle Exit Codes & Diagnostics
# Prisma migrate diff --exit-code returns:
#   0: No differences detected
#   1: Generic error (connection failure, invalid schema, engine error)
#   2: Differences detected (pnpm may report this as exit 1 with 'failed with exit code 2')
if [ $RAW_EXIT -eq 0 ]; then
  echo "✅ SUCCESS: Schema and migration history are in parity. No drift detected."
  exit 0
elif [ $RAW_EXIT -eq 2 ] || echo "${DIFF_OUTPUT}" | grep -q "Changed the " || echo "${DIFF_OUTPUT}" | grep -q "failed with exit code 2"; then
  echo "❌ CRITICAL: Schema-to-migration drift detected!" >&2
  echo "The Prisma schema has diverged from the structure produced by the migration history." >&2
  echo "A schema change is missing its corresponding migration, or the migration history is incomplete." >&2
  echo "" >&2
  echo "--- Structural Differences Detected ---" >&2
  echo "${SANITIZED_DIFF_OUTPUT}" >&2
  echo "----------------------------------------" >&2
  exit 2
else
  echo "❌ ERROR: Prisma migrate diff execution failed (exit code: ${RAW_EXIT})." >&2
  echo "Diagnostic details:" >&2
  echo "${SANITIZED_DIFF_OUTPUT}" >&2
  exit 1
fi
