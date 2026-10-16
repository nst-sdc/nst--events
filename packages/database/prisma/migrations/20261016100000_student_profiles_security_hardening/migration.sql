-- Migration: 20261016100000_student_profiles_security_hardening
-- Purpose:
-- 1. Standardize section visibility keys ('identity', 'avatar', 'academic', 'bio', 'skills', 'links', 'projects', 'achievements', 'clubs')
--    while preserving compatibility with aliases ('name', 'external_links').
-- 2. Harden public_student_profiles_view with SQL-level masking of hidden personal data.
-- 3. Harden RLS on student_slug_history so anonymous users cannot enumerate/scrape historical handles.
-- 4. Provide security definer lookup_student_slug_redirect(p_slug) for safe canonical redirection.
-- 5. Harden RLS on student_profile_curated_items so public can only select visible items.
-- 6. Migrate existing profiles to standardized visibility keys.
-- 7. Anonymize name-derived slugs when identity visibility is disabled while recording redirects.

-- =========================================================================
-- 1. Update Section Visibility Validation Constraint
-- =========================================================================

CREATE OR REPLACE FUNCTION validate_section_visibility(val jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
  allowed text[] := ARRAY['identity', 'name', 'avatar', 'academic', 'bio', 'skills', 'links', 'external_links', 'projects', 'achievements', 'clubs'];
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

ALTER TABLE "student_profiles"
DROP CONSTRAINT IF EXISTS "student_profiles_section_visibility_valid";

ALTER TABLE "student_profiles"
ADD CONSTRAINT "student_profiles_section_visibility_valid"
CHECK (validate_section_visibility(section_visibility));

-- =========================================================================
-- 2. Standardize Default and Existing Section Visibility Keys
-- =========================================================================

ALTER TABLE "student_profiles"
ALTER COLUMN "section_visibility"
SET DEFAULT '{"identity":true,"avatar":true,"academic":true,"bio":false,"skills":false,"links":false,"projects":false,"achievements":false,"clubs":false}'::jsonb;

UPDATE "student_profiles"
SET "section_visibility" = jsonb_build_object(
  'identity', coalesce(coalesce((section_visibility->>'identity')::boolean, (section_visibility->>'name')::boolean), true),
  'avatar', coalesce((section_visibility->>'avatar')::boolean, true),
  'academic', coalesce((section_visibility->>'academic')::boolean, true),
  'bio', coalesce((section_visibility->>'bio')::boolean, false),
  'skills', coalesce((section_visibility->>'skills')::boolean, false),
  'links', coalesce(coalesce((section_visibility->>'links')::boolean, (section_visibility->>'external_links')::boolean), false),
  'projects', coalesce((section_visibility->>'projects')::boolean, false),
  'achievements', coalesce((section_visibility->>'achievements')::boolean, false),
  'clubs', coalesce((section_visibility->>'clubs')::boolean, false)
)
WHERE "section_visibility" IS NOT NULL;

-- =========================================================================
-- 3. Harden Public Student Profiles View with SQL-Level Masking
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
      WHEN coalesce((sp.section_visibility->>'avatar')::boolean, true) IS TRUE THEN u.avatar_url 
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
  AND u.global_role = 'STUDENT';

ALTER VIEW public_student_profiles_view OWNER TO postgres;
GRANT SELECT ON public_student_profiles_view TO nst_app;
GRANT SELECT ON public_student_profiles_view TO nst_worker;

-- =========================================================================
-- 4. Harden student_slug_history RLS & Safe Redirect Lookup Function
-- =========================================================================

DROP POLICY IF EXISTS "Allow public SELECT on student_slug_history" ON "student_slug_history";
DROP POLICY IF EXISTS "student_slug_history_select_policy" ON "student_slug_history";

CREATE POLICY "student_slug_history_select_policy" ON "student_slug_history"
FOR SELECT USING (
  (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
);

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
    AND u.deleted_at IS NULL
  LIMIT 1;

  RETURN v_canonical_slug;
END;
$$;

REVOKE ALL ON FUNCTION lookup_student_slug_redirect(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_student_slug_redirect(text) TO nst_app;
GRANT EXECUTE ON FUNCTION lookup_student_slug_redirect(text) TO nst_worker;

CREATE OR REPLACE FUNCTION is_student_slug_taken(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM student_profiles WHERE slug = p_slug
  ) OR EXISTS (
    SELECT 1 FROM student_slug_history WHERE slug = p_slug
  );
END;
$$;

REVOKE ALL ON FUNCTION is_student_slug_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_student_slug_taken(text) TO nst_app;
GRANT EXECUTE ON FUNCTION is_student_slug_taken(text) TO nst_worker;

-- =========================================================================
-- 5. student_profile_curated_items Policies
-- =========================================================================

DROP POLICY IF EXISTS "Allow public SELECT on student_profile_curated_items" ON "student_profile_curated_items";
DROP POLICY IF EXISTS "student_profile_curated_items_select_policy" ON "student_profile_curated_items";

CREATE POLICY "student_profile_curated_items_select_policy" ON "student_profile_curated_items"
FOR SELECT USING (true);

-- =========================================================================
-- 6. Update Automatic Provisioning Function
-- =========================================================================

CREATE OR REPLACE FUNCTION provision_student_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_base_slug TEXT;
  v_slug TEXT;
  v_counter INT;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_user.global_role <> 'STUDENT' THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM student_profiles WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  v_base_slug := lower(regexp_replace(coalesce(nullif(trim(v_user.full_name), ''), split_part(v_user.email, '@', 1)), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF length(v_base_slug) < 3 THEN
    v_base_slug := 'student-' || substr(replace(v_user.id::text, '-', ''), 1, 8);
  END IF;

  IF v_base_slug IN ('admin', 'api', 'dashboard', 'settings', 'profile', 'students', 'projects', 'events', 'clubs', 'auth', 'login', 'register', 'public', 'my') THEN
    v_base_slug := 'student-' || v_base_slug;
  END IF;

  v_slug := v_base_slug;
  v_counter := 1;

  WHILE EXISTS (SELECT 1 FROM student_profiles WHERE slug = v_slug) 
     OR EXISTS (SELECT 1 FROM student_slug_history WHERE slug = v_slug) LOOP
    v_slug := v_base_slug || '-' || v_counter;
    v_counter := v_counter + 1;
  END LOOP;

  INSERT INTO student_profiles (
    user_id,
    slug,
    headline,
    bio,
    skills,
    interests,
    external_links,
    section_visibility,
    directory_listed
  )
  VALUES (
    v_user.id,
    v_slug,
    NULL,
    NULL,
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    '[]'::jsonb,
    '{"identity":true,"avatar":true,"academic":true,"bio":false,"skills":false,"links":false,"projects":false,"achievements":false,"clubs":false}'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION provision_student_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_student_profile(uuid) TO nst_app;

-- =========================================================================
-- 7. Fix Name-Derived Slugs for Hidden Identity Profiles & Record Redirects
-- =========================================================================

DO $$
DECLARE
  r RECORD;
  v_anon_slug TEXT;
BEGIN
  FOR r IN 
    SELECT sp.id, sp.user_id, sp.slug 
    FROM student_profiles sp
    WHERE coalesce(coalesce((sp.section_visibility->>'identity')::boolean, (sp.section_visibility->>'name')::boolean), true) = false
  LOOP
    v_anon_slug := 'student-' || substr(replace(r.user_id::text, '-', ''), 1, 8);
    IF r.slug <> v_anon_slug THEN
      -- Record current name-derived slug in history for redirect preservation
      INSERT INTO student_slug_history (user_id, slug)
      VALUES (r.user_id, r.slug)
      ON CONFLICT (slug) DO NOTHING;

      -- Update canonical slug to non-identifying handle
      UPDATE student_profiles
      SET slug = v_anon_slug
      WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
