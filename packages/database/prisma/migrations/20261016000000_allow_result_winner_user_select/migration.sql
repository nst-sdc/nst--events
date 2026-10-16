-- Allow anonymous and public visitors to SELECT users who are winners/recipients of published event results
CREATE OR REPLACE FUNCTION is_published_result_winner(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM student_achievements
    WHERE user_id = target_user_id
      AND is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM award_recipients ar
    JOIN event_awards ea ON ea.id = ar.award_id
    JOIN event_result_revisions err ON err.id = ea.revision_id
    WHERE ar.user_id = target_user_id
      AND err.status = 'PUBLISHED'
  )
  OR EXISTS (
    SELECT 1 FROM award_recipient_members arm
    JOIN award_recipients ar ON ar.id = arm.recipient_id
    JOIN event_awards ea ON ea.id = ar.award_id
    JOIN event_result_revisions err ON err.id = ea.revision_id
    WHERE arm.user_id = target_user_id
      AND err.status = 'PUBLISHED'
  );
END;
$$;

REVOKE ALL ON FUNCTION is_published_result_winner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_published_result_winner(uuid) TO PUBLIC;

DROP POLICY IF EXISTS "Allow scoped SELECT on users" ON users;

CREATE POLICY "Allow scoped SELECT on users" ON users
FOR SELECT USING (
  -- 1. Own profile
  id = current_user_id()
  
  -- 2. Global admins
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  
  -- 3. Club Admins/Mentors for their attendees
  OR can_see_user_as_organizer(id)

  -- 4. Published project owner or accepted contributor
  OR is_published_project_participant(id)

  -- 5. Published event award winner or recognized member
  OR is_published_result_winner(id)
);

-- Fix result_reports SELECT policy so INSERT ... RETURNING * succeeds for anonymous and authenticated reporters
DROP POLICY IF EXISTS "result_reports_select_policy" ON "result_reports";
CREATE POLICY "result_reports_select_policy" ON "result_reports"
    FOR SELECT USING (
        reporter_id IS NULL
        OR (NULLIF(current_setting('app.user_id', true), '') IS NOT NULL AND reporter_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
        OR is_event_results_manager((SELECT event_id FROM event_result_sets WHERE id = result_set_id))
    );
