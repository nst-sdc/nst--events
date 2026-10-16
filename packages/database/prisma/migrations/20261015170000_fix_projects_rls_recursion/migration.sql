-- Fix infinite recursion in projects RLS policy by removing circular dependency on project_contributors
DROP POLICY IF EXISTS "Allow SELECT on projects" ON "projects";

CREATE POLICY "Allow SELECT on projects" ON "projects" FOR SELECT USING (
  (visibility = 'PUBLISHED' AND deleted_at IS NULL)
  OR (current_user_id() IS NOT NULL AND owner_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ))
);
