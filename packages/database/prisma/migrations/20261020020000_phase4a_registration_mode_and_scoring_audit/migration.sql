-- Forward Migration: Phase 4A Registration Mode Audit and Score Classification Reconcilation
-- Migration: 20261020020000_phase4a_registration_mode_and_scoring_audit

-- 1. Create deterministic score reason classification function
CREATE OR REPLACE FUNCTION public.classify_leaderboard_score_category(p_reason TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    -- 1. ATTENDANCE CATEGORY
    WHEN trim(COALESCE(p_reason, '')) = 'ATTENDANCE'
      OR p_reason ILIKE 'ATTENDANCE:%'
      OR p_reason ILIKE 'ATTENDANCE -%'
      OR p_reason ILIKE 'ATTENDED:%'
      OR trim(COALESCE(p_reason, '')) = 'Attended Tech Symposium'
      THEN 'ATTENDANCE'

    -- 2. COMPETITION CATEGORY
    WHEN trim(COALESCE(p_reason, '')) = 'COMPETITION'
      OR p_reason ILIKE 'COMPETITION:%'
      OR p_reason ILIKE 'COMPETITION -%'
      OR trim(COALESCE(p_reason, '')) = 'RESULT'
      OR p_reason ILIKE 'RESULT:%'
      OR trim(COALESCE(p_reason, '')) = 'AWARD'
      OR p_reason ILIKE 'AWARD:%'
      OR trim(COALESCE(p_reason, '')) = 'PODIUM'
      OR p_reason ILIKE 'PODIUM:%'
      OR trim(COALESCE(p_reason, '')) IN ('1ST_PLACE', '2ND_PLACE', '3RD_PLACE')
      THEN 'COMPETITION'

    -- 3. CONTRIBUTION CATEGORY
    WHEN trim(COALESCE(p_reason, '')) = 'CONTRIBUTION'
      OR p_reason ILIKE 'CONTRIBUTION:%'
      OR p_reason ILIKE 'CONTRIBUTION -%'
      OR trim(COALESCE(p_reason, '')) = 'PROJECT_CONTRIBUTION'
      OR p_reason ILIKE 'PROJECT_CONTRIBUTION:%'
      OR trim(COALESCE(p_reason, '')) = 'OPEN_SOURCE'
      OR p_reason ILIKE 'OPEN_SOURCE:%'
      OR trim(COALESCE(p_reason, '')) = 'VOLUNTEER'
      OR p_reason ILIKE 'VOLUNTEER:%'
      OR trim(COALESCE(p_reason, '')) = 'MENTORSHIP'
      OR p_reason ILIKE 'MENTORSHIP:%'
      THEN 'CONTRIBUTION'

    -- 4. UNKNOWN / OTHER (Unknown reasons must NOT silently become contribution points)
    ELSE 'OTHER'
  END;
$$;

REVOKE ALL ON FUNCTION public.classify_leaderboard_score_category(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.classify_leaderboard_score_category(text) TO nst_app, nst_worker;

-- 2. Update join_team to enforce registration_mode = 'REQUIRED'
CREATE OR REPLACE FUNCTION public.join_team(p_event_id uuid, p_team_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_caller_id UUID := current_user_id();
  v_reg event_registrations;
  v_event events;
  v_team teams;
  v_team_size INT;
  v_team_size_max INT;
  v_team_size_min INT;
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

  -- ENFORCE: Events with NOT_REQUIRED registration cannot accept team joins
  IF v_event.registration_mode = 'NOT_REQUIRED' THEN
    RAISE EXCEPTION 'Registration is not required for this event' USING ERRCODE = 'U0056';
  END IF;

  IF v_event.registration_type != 'TEAM' THEN RAISE EXCEPTION 'Event does not support teams' USING ERRCODE = 'U0035'; END IF;
  IF v_event.is_locked = true OR now() >= v_event.end_time + interval '24 hours' THEN 
    RAISE EXCEPTION 'Event is locked' USING ERRCODE = 'U0006'; 
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
      RAISE EXCEPTION 'ACADEMICALLY_INELIGIBLE' USING ERRCODE = 'U0013';
    END IF;
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND event_id = p_event_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found' USING ERRCODE = 'U0034'; END IF;
  IF v_team.status = 'CANCELLED' THEN RAISE EXCEPTION 'Team is cancelled' USING ERRCODE = 'U0023'; END IF;

  -- Ensure user not already registered in an active team
  PERFORM 1 FROM event_registrations 
  WHERE event_id = p_event_id AND user_id = v_caller_id AND deleted_at IS NULL AND registration_status != 'CANCELLED';
  IF FOUND THEN RAISE EXCEPTION 'Already in a team' USING ERRCODE = 'U0020'; END IF;

  v_team_size_max := (v_event.metadata->>'maximum_team_size')::INT;
  v_team_size_min := COALESCE((v_event.metadata->>'minimum_team_size')::INT, 1);

  SELECT count(*) INTO v_team_size FROM event_registrations WHERE team_id = p_team_id AND deleted_at IS NULL AND registration_status != 'CANCELLED';
  IF v_team_size_max IS NOT NULL AND v_team_size >= v_team_size_max THEN
    RAISE EXCEPTION 'Team is full' USING ERRCODE = 'U0021';
  END IF;

  -- Count only active REGISTERED participants
  SELECT count(*) INTO v_active_participants
  FROM event_registrations
  WHERE event_id = p_event_id
    AND deleted_at IS NULL
    AND registration_status = 'REGISTERED';

  v_team_size := v_team_size + 1;

  IF v_team.status = 'FORMING' THEN
    IF v_team_size >= v_team_size_min THEN
      -- Minimum team size reached, check if team slot AND participant slots are available
      IF (v_event.max_capacity IS NULL OR v_event.registration_count < v_event.max_capacity)
         AND (v_event.max_participants IS NULL OR (v_active_participants + v_team_size) <= v_event.max_participants) THEN
        UPDATE teams SET status = 'REGISTERED' WHERE id = p_team_id;
        UPDATE event_registrations 
        SET registration_status = 'REGISTERED', 
            eligibility_scope_snapshot = v_event.audience, 
            academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END 
        WHERE team_id = p_team_id AND deleted_at IS NULL;
        
        UPDATE events SET registration_count = registration_count + 1 WHERE id = p_event_id;
        
        INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status, eligibility_scope_snapshot, academic_batch_id_snapshot)
        VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'REGISTERED', v_event.audience, CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = v_caller_id) ELSE NULL END) RETURNING * INTO v_reg;
        RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
      ELSE
        -- Capacity full -> transition to WAITLISTED
        UPDATE teams SET status = 'WAITLISTED' WHERE id = p_team_id;
        INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
        VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
        RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
      END IF;
    ELSE
      -- Still FORMING below minimum size
      INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
      VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
      RETURN json_build_object('registration_id', v_reg.id, 'status', 'FORMING');
    END IF;
  ELSIF v_team.status = 'REGISTERED' THEN
    -- Team is already registered: joining member will consume 1 active participant slot
    IF v_event.max_participants IS NOT NULL AND v_active_participants >= v_event.max_participants THEN
      RAISE EXCEPTION 'Event participant capacity is full' USING ERRCODE = 'U0057';
    END IF;

    INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status, eligibility_scope_snapshot, academic_batch_id_snapshot)
    VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'REGISTERED', v_event.audience, CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = v_caller_id) ELSE NULL END) RETURNING * INTO v_reg;
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    -- Team is WAITLISTED: joining member is added to the waitlisted team without consuming registered capacity
    INSERT INTO event_registrations (id, event_id, user_id, team_id, registration_status)
    VALUES (gen_random_uuid(), p_event_id, v_caller_id, p_team_id, 'WAITLISTED') RETURNING * INTO v_reg;
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_team(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team(uuid, uuid) TO nst_app;

-- 3. Update process_waitlist to handle both INDIVIDUAL and TEAM waitlists with strict registration_mode check
CREATE OR REPLACE FUNCTION public.process_waitlist(p_event_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_promoted_ids UUID[] := ARRAY[]::UUID[];
  v_team RECORD;
  v_individual RECORD;
  v_member_ids UUID[];
  v_capacity_left INT;
  v_event events;
  v_active_participants INT;
  v_team_size INT;
BEGIN
  -- Re-read event capacity to ensure we don't violate bounds
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.deleted_at IS NOT NULL OR v_event.state != 'PUBLISHED' OR v_event.registration_mode = 'NOT_REQUIRED' THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  IF v_event.registration_type = 'INDIVIDUAL' THEN
    LOOP
      -- Calculate capacity left
      IF v_event.max_capacity IS NULL THEN
        v_capacity_left := 999999;
      ELSE
        v_capacity_left := v_event.max_capacity - v_event.registration_count;
      END IF;

      IF v_capacity_left <= 0 THEN
        EXIT;
      END IF;

      -- Find the oldest waitlisted individual
      SELECT er.id, er.user_id
      INTO v_individual
      FROM event_registrations er
      WHERE er.event_id = p_event_id 
        AND er.registration_status = 'WAITLISTED'
        AND er.deleted_at IS NULL
        AND er.team_id IS NULL
      ORDER BY er.registered_at ASC, er.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF NOT FOUND THEN
        EXIT;
      END IF;

      -- Promote the individual
      UPDATE event_registrations 
      SET 
        registration_status = 'REGISTERED', 
        eligibility_scope_snapshot = v_event.audience, 
        academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END 
      WHERE id = v_individual.id;
      
      v_promoted_ids := array_append(v_promoted_ids, v_individual.user_id);
      
      -- Update event registration count locally
      v_event.registration_count := v_event.registration_count + 1;
      UPDATE events SET registration_count = v_event.registration_count WHERE id = p_event_id;
    END LOOP;

  ELSIF v_event.registration_type = 'TEAM' THEN
    LOOP
      -- Calculate capacity left (1 team = 1 slot)
      IF v_event.max_capacity IS NULL THEN
        v_capacity_left := 999999;
      ELSE
        v_capacity_left := v_event.max_capacity - v_event.registration_count;
      END IF;

      IF v_capacity_left <= 0 THEN
        EXIT;
      END IF;

      -- Find the oldest waitlisted team
      SELECT t.id
      INTO v_team
      FROM teams t
      WHERE t.event_id = p_event_id 
        AND t.status = 'WAITLISTED'
        AND t.deleted_at IS NULL
      ORDER BY (
          SELECT min(er.registered_at) FROM event_registrations er 
          WHERE er.team_id = t.id AND er.deleted_at IS NULL
      ) ASC, t.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF NOT FOUND THEN
        EXIT;
      END IF;

      -- ENFORCE: Check max_participants limit before promoting waitlisted team
      IF v_event.max_participants IS NOT NULL THEN
        SELECT count(*) INTO v_active_participants
        FROM event_registrations
        WHERE event_id = p_event_id
          AND deleted_at IS NULL
          AND registration_status = 'REGISTERED';

        SELECT count(*) INTO v_team_size
        FROM event_registrations
        WHERE team_id = v_team.id AND deleted_at IS NULL;

        IF (v_active_participants + v_team_size) > v_event.max_participants THEN
          -- Promoting this team would exceed the max_participants cap; stop promoting (strict FIFO, head-of-line blocking)
          EXIT;
        END IF;
      END IF;

      -- Promote the team (1 team consumes 1 capacity slot)
      UPDATE teams SET status = 'REGISTERED' WHERE id = v_team.id;
      
      UPDATE event_registrations 
      SET 
        registration_status = 'REGISTERED', 
        eligibility_scope_snapshot = v_event.audience, 
        academic_batch_id_snapshot = CASE WHEN v_event.audience = 'SPECIFIC_BATCHES' THEN (SELECT batch_id FROM user_academic_profiles WHERE user_id = event_registrations.user_id) ELSE NULL END 
      WHERE team_id = v_team.id AND deleted_at IS NULL;
      
      -- Add team members to promoted list
      SELECT array_agg(user_id) INTO v_member_ids
      FROM event_registrations 
      WHERE team_id = v_team.id AND deleted_at IS NULL;
      
      v_promoted_ids := array_cat(v_promoted_ids, v_member_ids);
      
      -- Update event registration count by +1 team slot
      v_event.registration_count := v_event.registration_count + 1;
      UPDATE events SET registration_count = v_event.registration_count WHERE id = p_event_id;
    END LOOP;
  END IF;
  
  RETURN v_promoted_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.process_waitlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_waitlist(uuid) TO nst_app;

-- 4. Database trigger preventing transition to NOT_REQUIRED when registrations or teams exist
CREATE OR REPLACE FUNCTION public.check_event_registration_mode_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.registration_mode = 'NOT_REQUIRED' AND OLD.registration_mode = 'REQUIRED' THEN
    IF EXISTS (
      SELECT 1 FROM event_registrations 
      WHERE event_id = NEW.id AND deleted_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM teams 
      WHERE event_id = NEW.id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot change registration mode to NOT_REQUIRED when registrations or teams exist'
        USING ERRCODE = 'U0059';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_event_registration_mode_transition ON events;
CREATE TRIGGER trg_check_event_registration_mode_transition
  BEFORE UPDATE OF registration_mode ON events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_event_registration_mode_transition();

-- 5. Reconcile student leaderboard base and materialized view with deterministic classification
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
      WHEN is_student_identity_hidden(u.id) THEN 'Anonymous Student'
      ELSE u.full_name
    END AS display_name,
    COALESCE(SUM(ls.points), 0)::INTEGER AS total_points,
    COALESCE(SUM(CASE WHEN classify_leaderboard_score_category(ls.reason) = 'ATTENDANCE' THEN ls.points ELSE 0 END), 0)::INTEGER AS attendance_points,
    COALESCE(SUM(CASE WHEN classify_leaderboard_score_category(ls.reason) = 'CONTRIBUTION' THEN ls.points ELSE 0 END), 0)::INTEGER AS contribution_points,
    COALESCE(SUM(CASE WHEN classify_leaderboard_score_category(ls.reason) = 'COMPETITION' THEN ls.points ELSE 0 END), 0)::INTEGER AS competition_points,
    now() AS last_refreshed_at
  FROM users u
  LEFT JOIN leaderboard_scores ls ON u.id = ls.user_id
  WHERE u.deleted_at IS NULL
  GROUP BY u.id, u.full_name;
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
