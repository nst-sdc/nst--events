import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('NST Student Profiles & Directory Integration Suite', { concurrency: false }, () => {
  const student1Id = randomUUID();
  const student2Id = randomUUID();
  const adminId = randomUUID();

  let student1Token: string;
  let student2Token: string;
  let adminToken: string;

  let project1Id: string;
  let project2DraftId: string;
  let eventPublicId: string;
  let eventRestrictedId: string;
  let achievementPublicId: string;
  let achievementRestrictedId: string;
  let clubId: string;

  const testEmails = [
    'charlie.profile@adypu.edu.in',
    'dana.profile@newtonschool.co',
    'admin.profile@adypu.edu.in',
  ];

  const cleanup = async () => {
    await adminPrisma.$executeRaw`DELETE FROM student_profile_curated_items WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM student_slug_history WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM student_profiles WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM student_achievements WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM award_recipients WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM event_awards WHERE revision_id IN (SELECT id FROM event_result_revisions WHERE result_set_id IN (SELECT id FROM event_result_sets WHERE event_id IN (SELECT id FROM events WHERE slug IN ('prof-public-hackathon', 'prof-restricted-cup'))))`;
    await adminPrisma.$executeRaw`DELETE FROM event_result_revisions WHERE result_set_id IN (SELECT id FROM event_result_sets WHERE event_id IN (SELECT id FROM events WHERE slug IN ('prof-public-hackathon', 'prof-restricted-cup')))`;
    await adminPrisma.$executeRaw`DELETE FROM event_result_sets WHERE event_id IN (SELECT id FROM events WHERE slug IN ('prof-public-hackathon', 'prof-restricted-cup'))`;
    await adminPrisma.$executeRaw`DELETE FROM event_registrations WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM events WHERE slug IN ('prof-public-hackathon', 'prof-restricted-cup')`;
    await adminPrisma.$executeRaw`DELETE FROM project_contributors WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_slug_history WHERE project_id IN (SELECT id FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = ANY(${testEmails})))`;
    await adminPrisma.$executeRaw`DELETE FROM project_links WHERE project_id IN (SELECT id FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = ANY(${testEmails})))`;
    await adminPrisma.$executeRaw`DELETE FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM club_memberships WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM clubs WHERE name = 'Profile Test Club'`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE email = ANY(${testEmails}) OR google_sub IN ('gsub_charlie_prof', 'gsub_dana_prof', 'gsub_admin_prof')`;
  };

  before(async () => {
    await cleanup();

    // 1. Seed users
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES
      (${student1Id}::uuid, 'charlie.profile@adypu.edu.in', 'gsub_charlie_prof', 'Charlie Profile', 'STUDENT'),
      (${student2Id}::uuid, 'dana.profile@newtonschool.co', 'gsub_dana_prof', 'Dana Secretive', 'STUDENT'),
      (${adminId}::uuid, 'admin.profile@adypu.edu.in', 'gsub_admin_prof', 'Platform Admin', 'PLATFORM_ADMIN');
    `;

    student1Token = signJwt(student1Id);
    student2Token = signJwt(student2Id);
    adminToken = signJwt(adminId);

    // 2. Seed club and membership for student1
    clubId = randomUUID();
    await adminPrisma.$executeRaw`
      INSERT INTO clubs (id, name, description, status)
      VALUES (${clubId}::uuid, 'Profile Test Club', 'Test Club for Profiles', 'ACTIVE');
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO club_memberships (id, user_id, club_id, role)
      VALUES (gen_random_uuid(), ${student1Id}::uuid, ${clubId}::uuid, 'CORE_MEMBER');
    `;

    // 3. Seed projects: one published, one draft
    project1Id = randomUUID();
    project2DraftId = randomUUID();
    await adminPrisma.$executeRaw`
      INSERT INTO projects (id, owner_id, title, slug, tagline, description, category, tags, visibility, published_at, cover_image_url)
      VALUES
      (${project1Id}::uuid, ${student1Id}::uuid, 'Charlie Published Project', 'charlie-pub-proj', 'Great Project', 'Full details here', 'Web Development', ARRAY['React', 'TypeScript']::text[], 'PUBLISHED', NOW(), 'https://placehold.co/600x400/png'),
      (${project2DraftId}::uuid, ${student1Id}::uuid, 'Charlie Draft Secret', 'charlie-draft-secret', 'Stealth Mode', 'Secret project', 'AI', ARRAY['Python']::text[], 'DRAFT', NULL, 'https://placehold.co/600x400/png');
    `;

    // 4. Seed events: one PUBLIC, one RESTRICTED
    eventPublicId = randomUUID();
    eventRestrictedId = randomUUID();
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, description, start_time, end_time, event_type, state, visibility, slug, created_by)
      VALUES
      (${eventPublicId}::uuid, 'Campus Hackathon 2026', 'Open Hackathon', NOW(), NOW() + INTERVAL '2 hours', 'HACKATHON', 'PUBLISHED', 'PUBLIC', 'prof-public-hackathon', ${adminId}::uuid),
      (${eventRestrictedId}::uuid, 'Faculty Confidential Cup', 'Restricted Event', NOW(), NOW() + INTERVAL '2 hours', 'COMPETITION', 'PUBLISHED', 'RESTRICTED', 'prof-restricted-cup', ${adminId}::uuid);
    `;

    // 5. Seed registrations
    const regPublicId = randomUUID();
    const regRestrictedId = randomUUID();
    await adminPrisma.$executeRaw`INSERT INTO event_registrations (id, event_id, user_id, registration_status) VALUES (${regPublicId}::uuid, ${eventPublicId}::uuid, ${student1Id}::uuid, 'REGISTERED')`;
    await adminPrisma.$executeRaw`INSERT INTO event_registrations (id, event_id, user_id, registration_status) VALUES (${regRestrictedId}::uuid, ${eventRestrictedId}::uuid, ${student1Id}::uuid, 'REGISTERED')`;

    // 6. Seed event_result_sets, revisions, awards, and student_achievements
    const resultSetPublicId = randomUUID();
    const revPublicId = randomUUID();
    const awardPublicId = randomUUID();
    const recipientPublicId = randomUUID();
    achievementPublicId = randomUUID();

    await adminPrisma.$executeRaw`INSERT INTO event_result_sets (id, event_id) VALUES (${resultSetPublicId}::uuid, ${eventPublicId}::uuid)`;
    await adminPrisma.$executeRaw`INSERT INTO event_result_revisions (id, result_set_id, revision_number, status, created_by, published_at, published_by) VALUES (${revPublicId}::uuid, ${resultSetPublicId}::uuid, 1, 'PUBLISHED', ${adminId}::uuid, NOW(), ${adminId}::uuid)`;
    await adminPrisma.$executeRaw`INSERT INTO event_awards (id, revision_id, title, award_type, placement, display_order) VALUES (${awardPublicId}::uuid, ${revPublicId}::uuid, 'Grand Winner', 'RANKED_PLACEMENT', 1, 1)`;
    await adminPrisma.$executeRaw`INSERT INTO award_recipients (id, award_id, recipient_type, user_id, registration_id) VALUES (${recipientPublicId}::uuid, ${awardPublicId}::uuid, 'INDIVIDUAL', ${student1Id}::uuid, ${regPublicId}::uuid)`;
    await adminPrisma.$executeRaw`INSERT INTO student_achievements (id, user_id, event_id, result_set_id, revision_id, award_id, recipient_id, award_title, award_type, placement, is_active, published_at) VALUES (${achievementPublicId}::uuid, ${student1Id}::uuid, ${eventPublicId}::uuid, ${resultSetPublicId}::uuid, ${revPublicId}::uuid, ${awardPublicId}::uuid, ${recipientPublicId}::uuid, 'Grand Winner', 'RANKED_PLACEMENT', 1, true, NOW())`;

    const resultSetRestrictedId = randomUUID();
    const revRestrictedId = randomUUID();
    const awardRestrictedId = randomUUID();
    const recipientRestrictedId = randomUUID();
    achievementRestrictedId = randomUUID();

    await adminPrisma.$executeRaw`INSERT INTO event_result_sets (id, event_id) VALUES (${resultSetRestrictedId}::uuid, ${eventRestrictedId}::uuid)`;
    await adminPrisma.$executeRaw`INSERT INTO event_result_revisions (id, result_set_id, revision_number, status, created_by, published_at, published_by) VALUES (${revRestrictedId}::uuid, ${resultSetRestrictedId}::uuid, 1, 'PUBLISHED', ${adminId}::uuid, NOW(), ${adminId}::uuid)`;
    await adminPrisma.$executeRaw`INSERT INTO event_awards (id, revision_id, title, award_type, placement, display_order) VALUES (${awardRestrictedId}::uuid, ${revRestrictedId}::uuid, 'Classified Honor', 'SPECIAL_AWARD', NULL, 1)`;
    await adminPrisma.$executeRaw`INSERT INTO award_recipients (id, award_id, recipient_type, user_id, registration_id) VALUES (${recipientRestrictedId}::uuid, ${awardRestrictedId}::uuid, 'INDIVIDUAL', ${student1Id}::uuid, ${regRestrictedId}::uuid)`;
    await adminPrisma.$executeRaw`INSERT INTO student_achievements (id, user_id, event_id, result_set_id, revision_id, award_id, recipient_id, award_title, award_type, placement, is_active, published_at) VALUES (${achievementRestrictedId}::uuid, ${student1Id}::uuid, ${eventRestrictedId}::uuid, ${resultSetRestrictedId}::uuid, ${revRestrictedId}::uuid, ${awardRestrictedId}::uuid, ${recipientRestrictedId}::uuid, 'Classified Honor', 'SPECIAL_AWARD', NULL, true, NOW())`;
  });

  after(async () => {
    await cleanup();
  });

  // =========================================================================
  // 1. Initial State & Self Profile Retrieval
  // =========================================================================

  it('GET /v1/students/me/profile returns authenticated student profile and source options', async () => {
    const res = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, 'charlie.profile@adypu.edu.in');
    assert.ok(res.body.profile.slug);
    assert.ok(Array.isArray(res.body.source_options.projects));
    assert.ok(res.body.source_options.projects.some((p: any) => p.id === project1Id));
    assert.ok(res.body.source_options.achievements.some((a: any) => a.id === achievementPublicId));
    assert.ok(res.body.source_options.clubs.some((c: any) => c.club_id === clubId));
  });

  it('rejects unauthenticated access to /v1/students/me/profile with 401', async () => {
    const res = await request(app).get('/v1/students/me/profile');
    assert.strictEqual(res.status, 401);
  });

  // =========================================================================
  // 2. Profile Content Updates
  // =========================================================================

  it('PATCH /v1/students/me/profile updates headline, bio, skills, interests, and external links', async () => {
    const res = await request(app)
      .patch('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        headline: 'Full-Stack Developer & Open Source Enthusiast',
        bio: 'Building developer tools and participating in campus jams.',
        skills: ['React', 'Next.js', 'PostgreSQL', 'Docker'],
        interests: ['Distributed Systems', 'UI Engineering'],
        external_links: [
          { type: 'github', label: 'GitHub Profile', url: 'https://github.com/charlieprofile' },
          { type: 'portfolio', label: 'Personal Site', url: 'https://charlie.dev' },
        ],
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.headline, 'Full-Stack Developer & Open Source Enthusiast');
    assert.strictEqual(res.body.skills.length, 4);
    assert.strictEqual(res.body.external_links.length, 2);
  });

  it('rejects invalid external link URLs with 400', async () => {
    const res = await request(app)
      .patch('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        external_links: [{ type: 'other', url: 'javascript:alert(1)' }],
      });

    assert.strictEqual(res.status, 400);
  });

  // =========================================================================
  // 3. Section Visibility Updates & Anonymous Public Projection
  // =========================================================================

  it('GET /v1/students/:slug hides bio, skills, links, projects, achievements, and clubs by default', async () => {
    // Get student1 slug
    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const slug = meRes.body.profile.slug;

    // Anonymous public fetch
    const pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.slug, slug);
    assert.strictEqual(pubRes.body.full_name, 'Charlie Profile'); // Default name: true
    // Optional sections default to hidden
    assert.strictEqual(pubRes.body.bio, null);
    assert.deepStrictEqual(pubRes.body.skills, []);
    assert.deepStrictEqual(pubRes.body.external_links, []);
    assert.deepStrictEqual(pubRes.body.projects, []);
    assert.deepStrictEqual(pubRes.body.achievements, []);
    assert.deepStrictEqual(pubRes.body.clubs, []);
    // Zero private data leaked
    assert.strictEqual((pubRes.body as any).email, undefined);
    assert.strictEqual((pubRes.body as any).google_sub, undefined);
  });

  it('PATCH /v1/students/me/visibility enables optional sections and public projection includes them', async () => {
    const visRes = await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        section_visibility: {
          bio: true,
          skills: true,
          external_links: true,
          projects: true,
          achievements: true,
          clubs: true,
        },
      });

    assert.strictEqual(visRes.status, 200);

    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const slug = meRes.body.profile.slug;

    // Anonymous public fetch now returns the enabled sections
    const pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.headline, 'Full-Stack Developer & Open Source Enthusiast');
    assert.strictEqual(pubRes.body.bio, 'Building developer tools and participating in campus jams.');
    assert.strictEqual(pubRes.body.skills.length, 4);
    assert.strictEqual(pubRes.body.external_links.length, 2);

    // Published project appears; DRAFT project NEVER appears
    assert.strictEqual(pubRes.body.projects.length, 1);
    assert.strictEqual(pubRes.body.projects[0].id, project1Id);
    assert.strictEqual(pubRes.body.projects[0].title, 'Charlie Published Project');

    // Public hackathon award appears; RESTRICTED event award NEVER appears
    assert.strictEqual(pubRes.body.achievements.length, 1);
    assert.strictEqual(pubRes.body.achievements[0].id, achievementPublicId);
    assert.strictEqual(pubRes.body.achievements[0].award_title, 'Grand Winner');

    // Verified club appears
    assert.strictEqual(pubRes.body.clubs.length, 1);
    assert.strictEqual(pubRes.body.clubs[0].club_name, 'Profile Test Club');
  });

  // =========================================================================
  // 4. Individual Item Curation (Show/Hide, Featured, Ordering)
  // =========================================================================

  it('POST /v1/students/me/curation allows featuring and hiding individual items', async () => {
    // 1. Feature the project
    const featRes = await request(app)
      .post('/v1/students/me/curation')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        item_type: 'PROJECT',
        source_id: project1Id,
        is_visible: true,
        is_featured: true,
        display_order: 1,
      });

    assert.strictEqual(featRes.status, 200);
    assert.strictEqual(featRes.body.is_featured, true);

    // 2. Hide the achievement
    const hideAchRes = await request(app)
      .post('/v1/students/me/curation')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        item_type: 'ACHIEVEMENT',
        source_id: achievementPublicId,
        is_visible: false,
        is_featured: false,
      });

    assert.strictEqual(hideAchRes.status, 200);
    assert.strictEqual(hideAchRes.body.is_visible, false);

    // 3. Fetch public profile anonymously
    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const pubRes = await request(app).get(`/v1/students/${meRes.body.profile.slug}`);

    assert.strictEqual(pubRes.status, 200);
    // Project is featured
    assert.strictEqual(pubRes.body.projects[0].is_featured, true);
    // Hidden achievement is absent from public projection
    assert.strictEqual(pubRes.body.achievements.length, 0);
  });

  // =========================================================================
  // 5. BOLA Security & Authorization Checks
  // =========================================================================

  it('BOLA: student2 cannot curate student1 project', async () => {
    const res = await request(app)
      .post('/v1/students/me/curation')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        item_type: 'PROJECT',
        source_id: project1Id,
        is_visible: false,
      });

    assert.strictEqual(res.status, 403);
  });

  it('BOLA: student2 cannot curate student1 achievement', async () => {
    const res = await request(app)
      .post('/v1/students/me/curation')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        item_type: 'ACHIEVEMENT',
        source_id: achievementPublicId,
        is_visible: false,
      });

    assert.strictEqual(res.status, 403);
  });

  // =========================================================================
  // 6. Handle / Slug Customization, Collisions, and Historical Redirects
  // =========================================================================

  it('POST /v1/students/me/handle rejects reserved slug names with 400', async () => {
    const res = await request(app)
      .post('/v1/students/me/handle')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ slug: 'admin' });

    assert.strictEqual(res.status, 400);
  });

  it('POST /v1/students/me/handle rejects invalid slug characters with 400', async () => {
    const res = await request(app)
      .post('/v1/students/me/handle')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ slug: 'invalid_handle!' });

    assert.strictEqual(res.status, 400);
  });

  it('POST /v1/students/me/handle changes slug and historical slug returns redirect', async () => {
    // Current slug
    const meBefore = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const oldSlug = meBefore.body.profile.slug;

    // Change handle to 'charlie-dev-star'
    const newSlug = `charlie-${Date.now()}`;
    const changeRes = await request(app)
      .post('/v1/students/me/handle')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ slug: newSlug });

    assert.strictEqual(changeRes.status, 200);
    assert.strictEqual(changeRes.body.slug, newSlug);

    // Fetching new slug returns profile
    const newRes = await request(app).get(`/v1/students/${newSlug}`);
    assert.strictEqual(newRes.status, 200);
    assert.strictEqual(newRes.body.slug, newSlug);

    // Fetching historical old slug returns redirect response
    const oldRes = await request(app).get(`/v1/students/${oldSlug}`);
    assert.strictEqual(oldRes.status, 200);
    assert.strictEqual(oldRes.body.redirect, true);
    assert.strictEqual(oldRes.body.canonical_slug, newSlug);

    // Collision check: student2 cannot claim student1's current or historical slug
    const conflictRes1 = await request(app)
      .post('/v1/students/me/handle')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ slug: newSlug });
    assert.strictEqual(conflictRes1.status, 409);

    const conflictRes2 = await request(app)
      .post('/v1/students/me/handle')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ slug: oldSlug });
    assert.strictEqual(conflictRes2.status, 409);
  });

  // =========================================================================
  // 7. Student Directory & Privacy-Aware Discovery
  // =========================================================================

  it('GET /v1/students lists directory profiles and supports search by handle', async () => {
    const res = await request(app).get('/v1/students?limit=20');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination.total > 0);
  });

  it('Privacy Discovery: hidden name does NOT match search query', async () => {
    // Hide student2 name
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        section_visibility: {
          name: false,
        },
      });

    // Search for student2's full name 'Dana Secretive'
    const searchRes = await request(app).get('/v1/students?search=Dana%20Secretive');
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.data.length, 0);

    // But searching for student2's handle still finds them
    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student2Token}`);
    const slug = meRes.body.profile.slug;

    const handleSearch = await request(app).get(`/v1/students?search=${slug}`);
    assert.strictEqual(handleSearch.status, 200);
    assert.strictEqual(handleSearch.body.data.length, 1);
    assert.strictEqual(handleSearch.body.data[0].slug, slug);
    // Student2's name is null in directory card because it is hidden
    assert.strictEqual(handleSearch.body.data[0].full_name, null);
  });

  it('Directory opt-out: directory_listed = false removes student from directory listing', async () => {
    // Student2 opts out of directory
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        directory_listed: false,
      });

    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student2Token}`);
    const slug = meRes.body.profile.slug;

    // Searching for slug in directory yields 0 results
    const dirRes = await request(app).get(`/v1/students?search=${slug}`);
    assert.strictEqual(dirRes.body.data.length, 0);

    // But direct canonical profile URL still resolves stably!
    const directRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(directRes.status, 200);
    assert.strictEqual(directRes.body.slug, slug);
  });

  // =========================================================================
  // 8. Adversarial Scenarios A through L
  // =========================================================================

  it('Scenario A: Anonymous visitor cannot read private columns or arbitrary user rows', async () => {
    // 1. Direct query on users table under nst_app connection (subject to RLS)
    const { prisma } = await import('../../src/lib/prisma');
    const directUsers = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, email, google_sub FROM users WHERE id = '${student2Id}';`
    );
    assert.strictEqual(directUsers.length, 0, 'Anonymous nst_app must not be able to read student2 row from users table');

    // 2. Direct query on public view cannot request email
    let viewQueryFailed = false;
    try {
      await prisma.$queryRawUnsafe('SELECT email FROM public_student_profiles_view;');
    } catch {
      viewQueryFailed = true;
    }
    assert.strictEqual(viewQueryFailed, true, 'public_student_profiles_view must not expose email column');

    // 3. Public profile endpoint returns ONLY allowlisted DTO
    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const slug = meRes.body.profile.slug;

    const pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.email, undefined);
    assert.strictEqual(pubRes.body.google_sub, undefined);
    assert.strictEqual(pubRes.body.security_version, undefined);
    assert.strictEqual(pubRes.body.password_hash, undefined);
  });

  it('Scenario B: Cross-student mutation is rejected and leaves data unchanged', async () => {
    // Student1 attempts to update Student2 profile settings via BOLA
    const student1ProfileBefore = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT slug, directory_listed FROM student_profiles WHERE user_id = '${student1Id}';`
    );

    // Student2 cannot curate Student1's items
    const bolaRes = await request(app)
      .post('/v1/students/me/curation')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        item_type: 'PROJECT',
        source_id: project1Id,
        is_featured: true,
      });
    assert.strictEqual(bolaRes.status, 403);

    // Database remains unchanged
    const student1ProfileAfter = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT slug, directory_listed FROM student_profiles WHERE user_id = '${student1Id}';`
    );
    assert.strictEqual(student1ProfileAfter[0].slug, student1ProfileBefore[0].slug);
  });

  it('Scenario C: Hidden identity does not leak display name through public DTO or search', async () => {
    // Ensure student2 name is hidden
    const patchRes = await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ section_visibility: { identity: false } });

    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student2Token}`);
    const slug = meRes.body.profile.slug;

    // The slug itself should now be non-identifying (e.g. student-...)
    assert.match(slug, /^student-[a-f0-9]+/i);

    const pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.full_name, null, 'Hidden display name must be null in public DTO');

    // Search by full name yields 0 results
    const searchRes = await request(app).get('/v1/students?search=Dana%20Secretive');
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.data.length, 0);

    // Historical slug redirect is blocked when identity is hidden to prevent deanonymization
    const redirectRes = await request(app).get('/v1/students/dana-secretive');
    assert.strictEqual(redirectRes.status, 404);
  });

  it('Scenario D: Hidden content is excluded from public API responses', async () => {
    // Student1 enables then hides bio and skills
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        section_visibility: {
          bio: false,
          skills: false,
          external_links: false,
        },
      });

    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const slug = meRes.body.profile.slug;

    const pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.bio, null);
    assert.strictEqual(pubRes.body.headline, null);
    assert.deepStrictEqual(pubRes.body.skills, []);
    assert.deepStrictEqual(pubRes.body.external_links, []);
  });

  it('Scenario E: Restricted event achievements are never exposed on public profiles', async () => {
    // Student1 re-enables achievements section and un-hides public achievement
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { achievements: true } });

    await request(app)
      .post('/v1/students/me/curation')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        item_type: 'ACHIEVEMENT',
        source_id: achievementPublicId,
        is_visible: true,
      });

    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const slug = meRes.body.profile.slug;

    const pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    const achs = pubRes.body.achievements;
    assert.ok(achs.length > 0);
    for (const a of achs) {
      assert.notStrictEqual(a.event.title, 'Faculty Confidential Cup');
      assert.strictEqual(a.event.title, 'Campus Hackathon 2026');
    }
  });

  it('Scenario F: Unpublished/draft projects are never exposed on public profiles', async () => {
    // Student1 enables projects section
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { projects: true } });

    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const slug = meRes.body.profile.slug;

    const pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    // project2 is DRAFT — verify it is not present
    for (const p of pubRes.body.projects) {
      assert.notStrictEqual(p.id, project2DraftId);
      assert.strictEqual(p.title, 'Charlie Published Project');
    }
  });

  it('Scenario G: New student account creation automatically provisions a profile with conservative defaults', async () => {
    const newStudentId = randomUUID();
    const newEmail = `adv.new.student.${Date.now()}@adypu.edu.in`;

    // Insert new user with STUDENT role
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role)
      VALUES (${newStudentId}::uuid, ${newEmail}, ${'gsub_' + newStudentId}, 'New Student Test', 'STUDENT');
    `;

    // Query profile created by trigger
    const profiles = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM student_profiles WHERE user_id = '${newStudentId}';`
    );
    assert.strictEqual(profiles.length, 1);
    assert.ok(profiles[0].slug.startsWith('new-student-test'));
    assert.strictEqual(profiles[0].directory_listed, true);
    // Conservative defaults: bio, skills, projects, achievements, clubs are false
    const sec = profiles[0].section_visibility;
    assert.strictEqual(sec.bio, false);
    assert.strictEqual(sec.skills, false);
    assert.strictEqual(sec.projects, false);
    assert.strictEqual(sec.achievements, false);
    assert.strictEqual(sec.clubs, false);

    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM student_profiles WHERE user_id = ${newStudentId}::uuid`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id = ${newStudentId}::uuid`;
  });

  it('Scenario H: Concurrent provisioning operations do not create duplicate profiles or slugs', async () => {
    const raceStudentId = randomUUID();
    const raceEmail = `adv.race.student.${Date.now()}@adypu.edu.in`;

    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role)
      VALUES (${raceStudentId}::uuid, ${raceEmail}, ${'gsub_' + raceStudentId}, 'Race Student', 'STUDENT');
    `;

    // Call provision_student_profile concurrently 5 times
    await Promise.all([
      adminPrisma.$executeRaw`SELECT provision_student_profile(${raceStudentId}::uuid)`,
      adminPrisma.$executeRaw`SELECT provision_student_profile(${raceStudentId}::uuid)`,
      adminPrisma.$executeRaw`SELECT provision_student_profile(${raceStudentId}::uuid)`,
      adminPrisma.$executeRaw`SELECT provision_student_profile(${raceStudentId}::uuid)`,
      adminPrisma.$executeRaw`SELECT provision_student_profile(${raceStudentId}::uuid)`,
    ]);

    const countRes = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int AS count FROM student_profiles WHERE user_id = '${raceStudentId}';`
    );
    assert.strictEqual(countRes[0].count, 1, 'Exactly one profile must exist for student');

    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM student_profiles WHERE user_id = ${raceStudentId}::uuid`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id = ${raceStudentId}::uuid`;
  });

  it('Scenario I: Hidden name or skills do not influence search results or facet counts', async () => {
    // Search for a skill that student1 has ('Rust') when student1 has skills: false
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { skills: false } });

    const skillSearch = await request(app).get('/v1/students?skill=Rust');
    assert.strictEqual(skillSearch.status, 200);
    // Student1's profile should not appear in skill filter while skills is hidden
    const matches = skillSearch.body.data.filter((s: any) => s.slug === 'charlie-profile');
    assert.strictEqual(matches.length, 0);
  });

  it('Scenario J: Database enforces validated keys on section_visibility constraint', async () => {
    // Attempt to write invalid key directly to student_profiles table
    let rejected = false;
    try {
      await adminPrisma.$executeRawUnsafe(
        `UPDATE student_profiles SET section_visibility = '{"invalid_key": true}' WHERE user_id = '${student1Id}';`
      );
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true, 'Database check constraint must reject invalid section_visibility keys');
  });

  it('Scenario K: Visibility updates propagate immediately to public API', async () => {
    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const slug = meRes.body.profile.slug;

    // 1. Enable bio
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { bio: true } });

    let pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.ok(pubRes.body.bio !== null, 'Bio should be visible when enabled');

    // 2. Hide bio
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { bio: false } });

    pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.bio, null, 'Bio should be null immediately after being hidden');
  });

  it('Scenario L: Core user authentication and /users/me remain functional without regressions', async () => {
    const meRes = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${student1Token}`);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.id, student1Id);
    assert.strictEqual(meRes.body.email, 'charlie.profile@adypu.edu.in');
    assert.strictEqual(meRes.body.global_role, 'STUDENT');
  });

  // =========================================================================
  // 4. Hardening Scenarios for 4 Remaining Risks
  // =========================================================================

  it('Scenario M: SQL-level masking of avatar_url across avatar, avatar_url, and conflicting keys', async () => {
    // 1. Give student1 an avatar in users table
    await adminPrisma.$executeRaw`
      UPDATE users SET avatar_url = 'https://placehold.co/avatar-charlie.png' WHERE id = ${student1Id}::uuid
    `;

    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const slug = meRes.body.profile.slug;

    // 2. Hide avatar using 'avatar: false'
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { avatar: false } });

    const viewRows1 = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT avatar_url FROM public_student_profiles_view WHERE user_id = '${student1Id}';`
    );
    assert.strictEqual(viewRows1[0].avatar_url, null, 'SQL view must mask avatar_url to NULL when avatar: false');

    let pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.avatar_url, null);

    // 3. Hide avatar using alias 'avatar_url: false'
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { avatar_url: false } });

    const viewRows2 = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT avatar_url FROM public_student_profiles_view WHERE user_id = '${student1Id}';`
    );
    assert.strictEqual(viewRows2[0].avatar_url, null, 'SQL view must mask avatar_url to NULL when avatar_url: false');

    pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.avatar_url, null);

    // 4. Conflicting keys: avatar: true BUT avatar_url: false -> hidden MUST win
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { avatar: true, avatar_url: false } });

    const viewRowsConflict1 = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT avatar_url FROM public_student_profiles_view WHERE user_id = '${student1Id}';`
    );
    assert.strictEqual(viewRowsConflict1[0].avatar_url, null, 'SQL view must mask avatar_url when avatar: true but avatar_url: false');

    pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.avatar_url, null, 'Public endpoint must hide avatar when keys conflict with false');

    // 5. Conflicting keys: avatar: false BUT avatar_url: true -> hidden MUST win
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { avatar: false, avatar_url: true } });

    const viewRowsConflict2 = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT avatar_url FROM public_student_profiles_view WHERE user_id = '${student1Id}';`
    );
    assert.strictEqual(viewRowsConflict2[0].avatar_url, null, 'SQL view must mask avatar_url when avatar: false but avatar_url: true');

    pubRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.avatar_url, null, 'Public endpoint must hide avatar when keys conflict with false');

    // 6. Direct SQL test: even if raw JSON in DB contains conflicting values, view masks it
    await adminPrisma.$executeRawUnsafe(
      `UPDATE student_profiles SET section_visibility = '{"identity":true,"avatar":true,"avatar_url":false}' WHERE user_id = '${student1Id}';`
    );
    const rawSqlViewCheck = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT avatar_url FROM public_student_profiles_view WHERE user_id = '${student1Id}';`
    );
    assert.strictEqual(rawSqlViewCheck[0].avatar_url, null, 'Direct SQL query on view must mask avatar when avatar_url is false in raw JSON');

    // 7. Restore avatar visibility (both true)
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ section_visibility: { avatar: true, avatar_url: true } });

    const viewRows3 = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT avatar_url FROM public_student_profiles_view WHERE user_id = '${student1Id}';`
    );
    assert.strictEqual(viewRows3[0].avatar_url, 'https://placehold.co/avatar-charlie.png');
  });

  it('Scenario N: Unlisted profiles are excluded from public_student_profiles_view but accessible via direct canonical slug', async () => {
    // 1. Mark student2 as unlisted
    await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ directory_listed: false });

    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student2Token}`);
    const slug = meRes.body.profile.slug;

    // 2. Query public_student_profiles_view directly in SQL
    const viewRows = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM public_student_profiles_view WHERE user_id = '${student2Id}';`
    );
    assert.strictEqual(viewRows.length, 0, 'public_student_profiles_view must strictly exclude unlisted profiles at SQL level');

    // 3. Directory listing endpoint must not return student2
    const dirRes = await request(app).get('/v1/students');
    assert.strictEqual(dirRes.status, 200);
    const foundInDir = dirRes.body.data.some((s: any) => s.user_id === student2Id || s.slug === slug);
    assert.strictEqual(foundInDir, false, 'Unlisted student must not appear in directory');

    // 4. Direct slug lookup must succeed and return public DTO
    const directRes = await request(app).get(`/v1/students/${slug}`);
    assert.strictEqual(directRes.status, 200);
    assert.strictEqual(directRes.body.slug, slug);
  });

  it('Scenario O: lookup_student_slug_redirect SQL return signature matches API contract', async () => {
    // 1. Non-existent slug returns 0 rows (empty table result) matching contract
    const nullResult = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM lookup_student_slug_redirect('non-existent-random-slug-999');`
    );
    assert.strictEqual(nullResult.length, 0, 'Non-existent slug must return empty set from TABLE function');

    // 2. When a redirect exists, the returned column is named canonical_slug (matching API contract)
    const meRes = await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${student1Token}`);
    const currentSlug = meRes.body.profile.slug;
    const testOldSlug = `historical-handle-${Date.now()}`;

    await adminPrisma.$executeRaw`
      INSERT INTO student_slug_history (user_id, slug)
      VALUES (${student1Id}::uuid, ${testOldSlug})
      ON CONFLICT (slug) DO NOTHING;
    `;

    const redirectRows = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM lookup_student_slug_redirect('${testOldSlug}');`
    );
    assert.strictEqual(redirectRows.length, 1);
    assert.ok('canonical_slug' in redirectRows[0], 'Result row must contain canonical_slug column matching API contract');
    assert.strictEqual(redirectRows[0].canonical_slug, currentSlug);

    // 3. Self-redirect protection: if student_slug_history contains currentSlug, returns 0 rows
    await adminPrisma.$executeRaw`
      INSERT INTO student_slug_history (user_id, slug)
      VALUES (${student1Id}::uuid, ${currentSlug})
      ON CONFLICT (slug) DO NOTHING;
    `;

    const loopCheck = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM lookup_student_slug_redirect('${currentSlug}');`
    );
    assert.strictEqual(loopCheck.length, 0, 'Function must return 0 rows if historical slug equals current canonical slug');

    // 4. API endpoint returns { redirect: true, canonical_slug: currentSlug }
    const apiRes = await request(app).get(`/v1/students/${testOldSlug}`);
    assert.strictEqual(apiRes.status, 200);
    assert.strictEqual(apiRes.body.redirect, true);
    assert.strictEqual(apiRes.body.canonical_slug, currentSlug);

    // Cleanup
    await adminPrisma.$executeRaw`
      DELETE FROM student_slug_history WHERE slug IN (${testOldSlug}, ${currentSlug});
    `;
  });

  it('Scenario P: Anonymous slug generation avoids pre-existing collisions deterministically', async () => {
    const colStudentId = randomUUID();
    const colEmail = `col.student.${Date.now()}@adypu.edu.in`;
    const shortPrefix = colStudentId.replace(/-/g, '').slice(0, 8).toLowerCase();
    const collidingSlug = `student-${shortPrefix}`;

    // 1. Pre-occupy collidingSlug in student_slug_history
    await adminPrisma.$executeRaw`
      INSERT INTO student_slug_history (user_id, slug)
      VALUES (${adminId}::uuid, ${collidingSlug})
      ON CONFLICT (slug) DO NOTHING;
    `;

    // 2. Create the student
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role)
      VALUES (${colStudentId}::uuid, ${colEmail}, ${'gsub_' + colStudentId}, 'Collision Student', 'STUDENT');
    `;

    const colToken = signJwt(colStudentId);

    // 3. Switch identity: false to trigger anonymous slug rotation
    const patchRes = await request(app)
      .patch('/v1/students/me/visibility')
      .set('Authorization', `Bearer ${colToken}`)
      .send({ section_visibility: { identity: false } });

    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.body.slug, `${collidingSlug}-1`);

    // 4. Verify lookup of the new slug works
    const pubRes = await request(app).get(`/v1/students/${collidingSlug}-1`);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.slug, `${collidingSlug}-1`);

    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM student_profiles WHERE user_id = ${colStudentId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM student_slug_history WHERE slug IN (${collidingSlug}, '${collidingSlug}-1');`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id = ${colStudentId}::uuid;`;
  });

  it('Scenario Q: Anonymous slug generation is safe under concurrent requests', async () => {
    // 1. Test concurrency on the SAME student: 5 simultaneous requests to rotate to anonymous slug
    const raceStudentId = randomUUID();
    const raceEmail = `race.anon.${Date.now()}@adypu.edu.in`;

    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role)
      VALUES (${raceStudentId}::uuid, ${raceEmail}, ${'gsub_' + raceStudentId}, 'Race Anonymous', 'STUDENT');
    `;

    const raceToken = signJwt(raceStudentId);

    // Ensure student profile is initially provisioned with identity: true
    await request(app)
      .get('/v1/students/me/profile')
      .set('Authorization', `Bearer ${raceToken}`);

    // Fire 5 concurrent requests to disable identity
    const results = await Promise.all([
      request(app)
        .patch('/v1/students/me/visibility')
        .set('Authorization', `Bearer ${raceToken}`)
        .send({ section_visibility: { identity: false } }),
      request(app)
        .patch('/v1/students/me/visibility')
        .set('Authorization', `Bearer ${raceToken}`)
        .send({ section_visibility: { identity: false } }),
      request(app)
        .patch('/v1/students/me/visibility')
        .set('Authorization', `Bearer ${raceToken}`)
        .send({ section_visibility: { identity: false } }),
      request(app)
        .patch('/v1/students/me/visibility')
        .set('Authorization', `Bearer ${raceToken}`)
        .send({ section_visibility: { identity: false } }),
      request(app)
        .patch('/v1/students/me/visibility')
        .set('Authorization', `Bearer ${raceToken}`)
        .send({ section_visibility: { identity: false } }),
    ]);

    // All 5 requests must return 200 without constraint violation or abort
    for (const res of results) {
      assert.strictEqual(res.status, 200);
      assert.match(res.body.slug, /^student-[a-f0-9]{8}/);
    }

    // All 5 must have converged on the exact same canonical anonymous slug
    const finalSlug = results[0].body.slug;
    for (const res of results) {
      assert.strictEqual(res.body.slug, finalSlug);
    }

    // 2. Test concurrent collision between TWO DIFFERENT students sharing the same candidate slug
    const sharedShort = 'racecoll';
    const sharedCandidate = `student-${sharedShort}`;

    // Pre-insert a student with sharedCandidate so both new students will collide with it simultaneously
    await adminPrisma.$executeRaw`
      INSERT INTO student_slug_history (user_id, slug)
      VALUES (${adminId}::uuid, ${sharedCandidate})
      ON CONFLICT (slug) DO NOTHING;
    `;

    // Concurrently invoke rotate_student_to_anonymous_slug directly in SQL for two different students
    const studentAId = randomUUID();
    const studentBId = randomUUID();
    const emailA = `stud.a.${Date.now()}.${Math.random().toString(36).substring(7)}@adypu.edu.in`;
    const emailB = `stud.b.${Date.now()}.${Math.random().toString(36).substring(7)}@adypu.edu.in`;

    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role)
      VALUES 
      (${studentAId}::uuid, ${emailA}, ${'gsub_' + studentAId}, 'Student A', 'STUDENT'),
      (${studentBId}::uuid, ${emailB}, ${'gsub_' + studentBId}, 'Student B', 'STUDENT');
    `;

    // Provision both profiles
    await adminPrisma.$executeRaw`SELECT provision_student_profile(${studentAId}::uuid);`;
    await adminPrisma.$executeRaw`SELECT provision_student_profile(${studentBId}::uuid);`;

    // Concurrently rotate both students under their respective user contexts
    const [resA, resB] = await Promise.all([
      adminPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${studentAId}';`);
        return tx.$queryRawUnsafe<any[]>(`SELECT rotate_student_to_anonymous_slug('${studentAId}') AS slug;`);
      }),
      adminPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${studentBId}';`);
        return tx.$queryRawUnsafe<any[]>(`SELECT rotate_student_to_anonymous_slug('${studentBId}') AS slug;`);
      }),
    ]);

    assert.ok(resA[0].slug);
    assert.ok(resB[0].slug);
    assert.notStrictEqual(resA[0].slug, resB[0].slug, 'Concurrent rotations must assign unique distinct slugs');

    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM student_profiles WHERE user_id IN (${raceStudentId}::uuid, ${studentAId}::uuid, ${studentBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM student_slug_history WHERE slug = ${sharedCandidate} OR user_id IN (${raceStudentId}::uuid, ${studentAId}::uuid, ${studentBId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id IN (${raceStudentId}::uuid, ${studentAId}::uuid, ${studentBId}::uuid);`;
  });

  it('Scenario R: Privilege audit enforces caller authorization and secure search_path on SECURITY DEFINER functions', async () => {
    // 1. Audit public schema CREATE privileges: untrusted/app roles must NOT have CREATE
    const schemaPrivs = await adminPrisma.$queryRawUnsafe<Array<{ rolname: string; has_usage: boolean; has_create: boolean }>>(
      `SELECT
        r.rolname,
        has_schema_privilege(r.rolname, 'public', 'USAGE') AS has_usage,
        has_schema_privilege(r.rolname, 'public', 'CREATE') AS has_create
      FROM pg_roles r
      WHERE r.rolname IN ('postgres', 'nst_app', 'nst_worker')
      ORDER BY r.rolname;`
    );

    const appPriv = schemaPrivs.find((s) => s.rolname === 'nst_app');
    const workerPriv = schemaPrivs.find((s) => s.rolname === 'nst_worker');
    const pgPriv = schemaPrivs.find((s) => s.rolname === 'postgres');

    assert.strictEqual(appPriv?.has_create, false, 'nst_app must not have CREATE privilege on public schema');
    assert.strictEqual(appPriv?.has_usage, true, 'nst_app must have USAGE privilege on public schema');
    assert.strictEqual(workerPriv?.has_create, false, 'nst_worker must not have CREATE privilege on public schema');
    assert.strictEqual(workerPriv?.has_usage, true, 'nst_worker must have USAGE privilege on public schema');
    assert.strictEqual(pgPriv?.has_create, true, 'postgres must retain CREATE privilege on public schema');

    // 2. Verify search_path config in pg_proc for all student profile security definer functions
    const funcConfigs = await adminPrisma.$queryRawUnsafe<Array<{ proname: string; proconfig: string[] | null; proacl: string | null }>>(
      `SELECT p.proname, p.proconfig, p.proacl::text AS proacl
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'lookup_student_slug_redirect',
          'lookup_public_student_profile_by_slug',
          'rotate_student_to_anonymous_slug',
          'is_student_slug_taken',
          'provision_student_profile',
          'on_user_student_provision'
        );`
    );

    assert.ok(funcConfigs.length >= 6);
    for (const f of funcConfigs) {
      assert.ok(
        f.proconfig && f.proconfig.some((c) => c.includes('search_path=public, pg_temp')),
        `Function ${f.proname} must have secure search_path=public, pg_temp`
      );

      // Verify execution privileges
      assert.ok(f.proacl, `Function ${f.proname} must have explicit ACL`);
      assert.ok(!/(^|[,{])=X\//.test(f.proacl), `Function ${f.proname} must not grant EXECUTE to PUBLIC`);
      assert.ok(!f.proacl.includes('nst_worker='), `Function ${f.proname} must not grant EXECUTE to nst_worker`);

      if (f.proname === 'on_user_student_provision') {
        assert.ok(!f.proacl.includes('nst_app='), 'Trigger function must not grant EXECUTE to nst_app');
      } else {
        assert.ok(f.proacl.includes('nst_app=X/'), `Function ${f.proname} must grant EXECUTE strictly to nst_app`);
      }
    }

    // 2. BOLA Protection: Student 1 attempts to rotate Student 2's slug to anonymous
    const victimStudentId = randomUUID();
    const victimEmail = `victim.${Date.now()}.${Math.random().toString(36).substring(7)}@adypu.edu.in`;

    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role)
      VALUES (${victimStudentId}::uuid, ${victimEmail}, ${'gsub_' + victimStudentId}, 'Victim Student', 'STUDENT');
    `;
    await adminPrisma.$executeRaw`SELECT provision_student_profile(${victimStudentId}::uuid);`;

    const victimProfileBefore = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT slug FROM student_profiles WHERE user_id = '${victimStudentId}';`
    );
    const originalVictimSlug = victimProfileBefore[0].slug;

    // Student 1 sets app.user_id to student1Id and attempts to rotate victimStudentId
    let unauthorizedError: any = null;
    try {
      await adminPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${student1Id}';`);
        await tx.$queryRawUnsafe(`SELECT rotate_student_to_anonymous_slug('${victimStudentId}');`);
      });
    } catch (err: any) {
      unauthorizedError = err;
    }

    assert.ok(unauthorizedError, 'Attempt by Student 1 to rotate Victim Student profile must throw error');
    assert.match(
      unauthorizedError.message,
      /Access denied: cannot rotate another student profile/,
      'Must throw access denied error with SQLSTATE 42501'
    );

    // Victim's slug must remain unchanged
    const victimProfileAfter = await adminPrisma.$queryRawUnsafe<any[]>(
      `SELECT slug FROM student_profiles WHERE user_id = '${victimStudentId}';`
    );
    assert.strictEqual(victimProfileAfter[0].slug, originalVictimSlug);

    // 3. Anonymous caller (no app.user_id) attempts to rotate student profile
    let anonError: any = null;
    try {
      await adminPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`RESET app.user_id;`);
        await tx.$queryRawUnsafe(`SELECT rotate_student_to_anonymous_slug('${victimStudentId}');`);
      });
    } catch (err: any) {
      anonError = err;
    }

    assert.ok(anonError, 'Anonymous caller attempting to rotate student profile must throw error');
    assert.match(
      anonError.message,
      /Access denied: anonymous caller cannot rotate student profile/,
      'Must throw anonymous access denied error with SQLSTATE 42501'
    );

    // 4. Admin authorization: PLATFORM_ADMIN can rotate if needed
    let adminSuccess = false;
    try {
      await adminPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${adminId}';`);
        await tx.$queryRawUnsafe(`SELECT rotate_student_to_anonymous_slug('${victimStudentId}');`);
      });
      adminSuccess = true;
    } catch (err) {
      adminSuccess = false;
    }
    assert.strictEqual(adminSuccess, true, 'Platform admin must be authorized to invoke slug rotation');

    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM student_profiles WHERE user_id = ${victimStudentId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM student_slug_history WHERE user_id = ${victimStudentId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id = ${victimStudentId}::uuid;`;
  });
});
