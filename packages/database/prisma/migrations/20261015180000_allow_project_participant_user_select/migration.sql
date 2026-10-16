-- 1. Create SECURITY DEFINER helper to check if a user is an owner or accepted contributor of a published project.
-- Using SECURITY DEFINER avoids circular RLS evaluation between users and projects.
CREATE OR REPLACE FUNCTION is_published_project_participant(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE owner_id = target_user_id
      AND visibility = 'PUBLISHED'
      AND deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM project_contributors pc
    JOIN projects p ON p.id = pc.project_id
    WHERE pc.user_id = target_user_id
      AND pc.status = 'ACCEPTED'
      AND p.visibility = 'PUBLISHED'
      AND p.deleted_at IS NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION is_published_project_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_published_project_participant(uuid) TO PUBLIC;

-- 2. Update users SELECT policy to include published project participants
DROP POLICY IF EXISTS "Allow scoped SELECT on users" ON users;

CREATE POLICY "Allow scoped SELECT on users" ON users
FOR SELECT USING (
  -- 1. Own profile
  id = current_user_id()
  
  -- 2. Global admins
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  
  -- 3. Club Admins/Mentors for their attendees (bypassing RLS cycle via SECURITY DEFINER)
  OR can_see_user_as_organizer(id)

  -- 4. Published project owner or accepted contributor
  OR is_published_project_participant(id)
);

-- 3. Update projects SELECT policy to use current_user_global_role()
DROP POLICY IF EXISTS "Allow SELECT on projects" ON "projects";

CREATE POLICY "Allow SELECT on projects" ON "projects" FOR SELECT USING (
  (visibility = 'PUBLISHED' AND deleted_at IS NULL)
  OR (current_user_id() IS NOT NULL AND owner_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
);
