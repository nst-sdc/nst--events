-- 1. Fix project_contributors policies so invited users can see and accept invitations sent to their email
DROP POLICY IF EXISTS "Allow SELECT on project_contributors" ON "project_contributors";
CREATE POLICY "Allow SELECT on project_contributors" ON "project_contributors" FOR SELECT USING (
  (status = 'ACCEPTED' AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_contributors.project_id AND p.visibility = 'PUBLISHED' AND p.deleted_at IS NULL))
  OR (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND invited_email = (SELECT email FROM users WHERE id = current_user_id()))
  OR (current_user_id() IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_contributors.project_id AND p.owner_id = current_user_id()))
  OR (current_user_id() IS NOT NULL AND current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);

DROP POLICY IF EXISTS "Allow ALL on project_contributors" ON "project_contributors";
CREATE POLICY "Allow ALL on project_contributors" ON "project_contributors" FOR ALL USING (
  (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND invited_email = (SELECT email FROM users WHERE id = current_user_id()))
  OR (current_user_id() IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_contributors.project_id AND p.owner_id = current_user_id()))
  OR (current_user_id() IS NOT NULL AND current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);

-- 2. Fix project_reports SELECT policy so INSERT ... RETURNING * succeeds for anonymous and authenticated reporters
DROP POLICY IF EXISTS "Allow SELECT on project_reports" ON "project_reports";
CREATE POLICY "Allow SELECT on project_reports" ON "project_reports" FOR SELECT USING (
  reporter_id IS NULL
  OR (current_user_id() IS NOT NULL AND reporter_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);
