#!/usr/bin/env bash
#
# deploy-rollout.test.sh
# Focused verification suite for scripts/deploy-rollout.sh
# Tests: argument parsing, successful rollout, first deploy failure handling,
# safe rollback without migrations, migration-aware gating, operator overrides,
# expand/contract certification, and secondary rollback failure.
#
set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${REPO_ROOT}/scripts/deploy-rollout.sh"

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

TEMP_DIR=$(mktemp -d)
MOCK_BIN="${TEMP_DIR}/bin"
mkdir -p "${MOCK_BIN}"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

echo "================================================================================"
echo "RUNNING VERIFICATION SUITE: DEPLOY ROLLOUT & ROLLBACK COMPATIBILITY GATING"
echo "================================================================================"

# -----------------------------------------------------------------------------
# Test 1: Missing arguments error
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: Usage error on missing deployment argument"
set +e
OUT=$(bash "${SCRIPT}" 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$OUT" | grep -q "Usage:"; then
  pass "Fails with non-zero exit code and displays usage when no deployment is specified"
else
  fail "Argument check" "Expected usage error, got exit code $EXIT_CODE: $OUT"
fi

# -----------------------------------------------------------------------------
# Test 2: Successful rollout
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: Successful forward rollout"
cat << 'EOF' > "${MOCK_BIN}/kubectl"
#!/usr/bin/env bash
if [[ "$*" =~ "rollout history" ]]; then
  echo "REVISION"
  echo "1"
  echo "2"
  exit 0
elif [[ "$*" =~ "rollout status" ]]; then
  echo "deployment nst-api successfully rolled out"
  exit 0
fi
exit 0
EOF
chmod +x "${MOCK_BIN}/kubectl"

set +e
OUT=$(PATH="${MOCK_BIN}:${PATH}" bash "${SCRIPT}" nst-api nst-events 10s 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -eq 0 ] && echo "$OUT" | grep -q "SUCCESS: deployment/nst-api rollout completed successfully"; then
  pass "Rollout passes immediately when kubectl rollout status succeeds (exit 0)"
else
  fail "Successful rollout" "Expected exit 0, got $EXIT_CODE: $OUT"
fi

# -----------------------------------------------------------------------------
# Test 3: First deploy failure (no rollback target)
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: First deploy failure detection (<= 1 revision)"
cat << 'EOF' > "${MOCK_BIN}/kubectl"
#!/usr/bin/env bash
if [[ "$*" =~ "rollout history" ]]; then
  echo "REVISION"
  echo "1"
  exit 0
elif [[ "$*" =~ "rollout status" ]]; then
  echo "error: deployment nst-api rollout failed: timed out" >&2
  exit 1
elif [[ "$*" =~ "rollout undo" ]]; then
  echo "ERROR: kubectl rollout undo should NOT have been called!" >&2
  exit 99
elif [[ "$*" =~ "get pods" ]] || [[ "$*" =~ "get events" ]]; then
  exit 0
fi
exit 0
EOF
chmod +x "${MOCK_BIN}/kubectl"

set +e
OUT=$(PATH="${MOCK_BIN}:${PATH}" bash "${SCRIPT}" nst-api nst-events 10s 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$OUT" | grep -q "CRITICAL: first deploy failed, no rollback target"; then
  pass "Detects single revision, does not attempt rollback undo, exits with failure"
else
  fail "First deploy failure" "Expected first deploy failure error, got exit code $EXIT_CODE: $OUT"
fi

# -----------------------------------------------------------------------------
# Test 4: Rollout failure without migrations (safe container rollback)
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: Rollout failure without migrations (initiates safe container rollback)"
cat << 'EOF' > "${MOCK_BIN}/kubectl"
#!/usr/bin/env bash
if [[ "$*" =~ "rollout history" ]]; then
  echo "REVISION"
  echo "1"
  echo "2"
  exit 0
elif [[ "$*" =~ "rollout status" ]]; then
  # Fail first status (forward rollout), succeed second status (rollback)
  STATUS_COUNT_FILE="/tmp/nst_test_rollout_status_count"
  COUNT=$(cat "$STATUS_COUNT_FILE" 2>/dev/null || echo 0)
  COUNT=$((COUNT + 1))
  echo "$COUNT" > "$STATUS_COUNT_FILE"
  if [ "$COUNT" -eq 1 ]; then
    echo "error: rollout failed" >&2
    exit 1
  else
    echo "deployment successfully rolled back"
    exit 0
  fi
elif [[ "$*" =~ "rollout undo" ]]; then
  echo "deployment.apps/nst-api rolled back"
  exit 0
fi
exit 0
EOF
chmod +x "${MOCK_BIN}/kubectl"
rm -f /tmp/nst_test_rollout_status_count

set +e
OUT=$(PATH="${MOCK_BIN}:${PATH}" bash "${SCRIPT}" nst-api nst-events 10s 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$OUT" | grep -q "Initiating rollback via 'kubectl rollout undo'" && echo "$OUT" | grep -q "ALERT: Deployment failed; container rolled back to previous revision"; then
  pass "Rollout failure without migrations performs kubectl rollout undo and warns about un-reverted DB state"
else
  fail "Rollout failure without migrations" "Expected container rollback, got exit code $EXIT_CODE: $OUT"
fi

# -----------------------------------------------------------------------------
# Test 5: Rollout failure WITH migrations and strict policy (rollback is gated)
# -----------------------------------------------------------------------------
echo ""
echo "Test 5: Rollout failure WITH migrations under strict policy (rollback gated)"
cat << 'EOF' > "${MOCK_BIN}/kubectl"
#!/usr/bin/env bash
if [[ "$*" =~ "rollout history" ]]; then
  echo "REVISION"
  echo "1"
  echo "2"
  exit 0
elif [[ "$*" =~ "rollout status" ]]; then
  echo "error: rollout timed out" >&2
  exit 1
elif [[ "$*" =~ "rollout undo" ]]; then
  echo "CRITICAL DEFECT: kubectl rollout undo should NOT be called when migrations are applied and unverified!" >&2
  exit 99
elif [[ "$*" =~ "get pods" ]]; then
  exit 0
fi
exit 0
EOF
chmod +x "${MOCK_BIN}/kubectl"

set +e
OUT=$(PATH="${MOCK_BIN}:${PATH}" bash "${SCRIPT}" nst-api nst-events 10s --migration-applied 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$OUT" | grep -q "CRITICAL: Rollback Gated — Forward database migrations were applied"; then
  pass "Blocks automatic container rollback when forward DB migrations were applied under strict policy"
else
  fail "Migration-aware gating" "Expected rollback to be gated, got exit code $EXIT_CODE: $OUT"
fi

# -----------------------------------------------------------------------------
# Test 6: Rollout failure WITH migrations + explicit operator override flag
# -----------------------------------------------------------------------------
echo ""
echo "Test 6: Rollout failure WITH migrations and --allow-unverified-rollback flag"
cat << 'EOF' > "${MOCK_BIN}/kubectl"
#!/usr/bin/env bash
if [[ "$*" =~ "rollout history" ]]; then
  echo "REVISION"
  echo "1"
  echo "2"
  exit 0
elif [[ "$*" =~ "rollout status" ]]; then
  STATUS_COUNT_FILE="/tmp/nst_test_rollout_status_count_override"
  COUNT=$(cat "$STATUS_COUNT_FILE" 2>/dev/null || echo 0)
  COUNT=$((COUNT + 1))
  echo "$COUNT" > "$STATUS_COUNT_FILE"
  if [ "$COUNT" -eq 1 ]; then
    echo "error: rollout failed" >&2
    exit 1
  else
    echo "deployment successfully rolled back"
    exit 0
  fi
elif [[ "$*" =~ "rollout undo" ]]; then
  echo "deployment.apps/nst-api rolled back"
  exit 0
fi
exit 0
EOF
chmod +x "${MOCK_BIN}/kubectl"
rm -f /tmp/nst_test_rollout_status_count_override

set +e
OUT=$(PATH="${MOCK_BIN}:${PATH}" bash "${SCRIPT}" nst-api nst-events 10s --migration-applied --allow-unverified-rollback 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$OUT" | grep -q "WARNING: Unverified rollback explicitly authorized by operator override" && echo "$OUT" | grep -q "Initiating rollback via 'kubectl rollout undo'"; then
  pass "Proceeds with rollback when operator explicitly passes --allow-unverified-rollback"
else
  fail "Operator override flag" "Expected authorized rollback, got exit code $EXIT_CODE: $OUT"
fi

# -----------------------------------------------------------------------------
# Test 7: Rollout failure WITH migrations + expand_contract_verified policy
# -----------------------------------------------------------------------------
echo ""
echo "Test 7: Rollout failure WITH migrations and --compatibility-policy=expand_contract_verified"
rm -f /tmp/nst_test_rollout_status_count_override

set +e
OUT=$(PATH="${MOCK_BIN}:${PATH}" bash "${SCRIPT}" nst-api nst-events 10s --migration-applied --compatibility-policy=expand_contract_verified 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$OUT" | grep -q "Rollback compatibility verified under expand/contract discipline" && echo "$OUT" | grep -q "Initiating rollback via 'kubectl rollout undo'"; then
  pass "Proceeds with rollback when policy certifies expand/contract backward compatibility"
else
  fail "Expand/contract policy" "Expected certified rollback, got exit code $EXIT_CODE: $OUT"
fi

# -----------------------------------------------------------------------------
# Test 8: Rollback execution itself fails
# -----------------------------------------------------------------------------
echo ""
echo "Test 8: Failure when rollback itself fails or times out"
cat << 'EOF' > "${MOCK_BIN}/kubectl"
#!/usr/bin/env bash
if [[ "$*" =~ "rollout history" ]]; then
  echo "REVISION"
  echo "1"
  echo "2"
  exit 0
elif [[ "$*" =~ "rollout status" ]]; then
  echo "error: rollout status failed" >&2
  exit 1
elif [[ "$*" =~ "rollout undo" ]]; then
  echo "deployment.apps/nst-api rolled back"
  exit 0
fi
exit 0
EOF
chmod +x "${MOCK_BIN}/kubectl"

set +e
OUT=$(PATH="${MOCK_BIN}:${PATH}" bash "${SCRIPT}" nst-api nst-events 10s 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$OUT" | grep -q "CRITICAL: Rollback itself failed or timed out!"; then
  pass "Reports critical failure when rollback itself fails"
else
  fail "Rollback failure" "Expected critical rollback failure, got exit code $EXIT_CODE: $OUT"
fi

# Clean up temp files
rm -f /tmp/nst_test_rollout_status_count*

echo ""
echo "================================================================================"
echo "DEPLOY ROLLOUT VERIFICATION SUITE RESULTS: ${PASS_COUNT}/${TEST_COUNT} PASSED (${FAIL_COUNT} FAILED)"
echo "================================================================================"

if [ $FAIL_COUNT -eq 0 ]; then
  exit 0
else
  exit 1
fi
