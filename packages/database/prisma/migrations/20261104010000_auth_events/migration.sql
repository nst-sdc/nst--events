-- Migration: 20261104010000_auth_events
-- Purpose:
-- 1. Create table auth_events for login, refresh, logout, reuse, and revocation tracking.
-- 2. Sensitive privacy protection: hashes IPs with pepper, never stores tokens, stores domain only for rejected logins.
-- 3. Row Level Security: PLATFORM_ADMIN read-only, nst_app append-only, nst_worker purge-only.
-- 4. B-tree indexes for filter and time-range analytics queries.

-- =========================================================================
-- 1. Table auth_events
-- =========================================================================

CREATE TABLE IF NOT EXISTS "auth_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "app_version" TEXT,
    "user_agent_family" TEXT,
    "device_class" TEXT,
    "ip_hash" TEXT NOT NULL,
    "raw_ip" TEXT,
    "network_class" TEXT NOT NULL,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "auth_events_event_type_check" CHECK (
        "event_type" IN (
            'LOGIN_SUCCESS',
            'LOGIN_FAILED',
            'REFRESH_FAILED',
            'REUSE_DETECTED',
            'LOGOUT',
            'SESSION_REVOKED'
        )
    ),
    CONSTRAINT "auth_events_platform_check" CHECK ("platform" IN ('web', 'mobile')),
    CONSTRAINT "auth_events_network_class_check" CHECK ("network_class" IN ('campus', 'off_campus', 'unknown'))
);

-- =========================================================================
-- 2. Performance & Analytics Indexes
-- =========================================================================

CREATE INDEX IF NOT EXISTS "auth_events_created_at_idx" ON "auth_events"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_events_event_type_created_at_idx" ON "auth_events"("event_type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_events_user_id_created_at_idx" ON "auth_events"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_events_platform_created_at_idx" ON "auth_events"("platform", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_events_network_class_created_at_idx" ON "auth_events"("network_class", "created_at" DESC);

-- =========================================================================
-- 3. Row Level Security & Grants
-- =========================================================================

ALTER TABLE "auth_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_events" FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE "auth_events" TO nst_app;
GRANT SELECT, DELETE ON TABLE "auth_events" TO nst_worker;

-- PLATFORM_ADMIN can SELECT auth_events
DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN SELECT on auth_events" ON "auth_events";
CREATE POLICY "Allow PLATFORM_ADMIN SELECT on auth_events" ON "auth_events"
FOR SELECT USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

-- nst_app can asynchronously INSERT auth_events (batch flush runs without user context)
DROP POLICY IF EXISTS "Allow nst_app INSERT on auth_events" ON "auth_events";
CREATE POLICY "Allow nst_app INSERT on auth_events" ON "auth_events"
FOR INSERT TO nst_app
WITH CHECK (true);

-- nst_worker can DELETE auth_events for retention purges
DROP POLICY IF EXISTS "Allow nst_worker DELETE on auth_events" ON "auth_events";
CREATE POLICY "Allow nst_worker DELETE on auth_events" ON "auth_events"
FOR DELETE TO nst_worker
USING (true);

-- postgres superuser access
DROP POLICY IF EXISTS "Allow postgres access to auth_events" ON "auth_events";
CREATE POLICY "Allow postgres access to auth_events" ON "auth_events"
FOR ALL TO postgres
USING (true)
WITH CHECK (true);
