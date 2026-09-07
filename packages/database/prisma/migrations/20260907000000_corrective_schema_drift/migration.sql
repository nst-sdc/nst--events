-- Corrective migration: Align live database with schema.prisma
-- Fixes two drifts discovered in the 2026-09-07 repository health audit.
--
-- Drift A: AssignmentSource enum has 4 orphaned variants that were never
--          removed by 20260827212000_hotfix_academic_enum (which added new
--          values but intentionally skipped the type-swap required to drop
--          old ones). Zero rows in user_academic_profiles use any variant.
--
-- Drift B: teams(event_id, name) unique INDEX survives from init migration
--          because 20260902213638 used DROP CONSTRAINT (wrong DDL — it was
--          an index, not a constraint). The IF EXISTS clause masked the no-op.

-- =========================================================================
-- A. Clean up AssignmentSource enum via type swap
--    Keeps only: INSTITUTIONAL_EMAIL_INFERENCE, ADMIN_OVERRIDE
--    Drops:      EMAIL_INFERENCE, ADMIN, SSO_PROVIDER_INFERENCE, MANUAL_SELECTION
-- =========================================================================
BEGIN;

-- Safety: Abort if any rows use a variant we're about to drop
DO $$
DECLARE bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM user_academic_profiles
  WHERE assignment_source::text NOT IN ('INSTITUTIONAL_EMAIL_INFERENCE', 'ADMIN_OVERRIDE');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: % rows use a deprecated AssignmentSource variant', bad_count;
  END IF;
END $$;

CREATE TYPE "AssignmentSource_new" AS ENUM ('INSTITUTIONAL_EMAIL_INFERENCE', 'ADMIN_OVERRIDE');

ALTER TABLE "user_academic_profiles"
  ALTER COLUMN "assignment_source"
  TYPE "AssignmentSource_new"
  USING ("assignment_source"::text::"AssignmentSource_new");

ALTER TYPE "AssignmentSource" RENAME TO "AssignmentSource_old";
ALTER TYPE "AssignmentSource_new" RENAME TO "AssignmentSource";
DROP TYPE "AssignmentSource_old";

COMMIT;

-- =========================================================================
-- B. Drop orphaned teams(event_id, name) unique index
--    The correct constraint teams_event_id_normalized_name_key already exists.
-- =========================================================================
DROP INDEX IF EXISTS "teams_event_id_name_key";
