-- Forward Migration: Phase 4 Registration Mode and Leaderboard Scoring Ledger Reconcilation
-- Migration: 20261020010000_phase4_registration_mode_and_scoring_ledger

-- 1. Create RegistrationMode enum and add registration_mode to events
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RegistrationMode') THEN
    CREATE TYPE "RegistrationMode" AS ENUM ('REQUIRED', 'NOT_REQUIRED');
  END IF;
END $$;

ALTER TABLE "events" 
ADD COLUMN IF NOT EXISTS "registration_mode" "RegistrationMode" NOT NULL DEFAULT 'REQUIRED';

-- Conservative backfill:
-- For existing published or archived events with NULL start & end times and zero registrations, set to NOT_REQUIRED.
-- All other events remain REQUIRED.
UPDATE "events"
SET "registration_mode" = 'NOT_REQUIRED'
WHERE "registration_start_time" IS NULL 
  AND "registration_end_time" IS NULL 
  AND "registration_count" = 0
  AND NOT EXISTS (
    SELECT 1 FROM "event_registrations" er 
    WHERE er.event_id = "events".id 
      AND er.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "teams" t 
    WHERE t.event_id = "events".id 
      AND t.deleted_at IS NULL
  )
  AND "state" IN ('PUBLISHED', 'ARCHIVED');

-- 2. Update register_event to enforce registration_mode = 'REQUIRED'
CREATE OR REPLACE FUNCTION public.register_event(p_event_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id UUID := current_user_id();
  v_event events;
  v_reg event_registrations;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001'; END IF;

  -- Lock the event row exclusively
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.deleted_at IS NOT NULL THEN 
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032'; 
  END IF;
  
  IF v_event.state != 'PUBLISHED' THEN 
    RAISE EXCEPTION 'Event not published' USING ERRCODE = 'U0033'; 
  END IF;

  IF v_event.registration_mode = 'NOT_REQUIRED' THEN
    RAISE EXCEPTION 'Registration is not required for this event' USING ERRCODE = 'U0056';
  END IF;

  IF v_event.registration_type = 'TEAM' THEN 
    RAISE EXCEPTION 'Individual registration is not permitted for team events' USING ERRCODE = 'U0035'; 
  END IF;

  -- ENFORCE: Cannot register for permanently or temporarily locked events
  IF v_event.is_locked OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'EVENT_LOCKED' USING ERRCODE = 'U0006'; 
  END IF;

  -- ENFORCE: Registration window must be configured and open (now >= registration_start_time AND now < registration_end_time)
  IF v_event.registration_start_time IS NULL OR v_event.registration_end_time IS NULL THEN
    RAISE EXCEPTION 'Registration is closed for this event' USING ERRCODE = 'U0056';
  END IF;
  IF now() < v_event.registration_start_time THEN
    RAISE EXCEPTION 'Registration has not opened yet' USING ERRCODE = 'U0056';
  END IF;
  IF now() >= v_event.registration_end_time THEN
    RAISE EXCEPTION 'Registration is closed for this event' USING ERRCODE = 'U0056';
  END IF;

  -- Registration Eligibility
  IF v_event.audience = 'SPECIFIC_BATCHES' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_academic_profiles uap
      JOIN event_audience_batches eab ON eab.batch_id = uap.batch_id
      WHERE uap.user_id = v_user_id AND eab.event_id = p_event_id
    ) THEN
      RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0031';
    END IF;
  END IF;

  -- Check existing active registration
  IF EXISTS (
    SELECT 1 FROM event_registrations
    WHERE event_id = p_event_id AND user_id = v_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ALREADY_REGISTERED' USING ERRCODE = 'U0034';
  END IF;

  -- Capacity check and atomic insert
  IF v_event.max_capacity IS NOT NULL AND v_event.registration_count >= v_event.max_capacity THEN
    -- Insert into waitlist
    INSERT INTO event_registrations (id, event_id, user_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_user_id, 'WAITLISTED')
    RETURNING * INTO v_reg;

    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  ELSE
    -- Increment registration_count and insert REGISTERED
    UPDATE events SET registration_count = registration_count + 1 WHERE id = p_event_id;

    INSERT INTO event_registrations (id, event_id, user_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_user_id, 'REGISTERED')
    RETURNING * INTO v_reg;

    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.register_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_event(uuid) TO nst_app;

-- 3. Update create_team to enforce registration_mode = 'REQUIRED' and preserve participant capacity
CREATE OR REPLACE FUNCTION public.create_team(p_event_id uuid, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_caller_id UUID := current_user_id();
  v_team teams;
  v_reg event_registrations;
  v_event events;
  v_normalized_name TEXT := lower(trim(p_name));
  v_min_team_size INT;
  v_initial_status TEXT := 'FORMING';
  v_reg_status TEXT := 'WAITLISTED';
  v_active_participants INT;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001'; END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032'; END IF;

  -- ENFORCE: Primary Club Admin cannot participate in their own event
  IF EXISTS (
    SELECT 1 FROM event_clubs ec
    JOIN club_memberships cm ON cm.club_id = ec.club_id
    WHERE ec.event_id = p_event_id 
      AND ec.is_primary = true 
      AND cm.user_id = v_caller_id 
      AND cm.role = 'CLUB_ADMIN' 
      AND cm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Primary Club Admin cannot participate in their own event' USING ERRCODE = 'U0004';
  END IF;

  IF v_event.state != 'PUBLISHED' THEN RAISE EXCEPTION 'Event not published' USING ERRCODE = 'U0033'; END IF;

  IF v_event.registration_mode = 'NOT_REQUIRED' THEN
    RAISE EXCEPTION 'Registration is not required for this event' USING ERRCODE = 'U0056';
  END IF;

  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams' USING ERRCODE = 'U0035'; END IF;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0030'; 
  END IF;

  -- ENFORCE: Registration window must be configured and open (now >= registration_start_time AND now < registration_end_time)
  IF v_event.registration_start_time IS NULL OR v_event.registration_end_time IS NULL THEN
    RAISE EXCEPTION 'Registration is closed for this event' USING ERRCODE = 'U0056';
  END IF;
  IF now() < v_event.registration_start_time THEN
    RAISE EXCEPTION 'Registration has not opened yet' USING ERRCODE = 'U0056';
  END IF;
  IF now() >= v_event.registration_end_time THEN
    RAISE EXCEPTION 'Registration is closed for this event' USING ERRCODE = 'U0056';
  END IF;

  -- ENFORCE: Registration Eligibility
  IF v_event.audience = 'SPECIFIC_BATCHES' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_academic_profiles uap
      JOIN event_audience_batches eab ON eab.batch_id = uap.batch_id
      WHERE uap.user_id = v_caller_id AND eab.event_id = p_event_id
    ) THEN
      RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0031';
    END IF;
  END IF;

  -- User cannot already be in an active team for this event
  IF EXISTS (
    SELECT 1 FROM event_registrations 
    WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL AND registration_status != 'CANCELLED'
  ) THEN
    RAISE EXCEPTION 'Already in a team for this event.' USING ERRCODE = 'U0020';
  END IF;

  -- ENFORCE: Team Name Uniqueness
  IF EXISTS (SELECT 1 FROM teams WHERE event_id = p_event_id AND normalized_name = v_normalized_name AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'TEAM_NAME_TAKEN' USING ERRCODE = 'U0055';
  END IF;

  -- Count only active REGISTERED participants (WAITLISTED and CANCELLED do NOT consume participant capacity)
  SELECT count(*) INTO v_active_participants
  FROM event_registrations
  WHERE event_id = p_event_id
    AND deleted_at IS NULL
    AND registration_status = 'REGISTERED';

  v_min_team_size := COALESCE((v_event.metadata->>'minimum_team_size')::INT, 1);

  -- Initial team size with leader is 1
  IF 1 >= v_min_team_size THEN
    -- Minimum satisfied on creation: verify both team capacity and participant capacity
    IF (v_event.max_capacity IS NULL OR v_event.registration_count < v_event.max_capacity)
       AND (v_event.max_participants IS NULL OR v_active_participants < v_event.max_participants) THEN
      v_initial_status := 'REGISTERED';
      v_reg_status := 'REGISTERED';
      UPDATE events SET registration_count = registration_count + 1 WHERE id = p_event_id;
    ELSE
      -- Capacity full (either team slots or participant cap reached) -> waitlist
      v_initial_status := 'WAITLISTED';
      v_reg_status := 'WAITLISTED';
    END IF;
  ELSE
    v_initial_status := 'FORMING';
    v_reg_status := 'WAITLISTED';
  END IF;

  BEGIN
    INSERT INTO teams (id, event_id, name, normalized_name, leader_id, status)
    VALUES (gen_random_uuid(), p_event_id, p_name, v_normalized_name, v_caller_id, v_initial_status::"TeamStatus")
    RETURNING * INTO v_team;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'TEAM_NAME_TAKEN' USING ERRCODE = 'U0055';
  END;

  INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status, eligibility_scope_snapshot, academic_batch_id_snapshot)
  VALUES (
    gen_random_uuid(), p_event_id, v_caller_id, v_team.id, v_reg_status::"RegistrationStatus",
    CASE WHEN v_reg_status = 'REGISTERED' THEN v_event.audience ELSE NULL END,
    CASE WHEN v_reg_status = 'REGISTERED' AND v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = v_caller_id) ELSE NULL END
  )
  RETURNING * INTO v_reg;

  RETURN json_build_object('team_id', v_team.id, 'status', v_initial_status, 'registration_id', v_reg.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_team(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_team(uuid, text) TO nst_app;

-- 4. Update approve_event to enforce registration window for REQUIRED events
CREATE OR REPLACE FUNCTION public.approve_event(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
  v_is_global_admin BOOLEAN;
  v_is_mentor BOOLEAN;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  
  IF NOT FOUND OR v_event.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  IF v_event.state != 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Event must be in PENDING_APPROVAL state' USING ERRCODE = 'U0044';
  END IF;

  IF v_event.visibility IS NULL OR v_event.visibility::text NOT IN ('PUBLIC', 'UNLISTED', 'RESTRICTED') THEN
    RAISE EXCEPTION 'Event visibility must be selected before publication' USING ERRCODE = 'U0046';
  END IF;

  -- For REQUIRED events, valid registration window is required before publication
  IF v_event.registration_mode = 'REQUIRED' THEN
    IF v_event.registration_start_time IS NULL OR v_event.registration_end_time IS NULL OR v_event.registration_start_time >= v_event.registration_end_time THEN
      RAISE EXCEPTION 'Registration window must be configured before publication for registration-required events' USING ERRCODE = 'U0056';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
    AND ec.is_primary = true
    AND has_club_role(ec.club_id, v_caller_id, ARRAY['FACULTY_MENTOR'])
  ) INTO v_is_mentor;

  IF NOT v_is_global_admin AND NOT v_is_mentor THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  UPDATE events SET state = 'PUBLISHED' WHERE id = p_event_id AND state = 'PENDING_APPROVAL' RETURNING * INTO v_event;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Race condition: Event state changed during transaction' USING ERRCODE = 'U0045';
  END IF;

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_event(uuid) TO nst_app;

-- 5. Reconcile student leaderboard breakdown from the real score ledger
CREATE OR REPLACE FUNCTION public.get_student_leaderboard_base()
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
    COALESCE(SUM(CASE WHEN ls.reason ILIKE '%attend%' THEN ls.points ELSE 0 END), 0)::INTEGER AS attendance_points,
    COALESCE(SUM(CASE WHEN (ls.reason NOT ILIKE '%attend%' AND ls.reason NOT ILIKE '%compet%' AND ls.reason NOT ILIKE '%place%' AND ls.reason NOT ILIKE '%result%') THEN ls.points ELSE 0 END), 0)::INTEGER AS contribution_points,
    COALESCE(SUM(CASE WHEN (ls.reason ILIKE '%compet%' OR ls.reason ILIKE '%place%' OR ls.reason ILIKE '%result%') THEN ls.points ELSE 0 END), 0)::INTEGER AS competition_points,
    now() AS last_refreshed_at
  FROM users u
  LEFT JOIN student_profiles sp ON sp.user_id = u.id
  LEFT JOIN leaderboard_scores ls ON u.id = ls.user_id
  WHERE u.deleted_at IS NULL
  GROUP BY u.id, u.full_name, sp.section_visibility;
$$;

REVOKE ALL ON FUNCTION public.get_student_leaderboard_base() FROM PUBLIC, nst_worker;
GRANT EXECUTE ON FUNCTION public.get_student_leaderboard_base() TO nst_app;

DROP MATERIALIZED VIEW IF EXISTS student_leaderboard_mv CASCADE;

CREATE MATERIALIZED VIEW student_leaderboard_mv AS
SELECT * FROM get_student_leaderboard_base();

CREATE UNIQUE INDEX student_leaderboard_mv_user_id_idx ON student_leaderboard_mv(user_id);

ALTER MATERIALIZED VIEW student_leaderboard_mv OWNER TO nst_app;
GRANT SELECT ON student_leaderboard_mv TO nst_app;
GRANT SELECT ON student_leaderboard_mv TO nst_worker;
