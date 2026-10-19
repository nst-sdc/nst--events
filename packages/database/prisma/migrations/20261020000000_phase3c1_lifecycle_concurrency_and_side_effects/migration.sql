-- Phase 3C.1: Event Lifecycle Concurrency, Authorization, and Side-Effect Verification

-- 1. Create delete_event stored procedure with exclusive row locking and dependency check
CREATE OR REPLACE FUNCTION public.delete_event(p_event_id UUID)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id UUID := current_user_id();
  v_event events;
  v_reg_count INT;
  v_team_count INT;
  v_att_count INT;
  v_result_count INT;
  v_is_global_admin BOOLEAN := false;
  v_is_club_admin BOOLEAN := false;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'U0001';
  END IF;

  -- Exclusively lock the event row
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'U0032';
  END IF;

  -- Verify caller has CLUB_ADMIN role on primary club or is PLATFORM_ADMIN / FACULTY_ADMIN
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

  IF v_event.state != 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot delete a non-draft event. Published or past events must be cancelled or archived instead.' USING ERRCODE = 'U0043';
  END IF;

  -- Verify active dependent records while holding the row lock
  SELECT count(*) INTO v_reg_count FROM event_registrations WHERE event_id = p_event_id AND deleted_at IS NULL;
  SELECT count(*) INTO v_team_count FROM teams WHERE event_id = p_event_id AND deleted_at IS NULL;
  SELECT count(*) INTO v_att_count FROM attendance_sessions WHERE event_id = p_event_id AND deleted_at IS NULL;
  SELECT count(*) INTO v_result_count FROM event_results WHERE event_id = p_event_id;

  IF v_event.registration_count > 0 OR v_reg_count > 0 OR v_team_count > 0 OR v_att_count > 0 OR v_result_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete an event with existing registrations or historical records.' USING ERRCODE = 'U0058';
  END IF;

  UPDATE events SET deleted_at = now() WHERE id = p_event_id RETURNING * INTO v_event;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, previous_state, new_state, created_at)
  VALUES (
    v_caller_id, 'EVENT_DELETE', 'events', p_event_id,
    jsonb_build_object('state', 'DRAFT', 'deleted_at', null),
    jsonb_build_object('state', 'DRAFT', 'deleted_at', v_event.deleted_at),
    now()
  );

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_event(uuid) TO nst_app;


-- 2. Harden cancel_event with FOR UPDATE row locking
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

  -- Lock row exclusively
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.deleted_at IS NOT NULL THEN
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


-- 3. Harden archive_event with FOR UPDATE row locking
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

  -- Lock row exclusively
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.deleted_at IS NOT NULL THEN
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


-- 4. Harden register_event with FOR UPDATE row locking and deleted_at check
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
    WHERE event_id = p_event_id AND user_id = v_user_id AND deleted_at IS NULL AND registration_status != 'CANCELLED'
  ) THEN
    RAISE EXCEPTION 'Already registered for this event' USING ERRCODE = 'U0020';
  END IF;

  IF v_event.max_capacity IS NULL OR v_event.registration_count < v_event.max_capacity THEN
    UPDATE events 
    SET registration_count = registration_count + 1 
    WHERE id = p_event_id;

    INSERT INTO event_registrations (id, event_id, user_id, registration_status, registered_at)
    VALUES (gen_random_uuid(), p_event_id, v_user_id, 'REGISTERED', now())
    RETURNING * INTO v_reg;
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'REGISTERED');
  ELSE
    -- Waitlist assignment (capacity full)
    INSERT INTO event_registrations (id, event_id, user_id, registration_status, registered_at)
    VALUES (gen_random_uuid(), p_event_id, v_user_id, 'WAITLISTED', now())
    RETURNING * INTO v_reg;
    
    RETURN json_build_object('registration_id', v_reg.id, 'status', 'WAITLISTED');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.register_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_event(uuid) TO nst_app;


-- 5. Harden process_waitlist to ensure waitlist promotion never occurs on non-published or deleted events
CREATE OR REPLACE FUNCTION public.process_waitlist(p_event_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_promoted_ids UUID[] := ARRAY[]::UUID[];
  v_team RECORD;
  v_member_ids UUID[];
  v_capacity_left INT;
  v_event events;
BEGIN
  -- Re-read event capacity to ensure we don't violate bounds
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.deleted_at IS NOT NULL OR v_event.state != 'PUBLISHED' THEN
    RETURN ARRAY[]::UUID[];
  END IF;

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

    -- Find the oldest waitlisted team
    SELECT t.id, (
        SELECT count(*) FROM event_registrations er 
        WHERE er.team_id = t.id AND er.deleted_at IS NULL
    ) as member_count
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

    -- Does this entire team fit?
    IF v_team.member_count <= v_capacity_left THEN
      -- Promote the team
      UPDATE teams SET status = 'REGISTERED' WHERE id = v_team.id;
      
      UPDATE event_registrations 
      SET registration_status = 'REGISTERED' 
      WHERE team_id = v_team.id AND deleted_at IS NULL;
      
      -- Add team members to promoted list
      SELECT array_agg(user_id) INTO v_member_ids
      FROM event_registrations 
      WHERE team_id = v_team.id AND deleted_at IS NULL;
      
      v_promoted_ids := array_cat(v_promoted_ids, v_member_ids);
      
      -- Update event registration count locally
      v_event.registration_count := v_event.registration_count + v_team.member_count;
      UPDATE events SET registration_count = v_event.registration_count WHERE id = p_event_id;
    ELSE
      -- Team does not fit, we stop promoting (no partial, no leapfrogging)
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_promoted_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.process_waitlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_waitlist(uuid) TO nst_app;


-- 6. Harden submit_attendance_dispute to reject disputes on non-published/cancelled events
CREATE OR REPLACE FUNCTION public.submit_attendance_dispute(
  p_session_id UUID,
  p_reason TEXT,
  p_evidence_urls TEXT[] DEFAULT NULL
)
RETURNS attendance_disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_event_end_time TIMESTAMPTZ;
  v_event_state text;
  v_dispute_window_expires_at TIMESTAMPTZ;
  v_new_dispute attendance_disputes;
  v_existing_status "AttendanceStatus";
BEGIN
  v_user_id := current_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'U0001';
  END IF;

  SELECT e.id, e.end_time, e.state
  INTO v_event_id, v_event_end_time, v_event_state
  FROM attendance_sessions s
  JOIN events e ON s.event_id = e.id
  WHERE s.id = p_session_id AND s.deleted_at IS NULL AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_CLOSED' USING ERRCODE = 'U0049';
  END IF;

  IF v_event_state != 'PUBLISHED' THEN
    RAISE EXCEPTION 'EVENT_LOCKED' USING ERRCODE = 'U0006';
  END IF;

  -- Check Attendance Eligibility
  PERFORM check_attendance_eligibility(v_event_id, v_user_id);

  -- Prevent disputes if already marked PRESENT or EXCUSED
  SELECT status INTO v_existing_status
  FROM attendance_records
  WHERE session_id = p_session_id AND user_id = v_user_id;

  IF FOUND AND v_existing_status IN ('PRESENT', 'EXCUSED') THEN
    RAISE EXCEPTION 'ATTENDANCE_ALREADY_RECORDED' USING ERRCODE = 'U0054';
  END IF;

  v_dispute_window_expires_at := v_event_end_time + INTERVAL '24 hours';

  IF now() > v_dispute_window_expires_at THEN
    RAISE EXCEPTION 'DISPUTE_WINDOW_EXPIRED' USING ERRCODE = 'U0048';
  END IF;

  INSERT INTO attendance_disputes (
    id, session_id, event_id, user_id, reason, evidence_urls, status, dispute_window_expires_at, created_at
  ) VALUES (
    gen_random_uuid(), p_session_id, v_event_id, v_user_id, p_reason, p_evidence_urls, 'PENDING', v_dispute_window_expires_at, now()
  )
  RETURNING * INTO v_new_dispute;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_state, created_at)
  VALUES (
    v_user_id, 'DISPUTE_SUBMIT', 'attendance_disputes', v_new_dispute.id, row_to_json(v_new_dispute)::jsonb, now()
  );

  RETURN v_new_dispute;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_attendance_dispute(uuid, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_attendance_dispute(uuid, text, text[]) TO nst_app;


-- 7. Update RLS policy on attendance_sessions to allow CANCELLED events for historical/audit view
DROP POLICY IF EXISTS "Allow SELECT on attendance_sessions" ON "attendance_sessions";
CREATE POLICY "Allow SELECT on attendance_sessions" ON "attendance_sessions" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = attendance_sessions.event_id
    AND (
      (e.state IN ('PUBLISHED', 'ARCHIVED', 'CANCELLED') AND e.visibility IN ('PUBLIC', 'UNLISTED'))
      OR (
        current_user_id() IS NOT NULL AND (
          (e.state IN ('PUBLISHED', 'ARCHIVED', 'CANCELLED') AND e.visibility = 'RESTRICTED')
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
