import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import * as eventsService from '../../src/modules/events/events.service';
import { signJwt } from '../../src/lib/jwt';
import { randomUUID } from 'crypto';

const app = createApp();

test('Events RLS and Authorization Policy - Exhaustive Verification', async (t) => {
  let primaryAdminId: string;
  let coreMemberId: string;
  let mentorId: string;
  let otherAdminId: string;
  let studentId: string;

  let primaryAdminToken: string;
  let coreMemberToken: string;
  let mentorToken: string;
  let otherAdminToken: string;
  let studentToken: string;

  let clubAId: string;
  let clubBId: string;

  let draftEventId: string;
  let coreDraftEventId: string;
  let publishedEventId: string;

  const testEmails = [
    'rls_event_admin@example.com',
    'rls_event_coremember@example.com',
    'rls_event_mentor@example.com',
    'rls_event_otherca@example.com',
    'rls_event_student@example.com',
  ];

  async function cleanup() {
    const users = await adminPrisma.user.findMany({
      where: { email: { in: testEmails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      const events = await adminPrisma.event.findMany({
        where: { createdBy: { in: userIds } },
        select: { id: true },
      });
      const eventIds = events.map((e) => e.id);

      if (eventIds.length > 0) {
        await adminPrisma.eventClub.deleteMany({
          where: { eventId: { in: eventIds } },
        });
        await adminPrisma.auditLog.deleteMany({
          where: { entityId: { in: eventIds } },
        });
        await adminPrisma.event.deleteMany({
          where: { id: { in: eventIds } },
        });
      }

      await adminPrisma.clubMembership.deleteMany({
        where: { userId: { in: userIds } },
      });
      await adminPrisma.notification.deleteMany({
        where: { userId: { in: userIds } },
      });
    }

    await adminPrisma.club.deleteMany({
      where: { name: { in: ['RLS Test Club A', 'RLS Test Club B'] } },
    });

    if (userIds.length > 0) {
      await adminPrisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  }

  t.before(async () => {
    await cleanup();

    // 1. Create users
    const primaryAdmin = await adminPrisma.user.create({
      data: {
        email: 'rls_event_admin@example.com',
        googleSub: `gsub_${randomUUID()}`,
        fullName: 'Primary Club Admin',
        globalRole: 'STUDENT',
      },
    });
    primaryAdminId = primaryAdmin.id;
    primaryAdminToken = signJwt(primaryAdmin.id);

    const coreMember = await adminPrisma.user.create({
      data: {
        email: 'rls_event_coremember@example.com',
        googleSub: `gsub_${randomUUID()}`,
        fullName: 'Primary Club Core Member',
        globalRole: 'STUDENT',
      },
    });
    coreMemberId = coreMember.id;
    coreMemberToken = signJwt(coreMember.id);

    const mentor = await adminPrisma.user.create({
      data: {
        email: 'rls_event_mentor@example.com',
        googleSub: `gsub_${randomUUID()}`,
        fullName: 'Primary Club Faculty Mentor',
        globalRole: 'STUDENT',
      },
    });
    mentorId = mentor.id;
    mentorToken = signJwt(mentor.id);

    const otherAdmin = await adminPrisma.user.create({
      data: {
        email: 'rls_event_otherca@example.com',
        googleSub: `gsub_${randomUUID()}`,
        fullName: 'Other Club Admin',
        globalRole: 'STUDENT',
      },
    });
    otherAdminId = otherAdmin.id;
    otherAdminToken = signJwt(otherAdmin.id);

    const student = await adminPrisma.user.create({
      data: {
        email: 'rls_event_student@example.com',
        googleSub: `gsub_${randomUUID()}`,
        fullName: 'Unrelated Student',
        globalRole: 'STUDENT',
      },
    });
    studentId = student.id;
    studentToken = signJwt(student.id);

    // 2. Create clubs
    const clubA = await adminPrisma.club.create({
      data: { name: 'RLS Test Club A', status: 'ACTIVE' },
    });
    clubAId = clubA.id;

    const clubB = await adminPrisma.club.create({
      data: { name: 'RLS Test Club B', status: 'ACTIVE' },
    });
    clubBId = clubB.id;

    // 3. Assign club roles
    await adminPrisma.clubMembership.create({
      data: { clubId: clubAId, userId: primaryAdminId, role: 'CLUB_ADMIN' },
    });
    await adminPrisma.clubMembership.create({
      data: { clubId: clubAId, userId: coreMemberId, role: 'CORE_MEMBER' },
    });
    await adminPrisma.clubMembership.create({
      data: { clubId: clubAId, userId: mentorId, role: 'FACULTY_MENTOR' },
    });
    await adminPrisma.clubMembership.create({
      data: { clubId: clubBId, userId: otherAdminId, role: 'CLUB_ADMIN' },
    });

    // 4. Create events
    const baseStart = new Date(Date.now() + 86400000); // 1 day in future
    const baseEnd = new Date(Date.now() + 86400000 + 7200000); // +2 hours

    // Draft Event created by Primary Admin
    const draftEvent = await adminPrisma.event.create({
      data: {
        title: 'Original Draft Event Title',
        description: 'Original draft description',
        state: 'DRAFT',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        eventType: 'WORKSHOP',
        createdBy: primaryAdminId,
        startTime: baseStart,
        endTime: baseEnd,
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: baseStart,
      },
    });
    draftEventId = draftEvent.id;

    await adminPrisma.eventClub.create({
      data: { eventId: draftEventId, clubId: clubAId, isPrimary: true },
    });

    // Draft Event created by Core Member
    const coreDraftEvent = await adminPrisma.event.create({
      data: {
        title: 'Core Member Draft Event Title',
        description: 'Core draft description',
        state: 'DRAFT',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        eventType: 'WORKSHOP',
        createdBy: coreMemberId,
        startTime: baseStart,
        endTime: baseEnd,
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: baseStart,
      },
    });
    coreDraftEventId = coreDraftEvent.id;

    await adminPrisma.eventClub.create({
      data: { eventId: coreDraftEventId, clubId: clubAId, isPrimary: true },
    });

    // Published Event
    const publishedEvent = await adminPrisma.event.create({
      data: {
        title: 'Original Published Event Title',
        description: 'Original published description',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        eventType: 'WORKSHOP',
        createdBy: primaryAdminId,
        startTime: baseStart,
        endTime: baseEnd,
        registrationStartTime: new Date(Date.now() - 3600000),
        registrationEndTime: baseStart,
      },
    });
    publishedEventId = publishedEvent.id;

    await adminPrisma.eventClub.create({
      data: { eventId: publishedEventId, clubId: clubAId, isPrimary: true },
    });
  });

  t.after(async () => {
    await cleanup();
  });

  // =========================================================================
  // Section 1: Primary CLUB_ADMIN capabilities & 42501 Regression Verification
  // =========================================================================

  await t.test('1. Primary Club Admin can update DRAFT event via PATCH /v1/events/:id', async () => {
    const res = await request(app)
      .patch(`/v1/events/${draftEventId}`)
      .set('Authorization', `Bearer ${primaryAdminToken}`)
      .send({
        title: 'Updated Draft Event Title',
        description: 'Updated draft description',
      });

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.title, 'Updated Draft Event Title');

    const inDb = await adminPrisma.event.findUnique({ where: { id: draftEventId } });
    assert.strictEqual(inDb?.title, 'Updated Draft Event Title');
  });

  await t.test('2. Primary Club Admin can update PUBLISHED event via PATCH /v1/events/:id (RLS 42501 regression test)', async () => {
    const res = await request(app)
      .patch(`/v1/events/${publishedEventId}`)
      .set('Authorization', `Bearer ${primaryAdminToken}`)
      .send({
        title: 'Updated Published Event Title',
        description: 'Updated published description',
      });

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.title, 'Updated Published Event Title');

    const inDb = await adminPrisma.event.findUnique({ where: { id: publishedEventId } });
    assert.strictEqual(inDb?.title, 'Updated Published Event Title');
    assert.strictEqual(inDb?.state, 'PUBLISHED');
  });

  await t.test('3. Primary Club Admin can update PUBLISHED event via service updateEvent under RLS context', async () => {
    const updated = await eventsService.updateEvent(primaryAdminId, publishedEventId, {
      title: 'Service Updated Published Title',
    });

    assert.strictEqual(updated.title, 'Service Updated Published Title');

    const inDb = await adminPrisma.event.findUnique({ where: { id: publishedEventId } });
    assert.strictEqual(inDb?.title, 'Service Updated Published Title');
  });

  // =========================================================================
  // Section 2: CORE_MEMBER & Draft Creator capabilities & State Transitions
  // =========================================================================

  await t.test('4. CORE_MEMBER can update DRAFT event parameters via PATCH /v1/events/:id', async () => {
    const res = await request(app)
      .patch(`/v1/events/${coreDraftEventId}`)
      .set('Authorization', `Bearer ${coreMemberToken}`)
      .send({
        title: 'Core Member Updated Title',
        description: 'Core member updated description',
      });

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.title, 'Core Member Updated Title');

    const inDb = await adminPrisma.event.findUnique({ where: { id: coreDraftEventId } });
    assert.strictEqual(inDb?.title, 'Core Member Updated Title');
    assert.strictEqual(inDb?.state, 'DRAFT');
  });

  await t.test('5. CORE_MEMBER can submit DRAFT event for approval via POST /v1/events/:id/submit-for-approval', async () => {
    const res = await request(app)
      .post(`/v1/events/${coreDraftEventId}/submit-for-approval`)
      .set('Authorization', `Bearer ${coreMemberToken}`);

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.state, 'PENDING_APPROVAL');

    const inDb = await adminPrisma.event.findUnique({ where: { id: coreDraftEventId } });
    assert.strictEqual(inDb?.state, 'PENDING_APPROVAL');
  });

  await t.test('6. Primary Club Admin can submit DRAFT event for approval via POST /v1/events/:id/submit-for-approval', async () => {
    const res = await request(app)
      .post(`/v1/events/${draftEventId}/submit-for-approval`)
      .set('Authorization', `Bearer ${primaryAdminToken}`);

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.state, 'PENDING_APPROVAL');

    const inDb = await adminPrisma.event.findUnique({ where: { id: draftEventId } });
    assert.strictEqual(inDb?.state, 'PENDING_APPROVAL');
  });

  await t.test('7. FACULTY_MENTOR can approve PENDING_APPROVAL event via POST /v1/events/:id/approve', async () => {
    const res = await request(app)
      .post(`/v1/events/${draftEventId}/approve`)
      .set('Authorization', `Bearer ${mentorToken}`);

    assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.state, 'PUBLISHED');

    const inDb = await adminPrisma.event.findUnique({ where: { id: draftEventId } });
    assert.strictEqual(inDb?.state, 'PUBLISHED');
  });

  await t.test('8. CORE_MEMBER is BLOCKED from updating a PUBLISHED event (least privilege preserved)', async () => {
    // Attempt via service directly under RLS
    await assert.rejects(
      async () => {
        await eventsService.updateEvent(coreMemberId, publishedEventId, {
          title: 'Core Member Cannot Edit Published',
        });
      },
      (err: any) => {
        return err.statusCode === 404 || err.code === 'P2025' || (err.message && err.message.includes('not found'));
      }
    );
  });

  await t.test('9. CORE_MEMBER is BLOCKED from approving an event (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/v1/events/${coreDraftEventId}/approve`)
      .set('Authorization', `Bearer ${coreMemberToken}`);

    assert.strictEqual(res.status, 403);
  });

  // =========================================================================
  // Section 3: Verify UNRELATED STUDENTS & OTHER ORGANIZERS remain blocked
  // =========================================================================

  await t.test('10. Unrelated Student is blocked from updating event via HTTP (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/v1/events/${publishedEventId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Student Attempted Hack' });

    assert.strictEqual(res.status, 403);
  });

  await t.test('11. Unrelated Student is blocked by database RLS when calling updateEvent directly', async () => {
    await assert.rejects(
      async () => {
        await eventsService.updateEvent(studentId, publishedEventId, {
          title: 'Direct RLS Bypass Attempt',
        });
      },
      (err: any) => {
        return err.statusCode === 404 || err.code === 'P2025' || (err.message && err.message.includes('not found'));
      }
    );
  });

  await t.test('12. Unrelated Student is blocked from submitting event for approval (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/v1/events/${coreDraftEventId}/submit-for-approval`)
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(res.status, 403);
  });

  await t.test('13. Unrelated Student is blocked by RLS / stored proc when calling submitForApproval directly', async () => {
    await assert.rejects(
      async () => {
        await eventsService.submitForApproval(studentId, coreDraftEventId);
      },
      (err: any) => {
        // RLS prevents select on non-published non-member event OR stored proc raises U0001
        return err.statusCode === 404 || err.statusCode === 403 || err.code === 'U0001' || (err.message && err.message.includes('not found'));
      }
    );
  });

  await t.test('14. Organizer from another club is blocked from updating event via HTTP (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/v1/events/${publishedEventId}`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .send({ title: 'Other Club Attempted Hack' });

    assert.strictEqual(res.status, 403);
  });

  await t.test('15. Organizer from another club is blocked by database RLS when calling updateEvent directly', async () => {
    await assert.rejects(
      async () => {
        await eventsService.updateEvent(otherAdminId, publishedEventId, {
          title: 'Other Club Direct RLS Bypass Attempt',
        });
      },
      (err: any) => {
        return err.statusCode === 404 || err.code === 'P2025' || (err.message && err.message.includes('not found'));
      }
    );
  });

  await t.test('16. Organizer from another club is blocked from submitting event for approval (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/v1/events/${coreDraftEventId}/submit-for-approval`)
      .set('Authorization', `Bearer ${otherAdminToken}`);

    assert.strictEqual(res.status, 403);
  });

  await t.test('17. Organizer from another club is blocked from approving event (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/v1/events/${coreDraftEventId}/approve`)
      .set('Authorization', `Bearer ${otherAdminToken}`);

    assert.strictEqual(res.status, 403);
  });

  // =========================================================================
  // Section 4: Protected fields & Registration window validations
  // =========================================================================

  await t.test('18. Protected fields (id, state, created_by) cannot be overwritten via update payload', async () => {
    const res = await request(app)
      .patch(`/v1/events/${publishedEventId}`)
      .set('Authorization', `Bearer ${primaryAdminToken}`)
      .send({
        title: 'Payload Protection Test',
        state: 'DRAFT',
        created_by: studentId,
        id: randomUUID(),
      } as any);

    assert.strictEqual(res.status, 200);
    const inDb = await adminPrisma.event.findUnique({ where: { id: publishedEventId } });
    assert.strictEqual(inDb?.id, publishedEventId);
    assert.strictEqual(inDb?.state, 'PUBLISHED');
    assert.strictEqual(inDb?.createdBy, primaryAdminId);
  });

  await t.test('19. Registration time validations remain enforced on event update', async () => {
    const event = await adminPrisma.event.findUniqueOrThrow({ where: { id: publishedEventId } });
    const eventEnd = event.endTime.getTime();

    // reg_end_time after event end_time -> fails
    const invalidRegEnd = new Date(eventEnd + 3600000).toISOString();
    const res1 = await request(app)
      .patch(`/v1/events/${publishedEventId}`)
      .set('Authorization', `Bearer ${primaryAdminToken}`)
      .send({
        registration_end_time: invalidRegEnd,
      });

    assert.ok(res1.status === 400 || res1.status === 422, `Expected 400/422 but got ${res1.status}`);

    // reg_start_time after reg_end_time -> fails
    const regStart = new Date(eventEnd - 1800000).toISOString();
    const regEnd = new Date(eventEnd - 3600000).toISOString();
    const res2 = await request(app)
      .patch(`/v1/events/${publishedEventId}`)
      .set('Authorization', `Bearer ${primaryAdminToken}`)
      .send({
        registration_start_time: regStart,
        registration_end_time: regEnd,
      });

    assert.ok(res2.status === 400 || res2.status === 422, `Expected 400/422 but got ${res2.status}`);

    // Valid registration window succeeds
    const validRegStart = new Date(Date.now() + 3600000).toISOString();
    const validRegEnd = new Date(eventEnd - 1800000).toISOString();
    const res3 = await request(app)
      .patch(`/v1/events/${publishedEventId}`)
      .set('Authorization', `Bearer ${primaryAdminToken}`)
      .send({
        registration_start_time: validRegStart,
        registration_end_time: validRegEnd,
      });

    assert.strictEqual(res3.status, 200, `Expected 200 but got ${res3.status}: ${JSON.stringify(res3.body)}`);
  });
});
