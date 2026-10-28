-- Migration: 20261028000000_restore_attendance_sessions_authenticated_rls
-- Purpose: Restore documented invariant that attendance_sessions SELECT strictly requires authenticated user context
--          (current_user_id() IS NOT NULL) to protect qr_secret, scan windows, and geofence coordinates from anonymous exposure.
--          Enforce restricted-event isolation so ordinary authenticated users cannot read sessions of restricted events.

DROP POLICY IF EXISTS "Allow SELECT on attendance_sessions" ON "attendance_sessions";
CREATE POLICY "Allow SELECT on attendance_sessions" ON "attendance_sessions" FOR SELECT USING (
  current_user_id() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = attendance_sessions.event_id
      AND (
        (e.state IN ('PUBLISHED', 'ARCHIVED', 'CANCELLED') AND e.visibility IN ('PUBLIC', 'UNLISTED'))
        OR (
          e.state IN ('PUBLISHED', 'ARCHIVED', 'CANCELLED')
          AND e.visibility = 'RESTRICTED'
          AND EXISTS (
            SELECT 1 FROM event_registrations er
            WHERE er.event_id = e.id
            AND er.user_id = current_user_id()
            AND er.registration_status = 'REGISTERED'
            AND er.deleted_at IS NULL
          )
        )
        OR EXISTS (
          SELECT 1 FROM event_clubs ec
          WHERE ec.event_id = e.id
          AND is_active_club_member(ec.club_id, current_user_id())
        )
        OR e.created_by = current_user_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
      AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  )
);
