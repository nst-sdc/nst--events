-- Migration: 20261015140000_harden_public_event_rls
-- Purpose: Authoritatively harden RLS on attendance_sessions and event_form_fields so anonymous users cannot access them

-- 1. Attendance Sessions SELECT: strictly require authenticated context (current_user_id() IS NOT NULL)
DROP POLICY IF EXISTS "Allow SELECT on attendance_sessions" ON "attendance_sessions";
CREATE POLICY "Allow SELECT on attendance_sessions" ON "attendance_sessions" FOR SELECT USING (
  current_user_id() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = attendance_sessions.event_id
      AND (
        e.state = 'PUBLISHED'
        OR EXISTS (
          SELECT 1 FROM event_clubs ec
          WHERE ec.event_id = e.id
          AND is_active_club_member(ec.club_id, current_user_id())
        )
      )
    )
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  )
);

-- 2. Event Form Fields SELECT: strictly require authenticated context (current_user_id() IS NOT NULL)
DROP POLICY IF EXISTS "Allow SELECT on event_form_fields" ON "event_form_fields";
CREATE POLICY "Allow SELECT on event_form_fields"
  ON "event_form_fields" FOR SELECT
  USING (
    current_user_id() IS NOT NULL AND (
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
    )
  );
