-- 1. Create SECURITY DEFINER trigger function to automatically sync like_count on projects
-- Runs with definer privileges so students can update project like_count without having direct UPDATE rights on projects table.
CREATE OR REPLACE FUNCTION sync_project_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trigger_sync_project_like_count ON project_likes;
CREATE TRIGGER trigger_sync_project_like_count
AFTER INSERT OR DELETE ON project_likes
FOR EACH ROW EXECUTE FUNCTION sync_project_like_count();

-- 2. Create SECURITY DEFINER function to increment project view count
CREATE OR REPLACE FUNCTION increment_project_view_count(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE projects
  SET view_count = view_count + 1
  WHERE id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_project_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_project_view_count(uuid) TO PUBLIC;
