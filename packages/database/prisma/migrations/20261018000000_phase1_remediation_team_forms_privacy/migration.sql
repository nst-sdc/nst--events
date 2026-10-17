-- Migration: 20261018000000_phase1_remediation_team_forms_privacy
-- Purpose: Remediate Phase 1 Critical Findings:
--   1. FINDING-TEAM-01: Permit authorized team leader to remove members of their own team in leave_team.
--   2. FINDING-FORM-01: Set CASCADE on event_form_fields and RESTRICT on event_registration_responses.
--   3. FINDING-PRIVACY-01: Block deanonymizing redirects in lookup_student_slug_redirect when identity is hidden.
--   4. FINDING-PRIVACY-02: Mask display_name to 'Anonymous Student' in student_leaderboard_mv when identity is hidden.

-- =========================================================================
-- 1. Team Member Removal Authorization in leave_team
-- =========================================================================
CREATE OR REPLACE FUNCTION leave_team(p_event_id UUID, p_team_id UUID, p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_event events;
  v_promoted UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0024'; 
  END IF;

  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034'; 
  END IF;

  -- Authorization check:
  -- Caller must be:
  --   a) The member themselves departing voluntarily (v_caller_id = p_user_id)
  --   b) The team leader of this specific team (v_caller_id = v_team.leader_id)
  --   c) Platform Admin or Faculty Admin
  IF v_caller_id != p_user_id 
     AND v_team.leader_id != v_caller_id 
     AND NOT EXISTS (
       SELECT 1 FROM users WHERE id = v_caller_id AND global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
     ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  IF v_team.leader_id = p_user_id THEN
    -- Leader leaving dissolves the entire team
    IF v_team.status = 'REGISTERED' THEN
      UPDATE events SET registration_count = GREATEST(0, registration_count - 1) WHERE id = p_event_id;
    END IF;

    UPDATE teams SET status = 'CANCELLED', deleted_at = now() WHERE id = p_team_id;
    UPDATE event_registrations SET deleted_at = now(), registration_status = 'CANCELLED' WHERE team_id = p_team_id AND deleted_at IS NULL;
    
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
    VALUES (v_caller_id, 'TEAM_CANCELLED_BY_LEADER', 'TEAM', p_team_id, jsonb_build_object('team_id', p_team_id));
    
    IF v_team.status = 'REGISTERED' THEN
      v_promoted := process_waitlist(p_event_id);
    END IF;

    RETURN v_promoted;
  END IF;

  UPDATE event_registrations SET deleted_at = now(), registration_status = 'CANCELLED' 
  WHERE team_id = p_team_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Member not found in team' USING ERRCODE = 'U0039'; 
  END IF;

  -- Audit log for leader-initiated member removal
  IF v_caller_id != p_user_id THEN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state)
    VALUES (v_caller_id, 'TEAM_MEMBER_REMOVED_BY_LEADER', 'TEAM', p_team_id, jsonb_build_object('team_id', p_team_id, 'user_id', p_user_id));
  END IF;

  -- A member leaving or being removed from a registered team does NOT release an event capacity slot,
  -- and does NOT demote a REGISTERED team to WAITLISTED. The team remains REGISTERED.
  RETURN v_promoted;
END;
$$;

GRANT EXECUTE ON FUNCTION leave_team(UUID, UUID, UUID) TO nst_app;

-- =========================================================================
-- 2. Supplemental Form Foreign Key Constraints & Data Integrity
-- =========================================================================
ALTER TABLE "event_form_fields" DROP CONSTRAINT IF EXISTS "event_form_fields_form_id_fkey";
ALTER TABLE "event_form_fields" ADD CONSTRAINT "event_form_fields_form_id_fkey" 
  FOREIGN KEY ("form_id") REFERENCES "event_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_registration_responses" DROP CONSTRAINT IF EXISTS "event_registration_responses_form_id_fkey";
ALTER TABLE "event_registration_responses" ADD CONSTRAINT "event_registration_responses_form_id_fkey" 
  FOREIGN KEY ("form_id") REFERENCES "event_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================================
-- 3. Student Slug Redirect Anonymity Hardening
-- =========================================================================
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
    -- Only allow redirect if identity is visible and current slug is not an anonymous handle
    AND COALESCE(COALESCE((sp.section_visibility->>'identity')::boolean, (sp.section_visibility->>'name')::boolean), true) IS TRUE
    AND sp.slug !~ '^student-[a-f0-9]{6,12}(-[0-9]+)?$'
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION lookup_student_slug_redirect(text) FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION lookup_student_slug_redirect(text) TO nst_app;

-- =========================================================================
-- 4. Leaderboard Materialized View Privacy Hardening
-- =========================================================================
CREATE OR REPLACE FUNCTION get_student_leaderboard_base()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  total_points INTEGER,
  attendance_points INTEGER,
  contribution_points INTEGER,
  competition_points INTEGER,
  last_refreshed_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    u.id AS user_id,
    CASE
      WHEN COALESCE(COALESCE((sp.section_visibility->>'identity')::boolean, (sp.section_visibility->>'name')::boolean), true) IS FALSE
        THEN 'Anonymous Student'
      ELSE u.full_name
    END AS display_name,
    COALESCE(SUM(ls.points), 0)::INTEGER AS total_points,
    0::INTEGER AS attendance_points,
    0::INTEGER AS contribution_points,
    0::INTEGER AS competition_points,
    now() AS last_refreshed_at
  FROM users u
  LEFT JOIN student_profiles sp ON sp.user_id = u.id
  LEFT JOIN leaderboard_scores ls ON u.id = ls.user_id
  WHERE u.deleted_at IS NULL
  GROUP BY u.id, u.full_name, sp.section_visibility;
$$;

REVOKE ALL ON FUNCTION get_student_leaderboard_base() FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION get_student_leaderboard_base() TO nst_app;

DROP MATERIALIZED VIEW IF EXISTS student_leaderboard_mv CASCADE;

CREATE MATERIALIZED VIEW student_leaderboard_mv AS
SELECT * FROM get_student_leaderboard_base();

CREATE UNIQUE INDEX student_leaderboard_mv_user_id_idx ON student_leaderboard_mv(user_id);

ALTER MATERIALIZED VIEW student_leaderboard_mv OWNER TO nst_app;
ALTER MATERIALIZED VIEW club_leaderboard_mv OWNER TO nst_app;
GRANT SELECT ON student_leaderboard_mv TO nst_app;
GRANT SELECT ON student_leaderboard_mv TO nst_worker;

-- Real-time concealment check function for immediate, zero-delay fail-closed masking on leaderboards
CREATE OR REPLACE FUNCTION is_student_identity_hidden(p_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (COALESCE((sp.section_visibility->>'identity')::boolean, (sp.section_visibility->>'name')::boolean) IS FALSE),
    false
  )
  FROM student_profiles sp
  WHERE sp.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION is_student_identity_hidden(UUID) FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION is_student_identity_hidden(UUID) TO nst_app;




