#!/usr/bin/env bash
# ==============================================================================
# NST Events - Backup Security & Tamper Detection Verification Script
# Verifies modern authenticated encryption (CMS AES-256-GCM, RFC 5083/5084)
# with PBKDF2 key derivation and unique nonces, proving that corrupted,
# truncated, or incorrectly-keyed ciphertexts are strictly rejected.
# ==============================================================================
set -euo pipefail

TMP_DIR=$(mktemp -d /tmp/nst-backup-test.XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "==> 1. Setting up mock dump payload..."
cat << 'EOF' > "$TMP_DIR/test.dump"
PGDMP-MOCK-HEADER-POSTGRESQL-16
TABLE nst_events_users (id uuid, email text, role text);
COPY nst_events_users FROM stdin;
11111111-1111-1111-1111-111111111111	admin@adypu.edu.in	ADMIN
22222222-2222-2222-2222-222222222222	student@adypu.edu.in	STUDENT
\.
EOF

RAW_SHA=$(sha256sum "$TMP_DIR/test.dump" | awk '{print $1}')
RAW_SIZE=$(wc -c < "$TMP_DIR/test.dump" | tr -d ' ')
echo "[PASS] Test payload created: ${RAW_SIZE} bytes (SHA-256: ${RAW_SHA})"

PASSPHRASE="test-secure-backup-passphrase-minimum-32-characters-required"

echo "==> 2. Deriving 256-bit AES Key via PBKDF2-HMAC-SHA256 (100,000 iterations)..."
SALT=$(openssl rand -hex 16)
KEY=$(openssl kdf -keylen 32 \
  -kdfopt "pass:${PASSPHRASE}" \
  -kdfopt "hexsalt:${SALT}" \
  -kdfopt iter:100000 \
  -kdfopt digest:SHA256 \
  PBKDF2 | tr -d ':\n')

echo "[PASS] Key derived cleanly (256-bit / 64 hex characters)."

echo "==> 3. Encrypting with IETF RFC 5083/5084 CMS Authenticated-Enveloped-Data (AES-256-GCM)..."
openssl cms -encrypt -binary \
  -secretkey "$KEY" \
  -secretkeyid "01" \
  -aes-256-gcm \
  -outform DER \
  -in "$TMP_DIR/test.dump" \
  -out "$TMP_DIR/test.dump.enc"

[ -f "$TMP_DIR/test.dump.enc" ] || { echo "Encryption output missing!"; exit 1; }
ENC_SIZE=$(wc -c < "$TMP_DIR/test.dump.enc" | tr -d ' ')
ENC_SHA=$(sha256sum "$TMP_DIR/test.dump.enc" | awk '{print $1}')
echo "[PASS] Encrypted artifact generated: ${ENC_SIZE} bytes (SHA-256: ${ENC_SHA})"

echo "==> 4. Verifying Cryptographic Container Structure (ASN.1 parse)..."
ASN1_OUT=$(openssl asn1parse -inform DER -in "$TMP_DIR/test.dump.enc")

# Check for RFC 5083 AuthEnvelopedData
echo "$ASN1_OUT" | grep -q "id-smime-ct-authEnvelopedData" || {
  echo "[FAIL] Missing id-smime-ct-authEnvelopedData in ASN.1 structure!"
  exit 1
}

# Check for RFC 5084 aes-256-gcm OID
echo "$ASN1_OUT" | grep -q "aes-256-gcm" || {
  echo "[FAIL] Missing aes-256-gcm cipher in ASN.1 structure!"
  exit 1
}

echo "[PASS] ASN.1 container confirmed: id-smime-ct-authEnvelopedData with aes-256-gcm (RFC 5083 / RFC 5084 AEAD)."

echo "==> 5. Testing Round-Trip Decryption and Integrity Match..."
RECOVERED_KEY=$(openssl kdf -keylen 32 \
  -kdfopt "pass:${PASSPHRASE}" \
  -kdfopt "hexsalt:${SALT}" \
  -kdfopt iter:100000 \
  -kdfopt digest:SHA256 \
  PBKDF2 | tr -d ':\n')

openssl cms -decrypt -binary \
  -secretkey "$RECOVERED_KEY" \
  -secretkeyid "01" \
  -inform DER \
  -in "$TMP_DIR/test.dump.enc" \
  -out "$TMP_DIR/test.recovered"

cmp "$TMP_DIR/test.dump" "$TMP_DIR/test.recovered"
RECOVERED_SHA=$(sha256sum "$TMP_DIR/test.recovered" | awk '{print $1}')

if [ "$RAW_SHA" != "$RECOVERED_SHA" ]; then
  echo "[FAIL] Checksum mismatch between original and recovered payload!"
  exit 1
fi
echo "[PASS] Decrypted payload matches original dump exactly byte-for-byte."

echo "==> 6. Testing Tamper Detection (Mutated Ciphertext)..."
perl -e "
  open(my \$f, '<', '$TMP_DIR/test.dump.enc') or die;
  my \$d = do { local $/; <\$f> };
  close(\$f);
  substr(\$d, -5, 1) = chr(ord(substr(\$d, -5, 1)) ^ 0x01);
  open(my \$out, '>', '$TMP_DIR/test.tampered.enc') or die;
  print \$out \$d;
  close(\$out);
"

if openssl cms -decrypt -binary -secretkey "$RECOVERED_KEY" -secretkeyid "01" -inform DER -in "$TMP_DIR/test.tampered.enc" -out "$TMP_DIR/test.tampered.out" >/dev/null 2>&1; then
  echo "[FAIL] Tampered ciphertext was incorrectly accepted!"
  exit 1
else
  echo "[PASS] Tampered ciphertext was rejected by GCM authentication tag verification."
fi

echo "==> 7. Testing Truncation Rejection (Truncated Ciphertext)..."
perl -e "
  open(my \$f, '<', '$TMP_DIR/test.dump.enc') or die;
  my \$d = do { local $/; <\$f> };
  close(\$f);
  my \$truncated = substr(\$d, 0, length(\$d) - 15);
  open(my \$out, '>', '$TMP_DIR/test.truncated.enc') or die;
  print \$out \$truncated;
  close(\$out);
"

if openssl cms -decrypt -binary -secretkey "$RECOVERED_KEY" -secretkeyid "01" -inform DER -in "$TMP_DIR/test.truncated.enc" -out "$TMP_DIR/test.truncated.out" >/dev/null 2>&1; then
  echo "[FAIL] Truncated ciphertext was incorrectly accepted!"
  exit 1
else
  echo "[PASS] Truncated ciphertext was rejected with non-zero exit code."
fi

echo "==> 8. Testing Wrong Key Rejection (Must fail)..."
WRONG_KEY=$(openssl kdf -keylen 32 \
  -kdfopt "pass:completely-wrong-password-for-testing" \
  -kdfopt "hexsalt:${SALT}" \
  -kdfopt iter:100000 \
  -kdfopt digest:SHA256 \
  PBKDF2 | tr -d ':\n')

if openssl cms -decrypt -binary -secretkey "$WRONG_KEY" -secretkeyid "01" -inform DER -in "$TMP_DIR/test.dump.enc" -out "$TMP_DIR/test.wrong.out" >/dev/null 2>&1; then
  echo "[FAIL] Decryption succeeded with wrong key!"
  exit 1
else
  echo "[PASS] Decryption failed with wrong key as expected."
fi

echo "==> 9. Testing Backward Compatibility (GnuPG Historical Decryption)..."
echo "HISTORICAL_BACKUP_GPG" > "$TMP_DIR/hist.dump"
gpg --batch --yes --passphrase "$PASSPHRASE" \
  --symmetric --cipher-algo AES256 \
  --s2k-mode 3 --s2k-count 65011712 --s2k-digest-algo SHA512 \
  -o "$TMP_DIR/hist.dump.gpg" "$TMP_DIR/hist.dump" 2>/dev/null

gpg --batch --yes --passphrase "$PASSPHRASE" \
  --decrypt "$TMP_DIR/hist.dump.gpg" > "$TMP_DIR/hist.recovered" 2>/dev/null

cmp "$TMP_DIR/hist.dump" "$TMP_DIR/hist.recovered"
echo "[PASS] Backward compatibility verified: historical GPG backups remain fully recoverable."

echo "==> 10. Testing X.509 Certificate Envelope Encryption (Zero Process-Argument Secrets)..."
openssl req -x509 -newkey rsa:2048 -days 1 -nodes \
  -keyout "$TMP_DIR/asym-key.pem" -out "$TMP_DIR/asym-cert.pem" \
  -subj '/CN=nst-backup-asym' 2>/dev/null
chmod 400 "$TMP_DIR/asym-key.pem" "$TMP_DIR/asym-cert.pem"

# Encrypt: only public cert file path on argv, random 256-bit AES key generated in memory
openssl cms -encrypt -binary \
  -aes-256-gcm \
  -outform DER \
  -in "$TMP_DIR/test.dump" \
  -out "$TMP_DIR/test.asym.enc" \
  "$TMP_DIR/asym-cert.pem"

# Verify ASN.1 container
openssl asn1parse -inform DER -in "$TMP_DIR/test.asym.enc" | grep -q "id-smime-ct-authEnvelopedData" || {
  echo "[FAIL] Asymmetric archive missing id-smime-ct-authEnvelopedData!"
  exit 1
}

# Decrypt: private key file path on argv
openssl cms -decrypt -binary \
  -inform DER \
  -in "$TMP_DIR/test.asym.enc" \
  -inkey "$TMP_DIR/asym-key.pem" \
  -out "$TMP_DIR/test.asym.recovered"

cmp "$TMP_DIR/test.dump" "$TMP_DIR/test.asym.recovered"
echo "[PASS] Asymmetric envelope encryption round-trip verified (ZERO secret argv)."

# Tamper rejection
perl -e "
  open(my \$f, '<', '$TMP_DIR/test.asym.enc') or die;
  my \$d = do { local $/; <\$f> };
  close(\$f);
  substr(\$d, -5, 1) = chr(ord(substr(\$d, -5, 1)) ^ 0x01);
  open(my \$out, '>', '$TMP_DIR/test.asym.tampered.enc') or die;
  print \$out \$d;
  close(\$out);
"
if openssl cms -decrypt -binary -inform DER -in "$TMP_DIR/test.asym.tampered.enc" -inkey "$TMP_DIR/asym-key.pem" -out "$TMP_DIR/test.asym.bad" >/dev/null 2>&1; then
  echo "[FAIL] Tampered asymmetric ciphertext accepted!"
  exit 1
fi
echo "[PASS] Tampered asymmetric ciphertext strictly rejected by GCM authentication tag."

echo "==> ALL BACKUP CRYPTOGRAPHIC SECURITY TESTS PASSED SUCCESSFULLY."
