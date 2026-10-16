-- Form Studio RLS and Lifecycle Migration
-- 1. AlterTable: Add published_at with default CURRENT_TIMESTAMP and create indexes
ALTER TABLE "event_forms" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "event_forms" ALTER COLUMN "published_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Backfill any existing event_forms where published_at is NULL so they remain visible
UPDATE "event_forms" SET "published_at" = "created_at" WHERE "published_at" IS NULL;

CREATE INDEX IF NOT EXISTS "event_forms_event_id_idx" ON "event_forms"("event_id");
CREATE INDEX IF NOT EXISTS "event_forms_event_id_published_at_idx" ON "event_forms"("event_id", "published_at");
CREATE INDEX IF NOT EXISTS "event_forms_release_at_notified_at_idx" ON "event_forms"("release_at", "notified_at");

-- 2. Grants for application roles
GRANT ALL ON "field_definitions" TO nst_app;
GRANT ALL ON "student_profile_values" TO nst_app;
GRANT ALL ON "event_form_fields" TO nst_app;
GRANT ALL ON "event_forms" TO nst_app;
GRANT ALL ON "event_registration_responses" TO nst_app;

-- 3. Enable Row-Level Security
ALTER TABLE "field_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_profile_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_form_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_registration_responses" ENABLE ROW LEVEL SECURITY;

-- 4. Policies for field_definitions
DROP POLICY IF EXISTS "Allow authenticated users to SELECT field_definitions" ON "field_definitions";
CREATE POLICY "Allow authenticated users to SELECT field_definitions"
  ON "field_definitions" FOR SELECT
  USING (current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "Allow admins and club organizers to INSERT field_definitions" ON "field_definitions";
CREATE POLICY "Allow admins and club organizers to INSERT field_definitions"
  ON "field_definitions" FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (created_by_club_id IS NOT NULL AND has_club_role(created_by_club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']))
  );

DROP POLICY IF EXISTS "Allow admins and club organizers to UPDATE field_definitions" ON "field_definitions";
CREATE POLICY "Allow admins and club organizers to UPDATE field_definitions"
  ON "field_definitions" FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (created_by_club_id IS NOT NULL AND has_club_role(created_by_club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (created_by_club_id IS NOT NULL AND has_club_role(created_by_club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']))
  );

DROP POLICY IF EXISTS "Allow admins and club organizers to DELETE field_definitions" ON "field_definitions";
CREATE POLICY "Allow admins and club organizers to DELETE field_definitions"
  ON "field_definitions" FOR DELETE
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (created_by_club_id IS NOT NULL AND has_club_role(created_by_club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER']))
  );

-- 5. Policies for student_profile_values
DROP POLICY IF EXISTS "Allow students to SELECT own profile values" ON "student_profile_values";
CREATE POLICY "Allow students to SELECT own profile values"
  ON "student_profile_values" FOR SELECT
  USING (
    user_id = current_user_id()
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  );

DROP POLICY IF EXISTS "Allow students to INSERT own profile values" ON "student_profile_values";
CREATE POLICY "Allow students to INSERT own profile values"
  ON "student_profile_values" FOR INSERT
  WITH CHECK (
    user_id = current_user_id()
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  );

DROP POLICY IF EXISTS "Allow students to UPDATE own profile values" ON "student_profile_values";
CREATE POLICY "Allow students to UPDATE own profile values"
  ON "student_profile_values" FOR UPDATE
  USING (
    user_id = current_user_id()
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  )
  WITH CHECK (
    user_id = current_user_id()
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  );

DROP POLICY IF EXISTS "Allow students to DELETE own profile values" ON "student_profile_values";
CREATE POLICY "Allow students to DELETE own profile values"
  ON "student_profile_values" FOR DELETE
  USING (
    user_id = current_user_id()
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
  );

-- 6. Policies for event_forms
DROP POLICY IF EXISTS "Allow SELECT on event_forms" ON "event_forms";
CREATE POLICY "Allow SELECT on event_forms"
  ON "event_forms" FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_forms.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
    ))
    OR
    (
      published_at IS NOT NULL
      AND
      EXISTS (
        SELECT 1 FROM event_registrations er
        WHERE er.event_id = event_forms.event_id
          AND er.user_id = current_user_id()
          AND er.registration_status = 'REGISTERED'
          AND er.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "Allow organizers to INSERT event_forms" ON "event_forms";
CREATE POLICY "Allow organizers to INSERT event_forms"
  ON "event_forms" FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_forms.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    ))
  );

DROP POLICY IF EXISTS "Allow organizers to UPDATE event_forms" ON "event_forms";
CREATE POLICY "Allow organizers to UPDATE event_forms"
  ON "event_forms" FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_forms.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_forms.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    ))
  );

DROP POLICY IF EXISTS "Allow organizers to DELETE event_forms" ON "event_forms";
CREATE POLICY "Allow organizers to DELETE event_forms"
  ON "event_forms" FOR DELETE
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_forms.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    ))
  );

-- 7. Policies for event_form_fields
DROP POLICY IF EXISTS "Allow SELECT on event_form_fields" ON "event_form_fields";
CREATE POLICY "Allow SELECT on event_form_fields"
  ON "event_form_fields" FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_form_fields.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
    ))
    OR
    (
      form_id IS NULL
      AND
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = event_form_fields.event_id
          AND e.state = 'PUBLISHED'
          AND e.visibility = 'PUBLIC'
          AND e.deleted_at IS NULL
          AND (
            e.audience = 'ALL_STUDENTS'
            OR
            EXISTS (
              SELECT 1 FROM event_audience_batches eab
              JOIN user_academic_profiles uap ON uap.batch_id = eab.batch_id
              WHERE eab.event_id = e.id
                AND uap.user_id = current_user_id()
            )
          )
      )
    )
    OR
    (
      form_id IS NOT NULL
      AND
      EXISTS (
        SELECT 1 FROM event_forms ef
        WHERE ef.id = event_form_fields.form_id
          AND ef.event_id = event_form_fields.event_id
          AND ef.published_at IS NOT NULL
          AND (ef.release_at IS NULL OR ef.release_at <= now())
          AND EXISTS (
            SELECT 1 FROM event_registrations er
            WHERE er.event_id = event_form_fields.event_id
              AND er.user_id = current_user_id()
              AND er.registration_status = 'REGISTERED'
              AND er.deleted_at IS NULL
          )
      )
    )
  );

DROP POLICY IF EXISTS "Allow organizers to INSERT event_form_fields" ON "event_form_fields";
CREATE POLICY "Allow organizers to INSERT event_form_fields"
  ON "event_form_fields" FOR INSERT
  WITH CHECK (
    (
      (EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = current_user_id()
          AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      ))
      OR
      (EXISTS (
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = event_form_fields.event_id
          AND ec.is_primary = true
          AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
      ))
    )
    AND
    (
      form_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM event_forms ef
        WHERE ef.id = event_form_fields.form_id
          AND ef.event_id = event_form_fields.event_id
      )
    )
  );

DROP POLICY IF EXISTS "Allow organizers to UPDATE event_form_fields" ON "event_form_fields";
CREATE POLICY "Allow organizers to UPDATE event_form_fields"
  ON "event_form_fields" FOR UPDATE
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_form_fields.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
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
        SELECT 1 FROM event_clubs ec
        WHERE ec.event_id = event_form_fields.event_id
          AND ec.is_primary = true
          AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
      ))
    )
    AND
    (
      form_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM event_forms ef
        WHERE ef.id = event_form_fields.form_id
          AND ef.event_id = event_form_fields.event_id
      )
    )
  );

DROP POLICY IF EXISTS "Allow organizers to DELETE event_form_fields" ON "event_form_fields";
CREATE POLICY "Allow organizers to DELETE event_form_fields"
  ON "event_form_fields" FOR DELETE
  USING (
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_clubs ec
      WHERE ec.event_id = event_form_fields.event_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    ))
  );

-- 8. Policies for event_registration_responses
DROP POLICY IF EXISTS "Allow SELECT on event_registration_responses" ON "event_registration_responses";
CREATE POLICY "Allow SELECT on event_registration_responses"
  ON "event_registration_responses" FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM event_registrations er
      WHERE er.id = event_registration_responses.event_registration_id
        AND er.user_id = current_user_id()
    ))
    OR
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_registrations er
      JOIN event_clubs ec ON ec.event_id = er.event_id
      WHERE er.id = event_registration_responses.event_registration_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'])
    ))
  );

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
          AND er.registration_status = 'REGISTERED'
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
          AND (ef.close_at IS NULL OR ef.close_at >= now())
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
        AND er.registration_status = 'REGISTERED'
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
          AND er.registration_status = 'REGISTERED'
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
          AND (ef.close_at IS NULL OR ef.close_at >= now())
      )
    )
  );

DROP POLICY IF EXISTS "Allow students, organizers, and admins to DELETE event_registra" ON "event_registration_responses";
CREATE POLICY "Allow students, organizers, and admins to DELETE event_registra"
  ON "event_registration_responses" FOR DELETE
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
    ))
    OR
    (EXISTS (
      SELECT 1 FROM event_registrations er
      JOIN event_clubs ec ON ec.event_id = er.event_id
      WHERE er.id = event_registration_responses.event_registration_id
        AND ec.is_primary = true
        AND has_club_role(ec.club_id, current_user_id(), ARRAY['CLUB_ADMIN', 'CORE_MEMBER'])
    ))
  );
