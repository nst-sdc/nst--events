#!/usr/bin/env bash
#
# recover-migration-lease.sh
# Safe, guarded operator recovery of orphaned Kubernetes migration Leases
#
# Enforces:
# 1. Mandatory, operator-supplied expected holderIdentity (prevents blind owner adoption).
# 2. Strict workload inspection: fails closed if any migration Job or non-terminal pod is active.
# 3. Fail-closed error handling: API query errors or malformed input abort immediately.
# 4. Atomic RFC 6902 JSON Patch testing both resourceVersion and expected holderIdentity.
# 5. Zero unconditional deletions: never issues 'kubectl delete lease'.
# 6. Explicit distinction: clearing coordination Lease does not terminate or roll back database DDL.
#
set -eo pipefail

EXPECTED_HOLDER="$1"
NAMESPACE="${2:-nst-events}"
LOCK_NAME="${3:-nst-migration-lock}"

echo "=== Guarded Migration Lease Recovery ==="
echo "Target Lease:      ${LOCK_NAME}"
echo "Namespace:         ${NAMESPACE}"
echo "Expected Orphan:   ${EXPECTED_HOLDER:-<UNSET>}"
echo "========================================="

# 1. Validate Input: Expected holderIdentity must be explicitly supplied and non-empty
TRIMMED_HOLDER="$(echo "${EXPECTED_HOLDER}" | tr -d '[:space:]')"
if [ -z "${TRIMMED_HOLDER}" ]; then
  echo "CRITICAL: An explicit, non-empty <expected-holder-identity> must be provided." >&2
  echo "Usage: $0 <expected-holder-identity> [namespace] [lock-name]" >&2
  echo "Example: $0 nst-db-migrate-sha-run123-pid456 nst-events" >&2
  echo "" >&2
  echo "NOTE: An operator must first investigate the orphaned runner and supply" >&2
  echo "the exact holderIdentity established during verification." >&2
  exit 1
fi

# 2. Workload Inspection: Ensure no migration Job or non-terminal Pod is executing
echo ">>> Step 1: Checking for active migration workload in namespace '${NAMESPACE}'..."

# Query all Jobs labeled app=nst-migration
set +e
JOBS_JSON=$(kubectl get jobs -n "${NAMESPACE}" -l app=nst-migration -o json 2>/dev/null)
JOB_STATUS=$?
set -e

if [ $JOB_STATUS -ne 0 ] || [ -z "$JOBS_JSON" ]; then
  echo "CRITICAL: API failure querying migration Jobs in namespace '${NAMESPACE}'. Failing closed." >&2
  exit 1
fi

ACTIVE_JOBS=$(echo "$JOBS_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    items = data.get('items', [])
    active = [j.get('metadata', {}).get('name', 'job') for j in items if j.get('status', {}).get('active', 0) > 0]
    print(' '.join(active))
except Exception:
    sys.exit(1)
" 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "CRITICAL: Failed to parse migration Jobs JSON in namespace '${NAMESPACE}'. Failing closed." >&2
  exit 1
fi

if [ -n "$ACTIVE_JOBS" ]; then
  echo "CRITICAL: Active migration Job(s) detected in '${NAMESPACE}': ${ACTIVE_JOBS}" >&2
  echo "Refusing to recover lock. Clearing a Lease does not stop or abort database operations." >&2
  echo "Wait for the migration Job to complete, or terminate it safely before attempting recovery." >&2
  exit 1
fi

# Query all Pods labeled app=nst-migration
set +e
PODS_JSON=$(kubectl get pods -n "${NAMESPACE}" -l app=nst-migration -o json 2>/dev/null)
POD_STATUS=$?
set -e

if [ $POD_STATUS -ne 0 ] || [ -z "$PODS_JSON" ]; then
  echo "CRITICAL: API failure querying migration Pods in namespace '${NAMESPACE}'. Failing closed." >&2
  exit 1
fi

ACTIVE_PODS=$(echo "$PODS_JSON" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    items = data.get('items', [])
    active = []
    for p in items:
        meta = p.get('metadata', {})
        name = meta.get('name', 'pod')
        phase = p.get('status', {}).get('phase', 'Unknown')
        has_deletion = 'deletionTimestamp' in meta
        if phase not in ['Succeeded', 'Failed'] or has_deletion:
            active.append(f'{name}({phase})')
    print(' '.join(active))
except Exception:
    sys.exit(1)
" 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "CRITICAL: Failed to parse migration Pods JSON in namespace '${NAMESPACE}'. Failing closed." >&2
  exit 1
fi

if [ -n "$ACTIVE_PODS" ]; then
  echo "CRITICAL: Active or pending migration Pod(s) detected in '${NAMESPACE}': ${ACTIVE_PODS}" >&2
  echo "Refusing to recover lock. Clearing a Lease does not stop in-flight database operations." >&2
  echo "Ensure all migration pods have fully completed or terminated before recovering the lock." >&2
  exit 1
fi

echo "  -> Confirmed: 0 active migration Jobs and 0 non-terminal Pods in '${NAMESPACE}'."

# 3. Retrieve and Inspect Current Lease State
echo ">>> Step 2: Retrieving current Lease '${LOCK_NAME}' in namespace '${NAMESPACE}'..."
set +e
LEASE_JSON=$(kubectl get lease "${LOCK_NAME}" -n "${NAMESPACE}" -o json 2>/dev/null)
LEASE_STATUS=$?
set -e

if [ $LEASE_STATUS -ne 0 ] || [ -z "$LEASE_JSON" ]; then
  echo "CRITICAL: Could not retrieve Lease '${LOCK_NAME}' in namespace '${NAMESPACE}' (API failure or not found)." >&2
  exit 1
fi

CURRENT_HOLDER=$(echo "$LEASE_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('spec', {}).get('holderIdentity') or '')" 2>/dev/null || echo "")
CURRENT_RV=$(echo "$LEASE_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('metadata', {}).get('resourceVersion', ''))" 2>/dev/null || echo "")

if [ -z "$CURRENT_RV" ]; then
  echo "CRITICAL: Could not determine resourceVersion for Lease '${LOCK_NAME}'. Failing closed." >&2
  exit 1
fi

# 4. Verify Holder: Must not be already free, and must strictly match operator-supplied expected identity
if [ -z "$CURRENT_HOLDER" ]; then
  echo "WARNING: Lease '${LOCK_NAME}' is already free/unowned (holderIdentity is empty)." >&2
  echo "No recovery mutation required. Refusing redundant modification." >&2
  exit 1
fi

if [ "$CURRENT_HOLDER" != "$EXPECTED_HOLDER" ]; then
  echo "CRITICAL: Holder mismatch on Lease '${LOCK_NAME}' in namespace '${NAMESPACE}'!" >&2
  echo "  Operator expected orphan: '${EXPECTED_HOLDER}'" >&2
  echo "  Actual current holder:    '${CURRENT_HOLDER}'" >&2
  echo "Refusing to mutate Lease. The Lease was acquired by a different owner or updated since inspection." >&2
  exit 1
fi

echo "  -> Confirmed: Current holder '${CURRENT_HOLDER}' matches expected orphan."
echo "  -> Current resourceVersion: ${CURRENT_RV}"

# 5. Execute Atomic Owner-Bound Patch
echo ">>> Step 3: Executing atomic owner-bound recovery patch..."
set +e
PATCH_OUT=$(kubectl patch lease "${LOCK_NAME}" -n "${NAMESPACE}" --type='json' -p="[
  {\"op\": \"test\", \"path\": \"/metadata/resourceVersion\", \"value\": \"${CURRENT_RV}\"},
  {\"op\": \"test\", \"path\": \"/spec/holderIdentity\", \"value\": \"${EXPECTED_HOLDER}\"},
  {\"op\": \"add\", \"path\": \"/spec/holderIdentity\", \"value\": \"\"}
]" 2>&1)
PATCH_EXIT=$?
set -e

if [ $PATCH_EXIT -ne 0 ]; then
  echo "CRITICAL: Atomic recovery patch failed (exit code: ${PATCH_EXIT})." >&2
  echo "Error details: ${PATCH_OUT}" >&2
  echo "Precondition failed: The Lease was modified concurrently. No changes were applied." >&2
  exit 1
fi

# 6. Confirm Mutation Success via API Query
echo ">>> Step 4: Confirming recovery success via Kubernetes API..."
set +e
VERIFY_JSON=$(kubectl get lease "${LOCK_NAME}" -n "${NAMESPACE}" -o json 2>/dev/null)
VERIFY_EXIT=$?
set -e

if [ $VERIFY_EXIT -ne 0 ] || [ -z "$VERIFY_JSON" ]; then
  echo "CRITICAL: Could not re-query Lease '${LOCK_NAME}' to confirm recovery. Verification failed." >&2
  exit 1
fi

FINAL_HOLDER=$(echo "$VERIFY_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('spec', {}).get('holderIdentity') or '')" 2>/dev/null || echo "UNKNOWN")

if [ "$FINAL_HOLDER" != "" ]; then
  echo "CRITICAL: Verification failed: Lease holder is '${FINAL_HOLDER}' instead of empty. Refusing to report success." >&2
  exit 1
fi

echo "================================================================================"
echo "SUCCESS: Orphaned migration lock '${LOCK_NAME}' was cleanly recovered!"
echo "  Previous Holder: '${EXPECTED_HOLDER}'"
echo "  New Holder:      '' (unowned / free)"
echo "  Namespace:       '${NAMESPACE}'"
echo "================================================================================"
echo "NOTE: This recovery operation cleared the coordination Lease lock only."
echo "It did not stop, abort, or roll back database DDL operations."
echo "Deployments may now proceed normally and will claim the free lock."
exit 0
