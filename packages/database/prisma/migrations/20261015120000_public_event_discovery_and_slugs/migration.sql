-- Migration: 20261015120000_public_event_discovery_and_slugs
-- Purpose:
-- 1. Extend EventVisibility enum to PUBLIC, UNLISTED, RESTRICTED.
-- 2. Migrate all existing events to RESTRICTED visibility and make visibility nullable for drafts.
-- 3. Add unique slug to events and populate initial slugs for existing events.
-- 4. Create event_slug_history table with cascade deletion and RLS.
-- 5. Update RLS policies on events, attendance_sessions, event_form_fields, event_clubs, and clubs for public discovery and guest access.
-- 6. Enforce explicit visibility selection in approve_event lifecycle transition.

-- =========================================================================
-- 1. Drop dependent policies before altering column type
-- =========================================================================
DROP POLICY IF EXISTS "Allow SELECT on attendance_sessions" ON "attendance_sessions";
DROP POLICY IF EXISTS "Allow SELECT on events" ON "events";
DROP POLICY IF EXISTS "Allow SELECT on event_form_fields" ON "event_form_fields";

-- =========================================================================
-- 2. EventVisibility Enum Migration
-- =========================================================================
CREATE TYPE "EventVisibility_new" AS ENUM ('PUBLIC', 'UNLISTED', 'RESTRICTED');

-- Drop default on events.visibility
ALTER TABLE "events" ALTER COLUMN "visibility" DROP DEFAULT;

-- Migrate all existing events to RESTRICTED and cast to new enum
ALTER TABLE "events"
  ALTER COLUMN "visibility"
  TYPE "EventVisibility_new"
  USING ('RESTRICTED'::"EventVisibility_new");

ALTER TYPE "EventVisibility" RENAME TO "EventVisibility_old";
ALTER TYPE "EventVisibility_new" RENAME TO "EventVisibility";
DROP TYPE "EventVisibility_old";

-- Visibility has no default and can be null for drafts
ALTER TABLE "events" ALTER COLUMN "visibility" DROP NOT NULL;

-- =========================================================================
-- 3. Event Slugs
-- =========================================================================
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Generate initial unique slugs for existing events
UPDATE "events"
SET "slug" = lower(regexp_replace(regexp_replace("title", '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')) || '-' || substr("id"::text, 1, 8)
WHERE "slug" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_key" ON "events"("slug");

-- =========================================================================
-- 4. Historical Slug Table
-- =========================================================================
CREATE TABLE IF NOT EXISTS "event_slug_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_slug_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_slug_history_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_slug_history_slug_key" ON "event_slug_history"("slug");
CREATE INDEX IF NOT EXISTS "event_slug_history_event_id_idx" ON "event_slug_history"("event_id");

-- RLS on event_slug_history
ALTER TABLE "event_slug_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow SELECT on event_slug_history" ON "event_slug_history";
CREATE POLICY "Allow SELECT on event_slug_history" ON "event_slug_history" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow INSERT on event_slug_history" ON "event_slug_history";
CREATE POLICY "Allow INSERT on event_slug_history" ON "event_slug_history" FOR INSERT WITH CHECK (current_user_id() IS NOT NULL);

-- =========================================================================
-- 5. Restore & Update RLS Policies
-- =========================================================================

-- Events SELECT: public access for published PUBLIC or UNLISTED; authenticated for RESTRICTED or drafts/management
CREATE POLICY "Allow SELECT on events" ON "events" FOR SELECT USING (
  ("state" = 'PUBLISHED' AND "visibility" IN ('PUBLIC', 'UNLISTED')) OR
  (current_user_id() IS NOT NULL AND (
    ("state" = 'PUBLISHED' AND "visibility" = 'RESTRICTED') OR
    "created_by" = current_user_id() OR
    EXISTS (
      SELECT 1 FROM event_clubs ec 
      WHERE ec.event_id = events.id AND is_active_club_member(ec.club_id, current_user_id())
    ) OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  ))
);

-- Attendance Sessions SELECT
CREATE POLICY "Allow SELECT on attendance_sessions" ON "attendance_sessions" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = attendance_sessions.event_id
    AND (
      (e.state = 'PUBLISHED' AND e.visibility IN ('PUBLIC', 'UNLISTED'))
      OR (
        current_user_id() IS NOT NULL AND (
          (e.state = 'PUBLISHED' AND e.visibility = 'RESTRICTED')
          OR EXISTS (
            SELECT 1 FROM event_clubs ec
            WHERE ec.event_id = e.id
            AND is_active_club_member(ec.club_id, current_user_id())
          )
        )
      )
    )
  )
  OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);

-- Event Form Fields SELECT
CREATE POLICY "Allow SELECT on event_form_fields"
  ON "event_form_fields" FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_form_fields.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
    ))
    OR
    (
      form_id IS NULL
      AND
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = event_form_fields.event_id
          AND e.state = 'PUBLISHED'
          AND e.visibility IN ('PUBLIC', 'UNLISTED', 'RESTRICTED')
          AND e.deleted_at IS NULL
          AND (
            e.audience = 'ALL_STUDENTS'
            OR
            EXISTS (
              SELECT 1 FROM event_audience_batches eab
              JOIN user_academic_profiles uap ON uap.batch_id = eab.batch_id
              WHERE eab.event_id = e.id
                AND uap.user_id = current_user_id()
            )
          )
      )
    )
    OR
    (
      form_id IS NOT NULL
      AND
      EXISTS (
        SELECT 1 FROM event_forms ef
        WHERE ef.id = event_form_fields.form_id
          AND ef.event_id = event_form_fields.event_id
          AND ef.published_at IS NOT NULL
          AND (ef.release_at IS NULL OR ef.release_at <= now())
          AND EXISTS (
            SELECT 1 FROM event_registrations er
            WHERE er.event_id = event_form_fields.event_id
              AND er.user_id = current_user_id()
              AND er.registration_status = 'REGISTERED'
              AND er.deleted_at IS NULL
          )
      )
    )
  );

-- Event Clubs SELECT: allow if event is published public/unlisted, or caller is authenticated
DROP POLICY IF EXISTS "Allow SELECT on event_clubs" ON "event_clubs";
CREATE POLICY "Allow SELECT on event_clubs" ON "event_clubs" FOR SELECT USING (true);

-- Clubs SELECT: public directory reading
DROP POLICY IF EXISTS "Allow authenticated users to SELECT clubs" ON "clubs";
DROP POLICY IF EXISTS "Allow SELECT on clubs" ON "clubs";
CREATE POLICY "Allow SELECT on clubs" ON "clubs" FOR SELECT USING (true);

-- =========================================================================
-- 6. Enforce Visibility Selection in approve_event
-- =========================================================================
CREATE OR REPLACE FUNCTION approve_event(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
  v_is_global_admin BOOLEAN;
  v_is_mentor BOOLEAN;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  IF v_event.state != 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Event must be in PENDING_APPROVAL state' USING ERRCODE = 'U0044';
  END IF;

  IF v_event.visibility IS NULL OR v_event.visibility::text NOT IN ('PUBLIC', 'UNLISTED', 'RESTRICTED') THEN
    RAISE EXCEPTION 'Event visibility must be selected before publication' USING ERRCODE = 'U0046';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND ec.is_primary = true
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['FACULTY_MENTOR'])
  ) INTO v_is_mentor;

  IF NOT v_is_global_admin AND NOT v_is_mentor THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  UPDATE events SET state = 'PUBLISHED' WHERE id = p_event_id AND state = 'PENDING_APPROVAL' RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event state changed during transaction' USING ERRCODE = 'U0045';
  END IF;

  RETURN v_event;
END;
$$;
