#!/usr/bin/env bash
#
# deploy-rollout.sh: Rollout gating with explicit timeout, first-deploy detection, and automatic rollback
#
set -eo pipefail

DEPLOYMENT="$1"
NAMESPACE="${2:-nst-events}"
TIMEOUT="${3:-300s}"

if [ -z "$DEPLOYMENT" ]; then
  echo "Usage: $0 <deployment-name> [namespace] [timeout]"
  exit 1
fi

echo "=== Gating Rollout: deployment/${DEPLOYMENT} in namespace ${NAMESPACE} (timeout: ${TIMEOUT}) ==="

# Check existing revisions before rollout gating
REVISIONS_BEFORE=$(kubectl rollout history deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" 2>/dev/null | grep -E '^[0-9]+' | awk '{print $1}' || true)
NUM_REVISIONS_BEFORE=$(echo "${REVISIONS_BEFORE}" | grep -c . || true)
echo "Revisions recorded prior to rollout: ${NUM_REVISIONS_BEFORE}"

# Attempt rollout status
set +e
kubectl rollout status deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" --timeout="${TIMEOUT}"
ROLLOUT_EXIT_CODE=$?
set -e

if [ $ROLLOUT_EXIT_CODE -eq 0 ]; then
  echo ">>> SUCCESS: deployment/${DEPLOYMENT} rollout completed successfully."
  if [ -n "$GITHUB_STEP_SUMMARY" ]; then
    echo "- ✅ **\`${DEPLOYMENT}\`**: Rollout completed and verified healthy." >> "$GITHUB_STEP_SUMMARY"
  fi
  exit 0
fi

echo ">>> FAILURE: deployment/${DEPLOYMENT} rollout timed out / failed (exit code ${ROLLOUT_EXIT_CODE})."

# Check revisions now
REVISIONS_NOW=$(kubectl rollout history deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" 2>/dev/null | grep -E '^[0-9]+' | awk '{print $1}' || true)
NUM_REVISIONS_NOW=$(echo "${REVISIONS_NOW}" | grep -c . || true)
echo "Revisions available now: ${NUM_REVISIONS_NOW}"

# If 1 or 0 revisions, there is no previous revision to rollback to
if [ "${NUM_REVISIONS_NOW}" -le 1 ]; then
  echo "================================================================================"
  echo "CRITICAL: first deploy failed, no rollback target, manual intervention required"
  echo "================================================================================"
  echo "::error title=First Deploy Failed (No Rollback Target)::deployment/${DEPLOYMENT} in namespace ${NAMESPACE} failed rollout and has no previous revision. Manual intervention required."

  if [ -n "$GITHUB_STEP_SUMMARY" ]; then
    cat << EOF >> "$GITHUB_STEP_SUMMARY"

> [!CAUTION]
> ### 🛑 First Deploy Failed — No Rollback Target
> - **Deployment**: \`${DEPLOYMENT}\` (namespace: \`${NAMESPACE}\`)
> - **Status**: Rollout timed out or failed.
> - **Revision State**: Only 1 revision exists in cluster history. No previous revision exists to rollback to.
> - **Action Taken**: Deployment and pods left intact in failing state for operator inspection. **Manual intervention required.**

EOF
  fi

  echo "Leaving failed deployment inspectable for investigation. Pod details:"
  kubectl get pods -l app="${DEPLOYMENT}" -n "${NAMESPACE}" -o wide || true
  echo "Recent events in ${NAMESPACE}:"
  kubectl get events -n "${NAMESPACE}" --sort-by='.metadata.creationTimestamp' | tail -n 10 || true
  exit 1
fi

echo ">>> Previous revision exists (total: ${NUM_REVISIONS_NOW}). Initiating automatic rollback via 'kubectl rollout undo'..."
kubectl rollout undo deployment/"${DEPLOYMENT}" -n "${NAMESPACE}"

echo ">>> Rollback command dispatched. Waiting for rollback rollout status to verify health (timeout: ${TIMEOUT})..."
set +e
kubectl rollout status deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" --timeout="${TIMEOUT}"
ROLLBACK_EXIT_CODE=$?
set -e

if [ $ROLLBACK_EXIT_CODE -eq 0 ]; then
  echo "================================================================================"
  echo "ALERT: Deployment failed; successfully rolled back to previous revision."
  echo "================================================================================"
  echo "::error title=Deployment Failed (Rolled Back Automatically)::deployment/${DEPLOYMENT} failed rollout; successfully rolled back to previous revision via 'kubectl rollout undo'."

  if [ -n "$GITHUB_STEP_SUMMARY" ]; then
    cat << EOF >> "$GITHUB_STEP_SUMMARY"

> [!WARNING]
> ### ⚠️ Deployment Failed — Automatically Rolled Back
> - **Deployment**: \`${DEPLOYMENT}\` (namespace: \`${NAMESPACE}\`)
> - **Status**: New release failed rollout status check.
> - **Action Taken**: Executed \`kubectl rollout undo\`. Previous revision restored and verified healthy.
> - **Impact**: Service traffic preserved on previous revision. Investigate build/probe failure.

EOF
  fi
  exit 1
else
  echo "================================================================================"
  echo "CRITICAL: Rollback itself failed or timed out! Manual intervention required."
  echo "================================================================================"
  echo "::error title=CRITICAL: Rollback Failed::deployment/${DEPLOYMENT} forward rollout failed AND rollback to previous revision failed/timed out! Urgent manual intervention required."

  if [ -n "$GITHUB_STEP_SUMMARY" ]; then
    cat << EOF >> "$GITHUB_STEP_SUMMARY"

> [!CAUTION]
> ### 🔥 CRITICAL: Forward Rollout & Rollback Both Failed
> - **Deployment**: \`${DEPLOYMENT}\` (namespace: \`${NAMESPACE}\`)
> - **Status**: Forward rollout failed, and subsequent rollback also failed/timed out.
> - **Action Required**: **Urgent manual cluster intervention required.**

EOF
  fi
  exit 1
fi
