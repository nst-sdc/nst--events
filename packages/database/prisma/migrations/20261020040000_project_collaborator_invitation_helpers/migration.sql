-- 1. Helper to safely resolve a student by institutional email for project collaborator invitations
CREATE OR REPLACE FUNCTION find_user_by_institutional_email(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_email IS NULL THEN
    RETURN;
  END IF;

  -- Strictly enforce institutional domains
  IF NOT (LOWER(p_email) LIKE '%@adypu.edu.in' OR LOWER(p_email) LIKE '%@newtonschool.co') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.full_name, u.avatar_url
  FROM users u
  WHERE LOWER(u.email) = LOWER(p_email)
    AND u.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION find_user_by_institutional_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_by_institutional_email(text) TO nst_app;
GRANT EXECUTE ON FUNCTION find_user_by_institutional_email(text) TO nst_worker;

-- 2. Extend is_published_project_participant so project owners can always see contributors and invitees on their own projects
CREATE OR REPLACE FUNCTION is_published_project_participant(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  )
  OR (
    current_user_id() IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_contributors pc
      JOIN projects p ON p.id = pc.project_id
      WHERE pc.user_id = target_user_id
        AND p.owner_id = current_user_id()
        AND p.deleted_at IS NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION is_published_project_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_published_project_participant(uuid) TO PUBLIC;
