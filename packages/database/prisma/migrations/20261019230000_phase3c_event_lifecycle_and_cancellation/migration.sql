-- Phase 3C: Event Lifecycle Integrity, Cancellation, Archival, and Historical Data Preservation
-- 1. Create cancel_event stored procedure
CREATE OR REPLACE FUNCTION public.cancel_event(
  p_event_id UUID,
  p_reason TEXT
)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
  v_is_global_admin BOOLEAN := false;
  v_is_club_admin BOOLEAN := false;
  v_old_state "EventState";
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  -- Role check: PLATFORM_ADMIN, FACULTY_ADMIN or primary club CLUB_ADMIN
  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, v_caller_id, ARRAY['CLUB_ADMIN'])
  ) INTO v_is_club_admin;

  IF NOT v_is_global_admin AND NOT v_is_club_admin THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  -- Idempotency: if already CANCELLED, return immediately
  IF v_event.state = 'CANCELLED' THEN
    RETURN v_event;
  END IF;

  IF v_event.state = 'DRAFT' THEN
    RAISE EXCEPTION 'Draft events cannot be cancelled; delete the draft instead' USING ERRCODE = 'U0043';
  END IF;

  IF v_event.state = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Archived events cannot be cancelled' USING ERRCODE = 'U0044';
  END IF;

  v_old_state := v_event.state;

  UPDATE events
  SET state = 'CANCELLED',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'cancellation_reason', p_reason,
        'cancelled_by', v_caller_id,
        'cancelled_at', now()
      ),
      updated_at = now()
  WHERE id = p_event_id AND state IN ('PUBLISHED', 'PENDING_APPROVAL')
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    SELECT * INTO v_event FROM events WHERE id = p_event_id;
    IF v_event.state = 'CANCELLED' THEN
      RETURN v_event;
    END IF;
    RAISE EXCEPTION 'Race condition: Event state changed during transaction' USING ERRCODE = 'U0045';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (
    v_caller_id,
    'EVENT_CANCELLED',
    'event',
    p_event_id,
    jsonb_build_object('state', v_old_state),
    jsonb_build_object('state', 'CANCELLED', 'cancellation_reason', p_reason),
    now()
  );

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_event(uuid, text) TO nst_app;

-- 2. Create archive_event stored procedure
CREATE OR REPLACE FUNCTION public.archive_event(
  p_event_id UUID
)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_event events;
  v_caller_id UUID := current_user_id();
  v_is_global_admin BOOLEAN := false;
  v_is_club_admin BOOLEAN := false;
  v_old_state "EventState";
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  -- Role check: PLATFORM_ADMIN, FACULTY_ADMIN or primary club CLUB_ADMIN
  SELECT EXISTS (
    SELECT 1 FROM users u WHERE u.id = v_caller_id AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ) INTO v_is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM event_clubs ec
    WHERE ec.event_id = p_event_id
      AND ec.is_primary = true
      AND has_club_role(ec.club_id, v_caller_id, ARRAY['CLUB_ADMIN'])
  ) INTO v_is_club_admin;

  IF NOT v_is_global_admin AND NOT v_is_club_admin THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  -- Idempotency: if already ARCHIVED, return immediately
  IF v_event.state = 'ARCHIVED' THEN
    RETURN v_event;
  END IF;

  IF v_event.state IN ('DRAFT', 'PENDING_APPROVAL') THEN
    RAISE EXCEPTION 'Only completed or cancelled events can be archived' USING ERRCODE = 'U0043';
  END IF;

  IF v_event.state = 'PUBLISHED' AND now() < v_event.end_time THEN
    RAISE EXCEPTION 'Cannot archive an event before its scheduled end time' USING ERRCODE = 'U0046';
  END IF;

  v_old_state := v_event.state;

  UPDATE events
  SET state = 'ARCHIVED',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'archived_by', v_caller_id,
        'archived_at', now()
      ),
      updated_at = now()
  WHERE id = p_event_id AND (state = 'CANCELLED' OR (state = 'PUBLISHED' AND end_time <= now()))
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    SELECT * INTO v_event FROM events WHERE id = p_event_id;
    IF v_event.state = 'ARCHIVED' THEN
      RETURN v_event;
    END IF;
    RAISE EXCEPTION 'Race condition: Event state changed during transaction' USING ERRCODE = 'U0045';
  END IF;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (
    v_caller_id,
    'EVENT_ARCHIVED',
    'event',
    p_event_id,
    jsonb_build_object('state', v_old_state),
    jsonb_build_object('state', 'ARCHIVED'),
    now()
  );

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_event(uuid) TO nst_app;

-- 3. Update sync_offline_attendance_v9 with event state check
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
  v_event_state text;
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

      SELECT s.event_id, e.is_locked, s.geofence_radius, s.venue_latitude, s.venue_longitude, e.end_time, s.open_at, s.close_at, e.state
      INTO v_event_id, v_is_locked, v_geofence_radius, v_venue_latitude, v_venue_longitude, v_event_end_time, v_session_open_at, v_session_close_at, v_event_state
      FROM attendance_sessions s
      JOIN events e ON s.event_id = e.id
      WHERE s.id = v_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SESSION_CLOSED' USING ERRCODE = 'U0005';
      END IF;

      -- Attendance only permitted for PUBLISHED events that are unlocked and within 24h of end_time
      IF v_event_state != 'PUBLISHED' OR v_is_locked OR v_scan_timestamp >= v_event_end_time + interval '24 hours' THEN
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

-- 4. Update is_event_results_publicly_visible to allow ARCHIVED events
CREATE OR REPLACE FUNCTION public.is_event_results_publicly_visible(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_state "EventState";
    v_visibility "EventVisibility";
    v_user_id uuid;
BEGIN
    SELECT state, visibility INTO v_state, v_visibility
    FROM events WHERE id = p_event_id;

    IF v_state NOT IN ('PUBLISHED', 'ARCHIVED') THEN
        RETURN false;
    END IF;

    IF v_visibility IN ('PUBLIC', 'UNLISTED') THEN
        RETURN true;
    END IF;

    IF v_visibility = 'RESTRICTED' THEN
        BEGIN
            v_user_id := NULLIF(current_setting('app.user_id', true), '')::uuid;
        EXCEPTION WHEN OTHERS THEN
            RETURN false;
        END;

        IF v_user_id IS NOT NULL THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_event_results_publicly_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_results_publicly_visible(uuid) TO PUBLIC;

-- 5. Update RLS on events to allow public reading of PUBLISHED, ARCHIVED, and CANCELLED events
DROP POLICY IF EXISTS "Allow SELECT on events" ON "events";
CREATE POLICY "Allow SELECT on events" ON "events" FOR SELECT USING (
  ("state" IN ('PUBLISHED', 'ARCHIVED', 'CANCELLED') AND "visibility" IN ('PUBLIC', 'UNLISTED')) OR
  (current_user_id() IS NOT NULL AND (
    ("state" IN ('PUBLISHED', 'ARCHIVED', 'CANCELLED') AND "visibility" = 'RESTRICTED') OR
    "created_by" = current_user_id() OR
    EXISTS (
      SELECT 1 FROM event_clubs ec 
      WHERE ec.event_id = events.id AND is_active_club_member(ec.club_id, current_user_id())
    ) OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  ))
);

-- 6. Update RLS on attendance_sessions to allow sessions of ARCHIVED events
DROP POLICY IF EXISTS "Allow SELECT on attendance_sessions" ON "attendance_sessions";
CREATE POLICY "Allow SELECT on attendance_sessions" ON "attendance_sessions" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = attendance_sessions.event_id
    AND (
      (e.state IN ('PUBLISHED', 'ARCHIVED') AND e.visibility IN ('PUBLIC', 'UNLISTED'))
      OR (
        current_user_id() IS NOT NULL AND (
          (e.state IN ('PUBLISHED', 'ARCHIVED') AND e.visibility = 'RESTRICTED')
          OR EXISTS (
            SELECT 1 FROM event_clubs ec
            WHERE ec.event_id = e.id
            AND is_active_club_member(ec.club_id, current_user_id())
          )
        )
      )
    )
  )
);
