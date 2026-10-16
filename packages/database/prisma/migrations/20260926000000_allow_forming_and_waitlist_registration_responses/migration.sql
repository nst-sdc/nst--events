-- Allow registration responses for REGISTERED and WAITLISTED registrations (team forming and waitlist)
DROP POLICY IF EXISTS "Allow students and admins to INSERT event_registration_response" ON "event_registration_responses";
CREATE POLICY "Allow students and admins to INSERT event_registration_response"
  ON "event_registration_responses" FOR INSERT
  WITH CHECK (
    (
      (EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = current_user_id()
          AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      ))
      OR
      (EXISTS (
        SELECT 1 FROM event_registrations er
        WHERE er.id = event_registration_responses.event_registration_id
          AND er.user_id = current_user_id()
          AND (
            (form_id IS NULL AND er.registration_status IN ('REGISTERED', 'WAITLISTED'))
            OR
            (form_id IS NOT NULL AND er.registration_status = 'REGISTERED')
          )
          AND er.deleted_at IS NULL
      ))
    )
    AND
    (
      form_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM event_forms ef
        JOIN event_registrations er ON er.event_id = ef.event_id
        WHERE ef.id = event_registration_responses.form_id
          AND er.id = event_registration_responses.event_registration_id
          AND ef.published_at IS NOT NULL
          AND (ef.release_at IS NULL OR ef.release_at <= now())
          AND (ef.close_at IS NULL OR ef.close_at > now())
      )
    )
  );

DROP POLICY IF EXISTS "Allow students and admins to UPDATE event_registration_response" ON "event_registration_responses";
CREATE POLICY "Allow students and admins to UPDATE event_registration_response"
  ON "event_registration_responses" FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_registrations er
      WHERE er.id = event_registration_responses.event_registration_id
        AND er.user_id = current_user_id()
        AND (
          (form_id IS NULL AND er.registration_status IN ('REGISTERED', 'WAITLISTED'))
          OR
          (form_id IS NOT NULL AND er.registration_status = 'REGISTERED')
        )
        AND er.deleted_at IS NULL
    ))
  )
  WITH CHECK (
    (
      (EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = current_user_id()
          AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      ))
      OR
      (EXISTS (
        SELECT 1 FROM event_registrations er
        WHERE er.id = event_registration_responses.event_registration_id
          AND er.user_id = current_user_id()
          AND (
            (form_id IS NULL AND er.registration_status IN ('REGISTERED', 'WAITLISTED'))
            OR
            (form_id IS NOT NULL AND er.registration_status = 'REGISTERED')
          )
          AND er.deleted_at IS NULL
      ))
    )
    AND
    (
      form_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM event_forms ef
        JOIN event_registrations er ON er.event_id = ef.event_id
        WHERE ef.id = event_registration_responses.form_id
          AND er.id = event_registration_responses.event_registration_id
          AND ef.published_at IS NOT NULL
          AND (ef.release_at IS NULL OR ef.release_at <= now())
          AND (ef.close_at IS NULL OR ef.close_at > now())
      )
    )
  );
