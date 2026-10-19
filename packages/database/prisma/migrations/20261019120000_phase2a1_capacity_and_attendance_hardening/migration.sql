-- Migration: 20261019120000_phase2a1_capacity_and_attendance_hardening
-- Purpose:
--   1. Correct max_participants enforcement in create_team and join_team:
--      - Only count registration_status = 'REGISTERED' against max_participants.
--      - Do NOT count WAITLISTED, CANCELLED, or deleted records against participant capacity.
--      - When max_participants is full, place new teams on the WAITLIST instead of raising an error.
--      - Reject joining already-REGISTERED teams when max_participants is full (U0057).
--      - Permit joining WAITLISTED teams without participant cap rejection.
--   2. Authoritatively track batch_index and precise user_id in sync_offline_attendance_v9 errors.

-- 1. Correct create_team function
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

-- 2. Correct join_team function
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

-- 3. Update sync_offline_attendance_v9 to include batch_index in errors
CREATE OR REPLACE FUNCTION public.sync_offline_attendance_v9(p_payloads jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_actor_id UUID;
  v_event_id UUID;
  v_session_id UUID;
  v_is_locked BOOLEAN;
  v_venue_latitude FLOAT;
  v_venue_longitude FLOAT;
  v_geofence_radius FLOAT;
  v_event_end_time TIMESTAMPTZ;
  v_session_open_at TIMESTAMPTZ;
  v_session_close_at TIMESTAMPTZ;
  v_payload JSONB;
  v_user_id UUID;
  v_scan_timestamp TIMESTAMPTZ;
  v_device_id TEXT;
  v_lat FLOAT;
  v_lng FLOAT;
  v_gps_accuracy FLOAT;
  v_mock_location_detected BOOLEAN;
  v_collision_detected BOOLEAN;
  v_colliding_user_id UUID;
  v_audit_metadata JSONB;
  v_new_record attendance_records;
  v_processed INT := 0;
  v_skipped INT := 0;
  v_errors JSONB := '[]'::jsonb;
  v_signature TEXT;
  v_max_gps_buffer FLOAT := 100.0;
  v_batch_index INT;
  v_record_user_id UUID;
BEGIN
  v_actor_id := current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  FOR v_payload IN SELECT * FROM jsonb_array_elements(p_payloads) ORDER BY (value->>'batch_index')::INT NULLS LAST, value->>'device_id'
  LOOP
    BEGIN
      v_session_id := (v_payload->>'session_id')::UUID;
      v_record_user_id := COALESCE((v_payload->>'user_id')::UUID, v_actor_id);
      v_user_id := v_actor_id; -- MANDATORY FIX: BIND TO CURRENT ACTOR ONLY
      v_scan_timestamp := (v_payload->>'scan_timestamp')::TIMESTAMPTZ;
      v_batch_index := (v_payload->>'batch_index')::INT;

      SELECT s.event_id, e.is_locked, s.geofence_radius, s.venue_latitude, s.venue_longitude, e.end_time, s.open_at, s.close_at
      INTO v_event_id, v_is_locked, v_geofence_radius, v_venue_latitude, v_venue_longitude, v_event_end_time, v_session_open_at, v_session_close_at
      FROM attendance_sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.id = v_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SESSION_CLOSED' USING ERRCODE = 'U0005';
      END IF;

      -- Use scan_timestamp instead of now()
      IF v_is_locked OR v_scan_timestamp >= v_event_end_time + interval '24 hours' THEN
        RAISE EXCEPTION 'EVENT_LOCKED' USING ERRCODE = 'U0006';
      END IF;

      -- ENFORCE: Authoritative session window (with +-30s TOTP drift tolerance matching verifyQrPayload)
      IF (v_session_open_at IS NOT NULL AND v_scan_timestamp < v_session_open_at - interval '30 seconds')
         OR (v_session_close_at IS NOT NULL AND v_scan_timestamp > v_session_close_at + interval '30 seconds') THEN
        RAISE EXCEPTION 'SESSION_CLOSED' USING ERRCODE = 'U0005';
      END IF;

      -- ENFORCE: Reject future timestamps (cannot scan in the future relative to server time)
      IF v_scan_timestamp > now() + interval '5 minutes' THEN
        RAISE EXCEPTION 'INVALID_TIMESTAMP' USING ERRCODE = 'U0010';
      END IF;

      v_device_id := v_payload->>'device_id';
      v_lat := (v_payload->>'gps_lat')::FLOAT;
      v_lng := (v_payload->>'gps_lng')::FLOAT;
      v_gps_accuracy := (v_payload->>'gps_accuracy')::FLOAT;
      v_mock_location_detected := (v_payload->>'mock_location_detected')::BOOLEAN;
      v_signature := v_payload->>'scanned_token';

      -- GEOLOCATION INTEGRITY HARDENING --
      IF v_lat IS NULL OR v_lng IS NULL THEN
        RAISE EXCEPTION 'LOCATION_UNAVAILABLE' USING ERRCODE = 'U0009';
      END IF;

      IF (v_lat >= -90 AND v_lat <= 90 AND v_lng >= -180 AND v_lng <= 180) IS NOT TRUE THEN
        RAISE EXCEPTION 'INVALID_LOCATION' USING ERRCODE = 'U0010';
      END IF;

      IF v_gps_accuracy IS NULL OR (v_gps_accuracy >= 0 AND v_gps_accuracy <= 100) IS NOT TRUE THEN
        RAISE EXCEPTION 'LOCATION_UNRELIABLE' USING ERRCODE = 'U0011';
      END IF;

      IF v_mock_location_detected = true THEN
        RAISE EXCEPTION 'MOCK_LOCATION_REJECTED' USING ERRCODE = 'U0008';
      END IF;

      IF v_venue_latitude IS NOT NULL AND v_venue_longitude IS NOT NULL THEN
        IF NOT ST_DWithin(ST_SetSRID(ST_MakePoint(v_venue_longitude, v_venue_latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography, v_geofence_radius + LEAST(v_gps_accuracy, v_max_gps_buffer)) THEN
          RAISE EXCEPTION 'OUTSIDE_GEOFENCE' USING ERRCODE = 'U0007';
        END IF;
      END IF;

      PERFORM check_attendance_eligibility(v_event_id, v_user_id);

      PERFORM pg_advisory_xact_lock(hashtext(v_session_id::text), hashtext(v_device_id));

      v_collision_detected := false;
      SELECT user_id INTO v_colliding_user_id
      FROM attendance_records
      WHERE session_id = v_session_id 
        AND audit_metadata->>'device_id' = v_device_id
        AND user_id != v_user_id
      LIMIT 1;

      IF FOUND THEN
        v_collision_detected := true;
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, ip_address, created_at)
        VALUES (
          v_user_id, 
          'ATTENDANCE_DEVICE_COLLISION', 
          'attendance_session', 
          v_session_id, 
          jsonb_build_object(
            'flagged_user_id', v_user_id,
            'colliding_user_id', v_colliding_user_id,
            'device_id', v_device_id,
            'offline_sync', true
          ), 
          NULL, 
          now()
        );
      END IF;

      v_audit_metadata := jsonb_build_object(
        'device_id', v_device_id,
        'gps_accuracy', v_gps_accuracy,
        'mock_location_detected', v_mock_location_detected,
        'offline_sync', true,
        'offline_seq', (v_payload->>'offline_seq')::INT,
        'batch_index', v_batch_index
      );

      IF v_collision_detected THEN
        v_audit_metadata := jsonb_set(v_audit_metadata, '{device_collision_detected}', 'true'::jsonb);
      END IF;

      INSERT INTO public.attendance_records (
        session_id, user_id, marked_by, marked_at, method, status, audit_metadata
      ) VALUES (
        v_session_id, v_user_id, v_actor_id, v_scan_timestamp, 'QR', 'PRESENT', v_audit_metadata
      )
      ON CONFLICT (session_id, user_id) DO NOTHING
      RETURNING * INTO v_new_record;

      IF FOUND THEN
        IF NOT v_collision_detected THEN
          INSERT INTO public.leaderboard_scores (
            id, user_id, club_id, points, reason, source_id, created_at
          ) VALUES (
            gen_random_uuid(), v_user_id, NULL, 5, 'ATTENDANCE', v_new_record.id, now()
          );
        END IF;
        v_processed := v_processed + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'user_id', v_record_user_id,
        'session_id', v_session_id,
        'offline_seq', (v_payload->>'offline_seq')::INT,
        'batch_index', (v_payload->>'batch_index')::INT,
        'error_code', SQLSTATE
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_offline_attendance_v9(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_offline_attendance_v9(jsonb) TO nst_app;

-- 4. SECURITY DEFINER participant count helper functions to bypass RLS for aggregate attendee metrics
CREATE OR REPLACE FUNCTION public.get_event_participant_count(p_event_id uuid)
 RETURNS int
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT COUNT(*)::int
  FROM event_registrations
  WHERE event_id = p_event_id
    AND deleted_at IS NULL
    AND registration_status = 'REGISTERED';
$$;

REVOKE ALL ON FUNCTION public.get_event_participant_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_participant_count(uuid) TO nst_app;

CREATE OR REPLACE FUNCTION public.get_events_participant_counts(p_event_ids uuid[])
 RETURNS TABLE(event_id uuid, participant_count int)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT event_id, COUNT(*)::int as participant_count
  FROM event_registrations
  WHERE event_id = ANY(p_event_ids)
    AND deleted_at IS NULL
    AND registration_status = 'REGISTERED'
  GROUP BY event_id;
$$;

REVOKE ALL ON FUNCTION public.get_events_participant_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_events_participant_counts(uuid[]) TO nst_app;

