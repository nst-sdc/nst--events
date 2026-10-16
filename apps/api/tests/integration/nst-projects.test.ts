import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { withUserContext } from '@nst/database';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('NST Projects Showcase & Discovery Integration Suite', { concurrency: false }, () => {
  const student1Id = randomUUID();
  const student2Id = randomUUID();
  const adminId = randomUUID();
  const nonInstUserId = randomUUID();
  const unverifiedStudentId = randomUUID();

  let student1Token: string;
  let student2Token: string;
  let adminToken: string;
  let nonInstToken: string;
  let unverifiedStudentToken: string;

  let createdProjectId: string;
  let createdProjectSlug: string;
  let contributorRecordId: string;
  let reportId: string;

  const testEmails = [
    'alice.student@adypu.edu.in',
    'bob.student@newtonschool.co',
    'admin.moderator@adypu.edu.in',
    'outsider@gmail.com',
    'carol.unverified@adypu.edu.in',
  ];

  const cleanup = async () => {
    await adminPrisma.$executeRaw`DELETE FROM project_moderation_actions WHERE actor_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_reports WHERE reporter_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_likes WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_contributors WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_slug_history WHERE project_id IN (SELECT id FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = ANY(${testEmails})))`;
    await adminPrisma.$executeRaw`DELETE FROM project_links WHERE project_id IN (SELECT id FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = ANY(${testEmails})))`;
    await adminPrisma.$executeRaw`DELETE FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE email = ANY(${testEmails}) OR google_sub IN ('gsub_alice_proj', 'gsub_bob_proj', 'gsub_admin_proj', 'gsub_outsider_proj', 'unverified_carol_proj')`;
  };

  before(async () => {
    // Clean up any stale records from previous aborted runs
    await cleanup();

    // 1. Seed users:
    // - Verified Institutional Students: student1, student2
    // - Platform Admin: admin
    // - Non-institutional user: nonInstUser
    // - Unverified Institutional Student: unverifiedStudent
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role) VALUES
      (${student1Id}::uuid, 'alice.student@adypu.edu.in', 'gsub_alice_proj', 'Alice Creator', 'STUDENT'),
      (${student2Id}::uuid, 'bob.student@newtonschool.co', 'gsub_bob_proj', 'Bob Collaborator', 'STUDENT'),
      (${adminId}::uuid, 'admin.moderator@adypu.edu.in', 'gsub_admin_proj', 'Faculty Admin', 'PLATFORM_ADMIN'),
      (${nonInstUserId}::uuid, 'outsider@gmail.com', 'gsub_outsider_proj', 'External User', 'STUDENT'),
      (${unverifiedStudentId}::uuid, 'carol.unverified@adypu.edu.in', 'unverified_carol_proj', 'Carol Unverified', 'STUDENT');
    `;

    student1Token = signJwt(student1Id);
    student2Token = signJwt(student2Id);
    adminToken = signJwt(adminId);
    nonInstToken = signJwt(nonInstUserId);
    unverifiedStudentToken = signJwt(unverifiedStudentId);
  });

  after(async () => {
    await cleanup();
  });

  // =========================================================================
  // 1. Creation, Drafts, and Publishing Validation
  // =========================================================================
  it('rejects creation from unauthenticated (anonymous) visitors with 401', async () => {
    const res = await request(app)
      .post('/v1/projects')
      .send({
        title: 'Anonymous Project Attempt',
        tagline: 'Should fail auth',
        description: 'Anonymous request',
        category: 'Web Development',
      });

    assert.strictEqual(res.status, 401);
  });

  it('rejects creation from non-institutional accounts with 403', async () => {
    const res = await request(app)
      .post('/v1/projects')
      .set('Authorization', `Bearer ${nonInstToken}`)
      .send({
        title: 'Unauthorized Project',
        tagline: 'Should fail registration eligibility',
        description: 'This is a test project from an external account',
        category: 'Web Development',
        coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
      });

    assert.strictEqual(res.status, 403);
    assert.match(res.body.detail || res.body.error || '', /institutional email account/i);
  });

  it('rejects creation from unverified student accounts with 403', async () => {
    const res = await request(app)
      .post('/v1/projects')
      .set('Authorization', `Bearer ${unverifiedStudentToken}`)
      .send({
        title: 'Unverified Student Project',
        tagline: 'Should fail verification check',
        description: 'This is a test project from an unverified institutional account',
        category: 'Web Development',
        coverImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
      });

    assert.strictEqual(res.status, 403);
    assert.match(res.body.detail || res.body.error || '', /verified institutional email account/i);
  });

  it('allows verified institutional student to create a draft without links', async () => {
    const res = await request(app)
      .post('/v1/projects')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: 'Automated Campus Shuttle Tracker',
        tagline: 'Live GPS and occupancy tracking for campus transit',
        description: 'A full-stack tracking application built with React Native and Node.js for campus commuters.',
        category: 'Mobile Applications',
        tags: ['React Native', 'GPS', 'Node.js', 'PostgreSQL'],
        projectType: 'PERSONAL',
        developmentStatus: 'PROTOTYPE',
        coverImageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
        publishNow: false,
      });

    if (res.status !== 201) {
      console.log('CREATE DRAFT FAILED:', res.status, res.body);
    }
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.title, 'Automated Campus Shuttle Tracker');
    assert.strictEqual(res.body.visibility, 'DRAFT');
    assert.ok(res.body.id);
    assert.ok(res.body.slug.startsWith('automated-campus-shuttle-tracker'));

    createdProjectId = res.body.id;
    createdProjectSlug = res.body.slug;
  });

  it('rejects publishing if rightsConfirmed is false', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/publish`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ rightsConfirmed: false });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.detail || res.body.error || '', /rights to showcase|rights to publish|ownership/i);
  });

  it('rejects publishing if project lacks at least one public showcase link', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/publish`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ rightsConfirmed: true });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.detail || res.body.error || '', /showcase artifact|showcase link/i);
  });

  it('publishes project successfully after adding repository link', async () => {
    // First update project with showcase link
    const updateRes = await request(app)
      .put(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        links: [
          {
            type: 'REPOSITORY',
            url: 'https://github.com/nst-sdc/campus-shuttle-tracker',
            label: 'Source Code',
          },
          {
            type: 'DEMO',
            url: 'https://shuttle.nstcampus.live',
            label: 'Live Web Demo',
          },
        ],
      });
    assert.strictEqual(updateRes.status, 200);

    // Now publish
    const pubRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/publish`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ rightsConfirmed: true });

    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.visibility, 'PUBLISHED');
    assert.ok(pubRes.body.publishedAt);
  });

  // =========================================================================
  // 2. Slug Generation, Suffixing, and Historical Redirection
  // =========================================================================
  it('auto-suffixes duplicate title slug on creation', async () => {
    const res = await request(app)
      .post('/v1/projects')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        title: 'Automated Campus Shuttle Tracker', // Same title
        tagline: 'Another take on the transit tracker',
        description: 'A different implementation by Bob.',
        category: 'Mobile Applications',
        coverImageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
        publishNow: false,
      });

    assert.strictEqual(res.status, 201);
    assert.notStrictEqual(res.body.slug, createdProjectSlug);
    assert.ok(res.body.slug.startsWith('automated-campus-shuttle-tracker-'));

    // Clean up second project
    await adminPrisma.$executeRaw`DELETE FROM projects WHERE id = ${res.body.id}::uuid`;
  });

  it('changes project slug and records historical redirect', async () => {
    const oldSlug = createdProjectSlug;
    const newSlug = `shuttle-tracker-${Date.now().toString().slice(-6)}`;

    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/slug`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ slug: newSlug });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.slug, newSlug);
    createdProjectSlug = newSlug;

    // Accessing with oldSlug should return redirect info
    const getOldRes = await request(app)
      .get(`/v1/projects/${oldSlug}`);

    assert.strictEqual(getOldRes.status, 200);
    assert.strictEqual(getOldRes.body.redirect, true);
    assert.strictEqual(getOldRes.body.canonical_slug, newSlug);
  });

  // =========================================================================
  // 3. Public Discovery, Views, and Anonymous Isolation
  // =========================================================================
  it('public landing page lists published projects with safe author projection', async () => {
    const res = await request(app)
      .get('/v1/projects')
      .query({ view: 'recent' });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
    assert.ok(res.body.pagination.total >= 1);

    const found = res.body.items.find((p: any) => p.id === createdProjectId);
    assert.ok(found);
    assert.strictEqual(found.title, 'Automated Campus Shuttle Tracker');
    assert.strictEqual(found.author.name, 'Alice Creator');
    // Verify no leak of author email or phone
    assert.strictEqual(found.author.email, undefined);
    assert.strictEqual(found.author.phone, undefined);
  });

  it('supports 4 ranking views: explore, trending, most_liked, recent', async () => {
    for (const view of ['explore', 'trending', 'most_liked', 'recent']) {
      const res = await request(app)
        .get('/v1/projects')
        .query({ view, limit: 5 });
      assert.strictEqual(res.status, 200, `Failed view ${view}`);
      assert.ok(Array.isArray(res.body.items));
    }
  });

  it('hides unpublished/draft projects from public discovery', async () => {
    // Unpublish project
    const unpubRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/unpublish`)
      .set('Authorization', `Bearer ${student1Token}`);
    assert.strictEqual(unpubRes.status, 200);

    // Public list should not contain it
    const listRes = await request(app)
      .get('/v1/projects')
      .query({ search: 'Shuttle Tracker' });
    const foundInList = listRes.body.items.find((p: any) => p.id === createdProjectId);
    assert.strictEqual(foundInList, undefined);

    // Anonymous detail query should 404
    const anonDetailRes = await request(app)
      .get(`/v1/projects/${createdProjectSlug}`);
    assert.strictEqual(anonDetailRes.status, 404);

    // Other student should 404
    const otherStudentRes = await request(app)
      .get(`/v1/projects/${createdProjectSlug}`)
      .set('Authorization', `Bearer ${student2Token}`);
    assert.strictEqual(otherStudentRes.status, 404);

    // Owner can still view it
    const ownerDetailRes = await request(app)
      .get(`/v1/projects/${createdProjectSlug}`)
      .set('Authorization', `Bearer ${student1Token}`);
    assert.strictEqual(ownerDetailRes.status, 200);
    assert.strictEqual(ownerDetailRes.body.visibility, 'UNPUBLISHED');

    // Re-publish for remaining tests
    const repubRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/publish`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ rightsConfirmed: true });
    assert.strictEqual(repubRes.status, 200);
  });

  // =========================================================================
  // 4. Likes Integrity, Concurrency, and Self-Like Prevention
  // =========================================================================
  it('prevents project owner from liking their own project', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/like`)
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(res.status, 400);
    assert.match(res.body.detail || res.body.error || '', /cannot like their own project/i);
  });

  it('allows another verified student to like and increments like count', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/like`)
      .set('Authorization', `Bearer ${student2Token}`);

    if (res.status !== 200) {
      console.log('LIKE WITH STUDENT 2 FAILED:', res.status, res.body);
    }
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.liked, true);
    assert.strictEqual(res.body.like_count, 1);

    // Public detail should show updated like count
    const detailRes = await request(app).get(`/v1/projects/${createdProjectSlug}`);
    assert.strictEqual(detailRes.body.like_count, 1);
  });

  it('is idempotent on repeated like requests (unique constraint safe)', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/like`)
      .set('Authorization', `Bearer ${student2Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.liked, true);
    assert.strictEqual(res.body.like_count, 1);
  });

  it('allows student to unlike and decrements count', async () => {
    const res = await request(app)
      .delete(`/v1/projects/${createdProjectId}/like`)
      .set('Authorization', `Bearer ${student2Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.liked, false);
    assert.strictEqual(res.body.like_count, 0);
  });

  // =========================================================================
  // 5. Contributors Workflow
  // =========================================================================
  it('allows project owner to invite another student collaborator', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        email: 'bob.student@newtonschool.co',
        role: 'Mobile Lead & Frontend Developer',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, 'PENDING');
    assert.strictEqual(res.body.role, 'Mobile Lead & Frontend Developer');
    contributorRecordId = res.body.id;

    // Pending contributor should NOT be displayed on public project page
    const detailRes = await request(app).get(`/v1/projects/${createdProjectSlug}`);
    assert.strictEqual(detailRes.body.contributors.length, 0);
  });

  it('collaborator can accept invitation and is then credited publicly', async () => {
    const res = await request(app)
      .post(`/v1/projects/contributors/${contributorRecordId}/respond`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ status: 'ACCEPTED' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ACCEPTED');

    // Now public detail should display accepted contributor
    const detailRes = await request(app).get(`/v1/projects/${createdProjectSlug}`);
    assert.strictEqual(detailRes.body.contributors.length, 1);
    assert.strictEqual(detailRes.body.contributors[0].name, 'Bob Collaborator');
    assert.strictEqual(detailRes.body.contributors[0].role, 'Mobile Lead & Frontend Developer');
  });

  // =========================================================================
  // 6. Abuse Reports and Moderator Workflow
  // =========================================================================
  it('allows visitors to submit abuse report with private reporter protection', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/report`)
      .send({
        reason: 'SPAM',
        details: 'Suspected duplicate testing content for review',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    // Reporter ID and internal report fields MUST NOT be exposed
    assert.strictEqual(res.body.reporterId, undefined);
    assert.strictEqual(res.body.resolutionNotes, undefined);
  });

  it('admin can list reports', async () => {
    const res = await request(app)
      .get('/v1/admin/projects/reports')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
    const found = res.body.items.find((r: any) => r.project?.id === createdProjectId);
    assert.ok(found);
    assert.strictEqual(found.reason, 'SPAM');
    reportId = found.id;
  });

  it('admin can moderate project with HIDE action', async () => {
    const res = await request(app)
      .post(`/v1/admin/projects/${createdProjectId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'HIDE',
        reason: 'Temporarily hidden while reviewing user report',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.action, 'HIDE');

    // Verify project is now hidden from public visitors
    const publicCheck = await request(app).get(`/v1/projects/${createdProjectSlug}`);
    assert.strictEqual(publicCheck.status, 404);
  });

  it('admin can resolve the report', async () => {
    const res = await request(app)
      .post(`/v1/admin/projects/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        resolutionNotes: 'Reviewed and handled appropriately',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'RESOLVED');
  });

  it('admin can RESTORE project to public visibility', async () => {
    const res = await request(app)
      .post(`/v1/admin/projects/${createdProjectId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'RESTORE',
        reason: 'Review complete; project approved for public showcase',
      });

    assert.strictEqual(res.status, 200);

    // Now public again
    const publicCheck = await request(app).get(`/v1/projects/${createdProjectSlug}`);
    assert.strictEqual(publicCheck.status, 200);
    assert.strictEqual(publicCheck.body.visibility, 'PUBLISHED');
  });

  // =========================================================================
  // 7. My Projects Dashboard Endpoint
  // =========================================================================
  it('returns student own projects with status badges and stats', async () => {
    const res = await request(app)
      .get('/v1/projects/my')
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.owned));
    assert.ok(res.body.stats);
    assert.strictEqual(res.body.stats.total, 1);
    assert.strictEqual(res.body.stats.published, 1);

    // Verify contributor view for student2
    const res2 = await request(app)
      .get('/v1/projects/my')
      .set('Authorization', `Bearer ${student2Token}`);

    assert.strictEqual(res2.status, 200);
    assert.ok(Array.isArray(res2.body.contributing));
    assert.strictEqual(res2.body.contributing.length, 1);
    assert.strictEqual(res2.body.contributing[0].role, 'Mobile Lead & Frontend Developer');
  });

  // =========================================================================
  // 8. Security Audit: BOLA, Ownership, & Authorization Enforcement
  // =========================================================================
  it('Authentication: rejects anonymous PATCH attempt with 401', async () => {
    const res = await request(app)
      .patch(`/v1/projects/${createdProjectId}`)
      .send({ title: 'Hacked Title Anonymous' });

    assert.strictEqual(res.status, 401);
  });

  it('Authentication: rejects anonymous publish attempt with 401', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/publish`)
      .send({ rightsConfirmed: true });

    assert.strictEqual(res.status, 401);
  });

  it('Authentication: rejects anonymous /projects/my access with 401', async () => {
    const res = await request(app).get('/v1/projects/my');
    assert.strictEqual(res.status, 401);
  });

  it('BOLA: non-owner student cannot edit another student project', async () => {
    const res = await request(app)
      .patch(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ title: 'Hacked Title Attempt' });

    assert.strictEqual(res.status, 403);
  });

  it('BOLA: non-owner student cannot unpublish another student project', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/unpublish`)
      .set('Authorization', `Bearer ${student2Token}`);

    assert.strictEqual(res.status, 403);
  });

  it('BOLA: non-owner student cannot change another student project slug', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/slug`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ slug: 'hacked-slug-attempt' });

    assert.strictEqual(res.status, 403);
  });

  it('BOLA: non-owner student cannot delete another student project', async () => {
    const res = await request(app)
      .delete(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student2Token}`);

    assert.strictEqual(res.status, 403);
  });

  it('Counter & Field Integrity: client-supplied likeCount or ownerId cannot tamper with records', async () => {
    const res = await request(app)
      .patch(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        likeCount: 9999,
        viewCount: 8888,
        ownerId: student2Id,
      });

    assert.strictEqual(res.status, 200);
    // Verified likeCount and viewCount were not overwritten
    const check = await request(app).get(`/v1/projects/${createdProjectSlug}`);
    assert.notStrictEqual(check.body.like_count, 9999);
    assert.notStrictEqual(check.body.author.name, 'Bob Collaborator');
  });

  it('Role Authorization: non-admin student cannot access admin reports or moderation', async () => {
    const reportsRes = await request(app)
      .get('/v1/admin/projects/reports')
      .set('Authorization', `Bearer ${student1Token}`);
    assert.strictEqual(reportsRes.status, 403);

    const moderateRes = await request(app)
      .post(`/v1/admin/projects/${createdProjectId}/moderate`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ action: 'HIDE', reason: 'Student trying to hide' });
    assert.strictEqual(moderateRes.status, 403);
  });

  it('Liking Integrity: student cannot like an unpublished/draft project', async () => {
    // Unpublish project first
    await request(app)
      .post(`/v1/projects/${createdProjectId}/unpublish`)
      .set('Authorization', `Bearer ${student1Token}`);

    // Student 2 tries to like unpublished project
    const likeRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/like`)
      .set('Authorization', `Bearer ${student2Token}`);
    assert.strictEqual(likeRes.status, 404);

    // Restore to published
    await request(app)
      .post(`/v1/projects/${createdProjectId}/publish`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ rightsConfirmed: true });
  });

  it('RLS Isolation: non-admin students cannot SELECT from project_reports under PostgreSQL RLS', async () => {
    // 1. Non-admin student queries project_reports under their own user context
    const studentReportQuery = await withUserContext(student1Id, async (tx) => {
      return tx.projectReport.findMany();
    });
    assert.strictEqual(studentReportQuery.length, 0, 'RLS must return 0 rows to non-admin student');

    // 2. Platform Admin queries project_reports under their user context
    const adminReportQuery = await withUserContext(adminId, async (tx) => {
      return tx.projectReport.findMany();
    });
    assert.ok(adminReportQuery.length > 0, 'RLS must allow platform admin to query reports');
  });
});
