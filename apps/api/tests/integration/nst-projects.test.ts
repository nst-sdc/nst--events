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
    await adminPrisma.$executeRaw`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_moderation_actions WHERE actor_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_reports WHERE reporter_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_likes WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails}))`;
    await adminPrisma.$executeRaw`DELETE FROM project_contributors WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${testEmails})) OR project_id IN (SELECT id FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = ANY(${testEmails})))`;
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
  // 5. Contributors Workflow (Two-Account End-to-End Suite)
  // =========================================================================
  it('Validation: rejects collaborator invitation with non-institutional email with 400', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        email: 'outsider@gmail.com',
        role: 'Frontend Developer',
      });

    assert.strictEqual(res.status, 400);
  });

  it('Validation: rejects self-invitation by project owner with 400', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        email: 'alice.student@adypu.edu.in',
        role: 'Lead Architect',
      });

    assert.strictEqual(res.status, 400);
  });

  it('Authorization: non-owner student cannot invite collaborators to someone else project', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        email: 'carol.unverified@adypu.edu.in',
        role: 'Designer',
      });

    assert.strictEqual(res.status, 403);
  });

  it('invitation workflow: owner (Student A) invites collaborator (Student B)', async () => {
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

    // Check notification was enqueued for Student B (Bob)
    const notifications = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM notifications WHERE user_id = ${student2Id}::uuid AND type = 'PROJECT_INVITATION'
    `;
    assert.ok(notifications.length >= 1);
    assert.match(notifications[0].title, /Project Collaboration Invitation/i);
  });

  it('pending invitations must NOT appear on public project screen', async () => {
    const detailRes = await request(app).get(`/v1/projects/${createdProjectSlug}`);
    assert.strictEqual(detailRes.body.contributors.length, 0);
  });

  it('owner immediately sees PENDING invitation in GET /v1/projects/:id/contributors under RLS', async () => {
    // Owner sees pending invitation with full details
    const ownerRes = await request(app)
      .get(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(ownerRes.status, 200);
    assert.strictEqual(ownerRes.body.length, 1);
    assert.strictEqual(ownerRes.body[0].id, contributorRecordId);
    assert.strictEqual(ownerRes.body[0].status, 'PENDING');
    assert.strictEqual(ownerRes.body[0].email, 'bob.student@newtonschool.co');
    assert.strictEqual(ownerRes.body[0].role, 'Mobile Lead & Frontend Developer');

    // Anonymous visitor gets 0 contributors because invitation is still PENDING
    const publicRes = await request(app).get(`/v1/projects/${createdProjectId}/contributors`);
    assert.strictEqual(publicRes.status, 200);
    assert.strictEqual(publicRes.body.length, 0);
  });

  it('recipient inbox: Student B sees the pending invitation in /v1/projects/my and receives in-app notification', async () => {
    // 1. In-app notification inbox
    const notifRes = await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${student2Token}`);
    assert.strictEqual(notifRes.status, 200);
    assert.ok(notifRes.body.data.length >= 1);
    const inviteNotif = notifRes.body.data.find((n: any) => n.type === 'PROJECT_INVITATION');
    assert.ok(inviteNotif);
    assert.strictEqual(inviteNotif.metadata.entity_ids.project_id, createdProjectId);
    assert.strictEqual(inviteNotif.metadata.entity_ids.contributor_id, contributorRecordId);

    // 2. /v1/projects/my contributing list
    const res = await request(app)
      .get('/v1/projects/my')
      .set('Authorization', `Bearer ${student2Token}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.contributing));
    const inv = res.body.contributing.find((c: any) => c.id === contributorRecordId || c.contributor_id === contributorRecordId);
    assert.ok(inv);
    assert.strictEqual(inv.status, 'PENDING');
    assert.strictEqual(inv.role, 'Mobile Lead & Frontend Developer');
    assert.strictEqual(inv.project.id, createdProjectId);
  });

  it('duplicate protection: rejects repeated invitation to same collaborator with 409 Conflict', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        email: 'bob.student@newtonschool.co',
        role: 'Duplicate Lead Attempt',
      });

    assert.strictEqual(res.status, 409);
  });

  it('BOLA: unauthorized third party (Student C) cannot respond to Bob invitation', async () => {
    const res = await request(app)
      .post(`/v1/projects/contributors/${contributorRecordId}/respond`)
      .set('Authorization', `Bearer ${unverifiedStudentToken}`)
      .send({ status: 'ACCEPTED' });

    assert.ok(res.status === 403 || res.status === 404);
  });

  it('acceptance: Student B accepts invitation and is credited publicly', async () => {
    const res = await request(app)
      .post(`/v1/projects/contributors/${contributorRecordId}/respond`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ status: 'ACCEPTED' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ACCEPTED');

    // Verify owner (Student A) receives an in-app notification of acceptance
    const ownerNotifications = await adminPrisma.$queryRaw<any[]>`
      SELECT * FROM notifications WHERE user_id = ${student1Id}::uuid AND type = 'PROJECT_COLLABORATION_ACCEPTED'
    `;
    assert.ok(ownerNotifications.length >= 1);

    // Now public detail should display accepted contributor
    const detailRes = await request(app).get(`/v1/projects/${createdProjectSlug}`);
    assert.strictEqual(detailRes.body.contributors.length, 1);
    assert.strictEqual(detailRes.body.contributors[0].name, 'Bob Collaborator');
    assert.strictEqual(detailRes.body.contributors[0].role, 'Mobile Lead & Frontend Developer');
  });

  it('replay protection: cannot accept or decline an already accepted invitation', async () => {
    const resAcceptAgain = await request(app)
      .post(`/v1/projects/contributors/${contributorRecordId}/respond`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ status: 'ACCEPTED' });

    assert.strictEqual(resAcceptAgain.status, 400);

    const resDecline = await request(app)
      .post(`/v1/projects/contributors/${contributorRecordId}/respond`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ status: 'DECLINED' });

    assert.strictEqual(resDecline.status, 400);
  });

  it('conflict protection: cannot invite an already accepted collaborator', async () => {
    const res = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        email: 'bob.student@newtonschool.co',
        role: 'Re-Invite Attempt',
      });

    assert.strictEqual(res.status, 409);
  });

  it('permissions: accepted collaborator cannot delete, publish, change slug, or invite others', async () => {
    // Bob cannot delete
    const delRes = await request(app)
      .delete(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student2Token}`);
    assert.strictEqual(delRes.status, 403);

    // Bob cannot publish
    const pubRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/publish`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ rightsConfirmed: true });
    assert.strictEqual(pubRes.status, 403);

    // Bob cannot unpublish
    const unpubRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/unpublish`)
      .set('Authorization', `Bearer ${student2Token}`);
    assert.strictEqual(unpubRes.status, 403);

    // Bob cannot change slug
    const slugRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/slug`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ slug: 'hacked-slug-by-collaborator' });
    assert.strictEqual(slugRes.status, 403);

    // Bob cannot invite others
    const invRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ email: 'carol.unverified@adypu.edu.in', role: 'Tester' });
    assert.strictEqual(invRes.status, 403);
  });

  it('contributor management endpoint: GET /v1/projects/:id/contributors returns full details for owner, but accepted only for public', async () => {
    // Owner sees list with email and status
    const ownerRes = await request(app)
      .get(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`);
    assert.strictEqual(ownerRes.status, 200);
    assert.ok(ownerRes.body.length >= 1);
    assert.strictEqual(ownerRes.body[0].email, 'bob.student@newtonschool.co');

    // Public / non-owner sees only accepted and does not leak private email
    const publicRes = await request(app)
      .get(`/v1/projects/${createdProjectId}/contributors`);
    assert.strictEqual(publicRes.status, 200);
    assert.ok(publicRes.body.length >= 1);
    assert.strictEqual(publicRes.body[0].email, undefined);
  });

  it('decline & reopen workflow: Carol declines invitation, re-inviting reopens to PENDING', async () => {
    // 1. Owner invites Carol
    const invRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        email: 'carol.unverified@adypu.edu.in',
        role: 'Data Scientist',
      });
    assert.strictEqual(invRes.status, 201);
    const carolRecordId = invRes.body.id;

    // 2. Carol declines
    const declineRes = await request(app)
      .post(`/v1/projects/contributors/${carolRecordId}/respond`)
      .set('Authorization', `Bearer ${unverifiedStudentToken}`)
      .send({ status: 'DECLINED' });
    assert.strictEqual(declineRes.status, 200);
    assert.strictEqual(declineRes.body.status, 'DECLINED');

    // 3. Re-inviting Carol reopens the record to PENDING
    const reopenRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        email: 'carol.unverified@adypu.edu.in',
        role: 'Senior Data Scientist',
      });
    assert.strictEqual(reopenRes.status, 201);
    assert.strictEqual(reopenRes.body.status, 'PENDING');
    assert.strictEqual(reopenRes.body.role, 'Senior Data Scientist');
    assert.strictEqual(reopenRes.body.id, carolRecordId);

    // 4. Owner revokes/cancels Carol's pending invitation
    const delRes = await request(app)
      .delete(`/v1/projects/${createdProjectId}/contributors/${carolRecordId}`)
      .set('Authorization', `Bearer ${student1Token}`);
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);

    // 5. Cancelled invitation cannot be responded to (404)
    const respCancelled = await request(app)
      .post(`/v1/projects/contributors/${carolRecordId}/respond`)
      .set('Authorization', `Bearer ${unverifiedStudentToken}`)
      .send({ status: 'ACCEPTED' });
    assert.strictEqual(respCancelled.status, 404);
  });

  it('revocation authorization: non-owner student cannot delete another owner collaborator', async () => {
    const res = await request(app)
      .delete(`/v1/projects/${createdProjectId}/contributors/${contributorRecordId}`)
      .set('Authorization', `Bearer ${unverifiedStudentToken}`);
    assert.strictEqual(res.status, 403);
  });

  it('reconciliation: invitation sent to unregistered institutional email is linked upon login or project list', async () => {
    // 1. Owner invites an institutional email that has no user record yet
    const orphanEmail = 'future.student@adypu.edu.in';
    const invRes = await request(app)
      .post(`/v1/projects/${createdProjectId}/contributors`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        email: orphanEmail,
        role: 'Research Assistant',
      });
    assert.strictEqual(invRes.status, 201);
    assert.strictEqual(invRes.body.status, 'PENDING');
    assert.strictEqual(invRes.body.userId, null);
    const orphanRecordId = invRes.body.id;

    // 2. Now user signs up / gets created
    const newUser = await adminPrisma.user.create({
      data: {
        email: orphanEmail,
        googleSub: 'gsub_future_student',
        fullName: 'Future Student',
        globalRole: 'STUDENT',
        securityVersion: 1,
      },
    });

    const newJwt = signJwt(newUser.id, 1);

    // 3. User accesses /v1/projects/my -> triggers automatic reconciliation
    const myProjectsRes = await request(app)
      .get('/v1/projects/my')
      .set('Authorization', `Bearer ${newJwt}`);
    assert.strictEqual(myProjectsRes.status, 200);
    const found = myProjectsRes.body.contributing.find((c: any) => c.id === orphanRecordId || c.contributor_id === orphanRecordId);
    assert.ok(found);
    assert.strictEqual(found.status, 'PENDING');

    // 4. Verify in-app notification is enqueued for the newly registered user
    const notifRes = await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${newJwt}`);
    assert.strictEqual(notifRes.status, 200);
    assert.ok(notifRes.body.data.length >= 1);
    assert.strictEqual(notifRes.body.data[0].type, 'PROJECT_INVITATION');

    // 5. Clean up
    await adminPrisma.projectContributor.delete({ where: { id: orphanRecordId } });
    await adminPrisma.notification.deleteMany({ where: { userId: newUser.id } });
    await adminPrisma.user.delete({ where: { id: newUser.id } });
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

  // =========================================================================
  // 9. Project Editing & Persistence Regression Suite
  // =========================================================================
  it('Project Edit: student owner can successfully edit all fields via PUT /v1/projects/:id and persist', async () => {
    const updatePayload = {
      title: 'Autonomous Shuttle Tracker v2',
      tagline: 'Next-gen live bus tracker with low-latency WebSockets',
      description: 'Updated comprehensive technical overview with deep architecture details.',
      category: 'Cloud / DevOps',
      tags: ['websockets', 'nextjs', 'kafka'],
      projectType: 'OPEN_SOURCE',
      developmentStatus: 'LIVE',
      coverImageUrl: 'https://images.unsplash.com/photo-shuttle-updated',
      problemStatement: 'Tracking buses in rural campus areas with intermittent network.',
      solution: 'Offline-first queue with opportunistic WebSocket sync.',
      implementationDetails: 'Rust telemetry daemon feeding into Kafka cluster.',
      personalContribution: 'Built the core telemetry sync engine.',
      whatsNext: 'Hardware sensor integration.',
      links: [
        { type: 'DEMO', url: 'https://shuttle-v2.nst.dev', label: 'Live v2', order: 0 },
        { type: 'REPOSITORY', url: 'https://github.com/nst/shuttle-v2', label: 'Source', order: 1 },
      ],
    };

    const res = await request(app)
      .put(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send(updatePayload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.title, 'Autonomous Shuttle Tracker v2');
    assert.strictEqual(res.body.tagline, 'Next-gen live bus tracker with low-latency WebSockets');
    assert.strictEqual(res.body.category, 'Cloud / DevOps');
    assert.strictEqual(res.body.links.length, 2);

    // Verify persistence via GET
    const getRes = await request(app)
      .get(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.title, 'Autonomous Shuttle Tracker v2');
    assert.strictEqual(getRes.body.problem_statement, 'Tracking buses in rural campus areas with intermittent network.');
    assert.strictEqual(getRes.body.solution, 'Offline-first queue with opportunistic WebSocket sync.');
    assert.strictEqual(getRes.body.implementation_details, 'Rust telemetry daemon feeding into Kafka cluster.');
    assert.strictEqual(getRes.body.is_owner, true);
    assert.strictEqual(getRes.body.owner_id, student1Id);
  });

  it('Project Edit Validation: rejects PUT with missing or empty title with 400', async () => {
    const res = await request(app)
      .put(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: '',
        tagline: 'Valid tagline',
        description: 'Valid description',
      });

    assert.strictEqual(res.status, 400);
  });

  it('Project Edit Validation: rejects PUT with invalid link URLs with 400', async () => {
    const res = await request(app)
      .put(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: 'Title',
        links: [{ type: 'DEMO', url: 'ftp://not-an-http-link' }],
      });

    assert.strictEqual(res.status, 400);
  });

  it('Project Edit Authorization: non-owner student cannot edit via PUT /v1/projects/:id (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        title: 'Malicious Overwrite Attempt',
      });

    assert.strictEqual(res.status, 403);
  });

  it('Project Edit Visibility: editing draft project does not silently publish it', async () => {
    // 1. Create a draft project
    const draftRes = await request(app)
      .post('/v1/projects')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: 'Secret Draft Project',
        tagline: 'Work in progress stealth project',
        description: 'Detailed stealth plan that is not yet ready for public release.',
        category: 'Research',
        coverImageUrl: 'https://images.unsplash.com/photo-draft',
        publishNow: false,
      });

    assert.strictEqual(draftRes.status, 201);
    assert.strictEqual(draftRes.body.visibility, 'DRAFT');
    const draftId = draftRes.body.id;
    const draftSlug = draftRes.body.slug;

    // 2. Edit draft project without publishNow
    const editRes = await request(app)
      .put(`/v1/projects/${draftId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: 'Secret Draft Project v2',
        description: 'Updated draft notes.',
      });

    assert.strictEqual(editRes.status, 200);
    assert.strictEqual(editRes.body.visibility, 'DRAFT');

    // 3. Anonymous visitor should NOT be able to view draft (404)
    const publicRes = await request(app).get(`/v1/projects/${draftSlug}`);
    assert.strictEqual(publicRes.status, 404);

    // 4. Other student should NOT be able to view draft (404)
    const otherStudentRes = await request(app)
      .get(`/v1/projects/${draftSlug}`)
      .set('Authorization', `Bearer ${student2Token}`);
    assert.strictEqual(otherStudentRes.status, 404);

    // 5. Project owner CAN view their draft (200)
    const ownerRes = await request(app)
      .get(`/v1/projects/${draftSlug}`)
      .set('Authorization', `Bearer ${student1Token}`);
    assert.strictEqual(ownerRes.status, 200);
    assert.strictEqual(ownerRes.body.title, 'Secret Draft Project v2');
    assert.strictEqual(ownerRes.body.is_owner, true);

    // Clean up draft project
    await request(app)
      .delete(`/v1/projects/${draftId}`)
      .set('Authorization', `Bearer ${student1Token}`);
  });

  it('Project Edit Concurrency & Deletion: cannot edit deleted project (404)', async () => {
    // Create and immediately delete a project
    const newProj = await request(app)
      .post('/v1/projects')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: 'To Be Deleted Project',
        tagline: 'Short lived project',
        description: 'Will be deleted immediately',
        category: 'Other',
        coverImageUrl: 'https://images.unsplash.com/photo-delete',
      });

    const toDeleteId = newProj.body.id;

    await request(app)
      .delete(`/v1/projects/${toDeleteId}`)
      .set('Authorization', `Bearer ${student1Token}`);

    // Attempt to edit deleted project
    const editDeletedRes = await request(app)
      .put(`/v1/projects/${toDeleteId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: 'Revival Attempt',
      });

    assert.strictEqual(editDeletedRes.status, 404);
  });

  it('Project Edit Moderation: cannot edit project that has been REMOVED by moderators (403)', async () => {
    // Admin removes project for violation
    await request(app)
      .post(`/v1/admin/projects/${createdProjectId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'REMOVE', reason: 'Terms of service violation' });

    // Student tries to edit removed project (soft-deleted -> 404)
    const editRes = await request(app)
      .put(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: 'Bypass Moderation Attempt',
      });

    assert.strictEqual(editRes.status, 404);

    // Admin restores project
    const restoreRes = await request(app)
      .post(`/v1/admin/projects/${createdProjectId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'RESTORE', reason: 'Reinstated on appeal' });
    assert.strictEqual(restoreRes.status, 200);
  });

  it('Project Edit Slug: editing customSlug updates slug and retains 301 history redirect', async () => {
    const oldSlug = createdProjectSlug;
    const newCustomSlug = `shuttle-renamed-${Date.now().toString().slice(-6)}`;

    const res = await request(app)
      .put(`/v1/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        customSlug: newCustomSlug,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.slug, newCustomSlug);

    // 1. New slug resolves directly with 200
    const newSlugRes = await request(app).get(`/v1/projects/${newCustomSlug}`);
    assert.strictEqual(newSlugRes.status, 200);
    assert.strictEqual(newSlugRes.body.title, 'Autonomous Shuttle Tracker v2');

    // 2. Old slug redirects to new slug
    const oldSlugRes = await request(app).get(`/v1/projects/${oldSlug}`);
    assert.strictEqual(oldSlugRes.status, 200);
    assert.strictEqual(oldSlugRes.body.redirect, true);
    assert.strictEqual(oldSlugRes.body.canonical_slug, newCustomSlug);
  });
});
