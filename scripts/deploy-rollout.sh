#!/usr/bin/env bash
#
# deploy-rollout.sh: Rollout gating with explicit timeout, first-deploy detection,
# migration-awareness, and guarded rollback compatibility gating.
#
set -eo pipefail

DEPLOYMENT=""
NAMESPACE="${NAMESPACE:-nst-events}"
TIMEOUT="${TIMEOUT:-300s}"
MIGRATION_APPLIED="${MIGRATION_APPLIED:-false}"
ALLOW_UNVERIFIED_ROLLBACK="${ALLOW_UNVERIFIED_ROLLBACK:-false}"
ROLLBACK_COMPATIBILITY_POLICY="${ROLLBACK_COMPATIBILITY_POLICY:-strict}"

# Parse arguments and flags
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --migration-applied)
      MIGRATION_APPLIED="true"
      shift
      ;;
    --migration-applied=*)
      MIGRATION_APPLIED="${1#*=}"
      shift
      ;;
    --allow-unverified-rollback)
      ALLOW_UNVERIFIED_ROLLBACK="true"
      shift
      ;;
    --allow-unverified-rollback=*)
      ALLOW_UNVERIFIED_ROLLBACK="${1#*=}"
      shift
      ;;
    --compatibility-policy=*)
      ROLLBACK_COMPATIBILITY_POLICY="${1#*=}"
      shift
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      shift
      ;;
  esac
done

if [ ${#POSITIONAL_ARGS[@]} -ge 1 ]; then
  DEPLOYMENT="${POSITIONAL_ARGS[0]}"
fi
if [ ${#POSITIONAL_ARGS[@]} -ge 2 ]; then
  NAMESPACE="${POSITIONAL_ARGS[1]}"
fi
if [ ${#POSITIONAL_ARGS[@]} -ge 3 ]; then
  TIMEOUT="${POSITIONAL_ARGS[2]}"
fi

if [ -z "$DEPLOYMENT" ]; then
  echo "Usage: $0 <deployment-name> [namespace] [timeout] [options]"
  echo "Options:"
  echo "  --migration-applied                 Flag that forward DB migrations were applied for this release"
  echo "  --allow-unverified-rollback         Force container rollback even if migrations were applied"
  echo "  --compatibility-policy=<mode>       Policy: 'strict' (default), 'expand_contract_verified', or 'permissive'"
  exit 1
fi

echo "=== Gating Rollout: deployment/${DEPLOYMENT} in namespace ${NAMESPACE} (timeout: ${TIMEOUT}) ==="
echo "Configuration: migration_applied=${MIGRATION_APPLIED}, compatibility_policy=${ROLLBACK_COMPATIBILITY_POLICY}, allow_unverified_rollback=${ALLOW_UNVERIFIED_ROLLBACK}"

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

# Compatibility Gating: Check if forward migrations were applied
if [ "${MIGRATION_APPLIED}" = "true" ]; then
  if [ "${ROLLBACK_COMPATIBILITY_POLICY}" = "expand_contract_verified" ]; then
    echo ">>> Rollback compatibility verified under expand/contract discipline. Proceeding with container rollback..."
  elif [ "${ALLOW_UNVERIFIED_ROLLBACK}" = "true" ] || [ "${ROLLBACK_COMPATIBILITY_POLICY}" = "permissive" ]; then
    echo ">>> WARNING: Unverified rollback explicitly authorized by operator override. Proceeding with container rollback..."
  else
    # Rollback is gated to protect against running older container code against newer schema
    echo "================================================================================"
    echo "CRITICAL: Rollback Gated — Forward database migrations were applied"
    echo "================================================================================"
    echo "::error title=Rollback Gated (Schema Compatibility Hazard)::deployment/${DEPLOYMENT} failed rollout after forward migrations were applied. Automatic container rollback to previous revision is gated to prevent potential schema-mismatch crashes or data corruption."
    echo ">>> Why automatic rollback is gated:"
    echo ">>> 1. Forward database migrations have already executed against the database."
    echo ">>> 2. Automatic database down-migrations are disabled to protect against data destruction."
    echo ">>> 3. The previous container revision may not be backward-compatible with the new schema."
    echo ">>> Operator options:"
    echo ">>> - If the migrations adhere to expand/contract discipline and are backward-compatible with N-1, rerun with ROLLBACK_COMPATIBILITY_POLICY=expand_contract_verified or ALLOW_UNVERIFIED_ROLLBACK=true."
    echo ">>> - Otherwise, deploy a forward fix or perform manual triage."

    if [ -n "$GITHUB_STEP_SUMMARY" ]; then
      cat << EOF >> "$GITHUB_STEP_SUMMARY"

> [!CAUTION]
> ### 🛑 Rollback Gated — Forward Database Migrations Applied
> - **Deployment**: \`${DEPLOYMENT}\` (namespace: \`${NAMESPACE}\`)
> - **Status**: Rollout failed, but automatic container rollback is **GATED**.
> - **Reason**: Forward migrations were applied. Blind \`kubectl rollout undo\` risks schema-mismatch crashes or data corruption if older code expects previous database structure.
> - **Action Taken**: Deployment left intact in failing state.
> - **Resolution**: Rerun with \`ROLLBACK_COMPATIBILITY_POLICY=expand_contract_verified\` or \`ALLOW_UNVERIFIED_ROLLBACK=true\` if verified, or deploy a forward fix.

EOF
    fi

    echo "Leaving failed deployment inspectable for investigation. Pod details:"
    kubectl get pods -l app="${DEPLOYMENT}" -n "${NAMESPACE}" -o wide || true
    exit 1
  fi
else
  echo ">>> No forward migrations applied for this release. Previous revision is schema-compatible."
fi

echo ">>> Previous revision exists (total: ${NUM_REVISIONS_NOW}). Initiating rollback via 'kubectl rollout undo'..."
kubectl rollout undo deployment/"${DEPLOYMENT}" -n "${NAMESPACE}"

echo ">>> Rollback command dispatched. Waiting for rollback rollout status to verify health (timeout: ${TIMEOUT})..."
set +e
kubectl rollout status deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" --timeout="${TIMEOUT}"
ROLLBACK_EXIT_CODE=$?
set -e

if [ $ROLLBACK_EXIT_CODE -eq 0 ]; then
  echo "================================================================================"
  echo "ALERT: Deployment failed; container rolled back to previous revision."
  echo "================================================================================"
  echo "::error title=Deployment Failed (Container Rolled Back)::deployment/${DEPLOYMENT} failed rollout; rolled back to previous container revision via 'kubectl rollout undo'."
  echo ">>> CRITICAL SCHEMA COMPATIBILITY NOTICE:"
  echo ">>> Forward database migrations (if applied in this release) were NOT reverted."
  echo ">>> Automatic down-migrations are disabled to prevent data destruction."
  echo ">>> Restored container compatibility depends on expand/contract migration design."
  echo ">>> Operators must verify application/database parity or apply a forward-fix."

  if [ -n "$GITHUB_STEP_SUMMARY" ]; then
    cat << EOF >> "$GITHUB_STEP_SUMMARY"

> [!WARNING]
> ### ⚠️ Deployment Failed — Container Rolled Back (Database Schema NOT Reverted)
> - **Deployment**: \`${DEPLOYMENT}\` (namespace: \`${NAMESPACE}\`)
> - **Status**: Forward rollout timed out or failed health check.
> - **Action Taken**: Executed \`kubectl rollout undo\`. Previous container image restored.
> - **Database Notice**: If forward migrations were executed, the database remains at the newer schema. Database changes are **NOT** automatically rolled back.
> - **Required Action**: Verify backward-compatibility of the active database schema with the restored container revision. Do not assume previous working state is fully restored without schema validation.

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
