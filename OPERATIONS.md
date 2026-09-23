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

### Migration Job RBAC Bootstrap

Prisma migrations run as a short-lived Kubernetes Job before the API rollout.
The deployer does not modify its own main Role. Instead, a cluster administrator
must apply the separate least-privilege Role and RoleBinding once:

```bash
kubectl apply -f infrastructure/kubernetes/github-actions-migration-rbac.yaml
```

This grants only the `batch/jobs` and pod-log permissions needed to create,
observe, retry, and read logs from migration Jobs in the `nst-events` namespace.
It does not grant secret access, deployment administration, or cross-namespace
access. Verify the bootstrap with:

```bash
kubectl auth can-i get jobs.batch \
  --as=system:serviceaccount:nst-events:github-actions-deployer \
  --namespace=nst-events
```

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

---

## 3. Database Backup & Restore

### Overview
Production PostgreSQL runs as `nst-postgres-0` in namespace `nst-events` (pinned to node `nst-n6`). Two independent protections are in place:

1. **Logical backup every 6 hours** — CronJob `nst-postgres-backup` runs `pg_dump -Fc` into the `nst-postgres-backups` PVC (10Gi, Longhorn). Every dump is verified with `pg_restore -l` before the job is allowed to succeed, and dumps older than 14 days are pruned.
2. **Volume snapshots every 6 hours** — Longhorn `RecurringJob` `nst-postgres-snapshot` snapshots the Postgres volume and retains 4 snapshots.

> **Both live inside the cluster.** They protect against *logical* damage (`DROP SCHEMA`, a bad migration, an accidental `prisma migrate reset`) but **not** against losing the cluster or its disks. An off-site S3/R2 backup target still needs to be configured for disaster recovery.

The backup pod is pinned to `nst-n6` and retries its dump up to 8 times because connections from a freshly started pod to `nst-postgres-service` can be refused for a short window on this cluster.

### What a backup does and does not give you
- **Recovery point:** up to 6 hours. Anything written since the last dump or snapshot is gone.
- **Recovery time:** tens of minutes. Restoring is a manual procedure, not an automatic one — nothing watches for a wipe and repairs it.
- **Nothing detects a wipe.** `prisma migrate reset` drops the schema and then re-applies every migration, so the API comes back up *healthy* against an empty database and logs no errors (this is exactly what happened on 2026-09-23). After any suspicious database action, verify row counts rather than trusting error rates:
  ```bash
  kubectl exec -n nst-events nst-postgres-0 -- psql -U postgres -d nst_events \
    -c "select (select count(*) from users) as users, (select count(*) from events) as events, (select count(*) from event_registrations) as registrations"
  ```


### Running a backup on demand
```bash
kubectl create job --from=cronjob/nst-postgres-backup nst-postgres-backup-manual -n nst-events
kubectl logs job/nst-postgres-backup-manual -n nst-events
```

### Listing the stored dumps
The backup volume is not mounted in the database pod, so use a helper pod:
```bash
kubectl run backup-helper -n nst-events --image=postgis/postgis:16-3.4 --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"backup-helper","image":"postgis/postgis:16-3.4","command":["sleep","3600"],"volumeMounts":[{"name":"b","mountPath":"/backups"}]}],"volumes":[{"name":"b","persistentVolumeClaim":{"claimName":"nst-postgres-backups"}}]}}'
kubectl exec -n nst-events backup-helper -- ls -lh /backups
kubectl cp nst-events/backup-helper:/backups/<dump-file> ./<dump-file>
kubectl delete pod -n nst-events backup-helper
```

### Restoring
Always restore into a scratch database first and verify it before promoting:

```bash
# 1. Port-forward the database
kubectl port-forward -n nst-events svc/nst-postgres-service 5432:5432

# 2. Restore into a scratch database
createdb -h localhost -U postgres nst_events_restore_check
pg_restore --no-owner --no-acl -h localhost -U postgres \
  -d nst_events_restore_check nst_events_<ts>.dump

# 3. Verify row counts and schema
psql -h localhost -U postgres -d nst_events_restore_check \
  -c "select count(*) from users" \
  -c "select count(*) from _prisma_migrations" \
  -c "select count(*) from information_schema.tables where table_name='event_forms'"
```

For a real recovery, stop the writers first (the period between a backup and the incident is lost either way):
```bash
kubectl scale deployment/nst-api deployment/nst-worker deployment/nst-dashboard -n nst-events --replicas=0
# restore into nst_events, then:
kubectl scale deployment/nst-api deployment/nst-worker deployment/nst-dashboard -n nst-events --replicas=1
kubectl rollout restart deployment/nst-api deployment/nst-worker deployment/nst-dashboard -n nst-events
```

### Never point a destructive Prisma command at production
`prisma migrate deploy` (what CI runs) is additive and safe. **Never run `prisma migrate reset` or `prisma db push --accept-data-loss` against the production `DATABASE_URL`.** That is what emptied this database on 2026-09-23: a `prisma migrate reset` was executed from an out-of-date checkout, which dropped the schema and left the database five migrations behind the deployed code.
