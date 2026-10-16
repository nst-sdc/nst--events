-- Migration: 20261015000000_fix_events_update_rls_policy
-- Purpose: Fix RLS UPDATE policy on events table to allow primary club admins to update both DRAFT and PUBLISHED events, aligning WITH CHECK with USING.

DROP POLICY IF EXISTS "Allow UPDATE on events" ON events;
CREATE POLICY "Allow UPDATE on events" ON events
  FOR UPDATE USING (
    (
      state = 'DRAFT' AND EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = events.id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['FACULTY_MENTOR'])
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    )
  )
  WITH CHECK (
    (
      state = 'DRAFT' AND EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = events.id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['FACULTY_MENTOR'])
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = events.id
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN'])
    )
  );
