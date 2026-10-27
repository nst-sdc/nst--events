import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { mapDatabaseError } from '../../src/lib/errors/database-error-mapper';
import { NotFoundError, ConflictError, BadRequestError, UnprocessableEntityError } from '../../src/lib/errors';
import { saveRegistrationResponses, cancelRegistration } from '../../src/modules/registrations/registrations.service';
import { submitEventFormResponses } from '../../src/modules/event-forms/event-forms.service';
import { saveDraft, publishRevision, withdrawResults, restoreResults } from '../../src/modules/event-results/event-results.service';
import { projectsService } from '../../src/modules/projects/projects.service';
import { approveEvent, rejectEvent, submitForApproval, deleteEvent, cancelEvent } from '../../src/modules/events/events.service';
import { createTeam, joinTeam, leaveTeam, removeMember } from '../../src/modules/teams/teams.service';
import { attendanceService } from '../../src/modules/attendance/attendance.service';
import { enqueueNotification } from '@nst/shared';
import { prisma } from '../../src/lib/prisma';
import { withUserContext } from '@nst/database';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Workstream 14: Business Logic & Transaction Integrity Closure Integration Suite', () => {
  const runId = Date.now().toString().slice(-6);

  // User IDs
  const clubAdminId = randomUUID();
  const studentAId = randomUUID();
  const studentBId = randomUUID();
  const studentCId = randomUUID();
  const projectOwnerId = randomUUID();
  const platformAdminId = randomUUID();
  const facultyMentorId = randomUUID();

  // Club & Event IDs
  const clubId = randomUUID();
  const event1Id = randomUUID();
  const event2Id = randomUUID();
  const eventCapacityId = randomUUID();
  const eventPendingId = randomUUID();
  const eventTeamId = randomUUID();

  // Tokens
  let clubAdminToken: string;
  let studentAToken: string;
  let studentBToken: string;
  let studentCToken: string;
  let platformAdminToken: string;
  let facultyMentorToken: string;

  beforeAll(async () => {
    // 1. Create Club
    await adminPrisma.club.create({
      data: {
        id: clubId,
        name: `WS14 Club ${runId}`,
      },
    });

    // 2. Create Users
    await adminPrisma.user.createMany({
      data: [
        {
          id: clubAdminId,
          email: `clubadmin-${runId}@adypu.edu.in`,
          fullName: `Club Admin ${runId}`,
          globalRole: 'STUDENT',
          googleSub: `sub-ca-${runId}`,
          securityVersion: 1,
        },
        {
          id: studentAId,
          email: `studentA-${runId}@adypu.edu.in`,
          fullName: `Student A ${runId}`,
          globalRole: 'STUDENT',
          googleSub: `sub-stA-${runId}`,
          securityVersion: 1,
        },
        {
          id: studentBId,
          email: `studentB-${runId}@adypu.edu.in`,
          fullName: `Student B ${runId}`,
          globalRole: 'STUDENT',
          googleSub: `sub-stB-${runId}`,
          securityVersion: 1,
        },
        {
          id: studentCId,
          email: `studentC-${runId}@adypu.edu.in`,
          fullName: `Student C ${runId}`,
          globalRole: 'STUDENT',
          googleSub: `sub-stC-${runId}`,
          securityVersion: 1,
        },
        {
          id: projectOwnerId,
          email: `owner-${runId}@adypu.edu.in`,
          fullName: `Project Owner ${runId}`,
          globalRole: 'STUDENT',
          googleSub: `sub-owner-${runId}`,
          securityVersion: 1,
        },
        {
          id: platformAdminId,
          email: `platformadmin-${runId}@adypu.edu.in`,
          fullName: `Platform Admin ${runId}`,
          globalRole: 'PLATFORM_ADMIN',
          googleSub: `sub-pa-${runId}`,
          securityVersion: 1,
        },
        {
          id: facultyMentorId,
          email: `mentor-${runId}@adypu.edu.in`,
          fullName: `Faculty Mentor ${runId}`,
          globalRole: 'STUDENT',
          googleSub: `sub-fm-${runId}`,
          securityVersion: 1,
        },
      ],
    });

    // 3. Create Club Memberships
    await adminPrisma.clubMembership.createMany({
      data: [
        {
          clubId,
          userId: clubAdminId,
          role: 'CLUB_ADMIN',
        },
        {
          clubId,
          userId: facultyMentorId,
          role: 'FACULTY_MENTOR',
        },
      ],
    });

    // 4. Generate Auth Tokens
    clubAdminToken = signJwt(clubAdminId, 1);
    studentAToken = signJwt(studentAId, 1);
    studentBToken = signJwt(studentBId, 1);
    studentCToken = signJwt(studentCId, 1);
    platformAdminToken = signJwt(platformAdminId, 1);
    facultyMentorToken = signJwt(facultyMentorId, 1);
  });

  afterAll(async () => {
    try {
      const allUserIds = [clubAdminId, studentAId, studentBId, studentCId, projectOwnerId, platformAdminId, facultyMentorId];
      const allEventIds = [event1Id, event2Id, eventCapacityId, eventPendingId, eventTeamId];

      await adminPrisma.notificationJob.deleteMany({
        where: { payload: { path: ['user_id'], string_contains: runId } },
      });
      await adminPrisma.notification.deleteMany({
        where: { userId: { in: allUserIds } },
      });
      await adminPrisma.attendanceDispute.deleteMany({
        where: { eventId: { in: allEventIds } },
      });
      await adminPrisma.attendanceRecord.deleteMany({
        where: { userId: { in: allUserIds } },
      });
      await adminPrisma.attendanceSession.deleteMany({
        where: { eventId: { in: allEventIds } },
      });
      await adminPrisma.projectContributor.deleteMany({
        where: { project: { ownerId: projectOwnerId } },
      });
      await adminPrisma.project.deleteMany({
        where: { ownerId: projectOwnerId },
      });
      await adminPrisma.leaderboardScore.deleteMany({
        where: { userId: { in: allUserIds } },
      });
      await adminPrisma.eventResultSet.deleteMany({
        where: { eventId: { in: allEventIds } },
      });
      await adminPrisma.eventRegistrationResponse.deleteMany({
        where: { eventRegistration: { eventId: { in: allEventIds } } },
      });
      await adminPrisma.eventRegistration.deleteMany({
        where: { eventId: { in: allEventIds } },
      });
      await adminPrisma.team.deleteMany({
        where: { eventId: { in: allEventIds } },
      });
      await adminPrisma.eventFormField.deleteMany({
        where: { eventId: { in: allEventIds } },
      });
      await adminPrisma.eventForm.deleteMany({
        where: { eventId: { in: allEventIds } },
      });
      await adminPrisma.eventClub.deleteMany({
        where: { eventId: { in: allEventIds } },
      });
      await adminPrisma.event.deleteMany({
        where: { id: { in: allEventIds } },
      });
      await adminPrisma.clubMembership.deleteMany({
        where: { clubId },
      });
      await adminPrisma.club.deleteMany({
        where: { id: clubId },
      });
      await adminPrisma.user.deleteMany({
        where: { id: { in: allUserIds } },
      });
    } catch {}
  });

  // =========================================================================
  // 1. Preflight: Stored Procedure vs. Database Schema/System Error Mapping
  // =========================================================================
  describe('Preflight: Database Error Classification & System Error Concealment', () => {
    it('1.1: Genuine PL/pgSQL stored procedure user exception (P0001) maps to NotFoundError (404)', () => {
      const spErr = {
        code: 'P2010',
        meta: { code: 'P0001' },
        message: 'Raw query failed. Code: `P0001`. Message: ERROR: Event not found',
      };
      assert.throws(() => mapDatabaseError(spErr), (err: any) => {
        return err instanceof NotFoundError && err.statusCode === 404;
      });
    });

    it('1.2: PostgreSQL schema error (42703 column undefined) strictly fails closed and throws generic 500', () => {
      // Even if the column name contains "Event not found"
      const schemaErr = {
        code: 'P2010',
        meta: { code: '42703' },
        message: 'Raw query failed. Code: `42703`. Message: column "Event not found" does not exist',
      };
      assert.throws(() => mapDatabaseError(schemaErr), (err: any) => {
        return !(err instanceof NotFoundError) && err.message === 'An unexpected error occurred';
      });
    });

    it('1.3: PostgreSQL syntax error (42601) strictly fails closed and throws generic 500', () => {
      const syntaxErr = {
        code: 'P2010',
        meta: { code: '42601' },
        message: 'Raw query failed. Code: `42601`. Message: syntax error at or near "Session not found"',
      };
      assert.throws(() => mapDatabaseError(syntaxErr), (err: any) => {
        return !(err instanceof NotFoundError) && err.message === 'An unexpected error occurred';
      });
    });

    it('1.4: Unrelated runtime Node error containing "not found" strictly fails closed and throws generic 500', () => {
      const runtimeErr = new Error("Table 'attendance_disputes' not found in schema public");
      assert.throws(() => mapDatabaseError(runtimeErr), (err: any) => {
        return !(err instanceof NotFoundError) && err.message === 'An unexpected error occurred';
      });
    });
  });

  // =========================================================================
  // 2. Registration Responses Atomic Upsert & Concurrency
  // =========================================================================
  describe('Registration Responses: Atomic Upsert and Duplicate Payload Deduplication', () => {
    let fieldDef1Id: string;
    let registrationId: string;

    beforeAll(async () => {
      // Create Event
      await adminPrisma.event.create({
        data: {
          id: event1Id,
          title: `Event One ${runId}`,
          slug: `event-one-${runId}`,
          eventType: 'WORKSHOP',
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationMode: 'REQUIRED',
          registrationType: 'INDIVIDUAL',
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          registrationStartTime: new Date(Date.now() - 3600000),
          registrationEndTime: new Date(Date.now() + 1800000),
          createdBy: clubAdminId,
          eventClubs: {
            create: { clubId, isPrimary: true },
          },
        },
      });

      // Create Field Definition
      const fieldDef = await adminPrisma.fieldDefinition.create({
        data: {
          key: `tshirt_size_${runId}`,
          label: 'T-Shirt Size',
          fieldType: 'TEXT',
          isReusable: true,
        },
      });
      fieldDef1Id = fieldDef.id;

      // Create Event Registration for studentA
      const reg = await adminPrisma.eventRegistration.create({
        data: {
          id: randomUUID(),
          eventId: event1Id,
          userId: studentAId,
          registrationStatus: 'REGISTERED',
        },
      });
      registrationId = reg.id;
    });

    it('2.1: Duplicate fieldDefinitionId in responses payload is deduplicated and atomic upsert succeeds', async () => {
      await adminPrisma.$transaction(async (tx) => {
        await saveRegistrationResponses(tx, studentAId, registrationId, event1Id, [
          { fieldDefinitionId: fieldDef1Id, value: 'M' },
          { fieldDefinitionId: fieldDef1Id, value: 'L' }, // Duplicate entry in same payload
        ]);
      });

      const saved = await adminPrisma.eventRegistrationResponse.findMany({
        where: { eventRegistrationId: registrationId, formId: null, fieldDefinitionId: fieldDef1Id },
      });
      assert.strictEqual(saved.length, 1, 'Exactly one response row must exist');
      assert.strictEqual(saved[0].value, 'L', 'Latest value must be preserved');
    });

    it('2.2: Concurrent saveRegistrationResponses requests do not conflict or violate partial unique constraint', async () => {
      // Simulate two parallel requests saving responses on the same registration simultaneously
      await Promise.all([
        adminPrisma.$transaction(async (tx) => {
          await saveRegistrationResponses(tx, studentAId, registrationId, event1Id, [
            { fieldDefinitionId: fieldDef1Id, value: 'XL' },
          ]);
        }),
        adminPrisma.$transaction(async (tx) => {
          await saveRegistrationResponses(tx, studentAId, registrationId, event1Id, [
            { fieldDefinitionId: fieldDef1Id, value: 'XXL' },
          ]);
        }),
      ]);

      const count = await adminPrisma.eventRegistrationResponse.count({
        where: { eventRegistrationId: registrationId, formId: null, fieldDefinitionId: fieldDef1Id },
      });
      assert.strictEqual(count, 1, 'Must maintain exactly 1 response without constraint collision');
    });
  });

  // =========================================================================
  // 3. Supplemental Event Form Responses Deduplication
  // =========================================================================
  describe('Supplemental Event Forms: Duplicate Response Deduplication', () => {
    let formId: string;
    let supplementalFieldDefId: string;

    beforeAll(async () => {
      const fieldDef = await adminPrisma.fieldDefinition.create({
        data: {
          key: `dietary_pref_${runId}`,
          label: 'Dietary Preference',
          fieldType: 'TEXT',
          isReusable: false,
        },
      });
      supplementalFieldDefId = fieldDef.id;

      const form = await adminPrisma.eventForm.create({
        data: {
          eventId: event1Id,
          title: `Post-Event Survey ${runId}`,
          purpose: 'FEEDBACK',
          publishedAt: new Date(Date.now() - 60000),
          fields: {
            create: {
              eventId: event1Id,
              fieldDefinitionId: supplementalFieldDefId,
              isRequired: false,
              order: 0,
            },
          },
        },
      });
      formId = form.id;
    });

    it('3.1: Submitting supplemental form with duplicate fieldDefinitionId deduplicates cleanly', async () => {
      const saved = await submitEventFormResponses(studentAId, event1Id, formId, [
        { fieldDefinitionId: supplementalFieldDefId, value: 'Vegetarian' },
        { fieldDefinitionId: supplementalFieldDefId, value: 'Vegan' }, // Duplicate entry
      ]);

      assert.strictEqual(saved.length, 1, 'Must return exactly one response record');
      assert.strictEqual(saved[0].value, 'Vegan', 'Latest deduplicated value should be recorded');

      const dbRecords = await adminPrisma.eventRegistrationResponse.findMany({
        where: { formId, fieldDefinitionId: supplementalFieldDefId },
      });
      assert.strictEqual(dbRecords.length, 1);
    });
  });

  // =========================================================================
  // 4. Result Draft Optimistic Concurrency Invariant
  // =========================================================================
  describe('Event Results: Draft Optimistic Concurrency Invariant', () => {
    let resultSetId: string;
    let draftId: string;

    beforeAll(async () => {
      await adminPrisma.event.create({
        data: {
          id: event2Id,
          title: `Competition Event ${runId}`,
          slug: `comp-event-${runId}`,
          eventType: 'COMPETITION',
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          startTime: new Date(Date.now() - 7200000),
          endTime: new Date(Date.now() - 3600000),
          createdBy: clubAdminId,
          eventClubs: {
            create: { clubId, isPrimary: true },
          },
        },
      });

      const rs = await adminPrisma.eventResultSet.create({
        data: {
          eventId: event2Id,
          status: 'DRAFT',
        },
      });
      resultSetId = rs.id;

      const draft = await adminPrisma.eventResultRevision.create({
        data: {
          resultSetId,
          revisionNumber: 1,
          status: 'DRAFT',
          version: 1,
          createdBy: clubAdminId,
        },
      });
      draftId = draft.id;
    });

    it('4.1: Concurrent saveDraft calls on the same version reject the second request with 409 Conflict', async () => {
      const awardsPayload = [
        {
          title: 'Champion',
          award_type: 'RANKED_PLACEMENT' as const,
          placement: 1,
          display_order: 1,
          is_tied: false,
          recipients: [],
        },
      ];

      // Two concurrent organizers attempt to save with version 1
      const results = await Promise.allSettled([
        saveDraft(event2Id, clubAdminId, { version: 1, awards: awardsPayload }),
        saveDraft(event2Id, clubAdminId, { version: 1, awards: awardsPayload }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent saveDraft must succeed');
      assert.strictEqual(rejected.length, 1, 'Conflicting concurrent saveDraft must be rejected');

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.strictEqual(rejectionReason.statusCode, 409, 'Must reject with HTTP 409 Conflict');

      const updatedDraft = await adminPrisma.eventResultRevision.findUnique({ where: { id: draftId } });
      assert.strictEqual(updatedDraft?.version, 2, 'Version must be incremented exactly once');
    });
  });

  // =========================================================================
  // 5. Results Publication Invariant & Atomic Transition
  // =========================================================================
  describe('Event Results: Atomic Publication Transition Guard', () => {
    let pubEventId: string;
    let pubDraftId: string;
    let regStudentAId: string;

    beforeAll(async () => {
      pubEventId = randomUUID();
      await adminPrisma.event.create({
        data: {
          id: pubEventId,
          title: `Pub Race Event ${runId}`,
          slug: `pub-race-${runId}`,
          eventType: 'COMPETITION',
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          startTime: new Date(Date.now() - 7200000),
          endTime: new Date(Date.now() - 3600000),
          createdBy: clubAdminId,
          eventClubs: {
            create: { clubId, isPrimary: true },
          },
        },
      });

      const reg = await adminPrisma.eventRegistration.create({
        data: {
          id: randomUUID(),
          eventId: pubEventId,
          userId: studentAId,
          registrationStatus: 'REGISTERED',
        },
      });
      regStudentAId = reg.id;

      const rs = await adminPrisma.eventResultSet.create({
        data: {
          eventId: pubEventId,
          status: 'DRAFT',
        },
      });

      const draft = await adminPrisma.eventResultRevision.create({
        data: {
          resultSetId: rs.id,
          revisionNumber: 1,
          status: 'DRAFT',
          version: 1,
          createdBy: clubAdminId,
          awards: {
            create: {
              title: 'First Place Winner',
              awardType: 'RANKED_PLACEMENT',
              placement: 1,
              displayOrder: 1,
              isTied: false,
              recipients: {
                create: {
                  recipientType: 'INDIVIDUAL',
                  userId: studentAId,
                  registrationId: regStudentAId,
                },
              },
            },
          },
        },
      });
      pubDraftId = draft.id;
    });

    it('5.1: Concurrent publishRevision calls allow only one publication and reject duplicate with 409', async () => {
      const publishOptions = {
        revision_id: pubDraftId,
        version: 1,
        notify_winners: false,
        announce_participants: false,
      };

      const results = await Promise.allSettled([
        publishRevision(pubEventId, clubAdminId, publishOptions),
        publishRevision(pubEventId, clubAdminId, publishOptions),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Only one publication attempt must succeed');
      assert.strictEqual(rejected.length, 1, 'Duplicate publication attempt must be rejected');

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.strictEqual(rejectionReason.statusCode, 409, 'Must return 409 Conflict');

      // Assert database state: exactly 1 active achievement created, no duplicate scores
      const achievements = await adminPrisma.studentAchievement.findMany({
        where: { eventId: pubEventId, userId: studentAId },
      });
      assert.strictEqual(achievements.length, 1, 'Must create exactly one student achievement');
      assert.strictEqual(achievements[0].isActive, true);
    });

    it('5.2: Concurrent withdrawResults calls allow only one withdrawal and reject duplicate with 409', async () => {
      const results = await Promise.allSettled([
        withdrawResults(pubEventId, clubAdminId, 'Reason 1'),
        withdrawResults(pubEventId, clubAdminId, 'Reason 2'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Only one withdrawal must succeed');
      assert.strictEqual(rejected.length, 1, 'Duplicate withdrawal must be rejected with 409');

      const rs = await adminPrisma.eventResultSet.findUnique({ where: { eventId: pubEventId } });
      assert.strictEqual(rs?.status, 'WITHDRAWN');
    });

    it('5.3: Concurrent restoreResults calls allow only one restoration and reject duplicate with 409', async () => {
      const results = await Promise.allSettled([
        restoreResults(pubEventId, clubAdminId, 'Restore 1'),
        restoreResults(pubEventId, clubAdminId, 'Restore 2'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Only one restoration must succeed');
      assert.strictEqual(rejected.length, 1, 'Duplicate restoration must be rejected with 409');

      const rs = await adminPrisma.eventResultSet.findUnique({ where: { eventId: pubEventId } });
      assert.strictEqual(rs?.status, 'PUBLISHED');
    });
  });

  // =========================================================================
  // 6. Project Contributor Invitation Response Concurrency
  // =========================================================================
  describe('Project Showcase: Collaborator Invitation Response Concurrency Guard', () => {
    let projectId: string;
    let contributorId: string;

    beforeAll(async () => {
      const proj = await adminPrisma.project.create({
        data: {
          id: randomUUID(),
          title: `Project Showcase ${runId}`,
          slug: `project-showcase-${runId}`,
          tagline: `Showcase Tagline ${runId}`,
          description: `A test project description for collaborator testing ${runId}`,
          category: 'AI_ML',
          coverImageUrl: 'https://example.com/cover.jpg',
          ownerId: projectOwnerId,
          projectType: 'OPEN_SOURCE',
          developmentStatus: 'IN_PROGRESS',
          visibility: 'PUBLISHED',
        },
      });
      projectId = proj.id;

      const contrib = await adminPrisma.projectContributor.create({
        data: {
          id: randomUUID(),
          projectId,
          userId: studentAId,
          invitedEmail: `studentA-${runId}@adypu.edu.in`,
          role: 'DEVELOPER',
          status: 'PENDING',
        },
      });
      contributorId = contrib.id;
    });

    it('6.1: Concurrent responses to the same invitation allow only one and reject the conflicting response with 409', async () => {
      const results = await Promise.allSettled([
        projectsService.respondToContributor(studentAId, contributorId, 'ACCEPTED'),
        projectsService.respondToContributor(studentAId, contributorId, 'DECLINED'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Only one response must be accepted');
      assert.strictEqual(rejected.length, 1, 'Conflicting concurrent response must be rejected');

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.strictEqual(rejectionReason.statusCode, 409, 'Must reject with HTTP 409 Conflict');

      const contrib = await adminPrisma.projectContributor.findUnique({ where: { id: contributorId } });
      assert.ok(['ACCEPTED', 'DECLINED'].includes(contrib!.status), 'Status must be updated to either accepted or declined');
    });
  });

  // =========================================================================
  // 7. Parallel Registration Capacity Boundary
  // =========================================================================
  describe('Event Registration: Parallel Capacity Boundary Enforcement', () => {
    beforeAll(async () => {
      await adminPrisma.event.create({
        data: {
          id: eventCapacityId,
          title: `Capacity Race Event ${runId}`,
          slug: `capacity-race-${runId}`,
          eventType: 'WORKSHOP',
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationMode: 'REQUIRED',
          registrationType: 'INDIVIDUAL',
          maxCapacity: 1, // Strict capacity limit of 1 spot!
          registrationCount: 0,
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          registrationStartTime: new Date(Date.now() - 3600000),
          registrationEndTime: new Date(Date.now() + 1800000),
          createdBy: clubAdminId,
          eventClubs: {
            create: { clubId, isPrimary: true },
          },
        },
      });
    });

    it('7.1: Two users competing in parallel for the final 1 slot results in exactly 1 REGISTERED and 1 WAITLISTED', async () => {
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/v1/events/${eventCapacityId}/register`)
          .set('Authorization', `Bearer ${studentAToken}`)
          .send({}),
        request(app)
          .post(`/v1/events/${eventCapacityId}/register`)
          .set('Authorization', `Bearer ${studentBToken}`)
          .send({}),
      ]);

      assert.strictEqual(resA.status, 201);
      assert.strictEqual(resB.status, 201);

      const statuses = [resA.body.status, resB.body.status];
      assert.ok(statuses.includes('REGISTERED'), 'Exactly one user must be REGISTERED');
      assert.ok(statuses.includes('WAITLISTED'), 'The other user must be WAITLISTED');

      // Verify persisted database records
      const registrations = await adminPrisma.eventRegistration.findMany({
        where: { eventId: eventCapacityId, deletedAt: null },
      });
      assert.strictEqual(registrations.length, 2);

      const registered = registrations.filter((r) => r.registrationStatus === 'REGISTERED');
      const waitlisted = registrations.filter((r) => r.registrationStatus === 'WAITLISTED');

      assert.strictEqual(registered.length, 1, 'Only 1 registration can have REGISTERED status');
      assert.strictEqual(waitlisted.length, 1, 'Only 1 registration can have WAITLISTED status');

      // Verify event registration_count in database
      const event = await adminPrisma.event.findUnique({ where: { id: eventCapacityId } });
      assert.strictEqual(event?.registrationCount, 1, 'Event registrationCount must strictly equal 1');
    });
  });

  // =========================================================================
  // 8. Event Lifecycle & Registration Integrity
  // =========================================================================
  describe('Event Lifecycle & Registration Integrity', () => {
    beforeAll(async () => {
      // Create pending event for lifecycle transition tests
      await adminPrisma.event.create({
        data: {
          id: eventPendingId,
          title: `Pending Event ${runId}`,
          slug: `pending-event-${runId}`,
          eventType: 'WORKSHOP',
          state: 'PENDING_APPROVAL',
          visibility: 'PUBLIC',
          registrationMode: 'REQUIRED',
          registrationType: 'INDIVIDUAL',
          maxCapacity: 50,
          registrationCount: 0,
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          registrationStartTime: new Date(Date.now() - 3600000),
          registrationEndTime: new Date(Date.now() + 1800000),
          createdBy: clubAdminId,
          eventClubs: {
            create: { clubId, isPrimary: true },
          },
        },
      });

      // Create team event for team cancellation guard tests
      await adminPrisma.event.create({
        data: {
          id: eventTeamId,
          title: `Team Event ${runId}`,
          slug: `team-event-${runId}`,
          eventType: 'COMPETITION',
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationMode: 'REQUIRED',
          registrationType: 'TEAM',
          metadata: { minimum_team_size: 1, maximum_team_size: 2 },
          maxCapacity: 10,
          registrationCount: 0,
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          registrationStartTime: new Date(Date.now() - 3600000),
          registrationEndTime: new Date(Date.now() + 1800000),
          createdBy: clubAdminId,
          eventClubs: {
            create: { clubId, isPrimary: true },
          },
        },
      });
    });

    it('8.1: Conflicting lifecycle transitions: Concurrent approve and reject allow exactly one transition and reject the other with 409', async () => {
      const results = await Promise.allSettled([
        approveEvent(platformAdminId, eventPendingId),
        rejectEvent(platformAdminId, eventPendingId, 'Rejected reason'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one lifecycle transition must succeed');
      assert.strictEqual(rejected.length, 1, 'Conflicting transition must be rejected');

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(
        rejectionReason.statusCode === 409 ||
        rejectionReason.statusCode === 422 ||
        rejectionReason.semanticCode === 'RACE_CONDITION_STATE' ||
        rejectionReason.semanticCode === 'EVENT_MUST_BE_PENDING' ||
        rejectionReason.message?.includes('Race condition') ||
        rejectionReason.message?.includes('PENDING_APPROVAL'),
        'Rejection must be a state transition conflict (409 Conflict / U0045 or 422 Unprocessable / U0044)'
      );

      const ev = await adminPrisma.event.findUnique({ where: { id: eventPendingId } });
      assert.ok(['PUBLISHED', 'DRAFT'].includes(ev!.state), 'Event state must be either PUBLISHED or DRAFT');
    });

    it('8.2: Registration retry idempotency: Duplicate registration attempt is rejected with 409 Conflict without altering registrationCount', async () => {
      // First registration succeeded in Suite 7 for studentAId on eventCapacityId.
      // Attempting to register again:
      const res = await request(app)
        .post(`/v1/events/${eventCapacityId}/register`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({});

      assert.strictEqual(res.status, 409, 'Duplicate registration attempt must return HTTP 409 Conflict');

      // Verify database count did not increment
      const event = await adminPrisma.event.findUnique({ where: { id: eventCapacityId } });
      assert.strictEqual(event?.registrationCount, 1, 'Registration count must remain unchanged');
    });

    it('8.3: Team membership protection: Cancelling individual registration for a team member is rejected with 400', async () => {
      // Create team for studentA on eventTeamId
      const teamRes = await createTeam(studentAId, eventTeamId, `Alpha ${runId}`);
      assert.ok(teamRes.team_id, 'Team must be created');

      // Now studentA attempts to call DELETE /v1/events/:id/register (individual cancel)
      const res = await request(app)
        .delete(`/v1/events/${eventTeamId}/register`)
        .set('Authorization', `Bearer ${studentAToken}`);

      assert.strictEqual(res.status, 400, 'Must return 400 BadRequest when individual cancel is attempted on a team member');
      assert.match(res.body.message || res.body.detail, /team/i);

      // Verify team and registration are completely preserved
      const team = await adminPrisma.team.findUnique({ where: { id: teamRes.team_id } });
      assert.strictEqual(team?.deletedAt, null, 'Team must not be deleted');

      const reg = await adminPrisma.eventRegistration.findFirst({
        where: { eventId: eventTeamId, userId: studentAId, deletedAt: null },
      });
      assert.ok(reg, 'Member registration must remain intact');
    });

    it('8.4: Deleting a published event fails closed with 422 Unprocessable Entity', async () => {
      await assert.rejects(
        async () => {
          await deleteEvent(clubAdminId, eventCapacityId);
        },
        (err: any) => {
          return err.statusCode === 422 || err.semanticCode === 'EVENT_MUST_BE_DRAFT' || err.message?.includes('Cannot delete a non-draft event');
        }
      );

      const ev = await adminPrisma.event.findUnique({ where: { id: eventCapacityId } });
      assert.strictEqual(ev?.deletedAt, null, 'Published event must not be soft-deleted');
    });
  });

  // =========================================================================
  // 9. Teams & Membership Concurrency & Invariants
  // =========================================================================
  describe('Teams & Membership Concurrency & Invariants', () => {
    let competitionTeamId: string;
    let teamCompetitionEventId: string;

    beforeAll(async () => {
      teamCompetitionEventId = randomUUID();
      await adminPrisma.event.create({
        data: {
          id: teamCompetitionEventId,
          title: `Team Concurrency Event ${runId}`,
          slug: `team-concurrency-${runId}`,
          eventType: 'COMPETITION',
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationMode: 'REQUIRED',
          registrationType: 'TEAM',
          metadata: { minimum_team_size: 1, maximum_team_size: 2 },
          maxCapacity: 10,
          registrationCount: 0,
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          registrationStartTime: new Date(Date.now() - 3600000),
          registrationEndTime: new Date(Date.now() + 1800000),
          createdBy: clubAdminId,
          eventClubs: {
            create: { clubId, isPrimary: true },
          },
        },
      });

      // Leader (studentA) creates team (size = 1, max = 2, only 1 spot left)
      const team = await createTeam(studentAId, teamCompetitionEventId, `Concurrency Team ${runId}`);
      competitionTeamId = team.team_id;
    });

    it('9.1: Two users competing for the final spot in a team: Exactly 1 succeeds and 1 is rejected with 400 (Team is full)', async () => {
      const results = await Promise.allSettled([
        joinTeam(studentBId, competitionTeamId),
        joinTeam(studentCId, competitionTeamId),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one join request must succeed');
      assert.strictEqual(rejected.length, 1, 'The competing join request must be rejected');

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(
        rejectionReason.statusCode === 400 || rejectionReason.message?.includes('Team is full'),
        'Rejection must indicate team is full (400 BadRequest / U0021)'
      );

      // Verify persisted count: exactly 2 active registrations
      const members = await adminPrisma.eventRegistration.findMany({
        where: { teamId: competitionTeamId, deletedAt: null },
      });
      assert.strictEqual(members.length, 2, 'Team must have exactly 2 members (maximum_team_size = 2)');
    });

    it('9.2: Non-leader cannot remove team members (400 BadRequest)', async () => {
      // Find the non-leader member
      const nonLeaderId = (await adminPrisma.eventRegistration.findFirst({
        where: { teamId: competitionTeamId, deletedAt: null, userId: { not: studentAId } },
      }))!.userId;

      await assert.rejects(
        async () => {
          await removeMember(nonLeaderId, competitionTeamId, studentAId);
        },
        (err: any) => {
          return err.statusCode === 400 && err.message?.includes('Only the leader can remove members');
        }
      );
    });

    it('9.3: Leader leaving team dissolves the team and cancels all member registrations atomically', async () => {
      // Leader (studentAId) leaves
      await leaveTeam(studentAId, competitionTeamId);

      // Verify team status in DB
      const team = await adminPrisma.team.findUnique({ where: { id: competitionTeamId } });
      assert.strictEqual(team?.status, 'CANCELLED');
      assert.ok(team?.deletedAt !== null, 'Team must be soft deleted');

      // Verify all member registrations are cancelled
      const activeMembers = await adminPrisma.eventRegistration.findMany({
        where: { teamId: competitionTeamId, deletedAt: null },
      });
      assert.strictEqual(activeMembers.length, 0, 'No active registrations should remain for cancelled team');

      const cancelledMembers = await adminPrisma.eventRegistration.findMany({
        where: { teamId: competitionTeamId, registrationStatus: 'CANCELLED' },
      });
      assert.strictEqual(cancelledMembers.length, 2, 'Both members must be marked CANCELLED');
    });
  });

  // =========================================================================
  // 10. Attendance & Dispute Concurrency
  // =========================================================================
  describe('Attendance & Dispute Concurrency', () => {
    let closedSessionId: string;
    let disputeSessionId: string;
    let disputeId: string;

    beforeAll(async () => {
      // Create closed session
      const closedSession = await adminPrisma.attendanceSession.create({
        data: {
          id: randomUUID(),
          eventId: event1Id,
          title: `Closed Session ${runId}`,
          startTime: new Date(Date.now() - 7200000),
          endTime: new Date(Date.now() - 3600000),
          openAt: new Date(Date.now() - 7200000),
          closeAt: new Date(Date.now() - 3600000), // Closed 1 hr ago!
          geofenceRadius: 50,
          qrSecret: 'test_qr_secret_1234567890',
          createdBy: clubAdminId,
        },
      });
      closedSessionId = closedSession.id;

      // Create session for dispute
      const disputeSession = await adminPrisma.attendanceSession.create({
        data: {
          id: randomUUID(),
          eventId: event1Id,
          title: `Dispute Session ${runId}`,
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() + 3600000),
          openAt: new Date(Date.now() - 3600000),
          closeAt: new Date(Date.now() + 3600000),
          geofenceRadius: 50,
          qrSecret: 'test_qr_secret_1234567890',
          createdBy: clubAdminId,
        },
      });
      disputeSessionId = disputeSession.id;

      // Ensure studentA is registered for event1Id so eligibility passes
      const existingReg = await adminPrisma.eventRegistration.findFirst({
        where: { eventId: event1Id, userId: studentAId, deletedAt: null },
      });
      if (!existingReg) {
        await adminPrisma.eventRegistration.create({
          data: {
            id: randomUUID(),
            eventId: event1Id,
            userId: studentAId,
            registrationStatus: 'REGISTERED',
          },
        });
      }

      // Submit dispute for studentA
      const dispute = await attendanceService.submitAttendanceDispute(studentAId, {
        session_id: disputeSessionId,
        reason: 'Network failed at venue',
      });
      disputeId = dispute.id;
    });

    it('10.1: Marking attendance on a closed session fails closed with 422 SESSION_CLOSED', async () => {
      await assert.rejects(
        async () => {
          await attendanceService.markAttendance(studentAId, {
            session_id: closedSessionId,
            totp_token: '123456',
            latitude: 18.5204,
            longitude: 73.8567,
            device_id: 'test-device',
            device_os: 'iOS',
            gps_accuracy: 10,
            mock_location_detected: false,
            app_version: '1.0.0',
          });
        },
        (err: any) => {
          return err.statusCode === 422 || err.message?.includes('SESSION_CLOSED');
        }
      );
    });

    it('10.2: Concurrent dispute resolution allows exactly one decision and rejects the conflicting call with 400', async () => {
      const results = await Promise.allSettled([
        attendanceService.resolveAttendanceDispute(platformAdminId, disputeId, { resolution: 'APPROVED' }),
        attendanceService.resolveAttendanceDispute(platformAdminId, disputeId, { resolution: 'REJECTED' }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Only one dispute resolution must succeed');
      assert.strictEqual(rejected.length, 1, 'Duplicate resolution must be rejected');

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(
        rejectionReason.statusCode === 400 || rejectionReason.message?.includes('DISPUTE_ALREADY_RESOLVED'),
        'Rejection must be DISPUTE_ALREADY_RESOLVED (400 BadRequest / U0052)'
      );

      // Verify database state: exactly one resolution
      const dispute = await adminPrisma.attendanceDispute.findUnique({ where: { id: disputeId } });
      assert.ok(['APPROVED', 'REJECTED'].includes(dispute!.status));
      assert.strictEqual(dispute?.reviewedBy, platformAdminId);
    });
  });

  // =========================================================================
  // 11. Notification Outbox & Transaction Rollback Integrity
  // =========================================================================
  describe('Notification Outbox & Transaction Rollback Integrity', () => {
    it('11.1: Transaction rollback: aborted transaction does not commit notifications or outbox jobs', async () => {
      const idempotencyKey = `ROLLBACK_TEST_${runId}`;

      await assert.rejects(
        async () => {
          await prisma.$transaction(async (tx) => {
            await enqueueNotification({
              tx,
              userId: studentAId,
              type: 'SYSTEM_ALERT',
              title: 'Rollback Alert',
              body: 'Should never exist in DB',
              metadata: {
                schema_version: 1,
                routing: { target: '/home', fallback: '/home', params: {} },
                entity_ids: {},
              },
              preferenceGate: 'push_enabled',
              idempotencyString: idempotencyKey,
            });

            // Intermediate failure
            throw new Error('Simulated transaction failure for rollback verification');
          });
        },
        /Simulated transaction failure/
      );

      // Verify database has zero records
      const notifs = await adminPrisma.notification.findMany({
        where: { userId: studentAId, title: 'Rollback Alert' },
      });
      assert.strictEqual(notifs.length, 0, 'No notification must be committed after rollback');
    });

    it('11.2: Idempotent notification delivery: Retrying enqueueNotification with identical idempotency key creates exactly 1 record', async () => {
      const idempotencyKey = `IDEMPOTENT_TEST_${runId}`;

      // Call 1
      await prisma.$transaction(async (tx) => {
        await enqueueNotification({
          tx,
          userId: studentAId,
          type: 'SYSTEM_ALERT',
          title: 'Idempotent Alert',
          body: 'Testing deduplication',
          metadata: {
            schema_version: 1,
            routing: { target: '/home', fallback: '/home', params: {} },
            entity_ids: {},
          },
          preferenceGate: 'push_enabled',
          idempotencyString: idempotencyKey,
        });
      });

      // Call 2 (Retry)
      await prisma.$transaction(async (tx) => {
        await enqueueNotification({
          tx,
          userId: studentAId,
          type: 'SYSTEM_ALERT',
          title: 'Idempotent Alert',
          body: 'Testing deduplication',
          metadata: {
            schema_version: 1,
            routing: { target: '/home', fallback: '/home', params: {} },
            entity_ids: {},
          },
          preferenceGate: 'push_enabled',
          idempotencyString: idempotencyKey,
        });
      });

      // Assert database has exactly 1 notification
      const notifs = await adminPrisma.notification.findMany({
        where: { userId: studentAId, title: 'Idempotent Alert' },
      });
      assert.strictEqual(notifs.length, 1, 'Exactly one notification record must exist');
    });
  });

  // =========================================================================
  // 12. Database Error Mapper Extended Classification
  // =========================================================================
  describe('Database Error Mapper Extended Classification', () => {
    it('12.1: PostgreSQL transaction rollback (40001 serialization failure / 40P01 deadlock) fails closed as 500', () => {
      const serErr = {
        code: 'P2010',
        meta: { code: '40001' },
        message: 'could not serialize access due to concurrent update',
      };
      assert.throws(
        () => mapDatabaseError(serErr),
        (err: any) => {
          return err.message === 'An unexpected error occurred' && !(err.statusCode < 500);
        }
      );

      const dlkErr = {
        code: 'P2010',
        meta: { code: '40P01' },
        message: 'deadlock detected',
      };
      assert.throws(
        () => mapDatabaseError(dlkErr),
        (err: any) => {
          return err.message === 'An unexpected error occurred' && !(err.statusCode < 500);
        }
      );
    });

    it('12.2: Prisma infrastructure error (P1001 database unreachable) fails closed as 500', () => {
      const connErr = {
        code: 'P1001',
        message: "Can't reach database server at 127.0.0.1:5440",
      };
      assert.throws(
        () => mapDatabaseError(connErr),
        (err: any) => {
          return err.message === 'An unexpected error occurred' && !(err.statusCode < 500);
        }
      );
    });

    it('12.3: Syntax error containing "not found" strictly fails closed as 500 (not 404)', () => {
      const syntaxErr = {
        code: 'P2010',
        meta: { code: '42601' },
        message: 'ERROR: syntax error at or near "not found"',
      };
      assert.throws(
        () => mapDatabaseError(syntaxErr),
        (err: any) => {
          return err.message === 'An unexpected error occurred' && !(err.statusCode === 404);
        }
      );
    });
  });
});
