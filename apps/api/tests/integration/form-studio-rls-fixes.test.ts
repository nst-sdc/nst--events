import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Form Studio RLS Fixes: Registration Fields Context & Scheduled Forms Lifecycle', () => {
  // Test entities
  const adminId = randomUUID();
  const organizerId = randomUUID();
  const student1Id = randomUUID(); // Eligible student (batch1)
  const student2Id = randomUUID(); // Ineligible student (batch2)
  const clubId = randomUUID();
  const batch1Id = randomUUID();
  const batch2Id = randomUUID();
  const programId = randomUUID();

  // Events
  const draftEventId = randomUUID();
  const publishedEventId = randomUUID();
  const restrictedEventId = randomUUID(); // SPECIFIC_BATCHES (batch1 only)
  const otherEventId = randomUUID();

  // Field definitions
  const fieldDef1Id = randomUUID();
  const fieldDef2Id = randomUUID();

  // Form IDs
  const upcomingFormId = randomUUID();
  const activeFormId = randomUUID();
  const closedFormId = randomUUID();
  const unpublishedFormId = randomUUID();

  // JWT Tokens
  let adminToken: string;
  let organizerToken: string;
  let student1Token: string;
  let student2Token: string;

  before(async () => {
    // 1. Create Academic Hierarchy for audience testing
    const programCode = 'FTP_' + randomUUID().slice(0, 8);
    await adminPrisma.$executeRaw`
      INSERT INTO academic_programs (id, name, code)
      VALUES (${programId}::uuid, 'Form Test Program', ${programCode});
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO academic_batches (id, program_id, admission_year, graduation_year)
      VALUES 
        (${batch1Id}::uuid, ${programId}::uuid, 2022, 2026),
        (${batch2Id}::uuid, ${programId}::uuid, 2023, 2027);
    `;


    // 2. Create Users
    await adminPrisma.$executeRaw`
      INSERT INTO users (id, email, google_sub, full_name, global_role)
      VALUES 
        (${adminId}::uuid, 'admin_rls@test.com', 'g_admin_rls', 'Platform Admin', 'PLATFORM_ADMIN'),
        (${organizerId}::uuid, 'org_rls@test.com', 'g_org_rls', 'Club Organizer', 'STUDENT'),
        (${student1Id}::uuid, 'student1_rls@test.com', 'g_stud1_rls', 'Student 1', 'STUDENT'),
        (${student2Id}::uuid, 'student2_rls@test.com', 'g_stud2_rls', 'Student 2', 'STUDENT');
    `;

    // 3. Set Academic Profiles
    await adminPrisma.$executeRaw`
      INSERT INTO user_academic_profiles (id, user_id, batch_id, assignment_source)
      VALUES 
        (gen_random_uuid(), ${student1Id}::uuid, ${batch1Id}::uuid, 'ADMIN_OVERRIDE'),
        (gen_random_uuid(), ${student2Id}::uuid, ${batch2Id}::uuid, 'ADMIN_OVERRIDE');
    `;



    // 4. Create Club and Organizer Membership
    await adminPrisma.$executeRaw`
      INSERT INTO clubs (id, name, description, status)
      VALUES (${clubId}::uuid, 'RLS Test Club', 'Test Club', 'ACTIVE');
    `;


    await adminPrisma.$executeRaw`
      INSERT INTO club_memberships (id, club_id, user_id, role)
      VALUES (gen_random_uuid(), ${clubId}::uuid, ${organizerId}::uuid, 'CLUB_ADMIN');
    `;

    // 5. Create Events
    // draftEvent: organized by club, DRAFT
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, audience, start_time, end_time, created_by, event_type)
      VALUES (${draftEventId}::uuid, 'Draft Event', 'DRAFT', 'PUBLIC', 'ALL_STUDENTS', now() + interval '1 day', now() + interval '2 days', ${organizerId}::uuid, 'WORKSHOP');
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO event_clubs (event_id, club_id, is_primary)
      VALUES (${draftEventId}::uuid, ${clubId}::uuid, true);
    `;

    // publishedEvent: PUBLISHED, PUBLIC, ALL_STUDENTS
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, audience, start_time, end_time, created_by, event_type)
      VALUES (${publishedEventId}::uuid, 'Published Event', 'PUBLISHED', 'PUBLIC', 'ALL_STUDENTS', now(), now() + interval '1 day', ${adminId}::uuid, 'WORKSHOP');
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO event_clubs (event_id, club_id, is_primary)
      VALUES (${publishedEventId}::uuid, ${clubId}::uuid, true);
    `;


    // restrictedEvent: PUBLISHED, PUBLIC, SPECIFIC_BATCHES (batch1 only)
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, audience, start_time, end_time, created_by, event_type)
      VALUES (${restrictedEventId}::uuid, 'Restricted Event', 'PUBLISHED', 'PUBLIC', 'SPECIFIC_BATCHES', now(), now() + interval '1 day', ${adminId}::uuid, 'WORKSHOP');
    `;
    await adminPrisma.$executeRaw`
      INSERT INTO event_audience_batches (id, event_id, batch_id)
      VALUES (gen_random_uuid(), ${restrictedEventId}::uuid, ${batch1Id}::uuid);
    `;

    // otherEvent: for cross-event checks
    await adminPrisma.$executeRaw`
      INSERT INTO events (id, title, state, visibility, audience, start_time, end_time, created_by, event_type)
      VALUES (${otherEventId}::uuid, 'Other Event', 'PUBLISHED', 'PUBLIC', 'ALL_STUDENTS', now(), now() + interval '1 day', ${adminId}::uuid, 'WORKSHOP');
    `;

    // 6. Create Field Definitions
    await adminPrisma.$executeRaw`
      INSERT INTO field_definitions (id, key, label, field_type, is_reusable)
      VALUES 
        (${fieldDef1Id}::uuid, 'github_url_rls', 'GitHub URL', 'URL', true),
        (${fieldDef2Id}::uuid, 'tshirt_size_rls', 'T-Shirt Size', 'SELECT', false);
    `;

    // 7. Attach Registration Fields to Draft & Published Events
    await adminPrisma.$executeRaw`
      INSERT INTO event_form_fields (id, event_id, field_definition_id, is_required, "order", form_id)
      VALUES 
        (gen_random_uuid(), ${draftEventId}::uuid, ${fieldDef1Id}::uuid, true, 1, NULL),
        (gen_random_uuid(), ${publishedEventId}::uuid, ${fieldDef1Id}::uuid, true, 1, NULL),
        (gen_random_uuid(), ${restrictedEventId}::uuid, ${fieldDef1Id}::uuid, true, 1, NULL),
        (gen_random_uuid(), ${otherEventId}::uuid, ${fieldDef2Id}::uuid, false, 1, NULL);
    `;

    // 8. Register student1 for publishedEvent
    await adminPrisma.$executeRaw`
      INSERT INTO event_registrations (id, event_id, user_id, registration_status)
      VALUES (gen_random_uuid(), ${publishedEventId}::uuid, ${student1Id}::uuid, 'REGISTERED');
    `;

    // Generate JWT tokens
    adminToken = signJwt(adminId);
    organizerToken = signJwt(organizerId);
    student1Token = signJwt(student1Id);
    student2Token = signJwt(student2Id);
  });

  after(async () => {
    // Cleanup
    await adminPrisma.$executeRaw`DELETE FROM event_registration_responses WHERE form_id IS NOT NULL OR event_registration_id IN (SELECT id FROM event_registrations WHERE event_id IN (${draftEventId}::uuid, ${publishedEventId}::uuid, ${restrictedEventId}::uuid, ${otherEventId}::uuid));`;
    await adminPrisma.$executeRaw`DELETE FROM event_form_fields WHERE event_id IN (${draftEventId}::uuid, ${publishedEventId}::uuid, ${restrictedEventId}::uuid, ${otherEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_forms WHERE event_id IN (${draftEventId}::uuid, ${publishedEventId}::uuid, ${restrictedEventId}::uuid, ${otherEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_registrations WHERE event_id IN (${draftEventId}::uuid, ${publishedEventId}::uuid, ${restrictedEventId}::uuid, ${otherEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_audience_batches WHERE event_id IN (${restrictedEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM event_clubs WHERE event_id IN (${draftEventId}::uuid, ${publishedEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM events WHERE id IN (${draftEventId}::uuid, ${publishedEventId}::uuid, ${restrictedEventId}::uuid, ${otherEventId}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM student_profile_values WHERE field_definition_id IN (${fieldDef1Id}::uuid, ${fieldDef2Id}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM field_definitions WHERE id IN (${fieldDef1Id}::uuid, ${fieldDef2Id}::uuid) OR key LIKE 'inline_%' OR key LIKE 'direct_%';`;
    await adminPrisma.$executeRaw`DELETE FROM club_memberships WHERE club_id = ${clubId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM clubs WHERE id = ${clubId}::uuid;`;
    await adminPrisma.$executeRaw`DELETE FROM user_academic_profiles WHERE user_id IN (${student1Id}::uuid, ${student2Id}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM notifications WHERE user_id IN (${adminId}::uuid, ${organizerId}::uuid, ${student1Id}::uuid, ${student2Id}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM users WHERE id IN (${adminId}::uuid, ${organizerId}::uuid, ${student1Id}::uuid, ${student2Id}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM academic_batches WHERE id IN (${batch1Id}::uuid, ${batch2Id}::uuid);`;
    await adminPrisma.$executeRaw`DELETE FROM academic_programs WHERE id = ${programId}::uuid;`;
  });

  // =========================================================================
  // CRITICAL ISSUE 1: REGISTRATION FIELDS DATABASE CONTEXT & AUTHORIZATION
  // =========================================================================

  describe('Critical Issue 1: Registration Form Fields Authorization & Context', () => {
    it('authorized organizer can load registration fields for DRAFT event they manage', async () => {
      const res = await request(app)
        .get(`/v1/events/${draftEventId}/form-fields`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].fieldDefinitionId, fieldDef1Id);
      assert.strictEqual(res.body.data[0].fieldDefinition.key, 'github_url_rls');
    });

    it('platform admin can load registration fields for any event (including DRAFT)', async () => {
      const res = await request(app)
        .get(`/v1/events/${draftEventId}/form-fields`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].fieldDefinitionId, fieldDef1Id);
    });

    it('student cannot load registration fields for DRAFT event (returns 404)', async () => {
      const res = await request(app)
        .get(`/v1/events/${draftEventId}/form-fields`)
        .set('Authorization', `Bearer ${student1Token}`);

      assert.strictEqual(res.status, 404);
    });

    it('student loads registration fields for PUBLISHED & PUBLIC event (ALL_STUDENTS)', async () => {
      const res = await request(app)
        .get(`/v1/events/${publishedEventId}/form-fields`)
        .set('Authorization', `Bearer ${student1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].fieldDefinitionId, fieldDef1Id);
    });

    it('eligible student loads registration fields for SPECIFIC_BATCHES event', async () => {
      const res = await request(app)
        .get(`/v1/events/${restrictedEventId}/form-fields`)
        .set('Authorization', `Bearer ${student1Token}`); // student1 in batch1

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].fieldDefinitionId, fieldDef1Id);
    });

    it('ineligible student receives 403 Forbidden (AUDIENCE_NOT_ELIGIBLE) for SPECIFIC_BATCHES', async () => {
      const res = await request(app)
        .get(`/v1/events/${restrictedEventId}/form-fields`)
        .set('Authorization', `Bearer ${student2Token}`); // student2 in batch2

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.detail, 'AUDIENCE_NOT_ELIGIBLE');
    });

    it('unauthenticated caller querying /form-fields receives empty array { data: [] } under RLS', async () => {
      const res = await request(app)
        .get(`/v1/events/${publishedEventId}/form-fields`);

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, { data: [] });
    });

    it('malformed bearer token returns 401 Unauthorized', async () => {
      const res = await request(app)
        .get(`/v1/events/${publishedEventId}/form-fields`)
        .set('Authorization', 'Bearer not-a-valid-jwt-token');

      assert.strictEqual(res.status, 401);
    });

    it('cross-event isolation: fields belonging to Event A are never returned for Event B', async () => {
      const res = await request(app)
        .get(`/v1/events/${otherEventId}/form-fields`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 1);
      // otherEventId has fieldDef2Id ('tshirt_size_rls'), NOT fieldDef1Id
      assert.strictEqual(res.body.data[0].fieldDefinitionId, fieldDef2Id);
    });
  });

  // =========================================================================
  // CRITICAL ISSUE 2: SCHEDULED FORMS LIFECYCLE & RLS ENFORCEMENT
  // =========================================================================

  describe('Critical Issue 2: Scheduled Forms Discovery, Visibility & Submission Lifecycle', () => {
    let createdFormId: string;

    it('creating scheduled form via API starts as Draft (published_at IS NULL)', async () => {
      const res = await request(app)
        .post(`/v1/events/${publishedEventId}/forms`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Newly Created Scheduled Form',
          purpose: 'SUBMISSION',
          releaseAt: new Date(Date.now() + 3600000).toISOString(), // 1h in future
          closeAt: new Date(Date.now() + 7200000).toISOString(),   // 2h in future
        });

      assert.strictEqual(res.status, 201);
      createdFormId = res.body.id;
      assert.ok(createdFormId);

      // Verify that published_at starts as NULL in PostgreSQL
      const row = await adminPrisma.$queryRaw<Array<{ published_at: Date | null }>>`
        SELECT published_at FROM event_forms WHERE id = ${createdFormId}::uuid
      `;
      assert.strictEqual(row[0]?.published_at, null, 'Newly created form must start as Draft (published_at IS NULL)');

      // Students must NOT see draft form in list
      const studentListRes = await request(app)
        .get(`/v1/events/${publishedEventId}/forms`)
        .set('Authorization', `Bearer ${student1Token}`);
      assert.strictEqual(studentListRes.status, 200);
      const draftInList = studentListRes.body.data.find((f: any) => f.id === createdFormId);
      assert.strictEqual(draftInList, undefined, 'Draft form must never be returned to students');
    });

    it('publishing form with 0 questions is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/v1/events/${publishedEventId}/forms/${createdFormId}/publish`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.detail?.includes('Cannot publish a form with no questions'));
    });

    it('organizer adds question and successfully publishes form', async () => {
      // Attach a field first
      const patchRes = await request(app)
        .patch(`/v1/events/${publishedEventId}/forms/${createdFormId}/fields`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          fields: [{ fieldDefinitionId: fieldDef1Id, isRequired: true, order: 1 }]
        });
      assert.strictEqual(patchRes.status, 200);

      // Now publish
      const pubRes = await request(app)
        .post(`/v1/events/${publishedEventId}/forms/${createdFormId}/publish`)
        .set('Authorization', `Bearer ${organizerToken}`);
      assert.strictEqual(pubRes.status, 200);

      // Verify published_at is set in DB
      const row = await adminPrisma.$queryRaw<Array<{ published_at: Date | null }>>`
        SELECT published_at FROM event_forms WHERE id = ${createdFormId}::uuid
      `;
      assert.ok(row[0]?.published_at, 'published_at must be populated after publishing');
    });

    it('registered student can list upcoming scheduled form once published before releaseAt', async () => {
      const res = await request(app)
        .get(`/v1/events/${publishedEventId}/forms`)
        .set('Authorization', `Bearer ${student1Token}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      const found = res.body.data.find((f: any) => f.id === createdFormId);
      assert.ok(found, 'Upcoming published form must be visible in listEventForms for student UI unlock countdown');
      assert.strictEqual(found.title, 'Newly Created Scheduled Form');
    });

    it('organizer can unpublish form reverting it to Draft', async () => {
      const unpubRes = await request(app)
        .post(`/v1/events/${publishedEventId}/forms/${createdFormId}/unpublish`)
        .set('Authorization', `Bearer ${organizerToken}`);
      assert.strictEqual(unpubRes.status, 200);

      // Student cannot see it anymore
      const studentRes = await request(app)
        .get(`/v1/events/${publishedEventId}/forms`)
        .set('Authorization', `Bearer ${student1Token}`);
      const found = studentRes.body.data.find((f: any) => f.id === createdFormId);
      assert.strictEqual(found, undefined, 'Unpublished form must not appear to students');

      // Re-publish for remainder of lifecycle tests
      await request(app)
        .post(`/v1/events/${publishedEventId}/forms/${createdFormId}/publish`)
        .set('Authorization', `Bearer ${organizerToken}`);
    });

    it('unregistered student cannot view forms for the event (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/v1/events/${publishedEventId}/forms`)
        .set('Authorization', `Bearer ${student2Token}`); // student2 is NOT registered

      assert.strictEqual(res.status, 403);
    });

    it('fetching form fields before releaseAt is rejected with 403 (not yet available)', async () => {
      // Attach a field to the created upcoming form
      await request(app)
        .patch(`/v1/events/${publishedEventId}/forms/${createdFormId}/fields`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          fields: [{ fieldDefinitionId: fieldDef1Id, isRequired: true, order: 1 }]
        });

      const res = await request(app)
        .get(`/v1/events/${publishedEventId}/forms/${createdFormId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      assert.strictEqual(res.status, 403);
      assert.ok(res.body.detail?.includes('not yet available'));
    });

    it('submitting responses before releaseAt is rejected with 403 (not yet released)', async () => {
      const res = await request(app)
        .post(`/v1/events/${publishedEventId}/forms/${createdFormId}/responses`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          responses: [{ fieldDefinitionId: fieldDef1Id, value: 'https://github.com/test' }]
        });

      assert.strictEqual(res.status, 403);
      assert.ok(res.body.detail?.includes('not yet released'));
    });

    it('submissions succeed during active window [releaseAt, closeAt)', async () => {
      // Update form to active window: releaseAt in past, closeAt in future
      const activeRelease = new Date(Date.now() - 3600000).toISOString();
      const activeClose = new Date(Date.now() + 3600000).toISOString();

      await adminPrisma.$executeRaw`
        UPDATE event_forms 
        SET release_at = ${activeRelease}::timestamptz, close_at = ${activeClose}::timestamptz
        WHERE id = ${createdFormId}::uuid;
      `;

      const res = await request(app)
        .post(`/v1/events/${publishedEventId}/forms/${createdFormId}/responses`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          responses: [{ fieldDefinitionId: fieldDef1Id, value: 'https://github.com/active-test' }]
        });

      assert.strictEqual(res.status, 201);
      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data[0].value, 'https://github.com/active-test');
    });

    it('submitting responses at or after closeAt is rejected with 403 (closed for submissions)', async () => {
      // Update form to closed window: closeAt in past
      const pastClose = new Date(Date.now() - 60000).toISOString();
      await adminPrisma.$executeRaw`
        UPDATE event_forms 
        SET close_at = ${pastClose}::timestamptz
        WHERE id = ${createdFormId}::uuid;
      `;

      const res = await request(app)
        .post(`/v1/events/${publishedEventId}/forms/${createdFormId}/responses`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          responses: [{ fieldDefinitionId: fieldDef1Id, value: 'https://github.com/late-test' }]
        });

      assert.strictEqual(res.status, 403);
      assert.ok(res.body.detail?.includes('closed for submissions'));
    });

    it('one student cannot access or expose form responses belonging to another student', async () => {
      // Register student2 and try to view student1 responses
      const res = await request(app)
        .get(`/v1/events/${publishedEventId}/forms/${createdFormId}/responses`)
        .set('Authorization', `Bearer ${student1Token}`);

      // The responses endpoint is an organizer endpoint
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // CRITICAL ISSUE 3: BATCH SAVE WITH INLINE DEFINITIONS, TRANSACTION INTEGRITY & RLS
  // =========================================================================

  describe('Critical Issue 3: Batch Save with Inline Definitions & RLS Authorization', () => {
    const inlineKey = 'inline_diet_' + randomUUID().slice(0, 8);
    let createdInlineDefId: string;

    it('direct POST /v1/field-definitions creates definition under RLS without 42501 error', async () => {
      const directKey = 'direct_test_' + randomUUID().slice(0, 8);
      const res = await request(app)
        .post('/v1/field-definitions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          key: directKey,
          label: 'Direct Test Field',
          fieldType: 'TEXT',
          isReusable: true,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.key, directKey);

      // Cleanup
      await adminPrisma.$executeRaw`DELETE FROM field_definitions WHERE key = ${directKey};`;
    });

    it('batch save PUT /v1/events/:id/form-fields creates inline definition and event field in one transaction under RLS', async () => {
      const res = await request(app)
        .put(`/v1/events/${draftEventId}/form-fields`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          fields: [
            { fieldDefinitionId: fieldDef1Id, isRequired: true, order: 0 },
            {
              definition: {
                key: inlineKey,
                label: 'Dietary Preferences',
                fieldType: 'SELECT',
                options: ['Veg', 'Vegan', 'Jain'],
                isReusable: true,
              },
              isRequired: false,
              order: 1,
            },
          ],
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 2);
      assert.strictEqual(res.body.data[0].fieldDefinitionId, fieldDef1Id);
      assert.strictEqual(res.body.data[1].fieldDefinition.key, inlineKey);
      assert.strictEqual(res.body.data[1].fieldDefinition.fieldType, 'SELECT');
      assert.deepStrictEqual(res.body.data[1].fieldDefinition.options, ['Veg', 'Vegan', 'Jain']);

      createdInlineDefId = res.body.data[1].fieldDefinitionId;
      assert.ok(createdInlineDefId);
    });

    it('reloading GET /v1/events/:id/form-fields reflects the persisted fields accurately', async () => {
      const res = await request(app)
        .get(`/v1/events/${draftEventId}/form-fields`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 2);
      assert.strictEqual(res.body.data[0].fieldDefinitionId, fieldDef1Id);
      assert.strictEqual(res.body.data[1].fieldDefinitionId, createdInlineDefId);
      assert.strictEqual(res.body.data[1].fieldDefinition.key, inlineKey);
    });

    it('repeated save with the same inline definition key reuses existing definition without duplicate error', async () => {
      const res = await request(app)
        .put(`/v1/events/${draftEventId}/form-fields`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          fields: [
            {
              definition: {
                key: inlineKey,
                label: 'Dietary Preferences',
                fieldType: 'SELECT',
                options: ['Veg', 'Vegan', 'Jain'],
                isReusable: true,
              },
              isRequired: true, // toggled required
              order: 0,
            },
          ],
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].fieldDefinitionId, createdInlineDefId, 'Must reuse existing definition ID');
      assert.strictEqual(res.body.data[0].isRequired, true);
    });

    it('transaction rollback: failed batch save leaves existing database state completely unchanged', async () => {
      // Current fields count is 1
      const countBefore = await adminPrisma.eventFormField.count({
        where: { eventId: draftEventId, formId: null },
      });

      // Submit an invalid batch (e.g. invalid nonexistent fieldDefinitionId)
      const nonExistentId = randomUUID();
      const res = await request(app)
        .put(`/v1/events/${draftEventId}/form-fields`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          fields: [
            { fieldDefinitionId: nonExistentId, isRequired: true, order: 0 },
          ],
        });

      // Must fail with 500/400 (Foreign key violation or error)
      assert.ok(res.status >= 400);

      // Verify DB was NOT modified / rolled back
      const countAfter = await adminPrisma.eventFormField.count({
        where: { eventId: draftEventId, formId: null },
      });
      assert.strictEqual(countAfter, countBefore, 'Database fields must remain untouched after rollback');
    });

    it('unauthorized user cannot batch-save form fields (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/v1/events/${draftEventId}/form-fields`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          fields: [
            { fieldDefinitionId: fieldDef1Id, isRequired: true, order: 0 },
          ],
        });

      assert.strictEqual(res.status, 403);
    });
  });
});
