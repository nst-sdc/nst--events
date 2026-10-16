-- Migration: 20261016130000_student_profiles_privilege_audit
-- Purpose:
-- 1. Perform strict privilege hardening on all SECURITY DEFINER functions in student profiles.
-- 2. Revoke execute privileges from PUBLIC and unnecessary roles (nst_worker).
-- 3. Grant execute strictly to authorized application role (nst_app).
-- 4. In rotate_student_to_anonymous_slug, enforce caller authorization check:
--    prevent anonymous callers and students from rotating another student's profile (BOLA protection).
-- 5. Revoke execute from PUBLIC on trigger function on_user_student_provision.
-- 6. Ensure secure and immutable search_path (public, pg_temp) across all SECURITY DEFINER functions.

-- =========================================================================
-- 1. Harden rotate_student_to_anonymous_slug: BOLA Protection & Least Privilege
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
  -- Strict caller authorization check:
  -- 1. Anonymous callers (no active session) cannot invoke slug rotation
  IF current_user_id() IS NULL THEN
    RAISE EXCEPTION 'Access denied: anonymous caller cannot rotate student profile' USING ERRCODE = '42501';
  END IF;

  -- 2. Authenticated users can only rotate their own profile unless PLATFORM_ADMIN or FACULTY_ADMIN
  IF current_user_id() <> p_user_id THEN
    IF current_user_global_role() NOT IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN') THEN
      RAISE EXCEPTION 'Access denied: cannot rotate another student profile' USING ERRCODE = '42501';
    END IF;
  END IF;

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

REVOKE ALL ON FUNCTION rotate_student_to_anonymous_slug(uuid) FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION rotate_student_to_anonymous_slug(uuid) TO nst_app;

-- =========================================================================
-- 2. Audit & Restrict lookup_student_slug_redirect
-- =========================================================================

REVOKE ALL ON FUNCTION lookup_student_slug_redirect(text) FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION lookup_student_slug_redirect(text) TO nst_app;

-- =========================================================================
-- 3. Audit & Restrict lookup_public_student_profile_by_slug
-- =========================================================================

REVOKE ALL ON FUNCTION lookup_public_student_profile_by_slug(text) FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION lookup_public_student_profile_by_slug(text) TO nst_app;

-- =========================================================================
-- 4. Audit & Restrict is_student_slug_taken
-- =========================================================================

REVOKE ALL ON FUNCTION is_student_slug_taken(text) FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION is_student_slug_taken(text) TO nst_app;

-- =========================================================================
-- 5. Audit & Restrict provision_student_profile
-- =========================================================================

REVOKE ALL ON FUNCTION provision_student_profile(uuid) FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION provision_student_profile(uuid) TO nst_app;

-- =========================================================================
-- 6. Audit & Restrict on_user_student_provision trigger function
-- =========================================================================

REVOKE ALL ON FUNCTION on_user_student_provision() FROM PUBLIC, nst_app, nst_worker;
