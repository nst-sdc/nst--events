# NST Events — Operations Guide

This guide covers operational maintenance procedures for the NST Events platform.

---

## 1. Initial Platform Admin Bootstrap

### Overview
In NST Events, platform administrators have system-wide control over campus clubs, user roles, event approvals, and audit logs. 

To ensure security and eliminate privilege escalation attack surfaces:
- **No self-service admin promotion or invite API exists.**
- **No in-app admin bootstrap flow exists.**
- Promotion to `PLATFORM_ADMIN` is **deliberately manual and one-time**, requiring direct database access by an authorized operator. Future maintainers must **not** implement an admin-invite endpoint or self-service promotion flow around this.

---

### Prerequisites
1. **User Sign-In**: The target operator/administrator must sign into NST Events via Google OAuth **at least once** before this script is executed.
   - User records in the `users` table are provisioned on-the-fly upon initial Google OAuth handshake (`upsert_oauth_user`).
   - If the user has not signed in yet, the script will abort with an explanatory error.
2. **Local Repository & Database Connectivity**: This script is executed from an operator machine with the repository checked out and connectivity to PostgreSQL. (The production `nst-api` container runs a lean Node 20 runtime without TypeScript execution tooling or dev tooling, so running `.ts` scripts directly inside the container is not supported).

---

### Execution Procedure

#### Step 1: Establish Database Connectivity
If connecting to the production K3s cluster database, forward the Postgres service port to your local machine:
```bash
kubectl port-forward -n nst-events svc/nst-postgres-service 5432:5432
```

#### Step 2: Run the Bootstrap Script
Run the script using the `@nst/database` workspace command.

**Interactive Confirmation (prompts for confirmation before mutation):**
```bash
DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/nst_events?schema=public" \
pnpm --filter @nst/database bootstrap-admin -- <admin-email>
```

**Non-interactive / Scripted (`--yes` or `-y` flag):**
```bash
DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/nst_events?schema=public" \
pnpm --filter @nst/database bootstrap-admin -- <admin-email> --yes
```

*Example:*
```bash
DATABASE_URL="postgresql://postgres:my-secret-pw@localhost:5432/nst_events?schema=public" \
pnpm --filter @nst/database bootstrap-admin -- coordinator@adypu.edu.in --yes
```

*(Note: In local development, `DATABASE_URL` is automatically loaded from `packages/database/.env` if already set).*

---

### Script Behavior & Safety Guarantees
- **Strict Scope**: Mutates `global_role` to `PLATFORM_ADMIN` only. Does not touch club memberships (`club_role`), profile details, or any other user attributes.
- **Confirmation Guard**: Prompts the operator to type `yes` before committing the change unless the `--yes` or `-y` flag is supplied.
- **Idempotent**: If the specified user is already a `PLATFORM_ADMIN`, the script reports this clearly and exits with code `0` without making redundant updates.
- **Application Isolation**: This script is a standalone command-line utility. It is **not** exposed through any Express API route, Next.js dashboard route, or mobile interface.

---

## 2. CI/CD Deployer ServiceAccount & Runner Token Security

### Overview
Automated deployments via `.github/workflows/deploy.yml` run on the self-hosted GitHub Actions runner installed on cluster node `nst-n6` (`192.168.136.150`). The runner authenticates to the Kubernetes API server (`https://192.168.136.145:6443`) using a dedicated, scoped Kubernetes ServiceAccount: `github-actions-deployer`.

### Token Storage & Scope
- **File Location on `n6`**: `/home/github-runner/.kube/config` (mode `0600`, owned by system user `github-runner:github-runner`).
- **Cluster Secret**: `github-actions-deployer-token` (in namespace `nst-events`).
- **Permissions Boundary**: Strictly confined to namespace `nst-events` by Role `github-actions-deployer-role`.
  - Resources: `deployments`, `deployments/rollback`, `deployments/scale`, `replicasets`, `pods`, `pods/log`, `services`, `events`, `configmaps`, `ingresses`, `poddisruptionbudgets`.
  - Verbs: `get`, `list`, `watch`, `create`, `update`, `patch`.
  - **No cluster-admin**: The token cannot access or list resources in `kube-system`, `default`, or other cluster namespaces.
  - **No secret reading**: The deployer cannot read generic secrets (such as database credentials or API secrets) in `nst-events`.

### Revocation & Rotation Procedure
If `nst-n6` is decommissioned, compromised, or the token requires periodic rotation:
1. **Immediate Revocation**: Delete the static token secret from the cluster:
   ```bash
   kubectl delete secret github-actions-deployer-token -n nst-events
   ```
   *Effect*: The token sitting on `n6` is immediately invalidated by the Kubernetes API server.
2. **Issue New Token**:
   ```bash
   cat <<EOF | kubectl apply -f -
   apiVersion: v1
   kind: Secret
   metadata:
     name: github-actions-deployer-token
     namespace: nst-events
     annotations:
       kubernetes.io/service-account.name: github-actions-deployer
   type: kubernetes.io/service-account-token
   EOF
   ```
3. **Re-install Scoped Kubeconfig**: Extract the newly generated token from the secret (`kubectl get secret github-actions-deployer-token -n nst-events -o jsonpath="{.data.token}" | base64 --decode`) and update `/home/github-runner/.kube/config` on `nst-n6`.
