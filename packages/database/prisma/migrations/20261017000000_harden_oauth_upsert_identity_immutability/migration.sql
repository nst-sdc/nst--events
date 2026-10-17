-- Migration: 20261017000000_harden_oauth_upsert_identity_immutability
-- Purpose:
-- 1. Enforce Google OAuth identity immutability in public.upsert_oauth_user().
--    Prevent account hijacking where an incoming OAuth token with a matching email but different
--    Google subject silently overwrites an established user's google_sub.
-- 2. Preserve legitimate account linking for pre-provisioned or unverified placeholders:
--    - Admin pre-provisioned accounts ('provisioned:%')
--    - Developer seed / testing placeholders ('pending-oauth-%')
--    - Pre-login directory sync placeholders ('unverified%')
--    - Unlinked accounts (google_sub IS NULL)
--    Upon first OAuth login, these placeholders are safely transitioned to the verified Google subject.
-- 3. Raise an explicit exception with SQLSTATE 'U0001' and message containing 'ACCOUNT_LINK_CONFLICT'
--    when a conflicting Google subject attempts to authenticate as an already-linked account.
-- 4. Preserve SECURITY DEFINER execution with secure search_path ('public', 'pg_catalog') and
--    restricted EXECUTE privileges (granted solely to nst_app, revoked from PUBLIC).

CREATE OR REPLACE FUNCTION public.upsert_oauth_user(
  p_google_sub TEXT,
  p_email TEXT,
  p_full_name TEXT
)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_role "GlobalRole" := 'STUDENT'::"GlobalRole";
  v_user users%ROWTYPE;
BEGIN
  IF p_email LIKE '%@newtonschool.co' THEN
    v_role := 'FACULTY_MENTOR'::"GlobalRole";
  END IF;

  -- First, try to find an existing user by email
  SELECT * INTO v_user FROM users WHERE email = p_email AND deleted_at IS NULL;

  IF FOUND THEN
    -- If they exist, check whether google_sub differs
    IF v_user.google_sub IS DISTINCT FROM p_google_sub THEN
      -- Only permit linking if the existing account has a placeholder/provisioned sub
      IF v_user.google_sub LIKE 'provisioned:%' 
         OR v_user.google_sub LIKE 'pending-oauth-%'
         OR v_user.google_sub LIKE 'unverified%'
         OR v_user.google_sub IS NULL THEN
        UPDATE users
        SET google_sub = p_google_sub, full_name = p_full_name, updated_at = NOW()
        WHERE id = v_user.id
        RETURNING * INTO v_user;
      ELSE
        -- Established Google identity cannot be replaced by a different subject
        RAISE EXCEPTION 'ACCOUNT_LINK_CONFLICT: Email is already linked to another Google identity'
          USING ERRCODE = 'U0001';
      END IF;
    ELSIF v_user.full_name IS DISTINCT FROM p_full_name THEN
      UPDATE users
      SET full_name = p_full_name, updated_at = NOW()
      WHERE id = v_user.id
      RETURNING * INTO v_user;
    END IF;
    RETURN NEXT v_user;
    RETURN;
  END IF;

  -- Otherwise, try to insert new user
  RETURN QUERY
  INSERT INTO users (id, google_sub, email, full_name, global_role)
  VALUES (gen_random_uuid(), p_google_sub, p_email, p_full_name, v_role)
  ON CONFLICT (google_sub) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW()
  WHERE users.deleted_at IS NULL
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_oauth_user(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_oauth_user(text, text, text) TO nst_app;
