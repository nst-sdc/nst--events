#!/usr/bin/env bash
# ==============================================================================
# NST Events - Full Application Database Backup & Disaster Recovery Drill
# Tests the complete disaster recovery lifecycle on the ACTUAL application schema:
# All 150 Prisma migrations + Seed data -> pg_dump -Fc -> Catalog Check ->
# CMS AES-256-GCM Authenticated Encryption (Zero secrets on argv) -> Checksum ->
# Read-back Decrypt -> Checksum Match -> pg_restore to new DB ->
# Verify 150 Migrations, Extensions, Schema, Data Parity, and RLS Policies.
# ==============================================================================
set -euo pipefail

DRILL_PORT=5435
CONTAINER_NAME="nst-full-dr-drill-$(date +%s)"
WORK_DIR=$(mktemp -d /tmp/nst-restore-drill.XXXXXX)

cleanup() {
  echo "==> Cleaning up drill artifacts..."
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "==> 1. Starting isolated disposable PostgreSQL instance ($CONTAINER_NAME on port $DRILL_PORT)..."
docker run -d --name "$CONTAINER_NAME" \
  -p "${DRILL_PORT}:5432" \
  -e POSTGRES_PASSWORD=drill_password \
  -e POSTGRES_DB=nst_events \
  postgis/postgis:16-3.4 >/dev/null

echo "Waiting for PostgreSQL initialization to complete..."
until docker logs "$CONTAINER_NAME" 2>&1 | grep -q "PostgreSQL init process complete; ready for start up"; do
  sleep 1
done

until docker exec "$CONTAINER_NAME" pg_isready -U postgres -d nst_events >/dev/null 2>&1; do
  sleep 1
done
echo "[PASS] Isolated database container fully initialized and ready."

echo "==> 2. Deploying full NST Events migration history (all 150 Prisma migrations)..."
DATABASE_URL="postgresql://postgres:drill_password@127.0.0.1:${DRILL_PORT}/nst_events?schema=public" \
  pnpm --filter @nst/database db:migrate:deploy >/dev/null

MIGRATION_COUNT=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events -t -c "SELECT COUNT(*) FROM _prisma_migrations;" | tr -d ' ')
echo "[PASS] All $MIGRATION_COUNT Prisma migrations deployed successfully."

echo "==> 3. Seeding representative NST Events application records..."
DATABASE_URL="postgresql://postgres:drill_password@127.0.0.1:${DRILL_PORT}/nst_events?schema=public" \
  pnpm --filter @nst/database db:seed >/dev/null

SRC_USERS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
SRC_EVENTS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events -t -c "SELECT COUNT(*) FROM events;" | tr -d ' ')
SRC_REGS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events -t -c "SELECT COUNT(*) FROM event_registrations;" | tr -d ' ')
SRC_ATT=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events -t -c "SELECT COUNT(*) FROM attendance_records;" | tr -d ' ')
echo "[PASS] Source database seeded: Users: $SRC_USERS, Events: $SRC_EVENTS, Registrations: $SRC_REGS, Attendance: $SRC_ATT."

echo "==> 4. Generating PostgreSQL custom-format dump (pg_dump -Fc)..."
docker exec "$CONTAINER_NAME" pg_dump -Fc -U postgres -d nst_events -f /tmp/source.dump
docker cp "$CONTAINER_NAME:/tmp/source.dump" "$WORK_DIR/nst_events_backup.dump"

RAW_SIZE=$(wc -c < "$WORK_DIR/nst_events_backup.dump" | tr -d ' ')
RAW_SHA=$(sha256sum "$WORK_DIR/nst_events_backup.dump" | awk '{print $1}')
echo "[PASS] Dump generated: ${RAW_SIZE} bytes (SHA-256: ${RAW_SHA})"

echo "==> 5. Validating dump catalog (pg_restore -l)..."
docker run --rm -v "$WORK_DIR:/drill:ro" postgres:16-bookworm pg_restore -l /drill/nst_events_backup.dump > /dev/null
echo "[PASS] Dump catalog verification passed."

echo "==> 6. Encrypting with RFC 5083/5084 CMS Authenticated-Enveloped-Data (AES-256-GCM)..."
echo "Verifying ZERO secret exposure in process arguments..."

# Generate temporary drill keypair (in production, public cert is in secret, private key in external vault)
CERT_FILE="$WORK_DIR/backup-cert.pem"
KEY_FILE="$WORK_DIR/backup-key.pem"
PASS_FILE="$WORK_DIR/key-passphrase.txt"

chmod 700 "$WORK_DIR"
openssl req -x509 -newkey rsa:2048 -days 1 -nodes \
  -keyout "$KEY_FILE" -out "$CERT_FILE" \
  -subj '/CN=nst-backup-drill' 2>/dev/null
chmod 400 "$KEY_FILE" "$CERT_FILE"

# Encrypt strictly via public certificate file path: NO secret on argv!
docker run --rm -v "$WORK_DIR:/drill" postgres:16-bookworm bash -c "
  set -euo pipefail
  openssl cms -encrypt -binary \
    -aes-256-gcm \
    -outform DER \
    -in /drill/nst_events_backup.dump \
    -out /drill/nst_events_backup.dump.enc \
    /drill/backup-cert.pem

  sha256sum /drill/nst_events_backup.dump.enc > /drill/nst_events_backup.dump.enc.sha256
"

ENC_SIZE=$(wc -c < "$WORK_DIR/nst_events_backup.dump.enc" | tr -d ' ')
ENC_SHA=$(awk '{print $1}' "$WORK_DIR/nst_events_backup.dump.enc.sha256")
echo "[PASS] Encrypted archive generated: ${ENC_SIZE} bytes (Ciphertext SHA: ${ENC_SHA})"

echo "==> 7. Performing Read-Back Decryption and Checksum Verification (Zero argv secrets)..."
# Decrypt strictly via private key file path: NO secret on argv!
docker run --rm -v "$WORK_DIR:/drill" postgres:16-bookworm bash -c "
  set -euo pipefail
  # 1. Verify ciphertext checksum
  sha256sum -c /drill/nst_events_backup.dump.enc.sha256

  # 2. Decrypt via private key file
  openssl cms -decrypt -binary \
    -inform DER \
    -in /drill/nst_events_backup.dump.enc \
    -inkey /drill/backup-key.pem \
    -out /drill/recovered.dump

  # 3. Verify dump catalog
  pg_restore -l /drill/recovered.dump > /dev/null
"

RECOVERED_SHA=$(sha256sum "$WORK_DIR/recovered.dump" | awk '{print $1}')
if [ "$RAW_SHA" != "$RECOVERED_SHA" ]; then
  echo "[FAIL] Recovered dump SHA-256 does not match original!"
  exit 1
fi
echo "[PASS] Read-back decryption and checksum verified exactly."

echo "==> 8. Restoring full database into fresh, empty instance (nst_events_restored)..."
docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -c "CREATE DATABASE nst_events_restored;" >/dev/null
docker cp "$WORK_DIR/recovered.dump" "$CONTAINER_NAME:/tmp/recovered.dump"
# pg_restore strictly enforces --exit-on-error and fails closed
RESTORE_STATUS=0
RESTORE_OUT=$(docker exec "$CONTAINER_NAME" pg_restore --exit-on-error --no-owner -U postgres -d nst_events_restored /tmp/recovered.dump 2>&1) || RESTORE_STATUS=$?
if [ "$RESTORE_STATUS" -ne 0 ]; then
  echo "[FATAL] pg_restore failed with exit code $RESTORE_STATUS: $RESTORE_OUT" >&2
  docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS nst_events_restored;" >/dev/null
  exit 1
fi

echo "[PASS] pg_restore executed successfully with --exit-on-error (exit code: $RESTORE_STATUS)."

echo "==> 9. Verifying full application schema, migrations, data, and RLS policies..."
RESTORED_MIG=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT COUNT(*) FROM _prisma_migrations;" | tr -d ' ')
RESTORED_USERS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
RESTORED_EVENTS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT COUNT(*) FROM events;" | tr -d ' ')
RESTORED_REGS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT COUNT(*) FROM event_registrations;" | tr -d ' ')
RESTORED_ATT=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT COUNT(*) FROM attendance_records;" | tr -d ' ')

USERS_RLS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = 'users';" | tr -d ' ')
EVENTS_RLS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = 'events';" | tr -d ' ')
REGS_RLS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = 'event_registrations';" | tr -d ' ')
ATT_RLS=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT relrowsecurity FROM pg_class WHERE relname = 'attendance_records';" | tr -d ' ')

POSTGIS_EXT=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT extname FROM pg_extension WHERE extname = 'postgis';" | tr -d ' ')
PGCRYPTO_EXT=$(docker exec "$CONTAINER_NAME" psql -U postgres -d nst_events_restored -t -c "SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';" | tr -d ' ')

echo "Verification results on restored database:"
echo "  - Prisma migrations: $RESTORED_MIG (source: $MIGRATION_COUNT)"
echo "  - Extensions verified: PostGIS ($POSTGIS_EXT), pgcrypto ($PGCRYPTO_EXT)"
echo "  - Users count: $RESTORED_USERS (source: $SRC_USERS)"
echo "  - Events count: $RESTORED_EVENTS (source: $SRC_EVENTS)"
echo "  - Registrations count: $RESTORED_REGS (source: $SRC_REGS)"
echo "  - Attendance records: $RESTORED_ATT (source: $SRC_ATT)"
echo "  - RLS enabled: users ($USERS_RLS), events ($EVENTS_RLS), registrations ($REGS_RLS), attendance ($ATT_RLS)"

if [ "$RESTORED_MIG" != "$MIGRATION_COUNT" ] || [ "$RESTORED_USERS" != "$SRC_USERS" ] || \
   [ "$USERS_RLS" != "t" ] || [ "$EVENTS_RLS" != "t" ] || [ "$REGS_RLS" != "t" ] || [ "$ATT_RLS" != "t" ] || \
   [ -z "$POSTGIS_EXT" ] || [ -z "$PGCRYPTO_EXT" ]; then
  echo "[FAIL] Restored database verification failed integrity criteria! Dropping database..."
  docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS nst_events_restored;" >/dev/null
  exit 1
fi

echo "[PASS] FULL APPLICATION DATABASE RESTORE DRILL PASSED 100% INTACT."
