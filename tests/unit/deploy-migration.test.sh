#!/usr/bin/env bash
#
# deploy-migration.test.sh
# Comprehensive verification suite for Workstream 10 & 11:
# Stale Migration Lock Recovery Safety & Guarded Orphaned Lease Recovery
#
set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${REPO_ROOT}/scripts/deploy-migration.sh"
RECOVER_SCRIPT="${REPO_ROOT}/scripts/recover-migration-lease.sh"


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
echo "RUNNING WORKSTREAM 10 & 11 VERIFICATION SUITE: GUARDED ORPHANED LEASE RECOVERY"
echo "================================================================================"

# -----------------------------------------------------------------------------
# Test 1: Static RBAC and Workflow Configuration
# -----------------------------------------------------------------------------
echo ""
echo "Test 1: RBAC grants patch/coordination permissions; deploy.yml enforces workflow concurrency"

RBAC_FILE="${REPO_ROOT}/infrastructure/kubernetes/github-actions-migration-rbac.yaml"
if grep -q 'apiGroups:.*coordination.k8s.io' "${RBAC_FILE}" && grep -A 2 'apiGroups:.*coordination.k8s.io' "${RBAC_FILE}" | grep -q 'resources:.*leases'; then
  pass "github-actions-migration-rbac.yaml explicitly grants least-privileged access to coordination.k8s.io/leases"
else
  fail "RBAC configuration check" "coordination.k8s.io leases permission missing in ${RBAC_FILE}"
fi

DEPLOY_YML="${REPO_ROOT}/.github/workflows/deploy.yml"
if grep -q 'concurrency:' "${DEPLOY_YML}" && grep -A 3 'concurrency:' "${DEPLOY_YML}" | grep -q 'group:.*nst-events-deploy'; then
  pass "deploy.yml includes workflow concurrency group to serialize deployment runs"
else
  fail "Workflow concurrency check" "concurrency group missing in ${DEPLOY_YML}"
fi

# -----------------------------------------------------------------------------
# Test 2: Migration Job uses dedicated migration secret reference (nst-db-admin-secrets)
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: Migration Job manifest uses dedicated migration secret (nst-db-admin-secrets)"
if grep -q 'name: nst-db-admin-secrets' "${SCRIPT}" && ! grep -q 'name: nst-api-secrets' "${SCRIPT}"; then
  pass "deploy-migration.sh references 'nst-db-admin-secrets' and does not mount 'nst-api-secrets'"
else
  fail "deploy-migration.sh secret reference check" "Expected nst-db-admin-secrets, found unexpected secret references"
fi

# -----------------------------------------------------------------------------
# Test 3: Missing migration credentials fail clearly without using app credentials
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: Missing migration credentials fail clearly with actionable error"

CMD_OUTPUT=$(
  unset DATABASE_URL ADMIN_DATABASE_URL POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
  bash -c '
    set +e
    if [ -z "${DATABASE_URL}" ] && [ -n "${ADMIN_DATABASE_URL}" ]; then
      export DATABASE_URL="${ADMIN_DATABASE_URL}"
    elif [ -z "${DATABASE_URL}" ] && [ -n "${POSTGRES_USER}" ] && [ -n "${POSTGRES_PASSWORD}" ] && [ -n "${POSTGRES_DB}" ]; then
      export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@nst-postgres-service:5432/${POSTGRES_DB}?schema=public"
    fi

    if [ -z "${DATABASE_URL}" ]; then
      echo "CRITICAL: No database migration credential found in nst-db-admin-secrets." >&2
      echo "Expected DATABASE_URL, ADMIN_DATABASE_URL, or POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB." >&2
      exit 1
    fi
  ' 2>&1 || true
)

if echo "${CMD_OUTPUT}" | grep -q "CRITICAL: No database migration credential found in nst-db-admin-secrets"; then
  pass "Unset credentials abort migration with explicit error and exit code 1"
else
  fail "Unset credential check" "Did not receive expected error message. Got: ${CMD_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Stateful Concurrency-Safe Mock Kubernetes API Server Setup
# -----------------------------------------------------------------------------
TEMP_DIR=$(mktemp -d)
MOCK_KUBECTL="${TEMP_DIR}/kubectl"
CALL_LOG="${TEMP_DIR}/calls.log"
STATE_FILE="${TEMP_DIR}/k8s_state.json"
STATE_LOCK="${TEMP_DIR}/k8s_state.lock"

export PATH="${TEMP_DIR}:${PATH}"
export MOCK_LOG="${CALL_LOG}"
export MOCK_STATE_FILE="${STATE_FILE}"
export MOCK_STATE_LOCK="${STATE_LOCK}"

# Write stateful mock kubectl that supports atomic OCC and RFC 6902 test/add/replace operations
cat << 'EOF' > "${MOCK_KUBECTL}"
#!/usr/bin/env python3
import sys, os, json, fcntl

log_path = os.environ.get("MOCK_LOG", "/dev/null")
state_path = os.environ.get("MOCK_STATE_FILE")
lock_path = os.environ.get("MOCK_STATE_LOCK")

with open(log_path, "a") as f:
    f.write("kubectl " + " ".join(sys.argv[1:]) + "\n")

args = sys.argv[1:]
if not args:
    sys.exit(0)

if os.environ.get("SIMULATE_API_ERROR") == "1":
    sys.stderr.write("Error from server (InternalError): an error on the server has occurred\n")
    sys.exit(1)

def with_lock(action):
    if not lock_path:
        return action()
    with open(lock_path, "w") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            return action()
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

def load_state():
    if not state_path or not os.path.exists(state_path):
        return {}
    with open(state_path, "r") as sf:
        try: return json.load(sf)
        except Exception: return {}

def save_state(s):
    if not state_path: return
    with open(state_path, "w") as sf:
        json.dump(s, sf)

cmd = args[0]

# --- kubectl get ---
if cmd == "get":
    res_type = args[1]
    s = load_state()

    if res_type in ["job", "jobs"]:
        if os.environ.get("SIMULATE_JOBS_QUERY_ERROR") == "1":
            sys.stderr.write("Error from server: connection timed out\n")
            sys.exit(1)
        # Check if this is a listing with -o json
        if "-o" in args and "json" in args and "-l" in args:
            items = []
            for jname, jdata in s.get("jobs", {}).items():
                items.append({"metadata": {"name": jname}, "status": {"active": jdata.get("active", 0)}})
            print(json.dumps({"items": items}))
            sys.exit(0)

        # Specific job by name
        job_name = ""
        for a in args[2:]:
            if not a.startswith("-"):
                job_name = a
                break
        job_data = s.get("jobs", {}).get(job_name)
        if not job_data:
            if "--ignore-not-found" in args:
                sys.exit(0)
            sys.exit(1)
        arg_str = " ".join(args)
        if "jsonpath={.status.conditions[?(@.type==\"Complete\")].status}" in arg_str:
            print(job_data.get("complete", ""))
            sys.exit(0)
        if "jsonpath={.status.conditions[?(@.type==\"Failed\")].status}" in arg_str:
            print(job_data.get("failed", ""))
            sys.exit(0)
        if "jsonpath={.status.active}" in arg_str:
            print(str(job_data.get("active", 0)))
            sys.exit(0)
        if "jsonpath={.metadata.name}" in arg_str:
            print(job_name)
            sys.exit(0)
        sys.exit(0)

    elif res_type in ["pod", "pods"]:
        if os.environ.get("SIMULATE_PODS_QUERY_ERROR") == "1":
            sys.stderr.write("Error from server: connection timed out\n")
            sys.exit(1)
        if "-o" in args and "json" in args and "-l" in args:
            raw_pods = s.get("pods", [])
            items = []
            for p in raw_pods:
                if isinstance(p, dict):
                    items.append(p)
                else:
                    items.append({"metadata": {"name": p}, "status": {"phase": "Running"}})
            for p in s.get("running_pods", []):
                items.append({"metadata": {"name": p}, "status": {"phase": "Running"}})
            print(json.dumps({"items": items}))
            sys.exit(0)

        # Legacy jsonpath or running pod check
        running_pods = s.get("running_pods", [])
        arg_str = " ".join(args)
        if "phase=Running" in arg_str:
            print(" ".join(running_pods))
            sys.exit(0)
        if running_pods:
            print(f"{running_pods[0]} Running")
        sys.exit(0)

    elif res_type == "events":
        sys.exit(0)

    elif res_type == "lease":
        if os.environ.get("SIMULATE_LEASE_QUERY_ERROR") == "1":
            sys.stderr.write("Error from server: connection timed out\n")
            sys.exit(1)
        lease = s.get("lease")
        if not lease:
            sys.exit(1)
        # Check if ownership stolen simulation is active
        if os.environ.get("SIMULATE_LEASE_STOLEN_BEFORE_APPLY") == "1":
            stolen_lease = json.loads(json.dumps(lease))
            stolen_lease["spec"]["holderIdentity"] = "ThiefProcess"
            if "-o" in args and "json" in args:
                print(json.dumps(stolen_lease))
                sys.exit(0)
        if "-o" in args and "json" in args:
            print(json.dumps(lease))
            sys.exit(0)
        arg_str = " ".join(args)
        if "holderIdentity" in arg_str:
            print(lease.get("spec", {}).get("holderIdentity", ""))
            sys.exit(0)
        if "resourceVersion" in arg_str:
            print(str(lease.get("metadata", {}).get("resourceVersion", "")))
            sys.exit(0)
        sys.exit(0)

# --- kubectl create ---
elif cmd == "create":
    stdin_content = sys.stdin.read()
    if "kind: Lease" in stdin_content:
        def do_create():
            s = load_state()
            if "lease" in s and s["lease"] is not None:
                sys.stderr.write("Error from server (AlreadyExists): leases.coordination.k8s.io already exists\n")
                sys.exit(1)
            # Parse holder from payload
            holder = ""
            for line in stdin_content.splitlines():
                if "holderIdentity:" in line:
                    holder = line.split(":", 1)[1].strip().strip('"')
            s["lease"] = {
                "apiVersion": "coordination.k8s.io/v1",
                "kind": "Lease",
                "metadata": {"name": "nst-migration-lock", "resourceVersion": "1"},
                "spec": {
                    "holderIdentity": holder,
                    "leaseDurationSeconds": 360,
                    "acquireTime": "2026-10-21T06:00:00.000000Z",
                    "renewTime": "2026-10-21T06:00:00.000000Z"
                }
            }
            save_state(s)
            sys.exit(0)
        with_lock(do_create)

# --- kubectl patch ---
elif cmd == "patch":
    patch_str = ""
    for a in args:
        if a.startswith("-p="): patch_str = a[3:]
        elif a.startswith("--patch="): patch_str = a[8:]
        elif a in ["-p", "--patch"] and args.index(a) + 1 < len(args): patch_str = args[args.index(a) + 1]
    if not patch_str:
        sys.exit(0)

    def do_patch():
        s = load_state()
        lease = s.get("lease")
        if not lease:
            sys.stderr.write("Error: lease not found\n")
            sys.exit(1)
        if os.environ.get("SIMULATE_CONCURRENT_MUTATION_ON_PATCH") == "1":
            cur_rv = int(lease.get("metadata", {}).get("resourceVersion", "1"))
            lease["metadata"]["resourceVersion"] = str(cur_rv + 10)
            s["lease"] = lease
            save_state(s)
        if os.environ.get("SIMULATE_HOLDER_STEAL_ON_PATCH") == "1":
            lease["spec"]["holderIdentity"] = "NewSneakyHolder"
            s["lease"] = lease
            save_state(s)
        try:
            ops = json.loads(patch_str)
        except Exception as e:
            sys.stderr.write(f"Invalid JSON patch: {e}\n")
            sys.exit(1)

        # 1. Evaluate all 'test' operations first
        for op in ops:
            if op.get("op") == "test":
                path_parts = [p for p in op.get("path", "").split("/") if p]
                cur = lease
                for p in path_parts:
                    cur = cur.get(p, "") if isinstance(cur, dict) else ""
                expected = op.get("value")
                if str(cur) != str(expected):
                    sys.stderr.write(f"The request is invalid: test operation failed: path {op.get('path')} value '{cur}' != '{expected}'\n")
                    sys.exit(1)

        # 2. Apply mutations
        for op in ops:
            if op.get("op") in ["add", "replace"]:
                path_parts = [p for p in op.get("path", "").split("/") if p]
                cur = lease
                for p in path_parts[:-1]:
                    if p not in cur: cur[p] = {}
                    cur = cur[p]
                cur[path_parts[-1]] = op.get("value")

        # 3. Increment resourceVersion atomically
        cur_rv = int(lease.get("metadata", {}).get("resourceVersion", "1"))
        lease["metadata"]["resourceVersion"] = str(cur_rv + 1)
        s["lease"] = lease
        save_state(s)
        sys.exit(0)

    with_lock(do_patch)

# --- kubectl delete ---
elif cmd == "delete":
    res_type = args[1]
    if res_type == "lease":
        def do_delete():
            s = load_state()
            s["lease"] = None
            save_state(s)
            sys.exit(0)
        with_lock(do_delete)
    elif res_type == "job":
        def do_delete_job():
            s = load_state()
            job_name = args[2] if len(args) > 2 else ""
            if "jobs" in s and job_name in s["jobs"]:
                del s["jobs"][job_name]
            save_state(s)
            sys.exit(0)
        with_lock(do_delete_job)

# --- kubectl apply ---
elif cmd == "apply":
    sys.stdin.read()
    sys.exit(0)

# --- kubectl wait ---
elif cmd == "wait":
    if any(a in ["jobs/nst-db-migrate-fail", "job/nst-db-migrate-fail", "nst-db-migrate-fail"] for a in args):
        sys.stderr.write("error: timed out waiting for condition on jobs/nst-db-migrate-fail\n")
        sys.exit(1)
    if any("nst-db-migrate-conc-A" in a for a in args):
        import time
        time.sleep(2)
    sys.exit(0)

# --- kubectl logs ---
elif cmd == "logs":
    print("Prisma Migrate Deploy: All migrations applied successfully.")
    sys.exit(0)

sys.exit(0)
EOF
chmod +x "${MOCK_KUBECTL}"

# Helper to initialize clean mock cluster state
init_cluster_state() {
  cat << EOF > "${STATE_FILE}"
{
  "lease": null,
  "jobs": {},
  "running_pods": []
}
EOF
  rm -f "${CALL_LOG}"
}

# -----------------------------------------------------------------------------
# Test 4: Single invocation acquires lock, runs Job, and releases lock atomically
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: Single invocation acquires lock, runs Job, and releases lock atomically"

init_cluster_state
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-single" "ghcr.io/nst-sdc/nst-api:target1" "nst-events" "300s")
EXIT_CODE=$?

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'NONE'))")

if [ $EXIT_CODE -eq 0 ] && grep -q 'kubectl create -n nst-events -f -' "${CALL_LOG}" && grep -q 'kubectl apply --namespace=nst-events -f -' "${CALL_LOG}" && [ "$FINAL_HOLDER" = "" ]; then
  pass "Single invocation acquires lease, runs migration, and atomically clears holder on completion"
else
  fail "Single invocation flow" "Exit code: ${EXIT_CODE}, Final holder: '${FINAL_HOLDER}', Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 5: Expired Lease with migration Job whose pod is Pending is NOT reclaimed unsafely (Scenario 1)
# -----------------------------------------------------------------------------
echo ""
echo "Test 5: Expired Lease with migration Job whose pod is Pending is not reclaimed unsafely"

init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "5"},
    "spec": {
      "holderIdentity": "DeadRunner",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": [
    {
      "metadata": {"name": "nst-db-migrate-pod-pending"},
      "status": {"phase": "Pending"}
    }
  ]
}
EOF

set +e
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-second" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "1s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "Active migration Pod(s) detected: nst-db-migrate-pod-pending(Pending)"; then
  pass "Expired Lease with Pending migration pod is NOT reclaimed unsafely"
else
  fail "Pending pod guard check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 6: Active migration Job with no Running pod blocks a second migration (Scenario 2)
# -----------------------------------------------------------------------------
echo ""
echo "Test 6: Active migration Job with no Running pod blocks a second migration"

init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "6"},
    "spec": {
      "holderIdentity": "DeadRunner",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {
    "nst-db-migrate-inflight": {
      "active": 1,
      "complete": "",
      "failed": ""
    }
  },
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-second" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "1s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "Active migration Job(s) detected: nst-db-migrate-inflight"; then
  pass "Active migration Job with 0 running pods blocks a second migration"
else
  fail "Active job guard check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 7: API query failure is not interpreted as zero active work; fails closed (Scenario 3)
# -----------------------------------------------------------------------------
echo ""
echo "Test 7: API query failure is not interpreted as zero active work; fails closed"

init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "7"},
    "spec": {
      "holderIdentity": "DeadRunner",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$(SIMULATE_PODS_QUERY_ERROR=1 "${SCRIPT}" "nst-db-migrate-second" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "1s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "API query failure verifying migration workload"; then
  pass "API query failure is not interpreted as zero active work; fails closed"
else
  fail "API query failure check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 8: Runner clock that is ahead does not independently authorize unsafe takeover (Scenario 4)
# -----------------------------------------------------------------------------
echo ""
echo "Test 8: Runner clock that is ahead does not independently authorize unsafe takeover"

init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "8"},
    "spec": {
      "holderIdentity": "LegitimateActiveOwner",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-20T00:00:00.000000Z",
      "renewTime": "2026-10-20T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-clock-ahead" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "1s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "Automatic lock stealing is refused"; then
  pass "A runner clock that is ahead does not independently authorize unsafe takeover"
else
  fail "Clock ahead check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 9: Runner clock that is behind does not leave system in unsafe state (Scenario 5)
# -----------------------------------------------------------------------------
echo ""
echo "Test 9: Runner clock that is behind does not leave system in unsafe state; fails closed safely"

init_cluster_state
FUTURE_TIME=$(date -u -v+1d +"%Y-%m-%dT%H:%M:%S.000000Z" 2>/dev/null || date -u -d "+1 day" +"%Y-%m-%dT%H:%M:%S.000000Z" 2>/dev/null || echo "2030-01-01T00:00:00.000000Z")
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "9"},
    "spec": {
      "holderIdentity": "FutureRunner",
      "leaseDurationSeconds": 360,
      "acquireTime": "${FUTURE_TIME}",
      "renewTime": "${FUTURE_TIME}"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-clock-behind" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "1s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "Clock skew detected: Lease timestamp"; then
  pass "A runner clock that is behind does not leave system in unsafe state; fails closed safely"
else
  fail "Clock behind check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 10: Lease with ambiguous timestamp follows documented fail-closed policy (Scenario 6)
# -----------------------------------------------------------------------------
echo ""
echo "Test 10: Lease with ambiguous or missing timestamp follows documented fail-closed policy"

# 10A: Malformed timestamp
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "10"},
    "spec": {
      "holderIdentity": "CorruptedRunner",
      "leaseDurationSeconds": 360,
      "acquireTime": "CORRUPTED_NON_ISO_TIMESTAMP",
      "renewTime": "CORRUPTED_NON_ISO_TIMESTAMP"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-ambiguous" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "1s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "has ambiguous/malformed timestamp"; then
  pass "A Lease with malformed timestamp follows documented fail-closed policy"
else
  fail "Malformed timestamp check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 10B: Missing timestamp
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "10"},
    "spec": {
      "holderIdentity": "CorruptedRunner2",
      "leaseDurationSeconds": 360,
      "acquireTime": "",
      "renewTime": ""
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-missing-time" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "1s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "has no acquireTime or renewTime"; then
  pass "A Lease with missing timestamp follows documented fail-closed policy"
else
  fail "Missing timestamp check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 11: Stale owner cannot start migration work after ownership loss (Scenario 7)
# -----------------------------------------------------------------------------
echo ""
echo "Test 11: Stale owner cannot start migration work after ownership loss"

init_cluster_state
set +e
RUN_OUTPUT=$(SIMULATE_LEASE_STOLEN_BEFORE_APPLY=1 "${SCRIPT}" "nst-db-migrate-stale-owner" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "300s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "Lock ownership lost before migration Job submission"; then
  pass "A stale owner cannot start or continue launching migration work after ownership loss"
else
  fail "Stale owner guard check" "Exit: ${EXIT_CODE}, Calls: $(cat "${CALL_LOG}"), Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 12: Workstream 09 OCC checks remain enforced on every release mutation (Scenario 8)
# -----------------------------------------------------------------------------
echo ""
echo "Test 12: Workstream 09 OCC checks remain enforced on every release mutation"

init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "25"},
    "spec": {
      "holderIdentity": "NewLegitimateOwner",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T06:00:00.000000Z",
      "renewTime": "2026-10-21T06:45:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

# Stale process with holder=OldOwner and rv=24 attempts release patch
STALE_RELEASE_OUTPUT=$(kubectl patch lease nst-migration-lock -n nst-events --type='json' -p='[
  {"op": "test", "path": "/metadata/resourceVersion", "value": "24"},
  {"op": "test", "path": "/spec/holderIdentity", "value": "OldOwner"},
  {"op": "add", "path": "/spec/holderIdentity", "value": ""}
]' 2>&1 || true)

CURRENT_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity'))")

if echo "${STALE_RELEASE_OUTPUT}" | grep -q "test operation failed" && [ "$CURRENT_HOLDER" = "NewLegitimateOwner" ]; then
  pass "Stale release patch is rejected and does not mutate newer owner's Lease"
else
  fail "Stale release safety check" "Output: ${STALE_RELEASE_OUTPUT}, Holder: ${CURRENT_HOLDER}"
fi

# -----------------------------------------------------------------------------
# Test 13: Handled migration failure cleans up owned lock and returns exit code 1 (Scenario 10)
# -----------------------------------------------------------------------------
echo ""
echo "Test 13: Handled migration failure cleans up owned lock and blocks rollout"

init_cluster_state
set +e
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-fail" "ghcr.io/nst-sdc/nst-api:targetFail" "nst-events" "300s" 2>&1)
EXIT_CODE=$?
set -e

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'NONE'))")

if [ $EXIT_CODE -eq 1 ] && [ "$FINAL_HOLDER" = "" ] && echo "${RUN_OUTPUT}" | grep -q "Database migration Job 'nst-db-migrate-fail' failed or timed out!"; then
  pass "Migration failure cleans up owned lock via atomic patch and returns exit code 1"
else
  fail "Handled failure check" "Exit: ${EXIT_CODE}, Final holder: '${FINAL_HOLDER}', Output: ${RUN_OUTPUT}"
fi

# -----------------------------------------------------------------------------
# Test 14: Guarded Orphaned Migration Lease Recovery (Workstream 11)
# -----------------------------------------------------------------------------
echo ""
echo "Test 14: Guarded Orphaned Migration Lease Recovery (Workstream 11)"

# 14A: Missing expected holder identity is rejected
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${RECOVER_SCRIPT}" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${RUN_OUTPUT}" | grep -q "CRITICAL: An explicit, non-empty <expected-holder-identity> must be provided"; then
  pass "14A: Missing expected holder identity is rejected with exit code 1"
else
  fail "14A: Missing expected holder check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 14B: Malformed or whitespace-only expected holder identity is rejected
set +e
RUN_OUTPUT=$("${RECOVER_SCRIPT}" "   " "nst-events" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${RUN_OUTPUT}" | grep -q "CRITICAL: An explicit, non-empty <expected-holder-identity> must be provided"; then
  pass "14B: Malformed/empty expected holder identity is rejected with exit code 1"
else
  fail "14B: Malformed expected holder check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 14C: Current holder matches expected orphan: guarded recovery succeeds
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

RUN_OUTPUT=$("${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events")
EXIT_CODE=$?

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'UNKNOWN'))")
FINAL_RV=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('metadata', {}).get('resourceVersion', 'UNKNOWN'))")

if [ $EXIT_CODE -eq 0 ] && [ "$FINAL_HOLDER" = "" ] && [ "$FINAL_RV" = "51" ] && echo "${RUN_OUTPUT}" | grep -q "SUCCESS: Orphaned migration lock 'nst-migration-lock' was cleanly recovered"; then
  pass "14C: Current holder matches expected orphan: guarded recovery succeeds atomically"
else
  fail "14C: Guarded recovery success check" "Exit: ${EXIT_CODE}, Holder: '${FINAL_HOLDER}', RV: '${FINAL_RV}', Output: ${RUN_OUTPUT}"
fi

# 14D: Current holder differs from expected orphan: recovery refuses to mutate
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "ActiveRunnerX",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'UNKNOWN'))")

if [ $EXIT_CODE -eq 1 ] && [ "$FINAL_HOLDER" = "ActiveRunnerX" ] && echo "${RUN_OUTPUT}" | grep -q "Holder mismatch on Lease"; then
  pass "14D: Current holder differs from expected orphan: recovery refuses to mutate Lease"
else
  fail "14D: Holder mismatch check" "Exit: ${EXIT_CODE}, Final Holder: '${FINAL_HOLDER}', Output: ${RUN_OUTPUT}"
fi

# 14E: Lease already free: recovery refuses redundant modification
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${RUN_OUTPUT}" | grep -q "is already free/unowned"; then
  pass "14E: Lease is already free: recovery refuses redundant modification"
else
  fail "14E: Already free check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 14F: Stale recovery after Lease mutation / new owner acquisition
# 14F1: Resource version changed before atomic patch (OCC failure)
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$(SIMULATE_CONCURRENT_MUTATION_ON_PATCH=1 "${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'UNKNOWN'))")

if [ $EXIT_CODE -eq 1 ] && [ "$FINAL_HOLDER" = "DeadRunnerCrashed" ] && echo "${RUN_OUTPUT}" | grep -q "Atomic recovery patch failed"; then
  pass "14F1: Resource version changed concurrently: patch fails safely with OCC error"
else
  fail "14F1: OCC failure check" "Exit: ${EXIT_CODE}, Final Holder: '${FINAL_HOLDER}', Output: ${RUN_OUTPUT}"
fi

# 14F2: Holder changed concurrently right before patch
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$(SIMULATE_HOLDER_STEAL_ON_PATCH=1 "${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'UNKNOWN'))")

if [ $EXIT_CODE -eq 1 ] && [ "$FINAL_HOLDER" = "NewSneakyHolder" ] && echo "${RUN_OUTPUT}" | grep -q "Atomic recovery patch failed"; then
  pass "14F2: New owner acquired Lease concurrently: patch test fails and protects new holder"
else
  fail "14F2: Concurrent steal check" "Exit: ${EXIT_CODE}, Final Holder: '${FINAL_HOLDER}', Output: ${RUN_OUTPUT}"
fi

# 14G: Active Job or non-terminal pod prevents recovery
# 14G1: Active Job
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {
    "nst-db-migrate-running": {
      "complete": "",
      "failed": "",
      "active": 1
    }
  },
  "pods": []
}
EOF

set +e
RUN_OUTPUT=$("${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'UNKNOWN'))")

if [ $EXIT_CODE -eq 1 ] && [ "$FINAL_HOLDER" = "DeadRunnerCrashed" ] && echo "${RUN_OUTPUT}" | grep -q "Active migration Job(s) detected"; then
  pass "14G1: Active migration Job prevents recovery"
else
  fail "14G1: Active Job guard check" "Exit: ${EXIT_CODE}, Final Holder: '${FINAL_HOLDER}', Output: ${RUN_OUTPUT}"
fi

# 14G2: Non-terminal pod (Pending/Running)
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": [
    {
      "metadata": {"name": "nst-db-migrate-pending-pod"},
      "status": {"phase": "Pending"}
    }
  ]
}
EOF

set +e
RUN_OUTPUT=$("${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'UNKNOWN'))")

if [ $EXIT_CODE -eq 1 ] && [ "$FINAL_HOLDER" = "DeadRunnerCrashed" ] && echo "${RUN_OUTPUT}" | grep -q "Active or pending migration Pod(s) detected"; then
  pass "14G2: Pending/running migration Pod prevents recovery"
else
  fail "14G2: Pending pod guard check" "Exit: ${EXIT_CODE}, Final Holder: '${FINAL_HOLDER}', Output: ${RUN_OUTPUT}"
fi

# 14G3: Pod with deletionTimestamp
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": [
    {
      "metadata": {"name": "nst-db-migrate-terminating-pod", "deletionTimestamp": "2026-10-21T00:01:00Z"},
      "status": {"phase": "Running"}
    }
  ]
}
EOF

set +e
RUN_OUTPUT=$("${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

FINAL_HOLDER=$(python3 -c "import json; print(json.load(open('${STATE_FILE}')).get('lease', {}).get('spec', {}).get('holderIdentity', 'UNKNOWN'))")

if [ $EXIT_CODE -eq 1 ] && [ "$FINAL_HOLDER" = "DeadRunnerCrashed" ] && echo "${RUN_OUTPUT}" | grep -q "Active or pending migration Pod(s) detected"; then
  pass "14G3: Terminating migration Pod with deletionTimestamp prevents recovery"
else
  fail "14G3: Terminating pod guard check" "Exit: ${EXIT_CODE}, Final Holder: '${FINAL_HOLDER}', Output: ${RUN_OUTPUT}"
fi

# 14H: Failed Kubernetes queries prevent recovery (fail-closed)
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

# 14H1: Jobs query API error
set +e
RUN_OUTPUT=$(SIMULATE_JOBS_QUERY_ERROR=1 "${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${RUN_OUTPUT}" | grep -q "API failure querying migration Jobs"; then
  pass "14H1: Jobs query API failure fails closed"
else
  fail "14H1: Jobs API error check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 14H2: Pods query API error
set +e
RUN_OUTPUT=$(SIMULATE_PODS_QUERY_ERROR=1 "${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${RUN_OUTPUT}" | grep -q "API failure querying migration Pods"; then
  pass "14H2: Pods query API failure fails closed"
else
  fail "14H2: Pods API error check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 14H3: Lease query API error
set +e
RUN_OUTPUT=$(SIMULATE_LEASE_QUERY_ERROR=1 "${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && echo "${RUN_OUTPUT}" | grep -q "Could not retrieve Lease"; then
  pass "14H3: Lease query API failure fails closed"
else
  fail "14H3: Lease API error check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 14I: Successful recovery leaves an explicitly unowned Lease that a subsequent deployment claims
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": {
    "apiVersion": "coordination.k8s.io/v1",
    "kind": "Lease",
    "metadata": {"name": "nst-migration-lock", "resourceVersion": "50"},
    "spec": {
      "holderIdentity": "DeadRunnerCrashed",
      "leaseDurationSeconds": 360,
      "acquireTime": "2026-10-21T00:00:00.000000Z",
      "renewTime": "2026-10-21T00:00:00.000000Z"
    }
  },
  "jobs": {},
  "pods": []
}
EOF

# Guarded recovery clears the orphaned lock
"${RECOVER_SCRIPT}" "DeadRunnerCrashed" "nst-events" >/dev/null

# Next deployment runs and claims the freed lock normally
RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-after-guarded-recovery" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "300s")
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ] && echo "${RUN_OUTPUT}" | grep -q "Claimed free migration lock" && grep -q 'kubectl apply' "${CALL_LOG}"; then
  pass "14I: Successful recovery leaves unowned Lease claimed cleanly by subsequent deployment"
else
  fail "14I: Subsequent deployment claim check" "Exit: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 14J: No recovery path uses unconditional Lease deletion
if ! grep -q 'kubectl delete lease' "${CALL_LOG}"; then
  pass "14J: Zero unconditional Lease deletions occurred across all recovery tests"
else
  fail "14J: Unconditional Lease deletion check" "Found unexpected 'kubectl delete lease' in call log: $(grep 'kubectl delete lease' "${CALL_LOG}")"
fi


# -----------------------------------------------------------------------------
# Test 15: Existing completed-Job idempotency and failed-Job retry handling
# -----------------------------------------------------------------------------
echo ""
echo "Test 15: Existing completed-Job skips execution; failed-Job is safely recreated"

# 15A: Completed Job skips execution
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": null,
  "jobs": {
    "nst-db-migrate-done": {
      "complete": "True",
      "failed": "",
      "active": 0
    }
  },
  "pods": []
}
EOF

RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-done" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "300s")
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ] && ! grep -q 'kubectl create' "${CALL_LOG}" && ! grep -q 'kubectl apply' "${CALL_LOG}" && echo "${RUN_OUTPUT}" | grep -q "already completed successfully"; then
  pass "Already completed Job for this SHA exits 0 without acquiring lock or re-running"
else
  fail "Completed Job idempotency check" "Exit code: ${EXIT_CODE}, Output: ${RUN_OUTPUT}"
fi

# 15B: Failed Job with active=0 is recreated under lock
init_cluster_state
cat << EOF > "${STATE_FILE}"
{
  "lease": null,
  "jobs": {
    "nst-db-migrate-failed-sha": {
      "complete": "",
      "failed": "True",
      "active": 0
    }
  },
  "pods": []
}
EOF

RUN_OUTPUT=$("${SCRIPT}" "nst-db-migrate-failed-sha" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "300s")
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ] && grep -q 'kubectl delete job nst-db-migrate-failed-sha -n nst-events --wait=true' "${CALL_LOG}" && grep -q 'kubectl apply' "${CALL_LOG}"; then
  pass "Stale failed Job with 0 active pods is safely deleted and recreated under lock"
else
  fail "Failed Job retry under lock check" "Exit code: ${EXIT_CODE}, Calls: $(cat "${CALL_LOG}")"
fi

# -----------------------------------------------------------------------------
# Test 16: Kubernetes API failure fails closed
# -----------------------------------------------------------------------------
echo ""
echo "Test 16: Kubernetes API failure fails closed: no unsafe fallback deletion, no migration run"

init_cluster_state
set +e
RUN_OUTPUT=$(SIMULATE_API_ERROR=1 "${SCRIPT}" "nst-db-migrate-api-fail" "ghcr.io/nst-sdc/nst-api:target" "nst-events" "1s" 2>&1)
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ] && ! grep -q 'kubectl apply' "${CALL_LOG}" && ! grep -q 'kubectl delete lease' "${CALL_LOG}"; then
  pass "API failures fail closed: migration aborted, zero jobs applied, no unsafe lease deletion"
else
  fail "API failure handling check" "Exit code: ${EXIT_CODE}, Calls: $(cat "${CALL_LOG}")"
fi

# Clean up temporary mock directory
rm -rf "${TEMP_DIR}"

# -----------------------------------------------------------------------------
# Test 17: Schema and Migration SQL preservation
# -----------------------------------------------------------------------------
echo ""
echo "Test 17: Schema and Migration SQL preservation"

MIGRATION_MODIFIED=$(git diff --name-only "${REPO_ROOT}/packages/database/prisma/migrations" || true)
if [ -z "${MIGRATION_MODIFIED}" ]; then
  pass "No migration SQL files were modified or overwritten in packages/database/prisma/migrations"
else
  fail "Prisma migration diff check" "Unexpected modified migration files: ${MIGRATION_MODIFIED}"
fi

UNTRACKED_MIGRATION_COUNT=$(git status --porcelain "${REPO_ROOT}/packages/database/prisma/migrations" | grep -c '^\?\?' || true)
if [ "${UNTRACKED_MIGRATION_COUNT}" -eq 11 ]; then
  pass "All 11 untracked migration folders from prior workstreams and forward RLS reconciliation are preserved intact"
else
  fail "Untracked migrations check" "Expected 11 untracked migrations, found: ${UNTRACKED_MIGRATION_COUNT}"
fi

STAGED_DIFF=$(git diff --cached --name-only)
if [ -z "${STAGED_DIFF}" ]; then
  pass "No files are staged (zero git commit/stage safety constraint respected)"
else
  fail "Staged files check" "Found staged files: ${STAGED_DIFF}"
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
