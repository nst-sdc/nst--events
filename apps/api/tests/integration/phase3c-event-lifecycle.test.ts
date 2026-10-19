import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { withUserContext } from '@nst/database';
import {
  createEvent,
  deleteEvent,
  cancelEvent,
  archiveEvent,
  getPublicEventBySlug,
} from '../../src/modules/events/events.service';
import { getPublicResultsBySlug } from '../../src/modules/event-results/event-results.service';
import { UnprocessableEntityError, NotFoundError } from '../../src/lib/errors';

describe('Phase 3C: Event Lifecycle Integrity, Cancellation, Archival, and Historical Data Preservation', () => {
  let clubAdminId: string;
  let studentId: string;
  let student2Id: string;
  let platformAdminId: string;
  let clubId: string;
  const createdEventIds: string[] = [];

  before(async () => {
    // 1. Create Club Admin
    const now = Date.now();
    const clubAdmin = await adminPrisma.user.create({
      data: {
        email: `phase3c_admin_${now}@adypu.edu.in`,
        googleSub: `sub_admin_${now}`,
        fullName: 'Phase 3C Club Admin',
        globalRole: 'STUDENT',
      },
    });
    clubAdminId = clubAdmin.id;

    // 2. Create Platform Admin
    const platformAdmin = await adminPrisma.user.create({
      data: {
        email: `phase3c_padmin_${now}@adypu.edu.in`,
        googleSub: `sub_padmin_${now}`,
        fullName: 'Phase 3C Platform Admin',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    platformAdminId = platformAdmin.id;

    // 3. Create Students
    const s1 = await adminPrisma.user.create({
      data: {
        email: `phase3c_student1_${now}@adypu.edu.in`,
        googleSub: `sub_s1_${now}`,
        fullName: 'Phase 3C Student 1',
        globalRole: 'STUDENT',
      },
    });
    studentId = s1.id;

    const s2 = await adminPrisma.user.create({
      data: {
        email: `phase3c_student2_${now}@adypu.edu.in`,
        googleSub: `sub_s2_${now}`,
        fullName: 'Phase 3C Student 2',
        globalRole: 'STUDENT',
      },
    });
    student2Id = s2.id;

    // 4. Create Club & Membership
    const club = await adminPrisma.club.create({
      data: {
        name: `Phase 3C Lifecycle Club ${Date.now()}`,
        status: 'ACTIVE',
      },
    });
    clubId = club.id;

    await adminPrisma.clubMembership.create({
      data: {
        userId: clubAdminId,
        clubId,
        role: 'CLUB_ADMIN',
      },
    });
  });

  after(async () => {
    // Cleanup created events
    for (const eid of createdEventIds) {
      await adminPrisma.notification.deleteMany({ where: { metadata: { path: ['entity_ids', 'event_id'], equals: eid } } });
      await adminPrisma.auditLog.deleteMany({ where: { entityId: eid } });
      await adminPrisma.attendanceRecord.deleteMany({ where: { session: { eventId: eid } } });
      await adminPrisma.attendanceSession.deleteMany({ where: { eventId: eid } });
      await adminPrisma.studentAchievement.deleteMany({ where: { eventId: eid } });
      await adminPrisma.eventRegistration.deleteMany({ where: { eventId: eid } });
      await adminPrisma.team.deleteMany({ where: { eventId: eid } });
      await adminPrisma.eventClub.deleteMany({ where: { eventId: eid } });
      await adminPrisma.eventSlugHistory.deleteMany({ where: { eventId: eid } });
      await adminPrisma.$executeRawUnsafe('DELETE FROM events WHERE id = $1::uuid', eid);
    }

    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.delete({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({
      where: { id: { in: [clubAdminId, platformAdminId, studentId, student2Id] } },
    });
  });

  it('1. Rejection of deleteEvent on non-draft events or events with registrations', async () => {
    // Create published event
    const pubEvent = await adminPrisma.event.create({
      data: {
        title: 'Published Event Deletion Test',
        slug: `pub-del-test-${Date.now()}`,
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(pubEvent.id);

    // Attempt delete on PUBLISHED event
    await assert.rejects(
      async () => {
        await deleteEvent(clubAdminId, pubEvent.id);
      },
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.match(err.message, /EVENT_MUST_BE_DRAFT|Cannot delete a non-draft event/);
        return true;
      }
    );

    // Create DRAFT event with registration
    const draftWithReg = await adminPrisma.event.create({
      data: {
        title: 'Draft With Reg Test',
        slug: `draft-reg-test-${Date.now()}`,
        state: 'DRAFT',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
        eventRegistrations: {
          create: {
            userId: studentId,
            registrationStatus: 'REGISTERED',
          },
        },
      },
    });
    createdEventIds.push(draftWithReg.id);

    // Attempt delete on DRAFT event with registrations
    await assert.rejects(
      async () => {
        await deleteEvent(clubAdminId, draftWithReg.id);
      },
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.match(err.message, /EVENT_HAS_DEPENDENT_RECORDS|Cannot delete an event with existing registrations/);
        return true;
      }
    );

    // Create pristine DRAFT event with 0 registrations
    const pristineDraft = await adminPrisma.event.create({
      data: {
        title: 'Pristine Draft Test',
        slug: `pristine-draft-${Date.now()}`,
        state: 'DRAFT',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(pristineDraft.id);

    // Pristine draft deletion should succeed
    await deleteEvent(clubAdminId, pristineDraft.id);
    const deletedRecord = await adminPrisma.event.findUnique({
      where: { id: pristineDraft.id },
    });
    assert.ok(deletedRecord?.deletedAt !== null, 'Pristine draft was soft-deleted');
  });

  it('2. Lifecycle transition permissions & cancellation of published event', async () => {
    const slug = `cancel-flow-test-${Date.now()}`;
    const event = await adminPrisma.event.create({
      data: {
        title: 'Full Cancellation Flow Event',
        slug,
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        eventType: 'HACKATHON',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
        eventRegistrations: {
          createMany: {
            data: [
              { userId: studentId, registrationStatus: 'REGISTERED' },
              { userId: student2Id, registrationStatus: 'WAITLISTED' },
            ],
          },
        },
      },
    });
    createdEventIds.push(event.id);

    // Unauthorized student attempts cancellation -> forbidden
    await assert.rejects(async () => {
      await cancelEvent(studentId, event.id, 'Student trying to cancel');
    });

    // Authorized Club Admin cancels event
    const cancelReason = 'Severe weather alert - campus closed';
    const result = await cancelEvent(clubAdminId, event.id, cancelReason);
    assert.strictEqual(result.state, 'CANCELLED');

    // Verify DB state
    const cancelledDb = await adminPrisma.event.findUnique({
      where: { id: event.id },
    });
    assert.strictEqual(cancelledDb?.state, 'CANCELLED');
    const metadata = cancelledDb?.metadata as any;
    assert.strictEqual(metadata.cancellation_reason, cancelReason);
    assert.strictEqual(metadata.cancelled_by, clubAdminId);
    assert.ok(metadata.cancelled_at);

    // Verify audit log
    const auditLogs = await adminPrisma.auditLog.findMany({
      where: { entityId: event.id, action: 'EVENT_CANCELLED' },
    });
    assert.strictEqual(auditLogs.length, 1);
    assert.strictEqual(auditLogs[0].actorId, clubAdminId);

    // Verify notifications delivered to both registered and waitlisted attendees
    const notifs = await adminPrisma.notification.findMany({
      where: {
        userId: { in: [studentId, student2Id] },
        type: 'EVENT_CANCELLED',
      },
    });
    assert.strictEqual(notifs.length, 2, 'Both attendees received cancellation notification');

    // Repeated cancellation request must be idempotent
    const repeatResult = await cancelEvent(clubAdminId, event.id, cancelReason);
    assert.strictEqual(repeatResult.state, 'CANCELLED');
    assert.strictEqual(repeatResult.message, 'Event is already cancelled');

    // No duplicate notifications were created on idempotent re-call
    const notifsAfter = await adminPrisma.notification.findMany({
      where: {
        userId: { in: [studentId, student2Id] },
        type: 'EVENT_CANCELLED',
      },
    });
    assert.strictEqual(notifsAfter.length, 2, 'No duplicate notifications created');
  });

  it('3. Operations on cancelled event are strictly rejected', async () => {
    const slug = `blocked-ops-${Date.now()}`;
    const event = await adminPrisma.event.create({
      data: {
        title: 'Cancelled Operations Blocked Event',
        slug,
        state: 'CANCELLED',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(event.id);

    // Create a session for this cancelled event
    const session = await adminPrisma.attendanceSession.create({
      data: {
        eventId: event.id,
        title: 'Session 1',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        openAt: new Date(Date.now() - 60000),
        closeAt: new Date(Date.now() + 60000),
        qrSecret: 'test_qr_secret_1234567890',
        createdBy: clubAdminId,
      },
    });

    // 1. register_event RPC must reject
    await assert.rejects(
      async () => {
        await withUserContext(studentId, async (tx) => {
          await tx.$queryRaw`SELECT register_event(${event.id}::uuid)`;
        });
      },
      /U0033/ // 'Event not published'
    );

    // 2. manual_mark_attendance RPC must reject
    await assert.rejects(
      async () => {
        await withUserContext(platformAdminId, async (tx) => {
          await tx.$queryRaw`SELECT manual_mark_attendance(${session.id}::uuid, ${studentId}::uuid)`;
        });
      },
      /U0006/ // 'EVENT_LOCKED'
    );

    // 3. sync_offline_attendance_v9 must reject
    const offlinePayload = [
      {
        session_id: session.id,
        user_id: studentId,
        scan_timestamp: new Date().toISOString(),
        device_id: 'test_dev_1',
        gps_lat: 18.5204,
        gps_lng: 73.8567,
        gps_accuracy: 10,
        mock_location_detected: false,
        scanned_token: 'test_token',
        offline_seq: 1,
        batch_index: 0,
      },
    ];

    const syncRes: any = await withUserContext(studentId, async (tx) => {
      return tx.$queryRaw`SELECT sync_offline_attendance_v9(${JSON.stringify(offlinePayload)}::jsonb) as res`;
    });
    const syncErrors = syncRes[0]?.res?.errors;
    assert.ok(syncErrors && syncErrors.length > 0, 'Offline sync returned error');
    assert.strictEqual(syncErrors[0].error_code, 'U0006', 'Error code was U0006 (EVENT_LOCKED)');
  });

  it('4. Event archival lifecycle invariants and permissions', async () => {
    // 1. Premature archival rejection
    const futureEvent = await adminPrisma.event.create({
      data: {
        title: 'Future Event Archival Test',
        slug: `future-archive-${Date.now()}`,
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000), // in the future
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(futureEvent.id);

    await assert.rejects(
      async () => {
        await archiveEvent(clubAdminId, futureEvent.id);
      },
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.match(err.message, /Cannot archive an event before its scheduled end time/);
        return true;
      }
    );

    // 2. Archiving a past completed event
    const pastCompletedEvent = await adminPrisma.event.create({
      data: {
        title: 'Past Completed Event Archival Test',
        slug: `past-archive-${Date.now()}`,
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() - 3600000), // in the past
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(pastCompletedEvent.id);

    const archiveResult = await archiveEvent(clubAdminId, pastCompletedEvent.id);
    assert.strictEqual(archiveResult.state, 'ARCHIVED');

    // DB state & audit log check
    const archivedDb = await adminPrisma.event.findUnique({
      where: { id: pastCompletedEvent.id },
    });
    assert.strictEqual(archivedDb?.state, 'ARCHIVED');
    const metadata = archivedDb?.metadata as any;
    assert.strictEqual(metadata.archived_by, clubAdminId);
    assert.ok(metadata.archived_at);

    const auditLog = await adminPrisma.auditLog.findFirst({
      where: { entityId: pastCompletedEvent.id, action: 'EVENT_ARCHIVED' },
    });
    assert.ok(auditLog, 'Audit log recorded for EVENT_ARCHIVED');

    // Idempotency: repeated archive call returns without error
    const repeatArchive = await archiveEvent(clubAdminId, pastCompletedEvent.id);
    assert.strictEqual(repeatArchive.state, 'ARCHIVED');
    assert.strictEqual(repeatArchive.message, 'Event is already archived');

    // Cannot cancel an archived event
    await assert.rejects(
      async () => {
        await cancelEvent(clubAdminId, pastCompletedEvent.id, 'Cannot cancel archived');
      },
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityError);
        assert.match(err.message, /Archived events cannot be cancelled/);
        return true;
      }
    );
  });

  it('5. Public slug resolution and results accessibility across lifecycle states', async () => {
    // A. Published event
    const pubSlug = `pub-slug-${Date.now()}`;
    const pubEvent = await adminPrisma.event.create({
      data: {
        title: 'Public Resolution Published',
        slug: pubSlug,
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(pubEvent.id);

    const pubRes = await getPublicEventBySlug(pubSlug);
    assert.strictEqual(pubRes.state, 'PUBLISHED');
    assert.strictEqual(pubRes.slug, pubSlug);

    // B. Cancelled event
    const cancelSlug = `cancel-slug-${Date.now()}`;
    const cancelEventRecord = await adminPrisma.event.create({
      data: {
        title: 'Public Resolution Cancelled',
        slug: cancelSlug,
        state: 'CANCELLED',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        metadata: { cancellation_reason: 'Weather emergency' },
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(cancelEventRecord.id);

    const cancelRes = await getPublicEventBySlug(cancelSlug);
    assert.strictEqual(cancelRes.state, 'CANCELLED');
    assert.strictEqual(cancelRes.registration_status, 'CLOSED');
    assert.strictEqual(cancelRes.cancellation_reason, 'Weather emergency');

    // C. Archived event with official results
    const archiveSlug = `archive-slug-${Date.now()}`;
    const archiveEventRecord = await adminPrisma.event.create({
      data: {
        title: 'Public Resolution Archived With Results',
        slug: archiveSlug,
        state: 'ARCHIVED',
        visibility: 'PUBLIC',
        eventType: 'HACKATHON',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() - 3600000),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(archiveEventRecord.id);

    // Create official published results for the archived event
    const resultSet = await adminPrisma.eventResultSet.create({
      data: {
        eventId: archiveEventRecord.id,
        status: 'PUBLISHED',
      },
    });
    const revision = await adminPrisma.eventResultRevision.create({
      data: {
        resultSetId: resultSet.id,
        revisionNumber: 1,
        version: 1,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: clubAdminId,
        createdBy: clubAdminId,
      },
    });
    await adminPrisma.eventResultSet.update({
      where: { id: resultSet.id },
      data: { activePublishedRevisionId: revision.id },
    });

    // Public slug resolution for ARCHIVED event -> 200 OK
    const archiveRes = await getPublicEventBySlug(archiveSlug);
    assert.strictEqual(archiveRes.state, 'ARCHIVED');
    assert.strictEqual(archiveRes.registration_status, 'CLOSED');

    // Public results resolution for ARCHIVED event -> Accessible!
    const resultsRes = await getPublicResultsBySlug(archiveSlug);
    assert.strictEqual(resultsRes.event.slug, archiveSlug);
    assert.strictEqual(resultsRes.status, 'PUBLISHED', 'Official results retrieved for archived event');

    // D. DRAFT event -> throws 404 NotFoundError
    const draftSlug = `draft-slug-${Date.now()}`;
    const draftEvent = await adminPrisma.event.create({
      data: {
        title: 'Draft Not Found Public',
        slug: draftSlug,
        state: 'DRAFT',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(draftEvent.id);

    await assert.rejects(
      async () => {
        await getPublicEventBySlug(draftSlug);
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError);
        return true;
      }
    );

    // E. Soft-deleted event -> throws 404 NotFoundError
    const deletedSlug = `deleted-slug-${Date.now()}`;
    const deletedEvent = await adminPrisma.event.create({
      data: {
        title: 'Deleted Not Found Public',
        slug: deletedSlug,
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        deletedAt: new Date(),
        createdBy: clubAdminId,
        eventClubs: { create: { clubId, isPrimary: true } },
      },
    });
    createdEventIds.push(deletedEvent.id);

    await assert.rejects(
      async () => {
        await getPublicEventBySlug(deletedSlug);
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError);
        return true;
      }
    );
  });
});
