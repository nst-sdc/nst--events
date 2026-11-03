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

---

## 4. Kubernetes Probes & Service Health Architecture

### Probe Specifications

All services in namespace `nst-events` define explicit `readinessProbe` and `livenessProbe` definitions to ensure smooth rolling updates and zero downtime:

| Workload | Container Port | Readiness Probe | Liveness Probe | Design Rationale |
| :--- | :---: | :--- | :--- | :--- |
| **`nst-api`** | `3001` | `GET /ready` (period: 10s, delay: 5s) | `GET /health` (period: 20s, delay: 15s) | Readiness validates database read/write connectivity before routing ingress traffic. Liveness checks event-loop responsiveness without pinging PostgreSQL. |
| **`nst-worker`** | `3002` | `GET /ready` (period: 10s, delay: 5s) | `GET /health` (period: 20s, delay: 15s) | Readiness executes `SELECT 1` against PostgreSQL and asserts `isInitialized && !isShuttingDown`. Liveness confirms HTTP metrics/health daemon is responsive. |
| **`nst-dashboard`** | `3000` | `GET /api/health` (period: 10s, delay: 5s) | `GET /api/health` (period: 20s, delay: 15s) | Replaces previous `/login` probe to eliminate unnecessary Next.js Server-Side Rendering (SSR) overhead and avoid unnecessary CPU spikes every 10 seconds. |

### Verifying Pod Readiness
```bash
kubectl get pods -n nst-events -o wide
kubectl describe pod -l app=nst-api -n nst-events | grep -E "Readiness|Liveness"
kubectl describe pod -l app=nst-worker -n nst-events | grep -E "Readiness|Liveness"
kubectl describe pod -l app=nst-dashboard -n nst-events | grep -E "Readiness|Liveness"
```

---

## 5. Centralized Error-Tracking & Observability Wrapper

### Architecture
Centralized error tracking is implemented via the `@nst/shared` error tracker wrapper (`packages/shared/src/errors/tracker.ts`). It abstracts monitoring providers (such as Sentry or Datadog) while strictly guaranteeing data privacy and security.

### Sensitive Data Scrubbing Rules
All captured exceptions, tags, breadcrumbs, and metadata dictionaries are recursively scrubbed before ingestion. Any key matching or containing the following identifiers is automatically masked with `[REDACTED]`:
- `authorization`, `cookie`, `set-cookie`
- `qr_secret`, `qrSecret`, `totp`
- `password`, `token`, `refreshtoken`, `refresh_token`, `secret`, `nonce`, `access_token`
- `session_id`, `api_key`, `apikey`, `code`

### Provisioning Sentry
When ready to connect to Sentry:
1. Export or configure `SENTRY_DSN` in Kubernetes secrets or environment variables (`infrastructure/kubernetes/secrets.yaml`).
2. Initialize error tracking during bootstrap:
   ```typescript
   import { initErrorTracking } from '@nst/shared';

   initErrorTracking({
     serviceName: 'nst-api',
     environment: process.env.NODE_ENV || 'production',
     dsn: process.env.SENTRY_DSN,
   });
   ```
3. In local development or automated CI tests where `SENTRY_DSN` is omitted, the wrapper functions in structured test mode, logging errors cleanly without leaking sensitive credentials.

---

## 6. Campus Wi-Fi NAT & Multi-Replica Rate Limiting Math

### The Challenge
Newton School of Technology (NST), Pune hosts 3,000+ active students sharing common campus NAT gateway IP addresses. With API services deployed across 2-3 replicas, standard per-IP rate limiting caused mass 429 lockouts.

### Rate Limiting Architecture & Per-Replica Quotas
To ensure rock-solid reliability during peak event registrations and morning login waves:

1. **Authenticated Requests**: Keyed strictly by authenticated `user_id`. Campus NAT IP is not used for authenticated route accounting.
2. **Token Refresh & Logout (`/auth/refresh`, `/auth/logout`)**:
   - Keyed by `auth:token:${sha256(token)}`.
   - Quota: `RATE_LIMIT_AUTH_TOKEN_MAX = 60` requests per 15-minute window (30 requests/replica across 2 replicas).
   - Hammering a single token returns `429 Too Many Requests` with a `Retry-After` header.
3. **Unauthenticated Token Fallback**:
   - Fallback when no token is present: `RATE_LIMIT_AUTH_UNAUTH_MAX = 2000` per 15-minute window (1,000 requests/replica across 2 replicas) keyed by IP, preventing campus-wide lockouts.
4. **Google OAuth Start & Callback (`/auth/google`, `/auth/google/callback`)**:
   - Configured with `skipSuccessfulRequests: true`.
   - Quota: `RATE_LIMIT_AUTH_FAILED_MAX = 600` failed attempts per 15-minute window (300 failures/replica).
   - 3,000 legitimate students completing Google OAuth concurrently generate 0 failed request counts, completely preventing lockout waves.

---

## 7. Secrets Management, Git Audit & Rotation

### Security Policy
- `infrastructure/kubernetes/secrets.yaml` is strictly a TEMPLATE containing empty placeholder strings (`""`).
- **No real passwords, tokens, or private keys must ever be committed to version control.**
- Local secret files (`secrets.local.yaml`, `secrets.yaml.local`) are ignored via root `.gitignore`.

### Historical Git Audit (October 2026)
A complete git commit history audit of `infrastructure/kubernetes/secrets.yaml` confirmed that 0 real secrets have ever been committed since repository inception:
```bash
git log -p infrastructure/kubernetes/secrets.yaml
```
All commits used empty string placeholders (`""` and `''`).

### Secret Rotation Runbook
To rotate JWT secrets, cookie secrets, or database passwords:
1. Generate new 32+ character secrets: `openssl rand -hex 32`.
2. Apply updated secret manifest directly to the Kubernetes cluster:
   ```bash
   kubectl apply -f infrastructure/kubernetes/secrets.yaml.local -n nst-events
   ```
3. Perform a zero-downtime rolling restart:
   ```bash
   kubectl rollout restart deployment/nst-api deployment/nst-worker -n nst-events
   kubectl rollout status deployment/nst-api -n nst-events
   ```

---

## 8. HTTP Body Parser Limits & DoS Prevention

To safeguard Node.js memory heaps against payload-based Denial of Service (DoS) attacks, strict body size constraints are enforced across Express middleware:

1. **General JSON Limit (`express.json({ limit: '100kb' })`)**:
   - Caps all incoming JSON payloads to $\le 100\text{ KiB}$.
   - Protects attendance check-ins, registrations, and form submissions from oversized array bloat.
2. **General URL-Encoded Limit (`express.urlencoded({ extended: true, limit: '100kb' })`)**:
   - Caps form-encoded payloads to $\le 100\text{ KiB}$.
3. **Route-Scoped Exceptions**:
   - `/v1/admin/policies`: Explicitly mounted with `express.json({ limit: '256kb' })` to accommodate 100 KiB raw UTF-8 policy Markdown text plus JSON envelope overhead.
4. **RFC 7807 Error Handling**:
   - Payloads exceeding configured limits trigger `body-parser` `entity.too.large` (`status: 413`).
   - The central error handler intercepts this and formats an RFC 7807 Problem Details response (`type: https://api.nstsdc.org/errors/payload-too-large`, `title: Payload Too Large`, `status: 413`) with correlation `request_id`.

---

## 9. Prometheus Metrics, Observability & Security Monitoring

### Overview
`apps/api` exports Prometheus metrics via `prom-client` on the non-public `/metrics` endpoint. This provides cluster operators and security teams real-time visibility into HTTP throughput, latency distributions, rate limit rejections, SSE connections, and PostgreSQL connection pool health without writing to the database on every request.

### Scrape Configuration & Access Control
- **Endpoint**: `GET /metrics`
- **Access Control**:
  - In production (`NODE_ENV=production`), `METRICS_TOKEN` is mandatory. Loopback (`127.0.0.1`) and `PLATFORM_ADMIN` bypasses are completely disabled. The API will refuse to start if `METRICS_TOKEN` is unset.
  - Scrape requests must supply either:
    - HTTP Header: `Authorization: Bearer <METRICS_TOKEN>`
    - HTTP Header: `X-Metrics-Token: <METRICS_TOKEN>`
  - Constant-time verification is enforced: tokens are hashed via SHA-256 before comparing via `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
  - If `METRICS_TOKEN` is unset in non-production (local dev/test), access is restricted to localhost loopback (`127.0.0.1`, `::1`) or authenticated `PLATFORM_ADMIN` sessions. External requests receive `403 Forbidden`.
- **Recommended Scrape Interval**: 15s to 30s.

#### Prometheus Scrape Job Configuration
Add the following job to your Prometheus server `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'nst-api'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    scheme: http
    authorization:
      type: Bearer
      credentials: '<METRICS_TOKEN>'
    static_configs:
      - targets: ['nst-api-service.nst-events.svc.cluster.local:3001']
        labels:
          app: nst-api
          env: production
```

Alternatively, if managing Prometheus via Prometheus Operator with Secret mounting:
```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: nst-api-monitor
  namespace: nst-events
spec:
  selector:
    matchLabels:
      app: nst-api
  podMetricsEndpoints:
    - port: http
      path: /metrics
      interval: 15s
      authorization:
        type: Bearer
        credentials:
          name: prometheus-scraper-secrets
          key: METRICS_TOKEN
```

### Metric Catalog
| Metric Name | Type | Labels | Description |
|---|---|---|---|
| `nst_api_http_requests_total` | Counter | `method`, `route`, `status_code`, `status_class` | Total HTTP requests handled. Normalized route templates (e.g. `/v1/events/:id`) prevent label cardinality explosion. Unmatched 404 routes are collapsed strictly to `route="unmatched"`. |
| `nst_api_http_request_duration_seconds` | Histogram | `method`, `route`, `status_class` | Request latency distribution across 9 standard histogram buckets (5ms to 10s). |
| `nst_api_rate_limit_exceeded_total` | Counter | `bucket` | 429 rate limit rejections grouped by bucket (`auth_token`, `attendance`, `user`, `unauth`, `auth_oauth_failed`, `auth_ip_ceiling`). |
| `nst_api_sse_active_connections` | Gauge | `stream_type` | Current persistent Server-Sent Events streams (`event_live`, `notifications_live`). |
| `prisma_pool_connections_busy` / `idle` | Gauge | — | Database connection pool active vs idle connections exported by Prisma runtime. |
| `nst_api_process_resident_memory_bytes` | Gauge | — | Node.js process RSS memory. |
| `nst_api_nodejs_heap_size_used_bytes` | Gauge | — | V8 heap memory usage. |

### Grafana Dashboard
A ready-to-import Grafana dashboard JSON artifact is provided in:
`infrastructure/grafana/dashboard-traffic-security.json`

Importing this dashboard into Grafana provides 3 primary rows:
1. **HTTP Traffic & Performance Overview**: Request rate by status class (2xx, 4xx, 5xx) and latency percentiles (p50, p95, p99).
2. **Rate Limiting & Security Monitoring**: 429 rejections by bucket and top 10 routes by traffic.
3. **Realtime Streams & Database Pool Health**: Active SSE connections, database pool utilization, and process memory.

---

## 10. Production Environment Variables Reference

The following environment variables were introduced and hardened during Task H1/H2:

| Variable | Required in Prod | Default | Purpose & Constraints |
|---|---|---|---|
| `AUTH_EVENTS_IP_PEPPER` | **YES** | *None* | Secret salt/pepper used for one-way HMAC-SHA256 IP address hashing (`hashIp(ip, pepper)`) before storing in `auth_events`. Must be at least 32 characters. In production (`NODE_ENV=production`), the API **fails to start** if unset or equal to the committed default. Generate with `openssl rand -hex 32`. |
| `METRICS_TOKEN` | **YES** | *None* | Secret bearer token required to scrape `/metrics`. In production, the API **fails to start** if unset. Loopback bypasses are completely disabled in production. Compare using constant-time equality. Generate with `openssl rand -hex 32`. |
| `CAMPUS_CIDR_BLOCKS` | No | `""` | Comma-separated list of IPv4/IPv6 CIDR blocks belonging to campus networks (e.g., `"10.0.0.0/8,172.16.0.0/12"`). No private ranges are included by default. When unset or empty, `classifyNetwork` assigns `network_class = 'unknown'`. When configured, requests from IPs within these blocks receive `network_class = 'campus'`, and all other valid IPs receive `'off_campus'`. |


