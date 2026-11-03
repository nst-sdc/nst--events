-- Migration: 20261104000000_dynamic_rate_limits
-- Purpose:
-- 1. Table rate_limit_settings: bucket text PK, max_total int, enabled bool, updated_by uuid, updated_at timestamptz.
-- 2. Table rate_limit_overrides: id uuid PK, subject_type text, subject text, mode text, custom_max int, expires_at timestamptz, reason text, created_by uuid, created_at timestamptz.
-- 3. Row Level Security: only PLATFORM_ADMIN writes/manages.
-- 4. SECURITY DEFINER loader functions for API dynamic config reading.
-- 5. pg_notify('rate_limit_changed', '{}') triggers for cluster-wide cache invalidation.

-- =========================================================================
-- 1. Table rate_limit_settings
-- =========================================================================

CREATE TABLE IF NOT EXISTS "rate_limit_settings" (
    "bucket" TEXT NOT NULL,
    "max_total" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_settings_pkey" PRIMARY KEY ("bucket"),
    CONSTRAINT "rate_limit_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- =========================================================================
-- 2. Table rate_limit_overrides
-- =========================================================================

CREATE TABLE IF NOT EXISTS "rate_limit_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "custom_max" INTEGER,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_overrides_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rate_limit_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "rate_limit_overrides_subject_type_check" CHECK ("subject_type" IN ('user', 'ip')),
    CONSTRAINT "rate_limit_overrides_mode_check" CHECK ("mode" IN ('block', 'allow', 'custom_max'))
);

CREATE INDEX IF NOT EXISTS "rate_limit_overrides_subject_idx" ON "rate_limit_overrides"("subject_type", "subject", "expires_at");
CREATE INDEX IF NOT EXISTS "rate_limit_overrides_expires_at_idx" ON "rate_limit_overrides"("expires_at");

-- =========================================================================
-- 3. Row Level Security & Grants
-- =========================================================================

ALTER TABLE "rate_limit_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limit_settings" FORCE ROW LEVEL SECURITY;

ALTER TABLE "rate_limit_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limit_overrides" FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "rate_limit_settings" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "rate_limit_overrides" TO nst_app;
GRANT SELECT, DELETE ON TABLE "rate_limit_overrides" TO nst_worker;

-- rate_limit_settings RLS Policies
DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN SELECT on rate_limit_settings" ON "rate_limit_settings";
CREATE POLICY "Allow PLATFORM_ADMIN SELECT on rate_limit_settings" ON "rate_limit_settings"
FOR SELECT USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN INSERT on rate_limit_settings" ON "rate_limit_settings";
CREATE POLICY "Allow PLATFORM_ADMIN INSERT on rate_limit_settings" ON "rate_limit_settings"
FOR INSERT TO nst_app
WITH CHECK (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN UPDATE on rate_limit_settings" ON "rate_limit_settings";
CREATE POLICY "Allow PLATFORM_ADMIN UPDATE on rate_limit_settings" ON "rate_limit_settings"
FOR UPDATE TO nst_app
USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN DELETE on rate_limit_settings" ON "rate_limit_settings";
CREATE POLICY "Allow PLATFORM_ADMIN DELETE on rate_limit_settings" ON "rate_limit_settings"
FOR DELETE TO nst_app
USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

-- rate_limit_overrides RLS Policies
DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN SELECT on rate_limit_overrides" ON "rate_limit_overrides";
CREATE POLICY "Allow PLATFORM_ADMIN SELECT on rate_limit_overrides" ON "rate_limit_overrides"
FOR SELECT USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN INSERT on rate_limit_overrides" ON "rate_limit_overrides";
CREATE POLICY "Allow PLATFORM_ADMIN INSERT on rate_limit_overrides" ON "rate_limit_overrides"
FOR INSERT TO nst_app
WITH CHECK (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN UPDATE on rate_limit_overrides" ON "rate_limit_overrides";
CREATE POLICY "Allow PLATFORM_ADMIN UPDATE on rate_limit_overrides" ON "rate_limit_overrides"
FOR UPDATE TO nst_app
USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Allow PLATFORM_ADMIN DELETE on rate_limit_overrides" ON "rate_limit_overrides";
CREATE POLICY "Allow PLATFORM_ADMIN DELETE on rate_limit_overrides" ON "rate_limit_overrides"
FOR DELETE TO nst_app
USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Worker access to rate_limit_overrides" ON "rate_limit_overrides";
CREATE POLICY "Worker access to rate_limit_overrides" ON "rate_limit_overrides"
FOR ALL TO nst_worker
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Postgres superuser access to rate_limit_overrides" ON "rate_limit_overrides";
CREATE POLICY "Postgres superuser access to rate_limit_overrides" ON "rate_limit_overrides"
FOR ALL TO postgres
USING (true)
WITH CHECK (true);

-- =========================================================================
-- 4. SECURITY DEFINER Functions for In-Memory Loaders
-- =========================================================================

CREATE OR REPLACE FUNCTION get_rate_limit_settings()
RETURNS TABLE(
  bucket TEXT,
  max_total INTEGER,
  enabled BOOLEAN,
  updated_by UUID,
  updated_at TIMESTAMPTZ(6)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bucket, max_total, enabled, updated_by, updated_at
  FROM rate_limit_settings;
$$;

CREATE OR REPLACE FUNCTION get_active_rate_limit_overrides()
RETURNS TABLE(
  id UUID,
  subject_type TEXT,
  subject TEXT,
  mode TEXT,
  custom_max INTEGER,
  expires_at TIMESTAMPTZ(6),
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ(6)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, subject_type, subject, mode, custom_max, expires_at, reason, created_by, created_at
  FROM rate_limit_overrides
  WHERE expires_at > CURRENT_TIMESTAMP;
$$;

REVOKE ALL ON FUNCTION get_rate_limit_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_rate_limit_settings() TO nst_app, postgres;

REVOKE ALL ON FUNCTION get_active_rate_limit_overrides() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_rate_limit_overrides() TO nst_app, postgres;

-- =========================================================================
-- 5. pg_notify Triggers
-- =========================================================================

CREATE OR REPLACE FUNCTION notify_rate_limit_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('rate_limit_changed', '{}');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_settings_notify ON rate_limit_settings;
CREATE TRIGGER trg_rate_limit_settings_notify
AFTER INSERT OR UPDATE OR DELETE ON rate_limit_settings
FOR EACH STATEMENT EXECUTE FUNCTION notify_rate_limit_changed();

DROP TRIGGER IF EXISTS trg_rate_limit_overrides_notify ON rate_limit_overrides;
CREATE TRIGGER trg_rate_limit_overrides_notify
AFTER INSERT OR UPDATE OR DELETE ON rate_limit_overrides
FOR EACH STATEMENT EXECUTE FUNCTION notify_rate_limit_changed();
