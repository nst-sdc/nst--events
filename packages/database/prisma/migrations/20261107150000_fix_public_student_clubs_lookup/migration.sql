-- Migration: 20261107150000_fix_public_student_clubs_lookup
-- Purpose:
-- 1. Dedicated SECURITY DEFINER function lookup_public_student_clubs(p_user_id uuid) so public student dossiers
--    can read verified active club memberships without being blocked by cascading users/student_profiles RLS policies.
-- 2. Define is_student_profile_public(target_user_id uuid) and update "Allow scoped SELECT on users" RLS policy
--    so public student profile users can be resolved during relation queries.

-- =========================================================================
-- 1. Dedicated SECURITY DEFINER Function for Student Club Memberships
-- =========================================================================

CREATE OR REPLACE FUNCTION lookup_public_student_clubs(p_user_id uuid)
RETURNS TABLE (
    club_id uuid,
    club_name text,
    role text,
    banner_url text,
    status text,
    joined_at timestamp(6) with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    cm.club_id,
    c.name AS club_name,
    cm.role::text,
    c.banner_url,
    c.status::text,
    cm.created_at AS joined_at
  FROM club_memberships cm
  JOIN clubs c ON c.id = cm.club_id
  WHERE cm.user_id = p_user_id
    AND cm.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND c.status = 'ACTIVE'
  ORDER BY cm.created_at ASC;
$$;

REVOKE ALL ON FUNCTION lookup_public_student_clubs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_public_student_clubs(uuid) TO nst_app;
GRANT EXECUTE ON FUNCTION lookup_public_student_clubs(uuid) TO nst_worker;

-- =========================================================================
-- 2. Helper & Users Table RLS Policy Update for Public Student Profiles
-- =========================================================================

CREATE OR REPLACE FUNCTION is_student_profile_public(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM student_profiles sp
    WHERE sp.user_id = target_user_id
      AND (
        sp.directory_listed = true
        OR coalesce((sp.section_visibility->>'clubs')::boolean, false) IS TRUE
        OR coalesce(coalesce((sp.section_visibility->>'identity')::boolean, (sp.section_visibility->>'name')::boolean), true) IS TRUE
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION is_student_profile_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_student_profile_public(uuid) TO PUBLIC;

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

  -- 6. Public student profile
  OR is_student_profile_public(id)
);

