# Database Backup, Disaster Recovery & Offsite Replication Guide

This document defines the production architecture, cryptographic standards, provider-specific S3/R2 configurations, fail-closed activation guards, key recovery design, and step-by-step restoration procedures for the NST Events PostgreSQL database (`nst_events`).

---

## 1. Architecture Overview

The database disaster recovery system operates as a **two-tier architecture**:

```
+--------------------------------------------------------------------------+
| Kubernetes Cluster (nst-events namespace)                                 |
|                                                                          |
|  [nst-postgres StatefulSet]                                              |
|         │                                                                |
|         │ (pg_dump every 6h via nst-postgres-backup CronJob)              |
|         ▼                                                                |
|  [Tier 1: Local Longhorn PVC (nst-postgres-backups)]                     |
|         │  • Retention: 14 days                                          |
|         │  • Catalog validation via pg_restore -l                        |
|         │  • SHA-256 raw dump checksum generation                        |
|         │  • Modern AEAD: RFC 5083/5084 CMS AES-256-GCM                  |
|         │  • Local plaintext dump retained on PVC for fast local DR      |
|         ▼                                                                |
+---------┼────────────────────────────────────────────────────────────────+
          │ TLS 1.3 (In-Transit Encryption)
          ▼
+--------------------------------------------------------------------------+
| Tier 2: Offsite S3-Compatible Storage (Cloudflare R2 / AWS S3)          |
|  • Bucket: nst-events-db-backups                                         |
|  • Only authenticated ciphertext (.dump.enc) uploaded offsite            |
|  • Independent failure domain from cluster storage                       |
|  • Provider-specific handling (R2 vs AWS S3 SSE)                         |
|  • Two-stage verification: HeadObject size + remote read-back checksum   |
|  • 14-day remote retention enforcement                                   |
+--------------------------------------------------------------------------+
```

---

## 2. Secrets & Configuration (`nst-backup-secrets`)

Credentials and operational parameters are mounted strictly from the Kubernetes Secret `nst-backup-secrets`:

| Key | Description | Production Default | Example / Format |
|---|---|---|---|
| `REQUIRE_OFFSITE_BACKUP` | Enforce offsite upload; fail closed if absent | `"true"` | `"true"` (production) or `"false"` (local dev only) |
| `STORAGE_PROVIDER` | Object storage provider type | `"r2"` | `"r2"` or `"s3"` |
| `R2_ACCOUNT_ID` | Cloudflare account ID for R2 endpoint | (required if r2) | `32-character hex` |
| `R2_ACCESS_KEY_ID` | S3 API Access Key ID | (required) | `32-character hex` |
| `R2_SECRET_ACCESS_KEY` | S3 API Secret Access Key | (required) | `64-character hex` |
| `R2_BUCKET_NAME` | Dedicated backup bucket name | (required) | `nst-events-db-backups` |
| `BACKUP_PUBLIC_CERT` | X.509 PEM public certificate for envelope encryption (zero argv secrets) | (required in prod) | `-----BEGIN CERTIFICATE-----...` |
| `BACKUP_ENCRYPTION_PASSPHRASE` | Historical symmetric passphrase for backward-compatible decryption | (optional) | Min 32 random characters |
| `S3_ENDPOINT` | Custom endpoint override | (optional) | `https://<account_id>.r2.cloudflarestorage.com` |

---

## 3. Activation & Fail-Closed Guard Behavior

> [!IMPORTANT]
> **Production Fail-Closed Guarantee**
> Production backup configurations require offsite backup (`REQUIRE_OFFSITE_BACKUP="true"`). 
> - If `BACKUP_PUBLIC_CERT` (or `/etc/backup-certs/backup-cert.pem`) is missing or placeholder, the dump container **exits with code 1**. Unencrypted dumps are never uploaded offsite.
> - Argument-based secret passing (e.g. `-secretkey "$KEY"`) is strictly forbidden to eliminate `/proc/$PID/cmdline` secret exposure.
> - If destination credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) are missing or set to placeholders, the sync container **exits with code 1**.
> - The CronJob fails visibly, Kubernetes records an execution failure, and operational alerting is triggered.
> - **Local-only development mode** (`REQUIRE_OFFSITE_BACKUP="false"`) is an explicit, opt-in configuration for dev/test environments only.

---

## 4. Cryptographic Specification & Authenticated Encryption

The backup pipeline enforces genuine Authenticated Encryption with Associated Data (AEAD) with zero process-argument secret exposure:

### 4.1 Modern AEAD Standard: RFC 5083 / RFC 5084 CMS AES-256-GCM Envelope Encryption

- **Container Format**: Cryptographic Message Syntax (CMS) Authenticated-Enveloped-Data (`id-smime-ct-authEnvelopedData`, RFC 5083 / RFC 5084).
- **Cipher**: AES-256 in Galois/Counter Mode (`aes-256-gcm`, NIST SP 800-38D).
- **Key-Management Architecture**: Public-Key Envelope Encryption (Hybrid Cryptography).
  - An ephemeral 256-bit AES symmetric key and 96-bit (12-byte) initialization vector (IV) are generated cryptographically in memory by OpenSSL for each backup archive.
  - The symmetric session key is encrypted with the recipient's RSA-4096 / ECC public certificate (`backup-cert.pem`).
  - The private key (`backup-key.pem`) is **NEVER** present inside the Kubernetes cluster during backup generation.
- **Zero Command-Line Secrecy Exposure**: Only public file paths (`-in`, `-out`, and `cert.pem`) are passed to OpenSSL. No keys, passphrases, or derived material ever appear in `argv`, `/proc/$PID/cmdline`, audit logs, or environment variables.
- **Integrity Protection**: 128-bit (16-byte) ICV authentication tag embedded directly into the CMS structure.
- **Tamper & Truncation Rejection**: Any bit-flip, payload modification, or truncation causes immediate OpenSSL MAC verification failure and terminates with exit code `1`.

### 4.2 Distinguishing GnuPG MDC vs. Modern AEAD

- **Historical GnuPG 2.2.x Format**: GnuPG 2.2 produces OpenPGP Packet Tag 18 (SEIPD v1, RFC 4880 Section 5.13) using AES-256 in Cipher Feedback (CFB) mode with a SHA-1 Modification Detection Code (MDC).
- **Why MDC is NOT AEAD**: OpenPGP MDC is an append-only SHA-1 integrity block designed in 2000 for stream tampering detection. It is not an Authenticated Encryption with Associated Data (AEAD) cipher construction (such as AES-GCM or ChaCha20-Poly1305).
- **Backward Compatibility**: All historical `.dump.gpg` archives generated under Phase 1.1 remain fully decryptable using `gpg --batch --yes --passphrase-file <keyfile> --decrypt`. Historical symmetric CMS `.dump.enc` archives remain decryptable using PBKDF2 derived keys.

### 4.3 Cluster-Wide Global Dependencies vs. Database-Local Objects

Standard database dumps (`pg_dump -Fc`) export only database-local objects. They do **not** export cluster-level roles or cluster-wide privileges.

| Dependency Tier | PostgreSQL Objects | Handled By | Failure Mode If Missing |
|---|---|---|---|
| **Cluster-Wide (Global)** | - Roles: `nst_app`, `nst_worker`<br>- Role attributes: `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`<br>- Cluster privileges: `GRANT CONNECT ON DATABASE nst_events`<br>- Tablespaces: default `pg_default` | Declarative bootstrap SQL: `infrastructure/postgres/bootstrap-cluster-roles.sql` applied by DBA/operator prior to `pg_restore`. | `pg_restore` throws `ERROR: role "nst_worker" does not exist`, failing table grants and worker RLS policies. |
| **Database-Local** | - Schemas (`public`)<br>- Tables, views, sequences<br>- Extensions (`postgis`, `pgcrypto`)<br>- Functions (`current_user_id()`)<br>- Row Level Security policies<br>- Table and column grants | `pg_dump -Fc` / `pg_restore` (restored automatically from archive). | Archive restore fails or produces schema drift. |

> [!NOTE]
> **Why Declarative Bootstrap SQL Over `pg_dumpall --globals-only`?**
> `pg_dumpall --globals-only` exports plain SQL containing hashed passwords for all roles in `pg_authid` (including the cluster superuser `postgres`). In a disaster recovery scenario, restoring globals blindly would overwrite the destination cluster's superuser credentials and risk credential leakage.
> Declarative bootstrap (`bootstrap-cluster-roles.sql`) is idempotent, does not export superuser hashes, and allows destination-specific passwords to be injected securely from secrets or KMS.

---

## 5. Independent Key Storage, Escrow & Recovery Design

To ensure disaster recovery viability even in the event of complete Kubernetes cluster loss:

1. **Independent Key Storage**:
   - The backup encryption passphrase / private key must **NEVER** exist solely inside the Kubernetes cluster.
   - The primary copy of `BACKUP_ENCRYPTION_PASSPHRASE` must be stored in an external, independent key management system:
     - Production Option A: **AWS Secrets Manager / Cloudflare Secrets** (dedicated account).
     - Production Option B: **HashiCorp Vault / 1Password Enterprise Vault** (under infrastructure team custody).
     - Offline Cold Storage: An encrypted, air-gapped USB drive held in physical safe custody.

2. **Access Controls**:
   - Access to the backup encryption key is restricted to authorized SRE / Lead Architects via multi-factor authentication (MFA).
   - Read access logs are audited and alerted.

3. **Rotation Strategy**:
   - When rotating `BACKUP_ENCRYPTION_PASSPHRASE`:
     1. Inject the new passphrase into `nst-backup-secrets` in Kubernetes and the external vault.
     2. Record the rotation date and version tag (e.g. `KEY_VERSION="v2"` in metadata manifest).
     3. Retain all previous passphrases in the external key vault keyed by effective timestamp range (`valid_from` to `valid_until`).
     4. Existing offsite backups are **NOT** re-encrypted immediately; each backup retains its original `.meta.json` recording its KDF salt and key version.

4. **Consequences of Key Loss**:
   - Modern AEAD (AES-256-GCM) with 256-bit entropy cannot be cracked or recovered mathematically.
   - If the key is lost, all encrypted offsite backups created with that key become permanently unrecoverable.
   - Dual-custody escrow in an independent off-cluster vault is mandatory.

---

## 6. Provider-Specific S3 vs. Cloudflare R2 Compatibility

| Feature | Cloudflare R2 (`STORAGE_PROVIDER="r2"`) | AWS S3 (`STORAGE_PROVIDER="s3"`) |
|---|---|---|
| **Endpoint** | `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` | `https://s3.amazonaws.com` (or regional) |
| **Server-Side Encryption Header** | **NOT SUPPORTED** (passing `x-amz-server-side-encryption` produces `InvalidArgument` error) | Supported (`--sse AES256` or KMS) |
| **Confidentiality Guarantee** | Client-side authenticated CMS AES-256-GCM encryption protects data before transmission | Dual-layer: Client-side CMS AES-256-GCM + S3 SSE-S3 AES-256 |
| **Checksum Upload** | Separate `.sha256` file uploaded alongside `.enc` | Separate `.sha256` file uploaded alongside `.enc` |
| **Metadata Manifest** | `.meta.json` recording original unencrypted size/hash and encrypted size/hash | `.meta.json` recording original unencrypted size/hash and encrypted size/hash |

---

## 7. Remote Verification Protocol

Matching object size alone is **insufficient proof of integrity**. The pipeline implements a two-stage remote verification protocol:

1. **Stage 1: Preliminary Remote Existence & Size Check (`head-object`)**:
   - Queries `ContentLength` via `aws s3api head-object`.
   - Confirms the remote object exists and exactly matches the local byte count (`$LOCAL_SIZE`).
2. **Stage 2: Remote Read-Back Checksum Verification**:
   - Downloads the remote encrypted archive to a temporary sandbox directory:
     ```bash
     aws s3 cp "s3://${BUCKET}/backups/${ARTIFACT_NAME}" "$VERIFY_DIR/${ARTIFACT_NAME}" --endpoint-url "$ENDPOINT"
     ```
   - Computes `sha256sum "$VERIFY_DIR/${ARTIFACT_NAME}"`.
   - Asserts exact match against local `${ARTIFACT_NAME}.sha256`.
   - Removes temporary verification file.
   - Only marks offsite replication successful once read-back checksum is verified.

---

## 8. Step-by-Step Restoration Procedures

> [!CAUTION]
> **NEVER TEST RESTORE PROCEDURES AGAINST PRODUCTION.**
> Restoration drills must be performed exclusively in an isolated disposable staging environment.

### Scenario A: Restore from Local Longhorn PVC

If the live database container is accessible and local PVC `/backups` is intact:

1. **Locate the desired backup file**:
   ```bash
   kubectl exec -n nst-events nst-postgres-0 -- ls -lht /backups/
   ```

2. **Verify SHA-256 checksum of raw dump**:
   ```bash
   cd /backups
   sha256sum -c nst_events_YYYYMMDDTHHMMSSZ.dump.sha256
   ```

3. **Verify archive catalog readability**:
   ```bash
   pg_restore -l nst_events_YYYYMMDDTHHMMSSZ.dump | head -n 30
   ```

4. **Restore to target database**:
   Disaster recovery procedures must restore into a newly created disposable database (`nst_events_recovery`) to prevent partial state corruption on failure:
   ```bash
   # 1. Create a fresh disposable database
   psql -h 127.0.0.1 -U postgres -d postgres \
     -c "CREATE DATABASE nst_events_recovery WITH OWNER postgres ENCODING 'UTF8';"

   # 2. Execute restore with --exit-on-error and fail-closed teardown
   if ! pg_restore \
     --host=127.0.0.1 \
     --username=postgres \
     --dbname=nst_events_recovery \
     --exit-on-error \
     --no-owner \
     --verbose \
     /backups/nst_events_YYYYMMDDTHHMMSSZ.dump; then
       echo "[FATAL] Local restore encountered an error! Dropping partially restored database to prevent unverified recovery..." >&2
       psql -h 127.0.0.1 -U postgres -d postgres \
         -c "DROP DATABASE IF EXISTS nst_events_recovery;"
       exit 1
   fi
   ```
   *Note 1: `--exit-on-error` ensures `pg_restore` halts immediately on the first error and returns a non-zero exit code.*
   *Note 2: If a restore fails after creating some objects, the procedure explicitly drops `nst_events_recovery` to prevent a partially restored database from being treated as recovered.*
   *Note 3: Dropping on failure guarantees that a subsequent retry starts from a completely clean slate without conflicting leftover objects.*

5. **Perform Pre-Cutover Validation Checklist (Section 9)**:
   Verify 100% schema parity (all 150 Prisma migrations), PostGIS and pgcrypto extensions, least-privilege roles (`nst_app`, `nst_worker`), table/column grants, and RLS policies on `nst_events_recovery` before touching the active application.

6. **Execute Application Quiesce, Cutover, and Controlled Traffic Progression**:

   > [!IMPORTANT]
   > **PostgreSQL 16 Transactional Cutover Semantics & Connection Constraints**:
   > - **Transactional Rename DDL**: In PostgreSQL 16, `ALTER DATABASE ... RENAME TO ...` is a catalog DDL operation that **executes inside an explicit transaction block** (`BEGIN ... COMMIT`).
   > - **Atomic Two-Rename Swap**: Executing both renames (`ALTER DATABASE nst_events RENAME TO nst_events_old;` and `ALTER DATABASE nst_events_recovery RENAME TO nst_events;`) inside a single `BEGIN ... COMMIT` transaction provides **full atomicity**. There is zero intermediate window where `nst_events` is missing to new connections. If an error occurs before `COMMIT`, the entire transaction rolls back cleanly, leaving both database names and contents unchanged.
   > - **Implicit `psql -c` Multi-Statement Trap**: Multi-statement commands passed in a single `psql -c "..."` string execute inside an implicit transaction block. `DROP DATABASE` cannot run inside any transaction block (`ERROR: DROP DATABASE cannot run inside a transaction block`). If `DROP DATABASE` is chained into a multi-statement `psql -c` command, the error aborts the implicit transaction and **rolls back the preceding renames** (even though `psql` displays `ALTER DATABASE` command tags).
   > - **Exclusion of `DROP DATABASE`**: `DROP DATABASE` must **never** be run within the cutover transaction block, and must **never** be run during the cutover window. `nst_events_old` is preserved under the mandatory 24-hour bake-in retention policy.
   > - **Active Connection Draining Requirement**: Active client sessions to `nst_events` (such as Prisma connection pools or SSE pg-listener connections from `nst-api` and `nst-worker`) will block `ALTER DATABASE ... RENAME` or cause lock timeouts. All connections must be drained and disallowed prior to initiating the cutover transaction.

   The promotion and verification runbook follows three distinct operational stages:

   #### Stage 1: Database Cutover Completion (Atomic Swap, Applications Quiesced)
   Applications remain completely offline (`replicas=0`) while the database catalog swap executes:

   ```bash
   # Step 6.1: Quiesce application services in Kubernetes (drain in-flight writes & background jobs)
   # Targets verified against infrastructure/kubernetes/api-deployment.yaml and worker-deployment.yaml
   kubectl scale deployment nst-api -n nst-events --replicas=0
   kubectl scale deployment nst-worker -n nst-events --replicas=0

   # Step 6.2: Disallow new connections on both live and recovery databases
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
     -c "ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;"
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
     -c "ALTER DATABASE nst_events_recovery WITH ALLOW_CONNECTIONS false;"

   # Step 6.3: Terminate any lingering client backend sessions
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -c "
     SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname IN ('nst_events', 'nst_events_recovery')
       AND pid <> pg_backend_pid();
   "

   # Step 6.4: Confirm 0 active client connections
   ACTIVE_CONNS=$(psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -tAc "
     SELECT count(*) FROM pg_stat_activity
     WHERE datname IN ('nst_events', 'nst_events_recovery') AND pid <> pg_backend_pid();
   ")
   if [ "$ACTIVE_CONNS" -ne 0 ]; then
     echo "[FATAL] Connections remain active ($ACTIVE_CONNS)! Aborting cutover." >&2
     exit 1
   fi

   # Step 6.5: Execute atomic database cutover inside a single explicit transaction
   # Both renames commit atomically; if anything fails, catalog state rolls back completely
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -c "
     BEGIN;
     ALTER DATABASE nst_events RENAME TO nst_events_old;
     ALTER DATABASE nst_events_recovery RENAME TO nst_events;
     COMMIT;
   "

   # Step 6.6: Re-enable connections on newly promoted nst_events
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
     -c "ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;"
   ```

   #### Stage 2: Internal Application Verification (Under External Maintenance Gate)

   > [!CAUTION]
   > **Traffic-Gating Architectural Limitation & External Prerequisite Warning**:
   > Audit of `infrastructure/kubernetes/ingress.yaml` and `api-deployment.yaml` confirms that `nst-events-ingress` routes `/health`, `/ready`, `/auth`, `/v1`, `/webhooks` directly to `nst-api-service:80`, which selects `app: nst-api`.
   > **There is NO in-cluster maintenance gate, canary router, or traffic-blocking mechanism verified or implemented in this repository**.
   > **IMMEDIATE EXPOSURE RISK**: The moment `kubectl scale deployment nst-api -n nst-events --replicas=2` is executed and pods pass their `/ready` probe (within 5–15 seconds), **PUBLIC TRAFFIC IS IMMEDIATELY ROUTED TO THE PROMOTED DATABASE**.
   >
   > **EXTERNAL OPERATIONAL PREREQUISITE**:
   > - External mechanisms (such as Cloudflare WAF maintenance blocking, edge gateway redirects, or upstream DNS traffic pausing) are **unverified external operational prerequisites**, NOT implemented or automated features of this cluster.
   > - **Stage 2 internal verification CANNOT safely run with public ingress enabled** unless an independently tested external traffic block is confirmed active.
   > - If `nst-api` is scaled up while public ingress is open, incoming public requests will commit production writes immediately, collapsing the pre-traffic verification window and forfeiting the zero-data-loss rollback guarantee.
   >
   > **MANDATORY OPERATOR VERIFICATION PROTOCOL (Execute BEFORE Scaling `nst-api`)**:
   > 1. From an external workstation/network (off-cluster, unauthenticated client):
   >    ```bash
   >    curl -Iv https://events.nstsdc.org/ready
   >    curl -Iv https://api.nst-events.nstsdc.org/health
   >    ```
   > 2. Assert that the response is an external maintenance status (e.g. HTTP 503 or edge maintenance page) and confirms that **zero traffic reaches the Kubernetes cluster**.
   > 3. Inspect Traefik ingress access logs or cluster metrics to confirm 0 incoming requests are reaching `nst-api-service`.
   > 4. **ONLY AFTER** external blocking is confirmed active may the operator scale `nst-api` for internal verification.
   > 5. If no external traffic block is active or available, operators must acknowledge that scaling `nst-api` immediately constitutes Stage 3 (Public Traffic Resumption) and production writes will begin immediately.

   ```bash
   # Step 6.7: Start application services ONLY after external maintenance gate is verified active
   kubectl scale deployment nst-api -n nst-events --replicas=2
   kubectl scale deployment nst-worker -n nst-events --replicas=1

   # Step 6.8: Execute Internal Smoke Tests (via internal port-forward or pod-local exec)
   # 1. Verify health and readiness endpoints
   kubectl exec -n nst-events deployment/nst-api -c api -- wget -qO- http://127.0.0.1:3001/ready
   # 2. Verify worker queue polling
   kubectl logs -n nst-events deployment/nst-worker --tail=50
   # 3. Read-only application validation (events listing, user authentication check)

   # CRITICAL OPERATIONAL BOUNDARY:
   # While external traffic is blocked and no production writes have occurred, Rollback Procedure A
   # can be executed with ZERO DATA LOSS.
   ```

   #### Stage 3: Public Traffic Resumption (Post-Traffic Write Boundary)
   Once internal sanity checks pass 100%:
   ```bash
   # Step 6.9: Lift external maintenance block and admit public ingress traffic
   echo "[INFO] Opening public traffic. Beginning post-traffic write window..."
   # At this exact point, public writes begin and the zero-data-loss rollback window CLOSES.
   ```

7. **Rollback Procedures & Data-Loss Operational Model**:

   > [!WARNING]
   > **Operational Boundary: Pre-Traffic Rollback Window vs. Post-Traffic Production Writes**:
   > The pre-cutover database (`nst_events_old`) is a frozen point-in-time snapshot. It **does NOT contain any writes** committed after cutover.
   > - **Pre-Traffic Window (Zero Data Loss)**: While application pods are being validated in Stage 2 (before public write traffic is admitted), rolling back to `nst_events_old` preserves 100% of data with **zero data loss**.
   > - **Post-Traffic Window (Data Loss & Reconciliation Boundary)**: The moment public writes resume in Stage 3 (event registrations, attendances, users, points, notifications), **renaming `nst_events_old` back to `nst_events` will permanently destroy every transaction committed after cutover**. An unmanaged snapshot rollback after production writes is strictly prohibited. Post-write rollback is **classified as manual recovery with potential data loss**.

   #### Rollback Procedure A: Pre-Traffic Verification Failure (Zero Data Loss)
   If post-cutover application startup or health probes fail BEFORE public writes resume:
   ```bash
   echo "[ROLLBACK] Pre-traffic verification failed. Restoring original database..."
   # 1. Quiesce applications
   kubectl scale deployment nst-api -n nst-events --replicas=0
   kubectl scale deployment nst-worker -n nst-events --replicas=0

   # 2. Drain newly promoted database
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
     -c "ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;"
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -c "
     SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nst_events' AND pid <> pg_backend_pid();
   "

   # 3. Atomically restore original database and isolate failed restore
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -c "
     BEGIN;
     ALTER DATABASE nst_events RENAME TO nst_events_failed;
     ALTER DATABASE nst_events_old RENAME TO nst_events;
     COMMIT;
   "
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
     -c "ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;"

   # 4. Restart applications on original database
   kubectl scale deployment nst-api -n nst-events --replicas=2
   kubectl scale deployment nst-worker -n nst-events --replicas=1
   ```

   #### Rollback Procedure B: Post-Traffic Failure & Manual Recovery (Post-Write Boundary)
   If a critical defect or corruption is detected AFTER production traffic and writes have already resumed:
   ```bash
   echo "[ROLLBACK] Production issue detected after writes resumed. Initiating emergency containment..."
   # 1. Quiesce applications immediately to halt write divergence
   kubectl scale deployment nst-api -n nst-events --replicas=0
   kubectl scale deployment nst-worker -n nst-events --replicas=0

   # 2. Drain and isolate promoted database with all committed post-cutover writes
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
     -c "ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS false;"
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -c "
     SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nst_events' AND pid <> pg_backend_pid();
   "

   # 3. Swap databases atomically, STRICTLY PRESERVING nst_events_failed for data recovery
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres -c "
     BEGIN;
     ALTER DATABASE nst_events RENAME TO nst_events_failed;
     ALTER DATABASE nst_events_old RENAME TO nst_events;
     COMMIT;
   "
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
     -c "ALTER DATABASE nst_events WITH ALLOW_CONNECTIONS true;"
   ```

   > [!CAUTION]
   > **Post-Write Delta Reconciliation Audit & Limitations**:
   > At this point, `nst_events` is active but **DOES NOT CONTAIN ANY WRITES COMMITTED AFTER CUTOVER**.
   > A rigorous audit of the Prisma schema, migrations, and write paths across all **58 database base tables** (57 application models + 1 migration history table) proves that **simple SQL queries based on `created_at` CANNOT achieve complete recovery**:
   >
   > ##### 1. Database Table Inventory & Mutation Classification (58 Total Base Tables)
   >
   > **Category A: Mutable Business Tables (43 Individual Tables)**:
   > Tables whose entities undergo INSERT, UPDATE, and/or DELETE during operational traffic:
   >
   > | # | Table Name | Prisma Model | Mutation Types | Timestamp Support | Critical Reconciliation Risk |
   > |---|---|---|---|---|---|
   > | 1 | `users` | User | INSERT, UPDATE, Soft-DELETE | `created_at`, `updated_at`, `deleted_at` | Profile updates, role changes (`STUDENT` -> `CLUB_ADMIN`), and avatar edits on pre-cutover rows have `created_at < CUTOVER_TS` and are **missed**. |
   > | 2 | `refresh_tokens` | RefreshToken | INSERT, UPDATE, Hard-DELETE | `created_at`, `expires_at`, `revoked_at` | Token revocations and session deletions leave **revoked sessions active** in rollback DB. |
   > | 3 | `clubs` | Club | INSERT, UPDATE, Soft-DELETE | `created_at`, `updated_at`, `deleted_at` | Club status transitions (`ACTIVE`/`INACTIVE`), banner, and description updates are missed. |
   > | 4 | `club_memberships` | ClubMembership | INSERT, UPDATE, Soft-DELETE | `created_at`, `updated_at`, `deleted_at` | Officer promotions/demotions and membership revocations are missed. |
   > | 5 | `events` | Event | INSERT, UPDATE, Soft-DELETE | `created_at`, `updated_at`, `deleted_at` | State transitions (`DRAFT` -> `PUBLISHED` -> `CANCELLED`), capacity edits, and `registration_count` updates are missed. |
   > | 6 | `event_clubs` | EventClub | INSERT, Hard-DELETE | **NO timestamps** | Adding or removing collaborating clubs has no timestamp tracking. Hard-deletes are unrecoverable via delta extraction. |
   > | 7 | `teams` | Team | INSERT, UPDATE, Soft-DELETE | `created_at`, `deleted_at` (NO `updated_at`) | Leadership handovers (`leader_id`) and status transitions (`FORMING` -> `COMPLETE`) are **untracked by timestamp**. |
   > | 8 | `event_registrations` | EventRegistration | INSERT, UPDATE, Soft-DELETE, Hard-DELETE | `registered_at`, `deleted_at` (**NO `created_at`**, **NO `updated_at`**) | Runbook query `SELECT ... created_at` **fails with column error**. Status transitions (`REGISTERED` -> `WAITLISTED` -> `CANCELLED`) are untracked by timestamp. |
   > | 9 | `attendance_sessions` | AttendanceSession | INSERT, UPDATE, Soft-DELETE | `created_at`, `updated_at`, `deleted_at` | Opening/closing sessions (`open_at`, `close_at`), time edits, and geofence updates are missed. |
   > | 10 | `attendance_records` | AttendanceRecord | INSERT, UPDATE | `marked_at` (NO `updated_at`, NO `deleted_at`) | Status overrides (`PRESENT` -> `FLAGGED`) and forensic audit metadata updates are missed. Querying `scanned_at` fails. |
   > | 11 | `attendance_disputes` | AttendanceDispute | INSERT, UPDATE | `submitted_at` (NO `updated_at`) | Admin dispute review updates (`ACCEPTED` / `REJECTED`) on existing disputes are untracked by timestamp. |
   > | 12 | `event_results` | EventResult | INSERT, UPDATE | `created_at` (NO `updated_at`) | Award/result type changes on pre-cutover results are missed. |
   > | 13 | `notifications` | Notification | INSERT, UPDATE | `created_at` (NO `updated_at`) | Read status receipts (`read_at`) and delivery updates on pre-cutover notifications are missed. |
   > | 14 | `notification_preferences` | NotificationPreference | INSERT, UPDATE | **NO timestamps** | Student notification preference toggles have zero timestamp tracking. |
   > | 15 | `push_tokens` | PushToken | INSERT, UPDATE, Hard-DELETE | `created_at`, `updated_at` | Token de-registrations and device token replacements leave stale tokens active in rollback DB. |
   > | 16 | `notification_jobs` | NotificationJob | INSERT, UPDATE, Hard-DELETE | `created_at`, `updated_at` | Worker queue state changes (`QUEUED`, `PROCESSING`, `LOCKED`, retry counts) require transaction synchronization. |
   > | 17 | `announcements` | Announcement | INSERT, UPDATE, Soft-DELETE | `created_at` (NO `updated_at`) | Announcement edits or retractions on pre-cutover rows are missed. |
   > | 18 | `leadership_handover_requests` | LeadershipHandoverRequest | INSERT, UPDATE | `created_at` (NO `updated_at`) | Handover acceptance/rejection updates on pre-cutover requests are missed. |
   > | 19 | `user_academic_profiles` | UserAcademicProfile | INSERT, UPDATE | `created_at`, `updated_at` | Student program and batch association updates are missed. |
   > | 20 | `authorized_students` | AuthorizedStudent | INSERT, UPDATE | `created_at`, `updated_at` | Student directory authorizations and department corrections are missed. |
   > | 21 | `mobile_auth_codes` | MobileAuthCode | INSERT, UPDATE | `created_at`, `used_at` (NO `updated_at`) | Consumption of auth codes (`used_at`) on pre-cutover codes is untracked by creation timestamp. |
   > | 22 | `event_forms` | EventForm | INSERT, UPDATE | `created_at` (NO `updated_at`) | Publication lifecycle transitions (`DRAFT` -> `PUBLISHED`) on existing forms are missed. |
   > | 23 | `student_profile_values` | StudentProfileValue | INSERT, UPDATE | `updated_at` (**NO `created_at`**) | Dynamic field response updates have no creation timestamp. |
   > | 24 | `event_form_fields` | EventFormField | INSERT, UPDATE, Hard-DELETE | **NO timestamps** | Form studio field additions, deletions, or reordering have zero timestamps. |
   > | 25 | `event_registration_responses` | EventRegistrationResponse | INSERT, UPDATE | `created_at` (NO `updated_at`) | Edits to registration form answers are missed. |
   > | 26 | `projects` | Project | INSERT, UPDATE, Soft-DELETE | `created_at`, `updated_at`, `deleted_at` | Title, description, likes count, and view count increments are missed. |
   > | 27 | `project_links` | ProjectLink | INSERT, UPDATE, Hard-DELETE | `created_at` (NO `updated_at`) | Project external links added, edited, or removed have no update tracking. |
   > | 28 | `project_contributors` | ProjectContributor | INSERT, UPDATE, Soft-DELETE | `created_at`, `updated_at` | Contributor role and confirmation updates are missed. |
   > | 29 | `project_likes` | ProjectLike | INSERT, Hard-DELETE | `created_at` (NO `updated_at`) | Unliking a project issues a hard `DELETE`. The deletion does not exist in `nst_events_failed`; `nst_events_old` retains **stale zombie likes**. |
   > | 30 | `project_reports` | ProjectReport | INSERT, UPDATE | `created_at` (NO `updated_at`) | Moderation status updates (`PENDING` -> `RESOLVED`) on existing reports are missed. |
   > | 31 | `event_result_sets` | EventResultSet | INSERT, UPDATE | `created_at`, `updated_at` | Result publication status transitions (`DRAFT` -> `PUBLISHED` -> `WITHDRAWN`) are missed. |
   > | 32 | `event_result_revisions` | EventResultRevision | INSERT, UPDATE | `created_at`, `updated_at` | Award revision lifecycle updates require strict topological dependency ordering. |
   > | 33 | `event_awards` | EventAward | INSERT, UPDATE, Hard-DELETE | `created_at`, `updated_at` | Award placement, title, and tie ranking changes on pre-cutover awards are missed. |
   > | 34 | `award_recipients` | AwardRecipient | INSERT, UPDATE | `created_at` (NO `updated_at`) | Recipient assignment changes on existing awards are missed. |
   > | 35 | `award_recipient_members` | AwardRecipientMember | INSERT, UPDATE | `created_at` (NO `updated_at`) | Team member snapshots linked to awards have no update tracking. |
   > | 36 | `award_project_links` | AwardProjectLink | INSERT, Hard-DELETE | `created_at` (NO `updated_at`) | Linking or unlinking project showcases to awards is untracked for deletions. |
   > | 37 | `result_notification_outbox` | ResultNotificationOutbox | INSERT, UPDATE | `created_at`, `updated_at` | Outbox delivery state changes (`PENDING` -> `SENT` -> `FAILED`) require queue synchronization. |
   > | 38 | `student_achievements` | StudentAchievement | INSERT, UPDATE | `created_at`, `updated_at` | Achievement activation and superseding updates on existing achievements are missed. |
   > | 39 | `result_reports` | ResultReport | INSERT, UPDATE | `created_at` (NO `updated_at`) | Dispute resolution reviews on award results are untracked by timestamp. |
   > | 40 | `student_profiles` | StudentProfile | INSERT, UPDATE | `created_at`, `updated_at` | Headline, bio, skills, interests, and directory visibility updates on existing profiles are missed. |
   > | 41 | `student_profile_curated_items` | StudentProfileCuratedItem | INSERT, UPDATE, Hard-DELETE | `created_at`, `updated_at` | Curated showcase additions, visibility toggles, and item removals are missed. |
   > | 42 | `rate_limit_settings` | RateLimitSetting | INSERT, UPDATE, Hard-DELETE | `updated_at` (**NO `created_at`**) | Dynamic rate limit threshold updates have no `created_at` and are missed. |
   > | 43 | `rate_limit_overrides` | RateLimitOverride | INSERT, Hard-DELETE | `created_at` (NO `updated_at`) | Temporary rate limit exemptions that were deleted or expired remain active in rollback DB. |
   >
   > **Category B: Append-Only Ledgers & Historical Logs (8 Individual Tables)**:
   > Tables where application workflows strictly perform INSERTs (immutable audit/history trails):
   >
   > | # | Table Name | Prisma Model | Mutation Types | Timestamp Column | Operational Consideration |
   > |---|---|---|---|---|---|
   > | 1 | `audit_logs` | AuditLog | INSERT | `created_at` | Immutable security audit trail; capturable by timestamp, but referencing entities whose mutations were lost creates an inconsistent ledger. |
   > | 2 | `auth_events` | AuthEvent | INSERT | `created_at` | Security login/telemetry log; append-only. |
   > | 3 | `attendance_attempts` | AttendanceAttempt | INSERT | `created_at` | Forensic QR scan telemetry; append-only. |
   > | 4 | `result_audit_logs` | ResultAuditLog | INSERT | `created_at` | Audit trail for award and result mutations; append-only. |
   > | 5 | `project_moderation_actions` | ProjectModerationAction | INSERT | `created_at` | Administrative moderation log; append-only. |
   > | 6 | `event_slug_history` | EventSlugHistory | INSERT | `created_at` | Slug redirect history ledger; append-only. |
   > | 7 | `project_slug_history` | ProjectSlugHistory | INSERT | `created_at` | Project slug redirect history ledger; append-only. |
   > | 8 | `student_slug_history` | StudentSlugHistory | INSERT | `created_at` | Student profile slug redirect history ledger; append-only. |
   >
   > **Category C: Static, Reference, and Configuration Tables (6 Individual Tables)**:
   > Tables containing institutional master data, spatial metadata, or global configuration:
   >
   > | # | Table Name | Prisma Model | Mutation Types | Timestamp Support | Operational Consideration |
   > |---|---|---|---|---|---|
   > | 1 | `academic_programs` | AcademicProgram | INSERT, UPDATE (Admin) | `created_at`, `updated_at` | Institutional degree programs reference table. |
   > | 2 | `academic_batches` | AcademicBatch | INSERT, UPDATE (Admin) | `created_at`, `updated_at` | Institutional graduation year cohorts reference table. |
   > | 3 | `event_audience_batches` | EventAudienceBatch | INSERT, Hard-DELETE (Admin) | `created_at` | Junction table mapping events to eligible academic batches. |
   > | 4 | `spatial_ref_sys` | spatial_ref_sys | System Static | **None** | PostGIS internal spatial reference coordinate systems. |
   > | 5 | `field_definitions` | FieldDefinition | INSERT, UPDATE (Admin) | `created_at` | Global custom profile field templates. |
   > | 6 | `system_policies` | SystemPolicy | UPDATE (Admin) | `updated_at` (NO `created_at`) | Institutional policy markdown documents (`privacy-policy`, `terms-of-service`). |
   >
   > **Category D: Internal Migration Ledger (1 Table)**:
   > - `_prisma_migrations`: Prisma schema migration history and checksum tracking.
   >
   > **Total Base Tables in PostgreSQL: 43 (Mutable) + 8 (Append-Only) + 6 (Static/Ref) + 1 (Migration) = 58 Tables.**
   >
   > ##### 2. Demonstrated Inherent Recovery Failures of Timestamp Delta Extraction
   > 1. **Complete Loss of UPDATE Mutations**: Any update made to an entity created before cutover keeps its original `created_at`. Timestamp queries `WHERE created_at >= CUTOVER` return **zero rows** for these updates.
   > 2. **Complete Loss of DELETE Mutations**: Hard-deleted rows are completely absent from `nst_events_failed`. No extraction query can detect them. Rolling back to `nst_events_old` **resurrects stale deleted records** (e.g. revoked tokens, unliked projects).
   > 3. **Schema Column Incompatibilities**: Runbook queries referencing `event_registrations.created_at` or `attendance_records.scanned_at` fail with database syntax errors (`column does not exist`).
   > 4. **Foreign-Key Dependencies & Transaction Ordering**: Restoring child records (e.g. `event_registrations`, `event_registration_responses`, `attendance_records`) before parent entities (`users`, `teams`, `events`) triggers foreign-key constraint violations (`fk_team_event`, FK user references). Replay requires strict topological sorting.
   > 5. **Database Sequences & Autoincrement Collision**: Serial columns and sequences (e.g. `dispute_number`) advance independently on `nst_events_failed` and become de-synchronized from `nst_events_old`, causing primary key collisions upon subsequent writes.
   >
   > ##### 3. Mandatory Post-Write Operational Policy
   > - Post-write rollback is **STRICTLY LABELED AS MANUAL RECOVERY WITH POTENTIAL DATA LOSS**.
   > - The promoted database (`nst_events_failed`) must be **PERMANENTLY PRESERVED** for forensic investigation.
   > - An explicit operator review of all affected tables and transaction logs is mandatory.
   > - **PRODUCTION TRAFFIC MUST NOT RESUME** until:
   >   1. Full manual delta reconciliation is verified across all affected business tables, OR
   >   2. SRE Lead and Executive Leadership formally accept and document the data loss window in writing.
   > - **Architectural Boundary**: Untested logical replication, dual writes, or CDC pipelines must **NOT** be introduced or assumed without complete end-to-end qualification.

   #### Old Database Retention & Approved Decommission Policy:
   `nst_events_old` must be retained in the cluster for a **mandatory minimum 24-hour bake-in period**.
   Decommissioning `nst_events_old` is permitted ONLY when all of the following conditions are met:
   1. Post-cutover application smoke tests pass 100%.
   2. Production traffic has operated without database errors for >= 24 hours.
   3. Zero outstanding delta reconciliation or rollback requests.
   4. SRE / Lead Architect operational approval has been documented.
   ```bash
   # Decommission only after approval and retention period:
   psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
     -c "DROP DATABASE nst_events_old;"
   ```

---

### Scenario B: Full Disaster Recovery from Modern Encrypted Offsite Backup (`.dump.enc`)

In the event of total cluster loss, Longhorn storage corruption, or catastrophic datacenter outage:

1. **Download the encrypted backup, checksum, and metadata**:
   ```bash
   export AWS_ACCESS_KEY_ID="<ACCESS_KEY>"
   export AWS_SECRET_ACCESS_KEY="<SECRET_KEY>"
   ENDPOINT="https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com" # or https://s3.amazonaws.com
   BUCKET="nst-events-db-backups"
   TS="YYYYMMDDTHHMMSSZ"

   # Download artifacts
   aws s3 cp "s3://${BUCKET}/backups/nst_events_${TS}.dump.enc" ./ --endpoint-url "$ENDPOINT"
   aws s3 cp "s3://${BUCKET}/backups/nst_events_${TS}.dump.enc.sha256" ./ --endpoint-url "$ENDPOINT"
   aws s3 cp "s3://${BUCKET}/backups/nst_events_${TS}.dump.meta.json" ./ --endpoint-url "$ENDPOINT"
   ```

2. **Verify downloaded ciphertext checksum**:
   ```bash
   sha256sum -c "nst_events_${TS}.dump.enc.sha256"
   ```

3. **Decrypt with OpenSSL CMS (Authenticated AES-256-GCM AEAD)**:

   **Primary (X.509 Envelope Encryption — Zero argv secrets)**:
   Retrieve the offline disaster-recovery private key (`backup-key.pem`) from external escrow / cold storage:
   ```bash
   openssl cms -decrypt -binary \
     -inform DER \
     -in "nst_events_${TS}.dump.enc" \
     -inkey /path/to/backup-key.pem \
     -out "recovered.dump"
   ```
   *Note: If the private key is passphrase-protected, supply `-passin file:/path/to/passphrase` or `-passin fd:0`. Neither the key nor passphrase appears in process arguments (`argv`).*

   **Historical Backward Compatibility (Symmetric PBKDF2 CMS Archives)**:
   If restoring an older Phase 1.2 archive that recorded `"kdf": "PBKDF2-HMAC-SHA256"` in its `.meta.json`:
   ```bash
   SALT=$(jq -r .kdf_salt "nst_events_${TS}.dump.meta.json")
   KEY=$(openssl kdf -keylen 32 \
     -kdfopt "pass:${BACKUP_ENCRYPTION_PASSPHRASE}" \
     -kdfopt "hexsalt:${SALT}" \
     -kdfopt iter:100000 \
     -kdfopt digest:SHA256 \
     PBKDF2 | tr -d ':\n')

   openssl cms -decrypt -binary \
     -secretkey "$KEY" \
     -secretkeyid "01" \
     -inform DER \
     -in "nst_events_${TS}.dump.enc" \
     -out "recovered.dump"
   ```
   *Note: In all cases, if ciphertext was tampered with or truncated, OpenSSL immediately aborts with a fatal MAC verify failure.*

4. **Verify decrypted raw dump checksum against manifest**:
   ```bash
   RAW_SHA=$(jq -r .raw_sha256 "nst_events_${TS}.dump.meta.json")
   RECOVERED_SHA=$(sha256sum recovered.dump | awk '{print $1}')
   [ "$RAW_SHA" = "$RECOVERED_SHA" ] || { echo "Checksum mismatch!"; exit 1; }
   ```

5. **Verify archive catalog readability prior to touching target database**:
   ```bash
   pg_restore -l recovered.dump > /dev/null
   ```
   *Note: Pre-restore catalog verification ensures that truncated or corrupted custom-format dumps are rejected before altering the destination database.*

6. **Bootstrap Cluster-Wide Roles and Extensions on Target Cluster**:
   > [!IMPORTANT]
   > `pg_dump` exports only database-local objects (schemas, tables, functions, RLS policies, table grants).
   > It does **NOT** export cluster-wide roles (`nst_app`, `nst_worker`) or cluster privileges.
   > Attempting to run `pg_restore` into a fresh PostgreSQL cluster without bootstrapping roles causes `ERROR: role "nst_worker" does not exist` and fails table grant and policy restoration.
   > 
   > Apply the declarative bootstrap script before running `pg_restore`:
   ```bash
   # 1. Create target database (clean, disposable)
   psql -h "$TARGET_DB_HOST" -p "$TARGET_DB_PORT" -U postgres -d postgres \
     -c "CREATE DATABASE nst_events WITH OWNER postgres ENCODING 'UTF8';"

   # 2. Apply declarative cluster roles and extensions (idempotent, safe to rerun)
   psql -h "$TARGET_DB_HOST" -p "$TARGET_DB_PORT" -U postgres -d nst_events \
     -f infrastructure/postgres/bootstrap-cluster-roles.sql

   # 3. Configure runtime passwords from secure external vault / secrets
   psql -h "$TARGET_DB_HOST" -p "$TARGET_DB_PORT" -U postgres -d nst_events \
     -c "ALTER ROLE nst_app WITH PASSWORD '<APP_DB_PASSWORD>';"
   psql -h "$TARGET_DB_HOST" -p "$TARGET_DB_PORT" -U postgres -d nst_events \
     -c "ALTER ROLE nst_worker WITH PASSWORD '<WORKER_DB_PASSWORD>';"
   ```

7. **Execute restore with fail-closed teardown (`--exit-on-error`)**:
   ```bash
   # Execute restore with --exit-on-error: aborts immediately on first error
   if ! pg_restore \
     --host="$TARGET_DB_HOST" \
     --port="$TARGET_DB_PORT" \
     --username=postgres \
     --dbname=nst_events \
     --exit-on-error \
     --no-owner \
     --verbose \
     recovered.dump; then
       echo "[FATAL] Restore failed! Dropping partially restored database to prevent unverified recovery..." >&2
       psql -h "$TARGET_DB_HOST" -p "$TARGET_DB_PORT" -U postgres -d postgres \
         -c "DROP DATABASE IF EXISTS nst_events;"
       exit 1
   fi
   ```
   *Note 1: `--exit-on-error` ensures pg_restore halts immediately on the first error and returns a non-zero exit code.*
   *Note 2: If a restore fails after creating some objects, the procedure explicitly drops the database (`DROP DATABASE IF EXISTS nst_events;`) to prevent a partial/corrupt database from ever being treated as recovered.*
   *Note 3: Dropping on failure guarantees that a subsequent retry is completely safe and starts from a clean slate without colliding with leftover objects.*
   *Note 4: Do NOT include `--no-privileges`. Retaining table privileges from the dump is required so `nst_app` and `nst_worker` receive their granted table and column permissions.*

---

### Scenario C: Recovery from Historical OpenPGP Backups (`.dump.gpg`)

For archives generated prior to Phase 1.2:

```bash
gpg --batch --yes --passphrase-file <(echo -n "$BACKUP_ENCRYPTION_PASSPHRASE") \
  --decrypt "nst_events_${TS}.dump.gpg" \
  -o "recovered.dump"
```

---

## 9. Post-Restore Validation Checklist

Following any restoration drill or disaster recovery event, verify database integrity before reconnecting applications:

- [ ] **Table Integrity**: `SELECT count(*) FROM users; SELECT count(*) FROM events; SELECT count(*) FROM clubs;`
- [ ] **Data Consistency**: Check row counts match source manifest or expected application baseline.
- [ ] **Prisma Migrations History**: `SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;`
- [ ] **Row Level Security (RLS)**: Confirm `relrowsecurity = true` on protected tables:
  ```sql
  SELECT relname, relrowsecurity 
  FROM pg_class 
  WHERE relnamespace = 'public'::regnamespace AND relname IN ('users', 'students', 'registrations');
  ```
- [ ] **Active RLS Policies**: Confirm policies are present:
  ```sql
  SELECT schemaname, tablename, policyname, cmd, qual 
  FROM pg_policies 
  WHERE schemaname = 'public';
  ```
- [ ] **Application Least-Privilege & RLS Transaction Isolation**:
  ```bash
  # Baseline: Session context absent -> 0 rows returned
  psql -U nst_app -d nst_events -h "$TARGET_DB_HOST" -tAc "SELECT COUNT(*) FROM event_registrations;" # MUST be 0

  # Transaction: Context set inside explicit transaction -> only intended student's rows
  psql -U nst_app -d nst_events -h "$TARGET_DB_HOST" -tAc "
    BEGIN;
    SET LOCAL app.user_id = '<STUDENT_UUID>';
    SELECT COUNT(*) FROM event_registrations;
    COMMIT;
  "
  ```

> [!CAUTION]
> **Fail-Closed Verification Rule**:
> If any post-restore verification check fails (migration count mismatch, missing extension, missing RLS policy, permission leakage, or data count discrepancy), the restored database is unverified and MUST NOT be promoted into service. The database must be immediately dropped (`DROP DATABASE IF EXISTS <target_db>;`), the incident escalated, and the root cause investigated before retrying.

---

## 10. Disaster Recovery Readiness & Operational Verification Matrix

### 10.1 Environment Status Matrix

| Component / Verification Target | Environment / Scope | Verified Status | Evidence / Notes |
|---|---|---|---|
| **Independent Cluster Separation** | Disposable Docker containers on local host | **LOCAL PASS** | Source (5438) & Destination (5439). Zero state inheritance confirmed (0 databases, 0 nst roles on init). |
| **Full Schema & Migration Parity** | Local destination cluster | **LOCAL PASS** | All 150 Prisma migrations, extensions (`postgis`, `pgcrypto`), tables, views, triggers, and seed data restored 100% intact. |
| **Declarative Role Bootstrap Idempotency** | Local destination cluster | **LOCAL PASS** | `bootstrap-cluster-roles.sql` executed twice consecutively with zero errors. Creates only `nst_app` and `nst_worker` (`NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`). |
| **Least-Privilege & DDL Isolation** | Local destination cluster | **LOCAL PASS** | `nst_worker` access to `users.email`, `events`, and DDL `CREATE TABLE` strictly denied. `nst_app` DDL `DROP TABLE` strictly denied. Zero superuser memberships. Database and schema owned by `postgres`. |
| **RLS Transaction Isolation & Context Scoping** | Local destination cluster | **LOCAL PASS** | Context absent -> 0 rows. Explicit transaction (`BEGIN; SET LOCAL app.user_id = '...'; SELECT; COMMIT;`) -> exact student rows. Cross-student leak -> 0 rows. Post-transaction context reset -> 0 rows. Superuser bypass -> all rows. |
| **Authenticated Encryption Integrity (AEAD)** | Local OpenSSL CMS RFC 5083/5084 AES-256-GCM | **LOCAL PASS** | Bit-flip tampered ciphertext strictly rejected by GCM authentication tag. Truncated ciphertext strictly rejected. Zero command-line secret leakage. |
| **Plaintext Archive Corruption Detection** | Local destination cluster | **LOCAL PASS** | Truncated custom-format archive caught by `pg_restore -l` and `pg_restore` (exits non-zero). Corrupted test database left in unviable state and dropped. |
| **Exact Artifact Consistency** | Local file paths & container copies | **LOCAL PASS** | Source dump (`source.dump`) -> Encrypted (`nst_events_backup.dump.enc`) -> Decrypted (`recovered.dump`) -> Container (`/tmp/recovered.dump`). Checksum identical at every stage. Missing/empty artifacts fail fast. |
| **Transactional Cutover & Data-Loss Boundary Verification** | Disposable Docker container (`test-database-cutover.sh`) | **LOCAL PASS** | Multi-statement `psql -c` failure reproduced; catalog inspection proved complete rollback of renames on `DROP DATABASE` error. Explicit transaction block (`BEGIN; ALTER DATABASE ... RENAME ...; COMMIT;`) proved 100% atomic in PostgreSQL 16. Injected transaction failure proved zero partial/orphan rename state. Active connection blocking & draining verified. Pre-traffic zero-data-loss rollback verified. Post-traffic write data-loss on snapshot rollback empirically verified (post-cutover write absent in restored database, preserved in `nst_events_failed`). Old database strictly retained under 24h bake-in policy. |
| **External Vault Key Custody & Retrieval** | Production AWS Secrets Manager / Vault / 1Password | **BLOCKED / NOT VERIFIED** | Only mock external directory (`$MOCK_VAULT_DIR`) verified. Live external IAM roles, KMS policies, network paths, and automated key retrieval remain unexecuted. |
| **Live Offsite Storage Sync & Read-Back** | Real Cloudflare R2 / AWS S3 buckets | **BLOCKED / NOT VERIFIED** | CronJob script logic verified locally; live upload, `head-object`, and remote read-back checksum download against real cloud endpoints remain unverified without production credentials. |
| **Staging Kubernetes Cluster DR Drill** | Staging Kubernetes cluster | **NOT VERIFIED** | Full cluster recovery drill not yet executed on dedicated staging cluster infrastructure. |
| **Production Disaster Recovery Certification** | Production Kubernetes cluster | **BLOCKED** | Blocked pending successful completion of staging drill and live external vault integration. |

### 10.2 Key Retrieval Boundary: Mock vs. Real External Key Custody

> [!WARNING]
> **Boundary Notice**: The local drill utilizes a mock external vault directory (`$MOCK_VAULT_DIR/backup-key.pem`) to simulate out-of-band key retrieval.
> In a true disaster recovery event:
> 1. The disaster recovery operator must retrieve the RSA-4096 private key (`backup-key.pem`) from the authoritative external key management system (e.g. AWS Secrets Manager, 1Password Enterprise Vault, or physical air-gapped safe custody).
> 2. The private key must **never** be checked into version control or stored on the Kubernetes cluster.
> 3. Automated key retrieval via IAM / OIDC roles must be verified in staging before production cutover.

### 10.3 Failure Domain Recovery Boundary: Cluster Separation vs. Host Failure

> [!IMPORTANT]
> **Architectural Limitation**: The local disaster recovery test runs two distinct PostgreSQL Docker containers on the same host machine.
> - **What this proves**: This proves **logical cluster separation**, zero state inheritance, correct schema bootstrapping, extension availability, role permissions, RLS transaction correctness, and cryptographic integrity.
> - **What this does NOT prove**: This does **not** prove resilience against physical infrastructure failure domains (e.g., host kernel panic, host storage controller failure, whole-datacenter loss, or regional cloud outage).
> Full disaster recovery qualification requires executing this drill across physically separated infrastructure (e.g., source cluster in Primary Cloud/Region, destination cluster in Secondary Cloud/Region).

### 10.4 Operational & Architectural Scope Boundaries

#### 10.4.1 Application Verification Scope: Database Simulation vs. Real Application Cutover
- **What was verified**: PostgreSQL catalog transaction semantics (`ALTER DATABASE ... RENAME` atomicity, rollback on failure, `psql -c` implicit transaction behavior), connection draining (`ALLOW_CONNECTIONS false`, `pg_terminate_backend`), schema/migration parity (150 Prisma migrations), RLS transaction scoping, and the post-traffic data-loss phenomenon.
- **What was NOT verified**: This drill did **not** boot up the actual `nst-api` Express server or `nst-worker` process against the promoted database, and did **not** execute `kubectl` commands against an active Kubernetes cluster.
- **Kubernetes Manifest Alignment**: The runbook commands use the actual deployment names (`nst-api`, `nst-worker`), service names (`nst-api-service`, `nst-postgres-service`), and namespace (`nst-events`) defined in `infrastructure/kubernetes/`.

#### 10.4.2 Pre-Traffic Gating Limitation: Ingress Exposes API Immediately Upon Readiness
- **Manifest Audit**: Inspection of `infrastructure/kubernetes/ingress.yaml` and `api-deployment.yaml` proves that `nst-events-ingress` maps public domains directly to `nst-api-service`, which selects `app: nst-api`.
- **Finding**: There is **no in-cluster traffic gate, canary filter, or maintenance middleware** implemented or verified in the Kubernetes configuration.
- **Consequence**: Scaling `nst-api` back to 2 replicas immediately exposes it to public traffic the moment readiness probes pass (within 5–15 seconds).
- **Operational Requirement**: Cloudflare WAF maintenance blocking or DNS traffic pausing is an **external operational prerequisite**, NOT an implemented or tested in-cluster feature. Stage 2 internal verification **cannot safely run with public ingress enabled** unless an independently tested external traffic block is active. Operators must verify this block from an off-cluster network (`curl -Iv https://events.nstsdc.org/ready` returning 503/maintenance) and verify 0 incoming requests in ingress logs BEFORE scaling `nst-api` up. If no external block is active, scaling the API immediately constitutes public traffic resumption and forfeits the zero-data-loss rollback guarantee.

#### 10.4.3 Delta Reconciliation Incompleteness & Post-Write Rollback Reality
- **Audit Findings**: The database contains 58 base tables (43 mutable business tables, 8 append-only ledgers, 6 static/reference tables, and 1 internal migration ledger) with diverse mutation profiles (INSERT, UPDATE, DELETE). Key tables (`event_registrations`, `attendance_records`, `teams`, `attendance_disputes`, `notifications`) lack timestamp tracking for mutations or lack creation timestamps altogether.
- **Demonstrated Flaws**: Extraction queries filtering on `created_at >= CUTOVER_TS` miss 100% of updates to pre-cutover entities, miss 100% of deleted records (leaving stale zombie records in the restored database), reference non-existent columns, and fail to preserve foreign-key dependency ordering or sequence synchronization.
- **Operational Policy**: Post-write rollback is **strictly classified as manual recovery with potential data loss**. `nst_events_failed` must be retained indefinitely for investigation. Traffic resumption is prohibited until delta reconciliation is validated or data loss is formally accepted in writing. Untested replication, dual writes, or CDC must not be introduced without automated verification.

### 10.5 Remaining Operational Blockers

Before NST Events database disaster recovery can be certified for production:

1. **Live External Vault Integration**: Deploy and verify IAM-based automated retrieval of `backup-key.pem` from AWS Secrets Manager / Vault.
2. **Real Cloud Object Storage Drill**: Execute backup upload, `head-object`, and remote read-back verification against a dedicated non-production Cloudflare R2 / AWS S3 bucket.
3. **Staging Environment Validation**: Run the complete restore procedure on a dedicated staging Kubernetes node pool and PostgreSQL cluster.
4. **Disaster Recovery Runbook Approval**: Review operational SLAs (RTO <= 2 hours, RPO <= 6 hours) with operations team.
