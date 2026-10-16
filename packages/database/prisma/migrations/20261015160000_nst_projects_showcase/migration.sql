-- Migration: 20261015160000_nst_projects_showcase
-- Purpose:
-- 1. Create Enums for NST Projects domain: ProjectType, ProjectStatus, ProjectVisibility, ProjectLinkType, ContributorStatus, ReportReason, ReportStatus, ModerationActionType.
-- 2. Create projects, project_links, project_contributors, project_likes, project_reports, project_moderation_actions, project_slug_history tables.
-- 3. Add foreign keys, unique constraints, and indexes.
-- 4. Enable RLS and create security policies.
-- 5. Grant permissions to nst_app role.

-- =========================================================================
-- 1. Create Enums
-- =========================================================================

CREATE TYPE "ProjectType" AS ENUM (
  'PERSONAL',
  'COURSEWORK',
  'HACKATHON',
  'OPEN_SOURCE',
  'RESEARCH',
  'HARDWARE',
  'DESIGN',
  'CASE_STUDY'
);

CREATE TYPE "ProjectStatus" AS ENUM (
  'IDEA',
  'IN_PROGRESS',
  'PROTOTYPE',
  'LIVE',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TYPE "ProjectVisibility" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'UNPUBLISHED',
  'REMOVED'
);

CREATE TYPE "ProjectLinkType" AS ENUM (
  'DEMO',
  'REPOSITORY',
  'VIDEO',
  'DOCUMENTATION',
  'OTHER'
);

CREATE TYPE "ContributorStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED'
);

CREATE TYPE "ReportReason" AS ENUM (
  'PLAGIARISM',
  'SPAM',
  'ABUSIVE',
  'VOTE_MANIPULATION',
  'MALICIOUS_LINKS',
  'IP_PRIVACY',
  'OTHER'
);

CREATE TYPE "ReportStatus" AS ENUM (
  'PENDING',
  'REVIEWED',
  'RESOLVED',
  'DISMISSED'
);

CREATE TYPE "ModerationActionType" AS ENUM (
  'HIDE',
  'RESTORE',
  'REMOVE',
  'INVALIDATE_LIKES',
  'UPDATE_METADATA'
);

-- =========================================================================
-- 2. Create Tables
-- =========================================================================

CREATE TABLE IF NOT EXISTS "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "problem_statement" TEXT,
    "solution" TEXT,
    "implementation_details" TEXT,
    "personal_contribution" TEXT,
    "whats_next" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "project_type" "ProjectType" NOT NULL DEFAULT 'PERSONAL',
    "development_status" "ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "visibility" "ProjectVisibility" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "cover_image_url" TEXT NOT NULL,
    "gallery_image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_key" ON "projects"("slug");
CREATE INDEX IF NOT EXISTS "projects_owner_id_idx" ON "projects"("owner_id");
CREATE INDEX IF NOT EXISTS "projects_visibility_published_at_idx" ON "projects"("visibility", "published_at");
CREATE INDEX IF NOT EXISTS "projects_category_visibility_idx" ON "projects"("category", "visibility");
CREATE INDEX IF NOT EXISTS "projects_deleted_at_idx" ON "projects"("deleted_at");

CREATE TABLE IF NOT EXISTS "project_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "type" "ProjectLinkType" NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_links_project_id_idx" ON "project_links"("project_id");

CREATE TABLE IF NOT EXISTS "project_contributors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID,
    "invited_email" TEXT,
    "role" TEXT NOT NULL,
    "status" "ContributorStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_contributors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_contributors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_contributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_contributors_project_id_user_id_key" ON "project_contributors"("project_id", "user_id");
CREATE INDEX IF NOT EXISTS "project_contributors_project_id_idx" ON "project_contributors"("project_id");
CREATE INDEX IF NOT EXISTS "project_contributors_user_id_idx" ON "project_contributors"("user_id");
CREATE INDEX IF NOT EXISTS "project_contributors_invited_email_idx" ON "project_contributors"("invited_email");

CREATE TABLE IF NOT EXISTS "project_likes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_likes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_likes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_likes_project_id_user_id_key" ON "project_likes"("project_id", "user_id");
CREATE INDEX IF NOT EXISTS "project_likes_project_id_idx" ON "project_likes"("project_id");
CREATE INDEX IF NOT EXISTS "project_likes_user_id_idx" ON "project_likes"("user_id");

CREATE TABLE IF NOT EXISTS "project_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "reporter_id" UUID,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolution_notes" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "project_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_reports_project_id_idx" ON "project_reports"("project_id");
CREATE INDEX IF NOT EXISTS "project_reports_status_idx" ON "project_reports"("status");

CREATE TABLE IF NOT EXISTS "project_moderation_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_moderation_actions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_moderation_actions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_moderation_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_moderation_actions_project_id_idx" ON "project_moderation_actions"("project_id");
CREATE INDEX IF NOT EXISTS "project_moderation_actions_actor_id_idx" ON "project_moderation_actions"("actor_id");

CREATE TABLE IF NOT EXISTS "project_slug_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_slug_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_slug_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_slug_history_slug_key" ON "project_slug_history"("slug");
CREATE INDEX IF NOT EXISTS "project_slug_history_project_id_idx" ON "project_slug_history"("project_id");

-- =========================================================================
-- 3. Grants for nst_app
-- =========================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "projects" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project_links" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project_contributors" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project_likes" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project_reports" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project_moderation_actions" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project_slug_history" TO nst_app;

-- =========================================================================
-- 4. Enable Row Level Security (RLS)
-- =========================================================================

ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_contributors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_moderation_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_slug_history" ENABLE ROW LEVEL SECURITY;

-- 4a. projects policies
DROP POLICY IF EXISTS "Allow SELECT on projects" ON "projects";
CREATE POLICY "Allow SELECT on projects" ON "projects" FOR SELECT USING (
  (visibility = 'PUBLISHED' AND deleted_at IS NULL)
  OR (current_user_id() IS NOT NULL AND owner_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ))
);

DROP POLICY IF EXISTS "Allow INSERT on projects" ON "projects";
CREATE POLICY "Allow INSERT on projects" ON "projects" FOR INSERT WITH CHECK (
  current_user_id() IS NOT NULL AND owner_id = current_user_id()
);

DROP POLICY IF EXISTS "Allow UPDATE on projects" ON "projects";
CREATE POLICY "Allow UPDATE on projects" ON "projects" FOR UPDATE USING (
  (current_user_id() IS NOT NULL AND owner_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ))
);

DROP POLICY IF EXISTS "Allow DELETE on projects" ON "projects";
CREATE POLICY "Allow DELETE on projects" ON "projects" FOR DELETE USING (
  (current_user_id() IS NOT NULL AND owner_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  ))
);

-- 4b. project_links policies
DROP POLICY IF EXISTS "Allow SELECT on project_links" ON "project_links";
CREATE POLICY "Allow SELECT on project_links" ON "project_links" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_links.project_id AND (
      (p.visibility = 'PUBLISHED' AND p.deleted_at IS NULL)
      OR (current_user_id() IS NOT NULL AND p.owner_id = current_user_id())
      OR (current_user_id() IS NOT NULL AND EXISTS (
        SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      ))
      OR (current_user_id() IS NOT NULL AND EXISTS (
        SELECT 1 FROM project_contributors pc WHERE pc.project_id = p.id AND pc.user_id = current_user_id() AND pc.status = 'ACCEPTED'
      ))
    )
  )
);

DROP POLICY IF EXISTS "Allow ALL on project_links" ON "project_links";
CREATE POLICY "Allow ALL on project_links" ON "project_links" FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_links.project_id AND (
      (current_user_id() IS NOT NULL AND p.owner_id = current_user_id())
      OR (current_user_id() IS NOT NULL AND EXISTS (
        SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
      ))
    )
  )
);

-- 4c. project_contributors policies
DROP POLICY IF EXISTS "Allow SELECT on project_contributors" ON "project_contributors";
CREATE POLICY "Allow SELECT on project_contributors" ON "project_contributors" FOR SELECT USING (
  (status = 'ACCEPTED' AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_contributors.project_id AND p.visibility = 'PUBLISHED' AND p.deleted_at IS NULL))
  OR (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_contributors.project_id AND p.owner_id = current_user_id()))
  OR (current_user_id() IS NOT NULL AND EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')))
);

DROP POLICY IF EXISTS "Allow ALL on project_contributors" ON "project_contributors";
CREATE POLICY "Allow ALL on project_contributors" ON "project_contributors" FOR ALL USING (
  (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR (current_user_id() IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_contributors.project_id AND p.owner_id = current_user_id()))
  OR (current_user_id() IS NOT NULL AND EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')))
);

-- 4d. project_likes policies
DROP POLICY IF EXISTS "Allow SELECT on project_likes" ON "project_likes";
CREATE POLICY "Allow SELECT on project_likes" ON "project_likes" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow INSERT on project_likes" ON "project_likes";
CREATE POLICY "Allow INSERT on project_likes" ON "project_likes" FOR INSERT WITH CHECK (
  current_user_id() IS NOT NULL
  AND user_id = current_user_id()
  AND NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_likes.project_id AND p.owner_id = current_user_id()
  )
);

DROP POLICY IF EXISTS "Allow DELETE on project_likes" ON "project_likes";
CREATE POLICY "Allow DELETE on project_likes" ON "project_likes" FOR DELETE USING (
  current_user_id() IS NOT NULL AND (
    user_id = current_user_id()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  )
);

-- 4e. project_reports policies
DROP POLICY IF EXISTS "Allow SELECT on project_reports" ON "project_reports";
CREATE POLICY "Allow SELECT on project_reports" ON "project_reports" FOR SELECT USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  )
);

DROP POLICY IF EXISTS "Allow INSERT on project_reports" ON "project_reports";
CREATE POLICY "Allow INSERT on project_reports" ON "project_reports" FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow UPDATE on project_reports" ON "project_reports";
CREATE POLICY "Allow UPDATE on project_reports" ON "project_reports" FOR UPDATE USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  )
);

-- 4f. project_moderation_actions policies
DROP POLICY IF EXISTS "Allow SELECT on project_moderation_actions" ON "project_moderation_actions";
CREATE POLICY "Allow SELECT on project_moderation_actions" ON "project_moderation_actions" FOR SELECT USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  )
);

DROP POLICY IF EXISTS "Allow INSERT on project_moderation_actions" ON "project_moderation_actions";
CREATE POLICY "Allow INSERT on project_moderation_actions" ON "project_moderation_actions" FOR INSERT WITH CHECK (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  )
);

-- 4g. project_slug_history policies
DROP POLICY IF EXISTS "Allow SELECT on project_slug_history" ON "project_slug_history";
CREATE POLICY "Allow SELECT on project_slug_history" ON "project_slug_history" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow ALL on project_slug_history" ON "project_slug_history";
CREATE POLICY "Allow ALL on project_slug_history" ON "project_slug_history" FOR ALL USING (
  current_user_id() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_slug_history.project_id AND p.owner_id = current_user_id())
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN'))
  )
);
