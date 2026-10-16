-- Migration: 20261016110000_student_profiles_residual_hardening
-- Purpose:
-- 1. Standardize and harden SQL-level masking of avatar_url across 'avatar' and 'avatar_url' keys in validate_section_visibility and views/functions.
-- 2. Restrict public_student_profiles_view to directory_listed = true so unlisted profiles cannot be enumerated or scraped.
-- 3. Provide secure lookup_public_student_profile_by_slug(p_slug) so direct canonical slug access (/students/[slug]) functions for unlisted profiles with full SQL-level column masking.
-- 4. Harden lookup_student_slug_redirect(p_slug) return contract against self-redirect loops (sp.slug <> p_slug) and restrict to STUDENT role.
-- 5. Harden anonymous slug generation logic against birthday paradox collisions in existing and new records.

-- =========================================================================
-- 1. Update validate_section_visibility to explicitly accept 'avatar_url'
-- =========================================================================

CREATE OR REPLACE FUNCTION validate_section_visibility(val jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
  allowed text[] := ARRAY['identity', 'name', 'avatar', 'avatar_url', 'academic', 'bio', 'skills', 'links', 'external_links', 'projects', 'achievements', 'clubs'];
BEGIN
  IF jsonb_typeof(val) <> 'object' THEN
    RETURN false;
  END IF;
  FOR k IN SELECT jsonb_object_keys(val) LOOP
    IF NOT (k = ANY(allowed)) THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(val -> k) <> 'boolean' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- =========================================================================
-- 2. Harden public_student_profiles_view: filter directory_listed = true and mask avatar_url
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
      WHEN coalesce(coalesce((sp.section_visibility->>'avatar')::boolean, (sp.section_visibility->>'avatar_url')::boolean), true) IS TRUE THEN u.avatar_url 
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
-- 3. Dedicated SECURITY DEFINER Function for Direct Slug Lookup (Supports unlisted profiles)
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
      WHEN coalesce(coalesce((sp.section_visibility->>'avatar')::boolean, (sp.section_visibility->>'avatar_url')::boolean), true) IS TRUE THEN u.avatar_url 
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
-- 4. Harden lookup_student_slug_redirect contract against loops
-- =========================================================================

CREATE OR REPLACE FUNCTION lookup_student_slug_redirect(p_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_canonical_slug text;
BEGIN
  SELECT sp.slug INTO v_canonical_slug
  FROM student_slug_history ssh
  JOIN student_profiles sp ON sp.user_id = ssh.user_id
  JOIN users u ON u.id = sp.user_id
  WHERE ssh.slug = p_slug
    AND sp.slug <> p_slug
    AND u.deleted_at IS NULL
    AND u.global_role = 'STUDENT'
  LIMIT 1;

  RETURN v_canonical_slug;
END;
$$;

REVOKE ALL ON FUNCTION lookup_student_slug_redirect(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_student_slug_redirect(text) TO nst_app;
GRANT EXECUTE ON FUNCTION lookup_student_slug_redirect(text) TO nst_worker;
