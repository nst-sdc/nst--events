-- Migration: 20261015220000_nst_event_results_and_recognition
-- Purpose:
-- 1. Create enum types for Event Results, Awards, Recipients, Revisions, Achievements, and Reports.
-- 2. Create tables: event_result_sets, event_result_revisions, event_awards, award_recipients,
--    award_recipient_members, award_project_links, result_audit_logs, result_notification_outbox,
--    student_achievements, result_reports.
-- 3. Add CHECK constraints enforcing placement > 0, recipient type exclusivity, and project link validity.
-- 4. Enable Row Level Security (RLS) and grant appropriate policies.

-- 1. Enums
CREATE TYPE "ResultLifecycleState" AS ENUM ('NOT_CONFIGURED', 'DRAFT', 'PUBLISHED', 'WITHDRAWN');
CREATE TYPE "ResultRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'WITHDRAWN');
CREATE TYPE "AwardType" AS ENUM ('RANKED_PLACEMENT', 'SPECIAL_AWARD', 'HONORABLE_MENTION', 'CUSTOM');
CREATE TYPE "AwardRecipientType" AS ENUM ('INDIVIDUAL', 'TEAM', 'EXTERNAL');
CREATE TYPE "TieRankingType" AS ENUM ('COMPETITION', 'DENSE');
CREATE TYPE "ResultReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ResultNotificationType" AS ENUM ('WINNER_NOTIFICATION', 'CORRECTION_NOTIFICATION', 'EVENT_ANNOUNCEMENT');
CREATE TYPE "ResultNotificationStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DEAD_LETTER');

-- 2. Tables

-- event_result_sets
CREATE TABLE "event_result_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "status" "ResultLifecycleState" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "current_draft_revision_id" UUID,
    "active_published_revision_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_result_sets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_result_sets_event_id_key" UNIQUE ("event_id"),
    CONSTRAINT "event_result_sets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- event_result_revisions
CREATE TABLE "event_result_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "result_set_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "status" "ResultRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "correction_reason" TEXT,
    "withdrawn_at" TIMESTAMPTZ(6),
    "withdrawn_by" UUID,
    "withdrawal_reason" TEXT,
    "restored_at" TIMESTAMPTZ(6),
    "restored_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_result_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_result_revisions_result_set_id_revision_number_key" UNIQUE ("result_set_id", "revision_number"),
    CONSTRAINT "event_result_revisions_result_set_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "event_result_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_result_revisions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "event_result_revisions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "event_result_revisions_withdrawn_by_fkey" FOREIGN KEY ("withdrawn_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "event_result_revisions_restored_by_fkey" FOREIGN KEY ("restored_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "event_result_revisions_result_set_id_status_idx" ON "event_result_revisions"("result_set_id", "status");

-- event_awards
CREATE TABLE "event_awards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "revision_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "award_type" "AwardType" NOT NULL DEFAULT 'RANKED_PLACEMENT',
    "placement" INTEGER,
    "description" TEXT,
    "prize_details" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_tied" BOOLEAN NOT NULL DEFAULT false,
    "tie_ranking_type" "TieRankingType",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_awards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_awards_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "event_result_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_awards_placement_positive_check" CHECK ("placement" IS NULL OR "placement" > 0)
);

CREATE INDEX "event_awards_revision_id_display_order_idx" ON "event_awards"("revision_id", "display_order");

-- award_recipients
CREATE TABLE "award_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "award_id" UUID NOT NULL,
    "recipient_type" "AwardRecipientType" NOT NULL,
    "user_id" UUID,
    "registration_id" UUID,
    "team_id" UUID,
    "external_name" TEXT,
    "external_details" TEXT,
    "is_authorized_exception" BOOLEAN NOT NULL DEFAULT false,
    "exception_reason" TEXT,
    "exception_authorized_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_recipients_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "award_recipients_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "event_awards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "award_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "award_recipients_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "award_recipients_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "award_recipients_exception_authorized_by_fkey" FOREIGN KEY ("exception_authorized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "check_recipient_type_consistency" CHECK (
        ("recipient_type" = 'INDIVIDUAL' AND "user_id" IS NOT NULL AND "registration_id" IS NOT NULL AND "team_id" IS NULL AND "external_name" IS NULL) OR
        ("recipient_type" = 'TEAM' AND "team_id" IS NOT NULL AND "user_id" IS NULL AND "registration_id" IS NULL AND "external_name" IS NULL) OR
        ("recipient_type" = 'EXTERNAL' AND "external_name" IS NOT NULL AND "user_id" IS NULL AND "registration_id" IS NULL AND "team_id" IS NULL)
    )
);

CREATE INDEX "award_recipients_award_id_idx" ON "award_recipients"("award_id");
CREATE INDEX "award_recipients_user_id_idx" ON "award_recipients"("user_id");
CREATE INDEX "award_recipients_team_id_idx" ON "award_recipients"("team_id");

-- award_recipient_members
CREATE TABLE "award_recipient_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID NOT NULL,
    "user_id" UUID,
    "registration_id" UUID,
    "display_name_snapshot" TEXT NOT NULL,
    "avatar_url_snapshot" TEXT,
    "roll_number_snapshot" TEXT,
    "team_role_snapshot" TEXT,
    "is_authorized_exception" BOOLEAN NOT NULL DEFAULT false,
    "exception_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_recipient_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "award_recipient_members_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "award_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "award_recipient_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "award_recipient_members_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "award_recipient_members_recipient_id_idx" ON "award_recipient_members"("recipient_id");
CREATE INDEX "award_recipient_members_user_id_idx" ON "award_recipient_members"("user_id");

-- award_project_links
CREATE TABLE "award_project_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "award_id" UUID NOT NULL,
    "project_id" UUID,
    "external_project_url" TEXT,
    "project_title_snapshot" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_project_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "award_project_links_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "event_awards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "award_project_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "check_award_project_link_target" CHECK ("project_id" IS NOT NULL OR "external_project_url" IS NOT NULL)
);

CREATE INDEX "award_project_links_award_id_idx" ON "award_project_links"("award_id");
CREATE INDEX "award_project_links_project_id_idx" ON "award_project_links"("project_id");

-- result_audit_logs
CREATE TABLE "result_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "result_set_id" UUID NOT NULL,
    "revision_id" UUID,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "result_audit_logs_result_set_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "event_result_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "result_audit_logs_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "event_result_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "result_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "result_audit_logs_result_set_id_created_at_idx" ON "result_audit_logs"("result_set_id", "created_at");
CREATE INDEX "result_audit_logs_actor_id_idx" ON "result_audit_logs"("actor_id");

-- result_notification_outbox
CREATE TABLE "result_notification_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "result_set_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "notification_type" "ResultNotificationType" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "delivery_status" "ResultNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 4,
    "last_attempt_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "error_category" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_notification_outbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "result_notification_outbox_idempotency_key_key" UNIQUE ("idempotency_key"),
    CONSTRAINT "result_notification_outbox_result_set_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "event_result_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "result_notification_outbox_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "event_result_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "result_notification_outbox_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "result_notification_outbox_status_attempt_idx" ON "result_notification_outbox"("delivery_status", "attempt_count");
CREATE INDEX "result_notification_outbox_result_set_id_idx" ON "result_notification_outbox"("result_set_id");

-- student_achievements
CREATE TABLE "student_achievements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "result_set_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "award_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "award_title" TEXT NOT NULL,
    "award_type" TEXT NOT NULL,
    "placement" INTEGER,
    "is_team_award" BOOLEAN NOT NULL DEFAULT false,
    "team_id" UUID,
    "team_name_snapshot" TEXT,
    "linked_project_id" UUID,
    "published_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "superseded_by_revision_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_achievements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_achievements_user_award_revision_key" UNIQUE ("user_id", "award_id", "revision_id"),
    CONSTRAINT "student_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_achievements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_achievements_result_set_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "event_result_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_achievements_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "event_result_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_achievements_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "event_awards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_achievements_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "award_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_achievements_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "student_achievements_linked_project_id_fkey" FOREIGN KEY ("linked_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "student_achievements_user_id_is_active_idx" ON "student_achievements"("user_id", "is_active");
CREATE INDEX "student_achievements_event_id_is_active_idx" ON "student_achievements"("event_id", "is_active");

-- result_reports
CREATE TABLE "result_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "result_set_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "reporter_id" UUID,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" "ResultReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolution_notes" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "result_reports_result_set_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "event_result_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "result_reports_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "event_result_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "result_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "result_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "result_reports_result_set_id_status_idx" ON "result_reports"("result_set_id", "status");

-- 3. Row Level Security (RLS) Enablement
ALTER TABLE "event_result_sets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_result_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_awards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "award_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "award_recipient_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "award_project_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "result_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "result_notification_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "result_reports" ENABLE ROW LEVEL SECURITY;

-- 4. Helper function to check if current user is an authorized manager for the event
CREATE OR REPLACE FUNCTION is_event_results_manager(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_role "GlobalRole";
BEGIN
    BEGIN
        v_user_id := NULLIF(current_setting('app.user_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN false;
    END;

    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT global_role INTO v_role FROM users WHERE id = v_user_id;
    IF v_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN') THEN
        RETURN true;
    END IF;

    -- Check if user is primary club admin or core member
    RETURN EXISTS (
        SELECT 1 FROM event_clubs ec
        JOIN club_memberships cm ON cm.club_id = ec.club_id
        WHERE ec.event_id = p_event_id
          AND ec.is_primary = true
          AND cm.user_id = v_user_id
          AND cm.deleted_at IS NULL
          AND cm.role IN ('CLUB_ADMIN', 'CORE_MEMBER')
    );
END;
$$;

REVOKE ALL ON FUNCTION is_event_results_manager(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_event_results_manager(uuid) TO PUBLIC;

-- 5. Helper function to check public visibility of an event
CREATE OR REPLACE FUNCTION is_event_results_publicly_visible(p_event_id uuid)
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

    IF v_state != 'PUBLISHED' THEN
        RETURN false;
    END IF;

    IF v_visibility IN ('PUBLIC', 'UNLISTED') THEN
        RETURN true;
    END IF;

    IF v_visibility = 'RESTRICTED' THEN
        BEGIN
            v_user_id := NULLIF(current_setting('app.user_id', true), '')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_user_id := NULL;
        END;
        -- User must be authenticated institutional user
        RETURN v_user_id IS NOT NULL;
    END IF;

    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION is_event_results_publicly_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_event_results_publicly_visible(uuid) TO PUBLIC;

-- 6. RLS Policies

-- event_result_sets:
CREATE POLICY "event_result_sets_select_policy" ON "event_result_sets"
    FOR SELECT USING (
        is_event_results_publicly_visible(event_id)
        OR is_event_results_manager(event_id)
    );

CREATE POLICY "event_result_sets_insert_policy" ON "event_result_sets"
    FOR INSERT WITH CHECK (
        is_event_results_manager(event_id)
    );

CREATE POLICY "event_result_sets_update_policy" ON "event_result_sets"
    FOR UPDATE USING (
        is_event_results_manager(event_id)
    );

-- event_result_revisions:
CREATE POLICY "event_result_revisions_select_policy" ON "event_result_revisions"
    FOR SELECT USING (
        (status = 'PUBLISHED' AND is_event_results_publicly_visible((SELECT event_id FROM event_result_sets WHERE id = result_set_id)))
        OR is_event_results_manager((SELECT event_id FROM event_result_sets WHERE id = result_set_id))
    );

CREATE POLICY "event_result_revisions_insert_policy" ON "event_result_revisions"
    FOR INSERT WITH CHECK (
        is_event_results_manager((SELECT event_id FROM event_result_sets WHERE id = result_set_id))
    );

CREATE POLICY "event_result_revisions_update_policy" ON "event_result_revisions"
    FOR UPDATE USING (
        is_event_results_manager((SELECT event_id FROM event_result_sets WHERE id = result_set_id))
    );

-- event_awards:
CREATE POLICY "event_awards_select_policy" ON "event_awards"
    FOR SELECT USING (
        (SELECT status FROM event_result_revisions WHERE id = revision_id) = 'PUBLISHED'
        OR is_event_results_manager((
            SELECT ers.event_id FROM event_result_revisions err
            JOIN event_result_sets ers ON ers.id = err.result_set_id
            WHERE err.id = revision_id
        ))
    );

CREATE POLICY "event_awards_all_policy" ON "event_awards"
    FOR ALL USING (
        is_event_results_manager((
            SELECT ers.event_id FROM event_result_revisions err
            JOIN event_result_sets ers ON ers.id = err.result_set_id
            WHERE err.id = revision_id
        ))
    );

-- award_recipients:
CREATE POLICY "award_recipients_select_policy" ON "award_recipients"
    FOR SELECT USING (
        (SELECT err.status FROM event_awards ea JOIN event_result_revisions err ON err.id = ea.revision_id WHERE ea.id = award_id) = 'PUBLISHED'
        OR is_event_results_manager((
            SELECT ers.event_id FROM event_awards ea
            JOIN event_result_revisions err ON err.id = ea.revision_id
            JOIN event_result_sets ers ON ers.id = err.result_set_id
            WHERE ea.id = award_id
        ))
    );

CREATE POLICY "award_recipients_all_policy" ON "award_recipients"
    FOR ALL USING (
        is_event_results_manager((
            SELECT ers.event_id FROM event_awards ea
            JOIN event_result_revisions err ON err.id = ea.revision_id
            JOIN event_result_sets ers ON ers.id = err.result_set_id
            WHERE ea.id = award_id
        ))
    );

-- award_recipient_members:
CREATE POLICY "award_recipient_members_select_policy" ON "award_recipient_members"
    FOR SELECT USING (
        (SELECT err.status FROM award_recipients ar
         JOIN event_awards ea ON ea.id = ar.award_id
         JOIN event_result_revisions err ON err.id = ea.revision_id
         WHERE ar.id = recipient_id) = 'PUBLISHED'
        OR is_event_results_manager((
            SELECT ers.event_id FROM award_recipients ar
            JOIN event_awards ea ON ea.id = ar.award_id
            JOIN event_result_revisions err ON err.id = ea.revision_id
            JOIN event_result_sets ers ON ers.id = err.result_set_id
            WHERE ar.id = recipient_id
        ))
    );

CREATE POLICY "award_recipient_members_all_policy" ON "award_recipient_members"
    FOR ALL USING (
        is_event_results_manager((
            SELECT ers.event_id FROM award_recipients ar
            JOIN event_awards ea ON ea.id = ar.award_id
            JOIN event_result_revisions err ON err.id = ea.revision_id
            JOIN event_result_sets ers ON ers.id = err.result_set_id
            WHERE ar.id = recipient_id
        ))
    );

-- award_project_links:
CREATE POLICY "award_project_links_select_policy" ON "award_project_links"
    FOR SELECT USING (
        (SELECT err.status FROM event_awards ea JOIN event_result_revisions err ON err.id = ea.revision_id WHERE ea.id = award_id) = 'PUBLISHED'
        OR is_event_results_manager((
            SELECT ers.event_id FROM event_awards ea
            JOIN event_result_revisions err ON err.id = ea.revision_id
            JOIN event_result_sets ers ON ers.id = err.result_set_id
            WHERE ea.id = award_id
        ))
    );

CREATE POLICY "award_project_links_all_policy" ON "award_project_links"
    FOR ALL USING (
        is_event_results_manager((
            SELECT ers.event_id FROM event_awards ea
            JOIN event_result_revisions err ON err.id = ea.revision_id
            JOIN event_result_sets ers ON ers.id = err.result_set_id
            WHERE ea.id = award_id
        ))
    );

-- student_achievements:
CREATE POLICY "student_achievements_select_policy" ON "student_achievements"
    FOR SELECT USING (
        (is_active = true AND is_event_results_publicly_visible(event_id))
        OR (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
        OR is_event_results_manager(event_id)
    );

CREATE POLICY "student_achievements_modify_policy" ON "student_achievements"
    FOR ALL USING (
        is_event_results_manager(event_id)
    );

-- result_audit_logs:
-- Append-only for managers; update and delete prohibited
CREATE POLICY "result_audit_logs_select_policy" ON "result_audit_logs"
    FOR SELECT USING (
        is_event_results_manager((SELECT event_id FROM event_result_sets WHERE id = result_set_id))
    );

CREATE POLICY "result_audit_logs_insert_policy" ON "result_audit_logs"
    FOR INSERT WITH CHECK (
        actor_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    );

-- result_notification_outbox:
CREATE POLICY "result_notification_outbox_policy" ON "result_notification_outbox"
    FOR ALL USING (
        is_event_results_manager((SELECT event_id FROM event_result_sets WHERE id = result_set_id))
    );

-- result_reports:
CREATE POLICY "result_reports_insert_policy" ON "result_reports"
    FOR INSERT WITH CHECK (
        reporter_id IS NULL OR reporter_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    );

CREATE POLICY "result_reports_select_policy" ON "result_reports"
    FOR SELECT USING (
        reporter_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        OR is_event_results_manager((SELECT event_id FROM event_result_sets WHERE id = result_set_id))
    );

CREATE POLICY "result_reports_update_policy" ON "result_reports"
    FOR UPDATE USING (
        is_event_results_manager((SELECT event_id FROM event_result_sets WHERE id = result_set_id))
    );
