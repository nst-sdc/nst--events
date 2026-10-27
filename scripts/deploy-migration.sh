#!/usr/bin/env bash
#
# deploy-migration.sh: Safe, idempotent execution of Kubernetes Prisma migration Jobs with atomic Lease ownership
#
set -eo pipefail

JOB_NAME="$1"
IMAGE="$2"
NAMESPACE="${3:-nst-events}"
TIMEOUT="${4:-300s}"

if [ -z "$JOB_NAME" ] || [ -z "$IMAGE" ]; then
  echo "Usage: $0 <job-name> <image> [namespace] [timeout]"
  exit 1
fi

TIMEOUT_SECS=$(echo "${TIMEOUT}" | sed 's/[^0-9]//g')
TIMEOUT_SECS="${TIMEOUT_SECS:-300}"
LOCK_DURATION=$(( TIMEOUT_SECS + 60 ))

# Unique lock holder identity for this execution
LOCK_HOLDER="${JOB_NAME}-${GITHUB_RUN_ID:-manual}-$$-${RANDOM}"
LOCK_NAME="nst-migration-lock"
LOCK_ACQUIRED="false"

echo "=== Deploying Database Migration: ${JOB_NAME} in namespace ${NAMESPACE} (timeout: ${TIMEOUT}) ==="

# Check if any migration work is actively executing, pending, or scheduled in the namespace.
# Returns:
#   0: Confirmed exactly 0 active migration work (all queries succeeded, 0 active jobs, 0 active pods)
#   1: Active migration work detected (jobs active > 0 or pods Pending/Running/Terminating/etc.)
#   2: API query failure (fail-closed: cannot confirm workload state)
get_active_migration_work() {
  local namespace="$1"

  # 1. Inspect migration Jobs with label app=nst-migration
  local jobs_json job_status
  set +e
  jobs_json=$(kubectl get jobs -n "${namespace}" -l app=nst-migration -o json 2>/dev/null)
  job_status=$?
  set -e

  if [ $job_status -ne 0 ] || [ -z "$jobs_json" ]; then
    echo "ERROR: API failure querying migration Jobs in namespace '${namespace}'" >&2
    return 2
  fi

  local active_jobs
  active_jobs=$(echo "$jobs_json" | python3 -c "
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
    echo "ERROR: Failed to parse migration Jobs JSON in namespace '${namespace}'" >&2
    return 2
  fi

  if [ -n "$active_jobs" ]; then
    echo "Active migration Job(s) detected: ${active_jobs}"
    return 1
  fi

  # 2. Inspect migration Pods with label app=nst-migration
  local pods_json pod_status
  set +e
  pods_json=$(kubectl get pods -n "${namespace}" -l app=nst-migration -o json 2>/dev/null)
  pod_status=$?
  set -e

  if [ $pod_status -ne 0 ] || [ -z "$pods_json" ]; then
    echo "ERROR: API failure querying migration Pods in namespace '${namespace}'" >&2
    return 2
  fi

  local active_pods
  active_pods=$(echo "$pods_json" | python3 -c "
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
    echo "ERROR: Failed to parse migration Pods JSON in namespace '${namespace}'" >&2
    return 2
  fi

  if [ -n "$active_pods" ]; then
    echo "Active migration Pod(s) detected: ${active_pods}"
    return 1
  fi

  return 0
}

# Trap to release owned lock on exit, error, or interruption via atomic owner-bound patch
release_lock() {
  local exit_code=$?
  if [ "$LOCK_ACQUIRED" = "true" ]; then
    local current_json current_rv current_holder
    current_json=$(kubectl get lease "${LOCK_NAME}" -n "${NAMESPACE}" -o json 2>/dev/null || true)
    current_rv=$(echo "$current_json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('metadata', {}).get('resourceVersion', ''))" 2>/dev/null || echo "")
    current_holder=$(echo "$current_json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('spec', {}).get('holderIdentity') or '')" 2>/dev/null || echo "")

    if [ "$current_holder" = "$LOCK_HOLDER" ] && [ -n "$current_rv" ]; then
      echo ">>> Atomically releasing migration lock '${LOCK_NAME}' (holder: ${LOCK_HOLDER}, rv: ${current_rv})..."
      set +e
      kubectl patch lease "${LOCK_NAME}" -n "${NAMESPACE}" --type='json' -p="[
        {\"op\": \"test\", \"path\": \"/metadata/resourceVersion\", \"value\": \"${current_rv}\"},
        {\"op\": \"test\", \"path\": \"/spec/holderIdentity\", \"value\": \"${LOCK_HOLDER}\"},
        {\"op\": \"add\", \"path\": \"/spec/holderIdentity\", \"value\": \"\"}
      ]" 2>/dev/null || true
      set -e
    else
      echo ">>> Skipping lock release: current holder '${current_holder}' does not match '${LOCK_HOLDER}'."
    fi
  fi
  exit "$exit_code"
}
trap release_lock EXIT INT TERM

# 1. Pre-check: If Job for this exact SHA already succeeded, skip redundant execution
EXISTING_JOB=$(kubectl get job "${JOB_NAME}" -n "${NAMESPACE}" --ignore-not-found -o jsonpath='{.metadata.name}' 2>/dev/null || true)
if [ -n "$EXISTING_JOB" ]; then
  IS_COMPLETE=$(kubectl get job "${JOB_NAME}" -n "${NAMESPACE}" -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || true)
  if [ "$IS_COMPLETE" = "True" ]; then
    echo ">>> SUCCESS: Migration Job '${JOB_NAME}' already completed successfully in a prior run."
    echo ">>> Skipping re-execution to avoid redundant migration runs."
    echo "--- Historical Migration Job Logs ---"
    kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=100 || true
    if [ -n "$GITHUB_STEP_SUMMARY" ]; then
      echo "- ✅ **\`${JOB_NAME}\`**: Migration Job previously succeeded; skipped rerun." >> "$GITHUB_STEP_SUMMARY"
    fi
    exit 0
  fi
fi

# 2. Acquire Atomic Coordination Lock (Kubernetes Lease with Owner-Bound Patching)
timeout_failure() {
  echo "================================================================================"
  echo "CRITICAL: Timed out waiting for migration lock '${LOCK_NAME}' after ${TIMEOUT_SECS}s!"
  echo "Currently held by '${CURRENT_HOLDER:-none}'."
  echo "Automatic lock stealing is refused for safety against runner clock skew, network"
  echo "partitions, and dual-writer concurrency risks."
  echo "================================================================================"
  echo "::error title=Migration Lock Timeout::Could not acquire migration lock '${LOCK_NAME}' within ${TIMEOUT_SECS}s. Currently held by '${CURRENT_HOLDER:-none}'. Operator recovery required if runner crashed."
  echo ""
  echo "--- SAFE OPERATOR RECOVERY PROCEDURE ---"
  echo "1. Verify that no migration Job or Pod is currently executing in namespace '${NAMESPACE}':"
  echo "   kubectl get jobs -n \"${NAMESPACE}\" -l app=nst-migration"
  echo "   kubectl get pods -n \"${NAMESPACE}\" -l app=nst-migration"
  echo "2. Verify that GitHub Actions run for holder '${CURRENT_HOLDER:-none}' has terminated."
  echo "3. Run the guarded recovery tool supplying the verified orphaned holder identity:"
  echo "   ./scripts/recover-migration-lease.sh \"${CURRENT_HOLDER:-none}\" \"${NAMESPACE}\""
  echo ""
  echo "   OR execute the equivalent guarded owner-bound patch directly:"
  echo "   CURRENT_RV=\$(kubectl get lease \"${LOCK_NAME}\" -n \"${NAMESPACE}\" -o jsonpath='{.metadata.resourceVersion}')"
  echo "   kubectl patch lease \"${LOCK_NAME}\" -n \"${NAMESPACE}\" --type='json' -p=\"["
  echo "     {\\\"op\\\": \\\"test\\\", \\\"path\\\": \\\"/metadata/resourceVersion\\\", \\\"value\\\": \\\"\${CURRENT_RV}\\\"},"
  echo "     {\\\"op\\\": \\\"test\\\", \\\"path\\\": \\\"/spec/holderIdentity\\\", \\\"value\\\": \\\"${CURRENT_HOLDER:-none}\\\"},"
  echo "     {\\\"op\\\": \\\"add\\\", \\\"path\\\": \\\"/spec/holderIdentity\\\", \\\"value\\\": \\\"\\\"}"
  echo "   ]\""
  echo "4. Re-run deployment."
  echo "NOTE: Guarded recovery clears the orphaned lock only; it does not stop in-flight DB operations."
  echo "----------------------------------------"
  exit 1
}

echo ">>> Attempting to acquire atomic migration lock '${LOCK_NAME}' as '${LOCK_HOLDER}'..."
START_TIME=$(date +%s)
POLL_INTERVAL=5
if [ "$TIMEOUT_SECS" -le 5 ]; then
  POLL_INTERVAL=1
fi

while true; do
  ELAPSED=$(( $(date +%s) - START_TIME ))
  if [ "$ELAPSED" -ge "$TIMEOUT_SECS" ]; then
    timeout_failure
  fi

  NOW_UTC=$(date -u +"%Y-%m-%dT%H:%M:%S.000000Z")

  # Query current Lease state in one atomic snapshot
  set +e
  LEASE_JSON=$(kubectl get lease "${LOCK_NAME}" -n "${NAMESPACE}" -o json 2>/dev/null)
  GET_STATUS=$?
  set -e

  # Case 1: Lease does not exist -> attempt atomic initial creation
  if [ $GET_STATUS -ne 0 ] || [ -z "$LEASE_JSON" ]; then
    set +e
    CREATE_OUT=$(cat <<EOF | kubectl create -n "${NAMESPACE}" -f - 2>&1
apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: ${LOCK_NAME}
  namespace: ${NAMESPACE}
spec:
  holderIdentity: "${LOCK_HOLDER}"
  leaseDurationSeconds: ${LOCK_DURATION}
  acquireTime: "${NOW_UTC}"
  renewTime: "${NOW_UTC}"
EOF
)
    CREATE_STATUS=$?
    set -e

    if [ $CREATE_STATUS -eq 0 ]; then
      LOCK_ACQUIRED="true"
      echo ">>> SUCCESS: Acquired atomic migration lock '${LOCK_NAME}' via creation (holder: ${LOCK_HOLDER})."
      break
    fi
    sleep "${POLL_INTERVAL}"
    continue
  fi

  # Parse Lease metadata and spec from the atomic snapshot
  CURRENT_RV=$(echo "$LEASE_JSON" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('metadata', {}).get('resourceVersion', ''))" 2>/dev/null || echo "")
  CURRENT_HOLDER=$(echo "$LEASE_JSON" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('spec', {}).get('holderIdentity') or '')" 2>/dev/null || echo "")
  LEASE_TIME=$(echo "$LEASE_JSON" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('spec', {}).get('renewTime') or data.get('spec', {}).get('acquireTime') or '')" 2>/dev/null || echo "")

  # Check if we already hold the lock
  if [ "$CURRENT_HOLDER" = "$LOCK_HOLDER" ]; then
    LOCK_ACQUIRED="true"
    echo ">>> Lock '${LOCK_NAME}' already held by this process (${LOCK_HOLDER})."
    break
  fi

  # Check if target Job completed while we were waiting for the lock
  CURRENT_JOB_COMPLETE=$(kubectl get job "${JOB_NAME}" -n "${NAMESPACE}" -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || true)
  if [ "$CURRENT_JOB_COMPLETE" = "True" ]; then
    echo ">>> SUCCESS: Target migration Job '${JOB_NAME}' completed while waiting for lock. Resuming as success."
    echo "--- Migration Job Logs ---"
    kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=100 || true
    if [ -n "$GITHUB_STEP_SUMMARY" ]; then
      echo "- ✅ **\`${JOB_NAME}\`**: Migration Job completed while waiting on lock." >> "$GITHUB_STEP_SUMMARY"
    fi
    exit 0
  fi

  # Case 2: Lease exists and is released/free (holderIdentity is empty)
  if [ -z "$CURRENT_HOLDER" ]; then
    echo ">>> Lock '${LOCK_NAME}' is free (rv: ${CURRENT_RV}). Attempting atomic conditional claim..."
    set +e
    CLAIM_OUT=$(kubectl patch lease "${LOCK_NAME}" -n "${NAMESPACE}" --type='json' -p="[
      {\"op\": \"test\", \"path\": \"/metadata/resourceVersion\", \"value\": \"${CURRENT_RV}\"},
      {\"op\": \"test\", \"path\": \"/spec/holderIdentity\", \"value\": \"\"},
      {\"op\": \"add\", \"path\": \"/spec/holderIdentity\", \"value\": \"${LOCK_HOLDER}\"},
      {\"op\": \"add\", \"path\": \"/spec/leaseDurationSeconds\", \"value\": ${LOCK_DURATION}},
      {\"op\": \"add\", \"path\": \"/spec/acquireTime\", \"value\": \"${NOW_UTC}\"},
      {\"op\": \"add\", \"path\": \"/spec/renewTime\", \"value\": \"${NOW_UTC}\"}
    ]" 2>&1)
    CLAIM_STATUS=$?
    set -e

    if [ $CLAIM_STATUS -eq 0 ]; then
      LOCK_ACQUIRED="true"
      echo ">>> SUCCESS: Claimed free migration lock '${LOCK_NAME}' (holder: ${LOCK_HOLDER}, rv: ${CURRENT_RV})."
      break
    else
      echo ">>> Contention claiming free lock: version changed. Retrying..."
      sleep "${POLL_INTERVAL}"
      continue
    fi
  fi

  # Case 3: Lease is held by another process
  # Evaluate active migration workload and timestamp validity fail-closed.
  # Automatic lock stealing is refused for safety against runner clock skew,
  # network partitions, and dual-writer concurrency risks.
  WORK_STATUS=0
  WORK_MSG=$(get_active_migration_work "${NAMESPACE}") || WORK_STATUS=$?

  if [ $WORK_STATUS -eq 1 ]; then
    echo ">>> Lock '${LOCK_NAME}' held by '${CURRENT_HOLDER}'. ${WORK_MSG}. Migration work is active."
  elif [ $WORK_STATUS -eq 2 ]; then
    echo ">>> WARNING: API query failure verifying migration workload in '${NAMESPACE}'. Failing closed; treating lock as active."
  else
    # 0 active work confirmed
    if [ -z "$LEASE_TIME" ]; then
      echo ">>> Lock '${LOCK_NAME}' held by '${CURRENT_HOLDER}' has no acquireTime or renewTime. Following fail-closed policy (no automatic takeover)."
    else
      set +e
      LEASE_EPOCH=$(python3 -c "
import datetime, sys
try:
    t_str = sys.argv[1].split('.')[0].rstrip('Z')
    dt = datetime.datetime.fromisoformat(t_str)
    print(int(dt.replace(tzinfo=datetime.timezone.utc).timestamp()))
except Exception:
    sys.exit(1)
" "$LEASE_TIME" 2>/dev/null)
      PARSE_STATUS=$?
      set -e

      if [ $PARSE_STATUS -ne 0 ] || [ -z "$LEASE_EPOCH" ]; then
        echo ">>> Lock '${LOCK_NAME}' held by '${CURRENT_HOLDER}' has ambiguous/malformed timestamp '${LEASE_TIME}'. Following fail-closed policy (no automatic takeover)."
      else
        NOW_EPOCH=$(date +%s)
        AGE=$(( NOW_EPOCH - LEASE_EPOCH ))

        if [ "$AGE" -lt 0 ]; then
          echo ">>> Clock skew detected: Lease timestamp '${LEASE_TIME}' is in the future relative to runner clock (age: ${AGE}s). Following fail-closed policy."
        else
          echo ">>> Lock '${LOCK_NAME}' held by '${CURRENT_HOLDER}' (age: ${AGE}s / duration: ${LOCK_DURATION}s, 0 active pods/jobs). Waiting for owner to release..."
        fi
      fi
    fi
  fi

  ELAPSED=$(( $(date +%s) - START_TIME ))
  if [ "$ELAPSED" -ge "$TIMEOUT_SECS" ]; then
    timeout_failure
  fi

  echo ">>> Lock held by '${CURRENT_HOLDER}'. Waiting ${POLL_INTERVAL}s (elapsed: ${ELAPSED}s / ${TIMEOUT_SECS}s)..."
  sleep "${POLL_INTERVAL}"
done

# 3. Handle Existing Job Lifecycle for this SHA
EXISTING_JOB=$(kubectl get job "${JOB_NAME}" -n "${NAMESPACE}" --ignore-not-found -o jsonpath='{.metadata.name}' 2>/dev/null || true)

if [ -n "$EXISTING_JOB" ]; then
  echo ">>> Found existing Job '${JOB_NAME}'. Inspecting execution state..."

  IS_COMPLETE=$(kubectl get job "${JOB_NAME}" -n "${NAMESPACE}" -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || true)
  IS_FAILED=$(kubectl get job "${JOB_NAME}" -n "${NAMESPACE}" -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null || true)
  ACTIVE_COUNT=$(kubectl get job "${JOB_NAME}" -n "${NAMESPACE}" -o jsonpath='{.status.active}' 2>/dev/null || true)
  ACTIVE_COUNT="${ACTIVE_COUNT:-0}"

  if [ "$IS_COMPLETE" = "True" ]; then
    echo ">>> SUCCESS: Migration Job '${JOB_NAME}' already completed successfully."
    echo "--- Historical Migration Job Logs ---"
    kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=100 || true
    if [ -n "$GITHUB_STEP_SUMMARY" ]; then
      echo "- ✅ **\`${JOB_NAME}\`**: Migration Job previously succeeded; skipped rerun." >> "$GITHUB_STEP_SUMMARY"
    fi
    exit 0
  fi

  if [ "$ACTIVE_COUNT" -gt 0 ]; then
    echo ">>> Migration Job '${JOB_NAME}' is currently running (${ACTIVE_COUNT} active pod(s)). Waiting for completion (timeout: ${TIMEOUT})..."
    if kubectl wait --for=condition=complete "job/${JOB_NAME}" -n "${NAMESPACE}" --timeout="${TIMEOUT}"; then
      echo ">>> SUCCESS: Active migration Job '${JOB_NAME}' completed successfully."
      kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=100 || true
      if [ -n "$GITHUB_STEP_SUMMARY" ]; then
        echo "- ✅ **\`${JOB_NAME}\`**: In-flight migration completed successfully." >> "$GITHUB_STEP_SUMMARY"
      fi
      exit 0
    else
      echo "::error title=Migration Job Failed::Active migration Job '${JOB_NAME}' failed or timed out."
      kubectl logs "job/${JOB_NAME}" -n "${NAMESPACE}" --tail=100 || true
      exit 1
    fi
  fi

  if [ "$IS_FAILED" = "True" ] && [ "$ACTIVE_COUNT" -eq 0 ]; then
    echo ">>> Existing Job '${JOB_NAME}' has failed and has 0 active pods. Cleaning up stale Job before recreation..."
    kubectl delete job "${JOB_NAME}" -n "${NAMESPACE}" --wait=true
  else
    echo ">>> Existing Job '${JOB_NAME}' is in an incomplete state (active: ${ACTIVE_COUNT}). Deleting safely before recreation..."
    kubectl delete job "${JOB_NAME}" -n "${NAMESPACE}" --wait=true
  fi
fi

# 4. Verify Confirmed Lock Ownership Before Job Submission
set +e
VERIFY_LEASE_JSON=$(kubectl get lease "${LOCK_NAME}" -n "${NAMESPACE}" -o json 2>/dev/null)
VERIFY_STATUS=$?
set -e

if [ $VERIFY_STATUS -ne 0 ] || [ -z "$VERIFY_LEASE_JSON" ]; then
  echo "================================================================================"
  echo "CRITICAL: Cannot verify migration lock '${LOCK_NAME}' ownership before Job submission!"
  echo "================================================================================"
  echo "::error title=Ownership Verification Failed::API query failed verifying lease '${LOCK_NAME}'. Aborting migration."
  LOCK_ACQUIRED="false"
  exit 1
fi

VERIFY_HOLDER=$(echo "$VERIFY_LEASE_JSON" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('spec', {}).get('holderIdentity') or '')" 2>/dev/null || echo "")

if [ "$VERIFY_HOLDER" != "$LOCK_HOLDER" ]; then
  echo "================================================================================"
  echo "CRITICAL: Lock ownership lost before migration Job submission!"
  echo "Expected holder: '${LOCK_HOLDER}', but current holder is: '${VERIFY_HOLDER}'"
  echo "================================================================================"
  echo "::error title=Lock Ownership Lost::Process '${LOCK_HOLDER}' lost ownership of '${LOCK_NAME}' to '${VERIFY_HOLDER}'. Refusing to launch migration Job."
  LOCK_ACQUIRED="false"
  exit 1
fi

# 5. Create and Apply the Migration Job Manifest
echo ">>> Submitting migration Job '${JOB_NAME}' with image ${IMAGE}..."

cat <<EOF | kubectl apply --namespace="${NAMESPACE}" -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
  namespace: ${NAMESPACE}
  labels:
    app: nst-migration
spec:
  backoffLimit: 1
  template:
    metadata:
      labels:
        app: nst-migration
    spec:
      restartPolicy: Never
      imagePullSecrets:
        - name: ghcr-pull-secret
      containers:
        - name: migrate
          image: ${IMAGE}
          imagePullPolicy: IfNotPresent
          command:
            - /bin/sh
            - -c
            - |
              set -e
              # Resolve database migration URL with dedicated admin identity
              if [ -z "\${DATABASE_URL}" ] && [ -n "\${ADMIN_DATABASE_URL}" ]; then
                export DATABASE_URL="\${ADMIN_DATABASE_URL}"
              elif [ -z "\${DATABASE_URL}" ] && [ -n "\${POSTGRES_USER}" ] && [ -n "\${POSTGRES_PASSWORD}" ] && [ -n "\${POSTGRES_DB}" ]; then
                export DATABASE_URL="postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@nst-postgres-service:5432/\${POSTGRES_DB}?schema=public"
              fi

              if [ -z "\${DATABASE_URL}" ]; then
                echo "CRITICAL: No database migration credential found in nst-db-admin-secrets." >&2
                echo "Expected DATABASE_URL, ADMIN_DATABASE_URL, or POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB." >&2
                exit 1
              fi

              echo "Executing Prisma migrate deploy..."
              exec /app/node_modules/.bin/prisma migrate deploy --schema=packages/database/prisma/schema.prisma
          envFrom:
            - secretRef:
                name: nst-db-admin-secrets
EOF

# 6. Wait for Job Completion
echo ">>> Waiting for Job '${JOB_NAME}' to complete (timeout: ${TIMEOUT})..."
set +e
kubectl wait --for=condition=complete "job/${JOB_NAME}" --namespace="${NAMESPACE}" --timeout="${TIMEOUT}"
WAIT_EXIT_CODE=$?
set -e

if [ $WAIT_EXIT_CODE -eq 0 ]; then
  echo ">>> SUCCESS: Migration Job '${JOB_NAME}' completed successfully."
  echo "--- Migration Job Logs ---"
  kubectl logs "job/${JOB_NAME}" --namespace="${NAMESPACE}" --tail=100 || true
  if [ -n "$GITHUB_STEP_SUMMARY" ]; then
    echo "- ✅ **\`${JOB_NAME}\`**: Migration Job executed and verified healthy." >> "$GITHUB_STEP_SUMMARY"
  fi
  exit 0
fi

echo "================================================================================"
echo "CRITICAL: Database migration Job '${JOB_NAME}' failed or timed out!"
echo "================================================================================"
echo "::error title=Migration Job Failed::Database migration Job '${JOB_NAME}' failed or timed out. Rollout blocked."

echo "--- Migration Job Logs ---"
kubectl logs "job/${JOB_NAME}" --namespace="${NAMESPACE}" --tail=100 || true

echo "--- Pod Details ---"
kubectl get pods -l app=nst-migration -n "${NAMESPACE}" -o wide || true

echo "--- Recent Events in ${NAMESPACE} ---"
kubectl get events -n "${NAMESPACE}" --sort-by='.metadata.creationTimestamp' | tail -n 15 || true

if [ -n "$GITHUB_STEP_SUMMARY" ]; then
  cat << EOF >> "$GITHUB_STEP_SUMMARY"

> [!CAUTION]
> ### 🛑 Database Migration Failed — Application Rollout Blocked
> - **Job**: \`${JOB_NAME}\` (namespace: \`${NAMESPACE}\`)
> - **Status**: Migration execution failed or timed out (exit code: ${WAIT_EXIT_CODE}).
> - **Action Taken**: Rollout blocked. Application pods (\`nst-api\`, \`nst-worker\`) were not updated.
> - **Remediation**: Inspect the logs and events above to resolve migration or database connection failure before retrying deployment.

EOF
fi

exit 1
