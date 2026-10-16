-- Corrective Migration: Publication Lifecycle and Strict Closing Boundary
-- 1. Remove automatic CURRENT_TIMESTAMP default from published_at
-- This ensures newly created forms begin in Draft state (published_at IS NULL)
ALTER TABLE "event_forms" ALTER COLUMN "published_at" DROP DEFAULT;
ALTER TABLE "event_forms" ALTER COLUMN "published_at" SET DEFAULT NULL;

-- 2. Update RLS policies on event_registration_responses to enforce strict closing boundary [release_at, close_at)
-- Submissions at or after close_at must be strictly rejected
DROP POLICY IF EXISTS "Allow students and admins to INSERT event_registration_response" ON "event_registration_responses";
CREATE POLICY "Allow students and admins to INSERT event_registration_response"
  ON "event_registration_responses" FOR INSERT
  WITH CHECK (
    (
      (EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = current_user_id()
          AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      ))
      OR
      (EXISTS (
        SELECT 1 FROM event_registrations er
        WHERE er.id = event_registration_responses.event_registration_id
          AND er.user_id = current_user_id()
          AND er.registration_status = 'REGISTERED'
          AND er.deleted_at IS NULL
      ))
    )
    AND
    (
      form_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM event_forms ef
        JOIN event_registrations er ON er.event_id = ef.event_id
        WHERE ef.id = event_registration_responses.form_id
          AND er.id = event_registration_responses.event_registration_id
          AND ef.published_at IS NOT NULL
          AND (ef.release_at IS NULL OR ef.release_at <= now())
          AND (ef.close_at IS NULL OR ef.close_at > now())
      )
    )
  );

DROP POLICY IF EXISTS "Allow students and admins to UPDATE event_registration_response" ON "event_registration_responses";
CREATE POLICY "Allow students and admins to UPDATE event_registration_response"
  ON "event_registration_responses" FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_registrations er
      WHERE er.id = event_registration_responses.event_registration_id
        AND er.user_id = current_user_id()
        AND er.registration_status = 'REGISTERED'
        AND er.deleted_at IS NULL
    ))
  )
  WITH CHECK (
    (
      (EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = current_user_id()
          AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      ))
      OR
      (EXISTS (
        SELECT 1 FROM event_registrations er
        WHERE er.id = event_registration_responses.event_registration_id
          AND er.user_id = current_user_id()
          AND er.registration_status = 'REGISTERED'
          AND er.deleted_at IS NULL
      ))
    )
    AND
    (
      form_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM event_forms ef
        JOIN event_registrations er ON er.event_id = ef.event_id
        WHERE ef.id = event_registration_responses.form_id
          AND er.id = event_registration_responses.event_registration_id
          AND ef.published_at IS NOT NULL
          AND (ef.release_at IS NULL OR ef.release_at <= now())
          AND (ef.close_at IS NULL OR ef.close_at > now())
      )
    )
  );
