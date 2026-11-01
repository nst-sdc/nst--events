-- Migration: 20261103000000_tighten_attendance_sessions_rls_and_lifecycle_fixes
-- Purpose:
-- 1. Tighten SELECT policy on attendance_sessions:
--    Ensure restricted event attendance sessions are only visible to:
--    - Authenticated users who are CONFIRMED attendees (registration_status = 'REGISTERED' and deleted_at IS NULL)
--    - Authorized organizers of the event's hosting clubs (is_active_club_member(ec.club_id, current_user_id()))
--    - The event creator (e.created_by = current_user_id())
--    - Platform administrators and faculty administrators (u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
--    Ordinary authenticated students, waitlisted attendees, and members of other clubs receive 0 rows.
-- 2. Audit & Restrict privileges on on_user_student_provision trigger function and related student profile functions:
--    Revoke execute privileges from PUBLIC, nst_app, and nst_worker.
--    Configure default privileges in schema public to prevent re-granting EXECUTE on functions to PUBLIC or nst_worker.
-- 3. Restore event state verification in sync_offline_attendance_v9:
--    Ensure attendance sync rejects non-published events (e.g. CANCELLED, DRAFT, ARCHIVED)
--    with SQLSTATE U0006 ('EVENT_LOCKED') prior to checking registration eligibility.

-- =========================================================================
-- 1. Attendance Sessions SELECT Policy
-- =========================================================================

DROP POLICY IF EXISTS "Allow SELECT on attendance_sessions" ON "attendance_sessions";
CREATE POLICY "Allow SELECT on attendance_sessions" ON "attendance_sessions" FOR SELECT USING (
  current_user_id() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = attendance_sessions.event_id
      AND (
        (e.state IN ('PUBLISHED', 'ARCHIVED', 'CANCELLED') AND e.visibility IN ('PUBLIC', 'UNLISTED'))
        OR (
          e.state IN ('PUBLISHED', 'ARCHIVED', 'CANCELLED')
          AND e.visibility = 'RESTRICTED'
          AND EXISTS (
            SELECT 1 FROM event_registrations er
            WHERE er.event_id = e.id
            AND er.user_id = current_user_id()
            AND er.registration_status = 'REGISTERED'
            AND er.deleted_at IS NULL
          )
        )
        OR EXISTS (
          SELECT 1 FROM event_clubs ec
          WHERE ec.event_id = e.id
          AND is_active_club_member(ec.club_id, current_user_id())
        )
        OR e.created_by = current_user_id()
      )
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
      AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  )
);

-- =========================================================================
-- 2. Revoke Function Privileges on Trigger & Student Profile Functions
-- =========================================================================

REVOKE ALL ON FUNCTION public.on_user_student_provision() FROM PUBLIC, nst_app, nst_worker;
REVOKE EXECUTE ON FUNCTION public.lookup_student_slug_redirect(text) FROM PUBLIC, nst_worker;
REVOKE EXECUTE ON FUNCTION public.lookup_public_student_profile_by_slug(text) FROM PUBLIC, nst_worker;
REVOKE EXECUTE ON FUNCTION public.rotate_student_to_anonymous_slug(uuid) FROM PUBLIC, nst_worker;
REVOKE EXECUTE ON FUNCTION public.provision_student_profile(uuid) FROM PUBLIC, nst_worker;
REVOKE EXECUTE ON FUNCTION public.is_student_slug_taken(text) FROM PUBLIC, nst_worker;

GRANT EXECUTE ON FUNCTION public.lookup_student_slug_redirect(text) TO nst_app;
GRANT EXECUTE ON FUNCTION public.lookup_public_student_profile_by_slug(text) TO nst_app;
GRANT EXECUTE ON FUNCTION public.rotate_student_to_anonymous_slug(uuid) TO nst_app;
GRANT EXECUTE ON FUNCTION public.provision_student_profile(uuid) TO nst_app;
GRANT EXECUTE ON FUNCTION public.is_student_slug_taken(text) TO nst_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM PUBLIC, nst_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, nst_worker;

-- =========================================================================
-- 3. Restore sync_offline_attendance_v9 Event State Verification
-- =========================================================================

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
GRANT EXECUTE ON FUNCTION public.sync_offline_attendance_v9(jsonb) TO nst_app, nst_worker;
