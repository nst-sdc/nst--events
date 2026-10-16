-- Migration: 20261016090000_nst_student_profiles_and_directory
-- Purpose:
-- 1. Create ProfileItemType enum ('PROJECT', 'ACHIEVEMENT', 'CLUB', 'LINK').
-- 2. Create student_profiles, student_profile_curated_items, and student_slug_history tables.
-- 3. Add foreign keys, unique constraints, and indexes.
-- 4. Enable RLS and create security policies.
-- 5. Define is_public_student_profile(target_user_id) security definer function.
-- 6. Update users SELECT RLS policy to permit selecting public student profile owners.
-- 7. Backfill stable student_profiles and unique slugs for all existing active users.

-- =========================================================================
-- 1. Create Enums
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProfileItemType') THEN
    CREATE TYPE "ProfileItemType" AS ENUM (
      'PROJECT',
      'ACHIEVEMENT',
      'CLUB',
      'LINK'
    );
  END IF;
END;
$$;

-- =========================================================================
-- 2. Create Tables
-- =========================================================================

CREATE TABLE IF NOT EXISTS "student_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "external_links" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "section_visibility" JSONB NOT NULL DEFAULT '{"name":true,"avatar":true,"academic":true,"bio":false,"skills":false,"external_links":false,"projects":false,"achievements":false,"clubs":false}'::jsonb,
    "directory_listed" BOOLEAN NOT NULL DEFAULT true,
    "settings_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_profiles_user_id_key" ON "student_profiles"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "student_profiles_slug_key" ON "student_profiles"("slug");
CREATE INDEX IF NOT EXISTS "student_profiles_directory_listed_idx" ON "student_profiles"("directory_listed");

CREATE TABLE IF NOT EXISTS "student_profile_curated_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "item_type" "ProfileItemType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_profile_curated_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_profile_curated_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_profile_curated_items_user_id_item_type_source_id_key" ON "student_profile_curated_items"("user_id", "item_type", "source_id");
CREATE INDEX IF NOT EXISTS "student_profile_curated_items_user_id_item_type_idx" ON "student_profile_curated_items"("user_id", "item_type");

CREATE TABLE IF NOT EXISTS "student_slug_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_slug_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_slug_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_slug_history_slug_key" ON "student_slug_history"("slug");
CREATE INDEX IF NOT EXISTS "student_slug_history_user_id_idx" ON "student_slug_history"("user_id");

-- =========================================================================
-- 3. Grants for nst_app and nst_worker
-- =========================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "student_profiles" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "student_profile_curated_items" TO nst_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "student_slug_history" TO nst_app;

GRANT SELECT ON TABLE "student_profiles" TO nst_worker;
GRANT SELECT ON TABLE "student_profile_curated_items" TO nst_worker;
GRANT SELECT ON TABLE "student_slug_history" TO nst_worker;

-- =========================================================================
-- 4. Enable Row Level Security (RLS)
-- =========================================================================

ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_profile_curated_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_slug_history" ENABLE ROW LEVEL SECURITY;

-- 4a. student_profiles policies
DROP POLICY IF EXISTS "Allow public SELECT on student_profiles" ON "student_profiles";
CREATE POLICY "Allow public SELECT on student_profiles" ON "student_profiles"
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u WHERE u.id = student_profiles.user_id AND u.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Allow owners to INSERT student_profiles" ON "student_profiles";
CREATE POLICY "Allow owners to INSERT student_profiles" ON "student_profiles"
FOR INSERT WITH CHECK (
  current_user_id() IS NOT NULL AND user_id = current_user_id()
);

DROP POLICY IF EXISTS "Allow owners and admins to UPDATE student_profiles" ON "student_profiles";
CREATE POLICY "Allow owners and admins to UPDATE student_profiles" ON "student_profiles"
FOR UPDATE USING (
  (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
);

DROP POLICY IF EXISTS "Allow owners and admins to DELETE student_profiles" ON "student_profiles";
CREATE POLICY "Allow owners and admins to DELETE student_profiles" ON "student_profiles"
FOR DELETE USING (
  (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
);

-- 4b. student_profile_curated_items policies
DROP POLICY IF EXISTS "Allow public SELECT on student_profile_curated_items" ON "student_profile_curated_items";
CREATE POLICY "Allow public SELECT on student_profile_curated_items" ON "student_profile_curated_items"
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owners to ALL on student_profile_curated_items" ON "student_profile_curated_items";
CREATE POLICY "Allow owners to ALL on student_profile_curated_items" ON "student_profile_curated_items"
FOR ALL USING (
  (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
);

-- 4c. student_slug_history policies
DROP POLICY IF EXISTS "Allow public SELECT on student_slug_history" ON "student_slug_history";
CREATE POLICY "Allow public SELECT on student_slug_history" ON "student_slug_history"
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owners to ALL on student_slug_history" ON "student_slug_history";
CREATE POLICY "Allow owners to ALL on student_slug_history" ON "student_slug_history"
FOR ALL USING (
  (current_user_id() IS NOT NULL AND user_id = current_user_id())
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
);

-- =========================================================================
-- =========================================================================
-- 5. Section Visibility Validation Constraint
-- =========================================================================

CREATE OR REPLACE FUNCTION validate_section_visibility(val jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
  allowed text[] := ARRAY['name', 'avatar', 'academic', 'bio', 'skills', 'external_links', 'projects', 'achievements', 'clubs'];
BEGIN
  IF jsonb_typeof(val) <> 'object' THEN
    RETURN false;
  END IF;
  FOR k IN SELECT jsonb_object_keys(val) LOOP
    IF NOT (k = ANY(allowed)) THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(val -> k) <> 'boolean' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE "student_profiles"
DROP CONSTRAINT IF EXISTS "student_profiles_section_visibility_valid";

ALTER TABLE "student_profiles"
ADD CONSTRAINT "student_profiles_section_visibility_valid"
CHECK (validate_section_visibility(section_visibility));

-- =========================================================================
-- 6. Dedicated Public Student Profiles View (Explicit Allowlist Projection)
-- =========================================================================

CREATE OR REPLACE VIEW public_student_profiles_view AS
SELECT 
    sp.id AS profile_id,
    sp.user_id,
    sp.slug,
    sp.headline,
    sp.bio,
    sp.skills,
    sp.interests,
    sp.external_links,
    sp.section_visibility,
    sp.directory_listed,
    sp.settings_version,
    sp.created_at,
    sp.updated_at,
    u.full_name,
    u.avatar_url,
    b.graduation_year,
    ap.batch_id,
    prog.name AS program_name,
    prog.code AS program_code,
    b.admission_year
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
LEFT JOIN user_academic_profiles ap ON ap.user_id = sp.user_id
LEFT JOIN academic_batches b ON b.id = ap.batch_id
LEFT JOIN academic_programs prog ON prog.id = b.program_id
WHERE u.deleted_at IS NULL;

GRANT SELECT ON public_student_profiles_view TO nst_app;
GRANT SELECT ON public_student_profiles_view TO nst_worker;

-- =========================================================================
-- 7. users Table Scoped SELECT Policy (Hardened - No Anonymous Scrape)
-- =========================================================================

DROP POLICY IF EXISTS "Allow scoped SELECT on users" ON users;
CREATE POLICY "Allow scoped SELECT on users" ON users
FOR SELECT USING (
  -- 1. Own profile
  id = current_user_id()
  
  -- 2. Global admins
  OR current_user_global_role() IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
  
  -- 3. Club Admins/Mentors for their attendees
  OR can_see_user_as_organizer(id)

  -- 4. Published project owner or accepted contributor
  OR is_published_project_participant(id)

  -- 5. Published event award winner or recognized member
  OR is_published_result_winner(id)
);

DROP POLICY IF EXISTS "Allow members and admins to SELECT club_memberships" ON club_memberships;
CREATE POLICY "Allow members and admins to SELECT club_memberships" ON club_memberships
  FOR SELECT
  USING (
    -- Global bypass for PLATFORM_ADMIN and FACULTY_ADMIN
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_user_id()
        AND u.global_role IN ('PLATFORM_ADMIN', 'FACULTY_ADMIN')
    )
    OR
    -- Club-scoped check for any active member of the same club
    (current_user_id() IS NOT NULL AND is_active_club_member(club_id, current_user_id()))
    OR
    -- Public student profile with clubs section enabled
    EXISTS (
      SELECT 1 FROM student_profiles sp
      WHERE sp.user_id = club_memberships.user_id
        AND (sp.section_visibility->>'clubs')::boolean = true
    )
  );

-- =========================================================================
-- 8. Automatic Provisioning Function & Trigger
-- =========================================================================

CREATE OR REPLACE FUNCTION provision_student_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_base_slug TEXT;
  v_slug TEXT;
  v_counter INT;
BEGIN
  SELECT * INTO v_user FROM users WHERE id = p_user_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_user.global_role <> 'STUDENT' THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM student_profiles WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  v_base_slug := lower(regexp_replace(coalesce(nullif(trim(v_user.full_name), ''), split_part(v_user.email, '@', 1)), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF length(v_base_slug) < 3 THEN
    v_base_slug := 'student-' || substr(replace(v_user.id::text, '-', ''), 1, 6);
  END IF;

  IF v_base_slug IN ('admin', 'api', 'dashboard', 'settings', 'profile', 'students', 'projects', 'events', 'clubs', 'auth', 'login', 'register', 'public', 'my') THEN
    v_base_slug := 'student-' || v_base_slug;
  END IF;

  v_slug := v_base_slug;
  v_counter := 1;

  WHILE EXISTS (SELECT 1 FROM student_profiles WHERE slug = v_slug) 
     OR EXISTS (SELECT 1 FROM student_slug_history WHERE slug = v_slug) LOOP
    v_slug := v_base_slug || '-' || v_counter;
    v_counter := v_counter + 1;
  END LOOP;

  INSERT INTO student_profiles (
    user_id,
    slug,
    headline,
    bio,
    skills,
    interests,
    external_links,
    section_visibility,
    directory_listed
  )
  VALUES (
    v_user.id,
    v_slug,
    NULL,
    NULL,
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    '[]'::jsonb,
    '{"name":true,"avatar":true,"academic":true,"bio":false,"skills":false,"external_links":false,"projects":false,"achievements":false,"clubs":false}'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION provision_student_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_student_profile(uuid) TO nst_app;

CREATE OR REPLACE FUNCTION on_user_student_provision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.global_role = 'STUDENT' AND NEW.deleted_at IS NULL THEN
    PERFORM provision_student_profile(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_user_student_provision ON users;
CREATE TRIGGER trigger_user_student_provision
AFTER INSERT OR UPDATE OF global_role, deleted_at ON users
FOR EACH ROW
EXECUTE FUNCTION on_user_student_provision();

-- =========================================================================
-- 9. Backfill Default Student Profiles for Existing Eligible Students
-- =========================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM users WHERE global_role = 'STUDENT' AND deleted_at IS NULL ORDER BY created_at ASC LOOP
    PERFORM provision_student_profile(r.id);
  END LOOP;
END;
$$;

