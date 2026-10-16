-- Migration: 20261016120000_close_student_profiles_security_review
-- Purpose:
-- 1. Fix conflicting avatar / avatar_url values: if either key is false, mask avatar_url to NULL in SQL.
-- 2. Update lookup_student_slug_redirect signature to RETURNS TABLE (canonical_slug text) so column name and empty-set behavior exactly match API contract.
-- 3. Provide concurrency-safe rotate_student_to_anonymous_slug(p_user_id) with row locking and subtransaction collision retry.

-- =========================================================================
-- 1. Update public_student_profiles_view: conflicting avatar keys cannot leak
-- =========================================================================

CREATE OR REPLACE VIEW public_student_profiles_view AS
SELECT 
    sp.id AS profile_id,
    sp.user_id,
    sp.slug,
    CASE 
      WHEN coalesce((sp.section_visibility->>'bio')::boolean, false) IS TRUE THEN sp.headline 
      ELSE NULL 
    END AS headline,
    CASE 
      WHEN coalesce((sp.section_visibility->>'bio')::boolean, false) IS TRUE THEN sp.bio 
      ELSE NULL 
    END AS bio,
    CASE 
      WHEN coalesce((sp.section_visibility->>'skills')::boolean, false) IS TRUE THEN sp.skills 
      ELSE ARRAY[]::TEXT[] 
    END AS skills,
    CASE 
      WHEN coalesce((sp.section_visibility->>'skills')::boolean, false) IS TRUE THEN sp.interests 
      ELSE ARRAY[]::TEXT[] 
    END AS interests,
    CASE 
      WHEN coalesce(coalesce((sp.section_visibility->>'links')::boolean, (sp.section_visibility->>'external_links')::boolean), false) IS TRUE THEN sp.external_links 
      ELSE '[]'::jsonb 
    END AS external_links,
    sp.section_visibility,
    sp.directory_listed,
    sp.settings_version,
    sp.created_at,
    sp.updated_at,
    CASE 
      WHEN coalesce(coalesce((sp.section_visibility->>'identity')::boolean, (sp.section_visibility->>'name')::boolean), true) IS TRUE THEN u.full_name 
      ELSE NULL 
    END AS full_name,
    CASE 
      WHEN (COALESCE((sp.section_visibility->>'avatar')::boolean, true) IS TRUE)
       AND (COALESCE((sp.section_visibility->>'avatar_url')::boolean, true) IS TRUE)
      THEN u.avatar_url 
      ELSE NULL 
    END AS avatar_url,
    CASE 
      WHEN coalesce((sp.section_visibility->>'academic')::boolean, true) IS TRUE THEN b.graduation_year 
      ELSE NULL 
    END AS graduation_year,
    ap.batch_id,
    CASE 
      WHEN coalesce((sp.section_visibility->>'academic')::boolean, true) IS TRUE THEN prog.name 
      ELSE NULL 
    END AS program_name,
    CASE 
      WHEN coalesce((sp.section_visibility->>'academic')::boolean, true) IS TRUE THEN prog.code 
      ELSE NULL 
    END AS program_code,
    CASE 
      WHEN coalesce((sp.section_visibility->>'academic')::boolean, true) IS TRUE THEN b.admission_year 
      ELSE NULL 
    END AS admission_year
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
LEFT JOIN user_academic_profiles ap ON ap.user_id = sp.user_id
LEFT JOIN academic_batches b ON b.id = ap.batch_id
LEFT JOIN academic_programs prog ON prog.id = b.program_id
WHERE u.deleted_at IS NULL
  AND u.global_role = 'STUDENT'
  AND sp.directory_listed = true;

ALTER VIEW public_student_profiles_view OWNER TO postgres;
GRANT SELECT ON public_student_profiles_view TO nst_app;
GRANT SELECT ON public_student_profiles_view TO nst_worker;

-- =========================================================================
-- 2. Update lookup_public_student_profile_by_slug: conflicting avatar keys cannot leak
-- =========================================================================

CREATE OR REPLACE FUNCTION lookup_public_student_profile_by_slug(p_slug text)
RETURNS TABLE (
    profile_id uuid,
    user_id uuid,
    slug text,
    headline text,
    bio text,
    skills text[],
    interests text[],
    external_links jsonb,
    section_visibility jsonb,
    directory_listed boolean,
    settings_version integer,
    created_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone,
    full_name text,
    avatar_url text,
    graduation_year integer,
    batch_id uuid,
    program_name text,
    program_code text,
    admission_year integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    sp.id AS profile_id,
    sp.user_id,
    sp.slug,
    CASE 
      WHEN coalesce((sp.section_visibility->>'bio')::boolean, false) IS TRUE THEN sp.headline 
      ELSE NULL 
    END AS headline,
    CASE 
      WHEN coalesce((sp.section_visibility->>'bio')::boolean, false) IS TRUE THEN sp.bio 
      ELSE NULL 
    END AS bio,
    CASE 
      WHEN coalesce((sp.section_visibility->>'skills')::boolean, false) IS TRUE THEN sp.skills 
      ELSE ARRAY[]::TEXT[] 
    END AS skills,
    CASE 
      WHEN coalesce((sp.section_visibility->>'skills')::boolean, false) IS TRUE THEN sp.interests 
      ELSE ARRAY[]::TEXT[] 
    END AS interests,
    CASE 
      WHEN coalesce(coalesce((sp.section_visibility->>'links')::boolean, (sp.section_visibility->>'external_links')::boolean), false) IS TRUE THEN sp.external_links 
      ELSE '[]'::jsonb 
    END AS external_links,
    sp.section_visibility,
    sp.directory_listed,
    sp.settings_version,
    sp.created_at,
    sp.updated_at,
    CASE 
      WHEN coalesce(coalesce((sp.section_visibility->>'identity')::boolean, (sp.section_visibility->>'name')::boolean), true) IS TRUE THEN u.full_name 
      ELSE NULL 
    END AS full_name,
    CASE 
      WHEN (COALESCE((sp.section_visibility->>'avatar')::boolean, true) IS TRUE)
       AND (COALESCE((sp.section_visibility->>'avatar_url')::boolean, true) IS TRUE)
      THEN u.avatar_url 
      ELSE NULL 
    END AS avatar_url,
    CASE 
      WHEN coalesce((sp.section_visibility->>'academic')::boolean, true) IS TRUE THEN b.graduation_year 
      ELSE NULL 
    END AS graduation_year,
    ap.batch_id,
    CASE 
      WHEN coalesce((sp.section_visibility->>'academic')::boolean, true) IS TRUE THEN prog.name 
      ELSE NULL 
    END AS program_name,
    CASE 
      WHEN coalesce((sp.section_visibility->>'academic')::boolean, true) IS TRUE THEN prog.code 
      ELSE NULL 
    END AS program_code,
    CASE 
      WHEN coalesce((sp.section_visibility->>'academic')::boolean, true) IS TRUE THEN b.admission_year 
      ELSE NULL 
    END AS admission_year
  FROM student_profiles sp
  JOIN users u ON u.id = sp.user_id
  LEFT JOIN user_academic_profiles ap ON ap.user_id = sp.user_id
  LEFT JOIN academic_batches b ON b.id = ap.batch_id
  LEFT JOIN academic_programs prog ON prog.id = b.program_id
  WHERE sp.slug = p_slug
    AND u.deleted_at IS NULL
    AND u.global_role = 'STUDENT';
$$;

REVOKE ALL ON FUNCTION lookup_public_student_profile_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_public_student_profile_by_slug(text) TO nst_app;
GRANT EXECUTE ON FUNCTION lookup_public_student_profile_by_slug(text) TO nst_worker;

-- =========================================================================
-- 3. Update lookup_student_slug_redirect signature to RETURNS TABLE (canonical_slug text)
-- =========================================================================

DROP FUNCTION IF EXISTS lookup_student_slug_redirect(text);

CREATE OR REPLACE FUNCTION lookup_student_slug_redirect(p_slug text)
RETURNS TABLE (canonical_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT sp.slug AS canonical_slug
  FROM student_slug_history ssh
  JOIN student_profiles sp ON sp.user_id = ssh.user_id
  JOIN users u ON u.id = sp.user_id
  WHERE ssh.slug = p_slug
    AND sp.slug <> p_slug
    AND u.deleted_at IS NULL
    AND u.global_role = 'STUDENT'
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION lookup_student_slug_redirect(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_student_slug_redirect(text) TO nst_app;
GRANT EXECUTE ON FUNCTION lookup_student_slug_redirect(text) TO nst_worker;

-- =========================================================================
-- 4. Concurrency-Safe Anonymous Slug Rotation Function
-- =========================================================================

CREATE OR REPLACE FUNCTION rotate_student_to_anonymous_slug(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_slug text;
  v_short text;
  v_base text;
  v_candidate text;
  v_counter int := 1;
BEGIN
  -- Row lock prevents concurrent race conditions on the same profile
  SELECT slug INTO v_current_slug
  FROM student_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_slug IS NULL THEN
    RETURN NULL;
  END IF;

  -- If already anonymous, return existing without re-rotating
  IF v_current_slug ~ '^student-[a-f0-9]{6,12}(-[0-9]+)?$' THEN
    RETURN v_current_slug;
  END IF;

  -- Record current name-derived slug in history
  INSERT INTO student_slug_history (user_id, slug)
  VALUES (p_user_id, v_current_slug)
  ON CONFLICT (slug) DO NOTHING;

  v_short := substr(replace(p_user_id::text, '-', ''), 1, 8);
  v_base := 'student-' || lower(v_short);
  v_candidate := v_base;

  LOOP
    BEGIN
      -- Check slug history first to avoid colliding with old handles
      IF NOT EXISTS (SELECT 1 FROM student_slug_history WHERE slug = v_candidate) THEN
        UPDATE student_profiles
        SET slug = v_candidate
        WHERE user_id = p_user_id;

        RETURN v_candidate;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- If another concurrent transaction claimed v_candidate, catch and retry with counter
      NULL;
    END;

    v_candidate := v_base || '-' || v_counter;
    v_counter := v_counter + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION rotate_student_to_anonymous_slug(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rotate_student_to_anonymous_slug(uuid) TO nst_app;
GRANT EXECUTE ON FUNCTION rotate_student_to_anonymous_slug(uuid) TO nst_worker;
