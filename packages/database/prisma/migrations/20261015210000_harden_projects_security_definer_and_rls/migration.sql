-- Migration: 20261015210000_harden_projects_security_definer_and_rls
-- Purpose:
-- 1. Pin search_path on all Projects SECURITY DEFINER functions to prevent search_path hijacking.
-- 2. Scope increment_project_view_count strictly to published, non-deleted projects.
-- 3. Provide submit_project_report SECURITY DEFINER function so report submissions require zero SELECT permissions on project_reports.
-- 4. Close RLS leakage on project_reports: restrict SELECT strictly to PLATFORM_ADMIN and FACULTY_ADMIN.
-- 5. Allow project owners to view moderation actions on their own projects.
-- 6. Harden project_likes INSERT RLS policy to enforce that the target project is PUBLISHED, not deleted, and not self-owned.

-- 1. Pin search_path on is_published_project_participant
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
  );
END;
$$;

REVOKE ALL ON FUNCTION is_published_project_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_published_project_participant(uuid) TO PUBLIC;

-- 2. Pin search_path on sync_project_like_count
CREATE OR REPLACE FUNCTION sync_project_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE projects
    SET like_count = (SELECT count(*)::int FROM project_likes WHERE project_id = NEW.project_id)
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE projects
    SET like_count = (SELECT count(*)::int FROM project_likes WHERE project_id = OLD.project_id)
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 3. Pin search_path on increment_project_view_count and scope to published, non-deleted projects
CREATE OR REPLACE FUNCTION increment_project_view_count(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE projects
  SET view_count = view_count + 1
  WHERE id = p_project_id
    AND visibility = 'PUBLISHED'
    AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION increment_project_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_project_view_count(uuid) TO PUBLIC;

-- 4. Create submit_project_report SECURITY DEFINER function
CREATE OR REPLACE FUNCTION submit_project_report(
  p_project_id uuid,
  p_reporter_id uuid,
  p_reason "ReportReason",
  p_details text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report_id uuid;
BEGIN
  -- Verify project exists and is not soft-deleted
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO project_reports (project_id, reporter_id, reason, details, status)
  VALUES (p_project_id, p_reporter_id, p_reason, p_details, 'PENDING')
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION submit_project_report(uuid, uuid, "ReportReason", text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_project_report(uuid, uuid, "ReportReason", text) TO PUBLIC;

-- 5. Harden project_reports RLS: strictly restrict SELECT to PLATFORM_ADMIN and FACULTY_ADMIN only
DROP POLICY IF EXISTS "Allow SELECT on project_reports" ON "project_reports";
CREATE POLICY "Allow SELECT on project_reports" ON "project_reports" FOR SELECT USING (
  current_user_id() IS NOT NULL AND current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
);

-- 6. Allow project owners to view moderation actions on their own projects
DROP POLICY IF EXISTS "Allow SELECT on project_moderation_actions" ON "project_moderation_actions";
CREATE POLICY "Allow SELECT on project_moderation_actions" ON "project_moderation_actions" FOR SELECT USING (
  current_user_id() IS NOT NULL AND (
    current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_moderation_actions.project_id AND p.owner_id = current_user_id())
  )
);

-- 7. Harden project_likes INSERT RLS to enforce that the target project is PUBLISHED, not deleted, and not self-owned
DROP POLICY IF EXISTS "Allow INSERT on project_likes" ON "project_likes";
CREATE POLICY "Allow INSERT on project_likes" ON "project_likes" FOR INSERT WITH CHECK (
  current_user_id() IS NOT NULL
  AND user_id = current_user_id()
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_likes.project_id
      AND p.visibility = 'PUBLISHED'
      AND p.deleted_at IS NULL
      AND p.owner_id != current_user_id()
  )
);
