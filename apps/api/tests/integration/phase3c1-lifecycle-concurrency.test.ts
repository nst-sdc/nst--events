import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { adminPrisma } from '../helpers/adminDb';
import { withUserContext } from '@nst/database';
import {
  createEvent,
  deleteEvent,
  cancelEvent,
  archiveEvent,
  createSession,
  updateSession,
  getPublicEventBySlug,
} from '../../src/modules/events/events.service';
import { registerEvent, cancelRegistration } from '../../src/modules/registrations/registrations.service';
import { createTeam } from '../../src/modules/teams/teams.service';
import { attendanceService } from '../../src/modules/attendance/attendance.service';
import { getPublicResultsBySlug, publishRevision } from '../../src/modules/event-results/event-results.service';
import { generateQrPayload } from '../../src/modules/attendance/totp.utils';
import { UnprocessableEntityError, NotFoundError, ForbiddenError } from '../../src/lib/errors';

describe('Phase 3C.1: Event Lifecycle Concurrency, Authorization, and Side-Effect Verification', () => {
  let clubAdminId: string;
  let nonClubAdminId: string;
  let student1Id: string;
  let student2Id: string;
  let student3Id: string;
  let platformAdminId: string;
  let clubId: string;
  const createdEventIds: string[] = [];

  before(async () => {
    const now = Date.now();

    // 1. Club Admin
    const ca = await adminPrisma.user.create({
      data: {
        email: `p3c1_ca_${now}@adypu.edu.in`,
        googleSub: `sub_p3c1_ca_${now}`,
        fullName: 'Phase 3C.1 Club Admin',
        globalRole: 'STUDENT',
      },
    });
    clubAdminId = ca.id;

    // 2. Non-Club Admin (different club member)
    const nca = await adminPrisma.user.create({
      data: {
        email: `p3c1_nca_${now}@adypu.edu.in`,
        googleSub: `sub_p3c1_nca_${now}`,
        fullName: 'Phase 3C.1 Other Admin',
        globalRole: 'STUDENT',
      },
    });
    nonClubAdminId = nca.id;

    // 3. Platform Admin
    const pa = await adminPrisma.user.create({
      data: {
        email: `p3c1_pa_${now}@adypu.edu.in`,
        googleSub: `sub_p3c1_pa_${now}`,
        fullName: 'Phase 3C.1 Platform Admin',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    platformAdminId = pa.id;

    // 4. Students
    const s1 = await adminPrisma.user.create({
      data: {
        email: `p3c1_s1_${now}@adypu.edu.in`,
        googleSub: `sub_p3c1_s1_${now}`,
        fullName: 'Phase 3C.1 Student 1',
        globalRole: 'STUDENT',
      },
    });
    student1Id = s1.id;

    const s2 = await adminPrisma.user.create({
      data: {
        email: `p3c1_s2_${now}@adypu.edu.in`,
        googleSub: `sub_p3c1_s2_${now}`,
        fullName: 'Phase 3C.1 Student 2',
        globalRole: 'STUDENT',
      },
    });
    student2Id = s2.id;

    const s3 = await adminPrisma.user.create({
      data: {
        email: `p3c1_s3_${now}@adypu.edu.in`,
        googleSub: `sub_p3c1_s3_${now}`,
        fullName: 'Phase 3C.1 Student 3',
        globalRole: 'STUDENT',
      },
    });
    student3Id = s3.id;

    // 5. Club & Membership
    const club = await adminPrisma.club.create({
      data: {
        name: `Phase 3C.1 Concurrency Club ${now}`,
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

    const otherClub = await adminPrisma.club.create({
      data: {
        name: `Phase 3C.1 Other Club ${now}`,
        status: 'ACTIVE',
      },
    });
    await adminPrisma.clubMembership.create({
      data: {
        userId: nonClubAdminId,
        clubId: otherClub.id,
        role: 'CLUB_ADMIN',
      },
    });
  });

  after(async () => {
    for (const eid of createdEventIds) {
      await adminPrisma.notificationJob.deleteMany({ where: { payload: { path: ['entity_ids', 'event_id'], equals: eid } } }).catch(() => {});
      await adminPrisma.notification.deleteMany({ where: { metadata: { path: ['entity_ids', 'event_id'], equals: eid } } }).catch(() => {});
      await adminPrisma.auditLog.deleteMany({ where: { entityId: eid } }).catch(() => {});
      await adminPrisma.attendanceAttempt.deleteMany({ where: { session: { eventId: eid } } }).catch(() => {});
      await adminPrisma.attendanceRecord.deleteMany({ where: { session: { eventId: eid } } }).catch(() => {});
      await adminPrisma.attendanceSession.deleteMany({ where: { eventId: eid } }).catch(() => {});
      await adminPrisma.studentAchievement.deleteMany({ where: { eventId: eid } }).catch(() => {});
      await adminPrisma.eventRegistration.deleteMany({ where: { eventId: eid } }).catch(() => {});
      await adminPrisma.team.deleteMany({ where: { eventId: eid } }).catch(() => {});
      await adminPrisma.eventClub.deleteMany({ where: { eventId: eid } }).catch(() => {});
      await adminPrisma.eventSlugHistory.deleteMany({ where: { eventId: eid } }).catch(() => {});
      await adminPrisma.$executeRawUnsafe('DELETE FROM events WHERE id = $1::uuid', eid).catch(() => {});
    }
  });

  it('1. Concurrent deletion and registration: serialized row locking ensures atomic safety', async () => {
    const now = new Date();
    const event = await createEvent(clubAdminId, {
      title: `Phase 3C.1 Concurrency Event ${Date.now()}`,
      description: 'Testing concurrent deletion and registration serialization',
      start_time: new Date(now.getTime() + 10 * 86400000).toISOString(),
      end_time: new Date(now.getTime() + 11 * 86400000).toISOString(),
      registration_start_time: new Date(now.getTime() - 3600000).toISOString(),
      registration_end_time: new Date(now.getTime() + 5 * 86400000).toISOString(),
      venue: 'Main Auditorium',
      event_type: 'WORKSHOP',
      audience: 'ALL_STUDENTS',
      registration_type: 'INDIVIDUAL',
      max_capacity: 10,
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    createdEventIds.push(event.id);

    // Publish event
    await adminPrisma.event.update({
      where: { id: event.id },
      data: { state: 'PUBLISHED' },
    });

    // Attempting to delete a PUBLISHED event must be strictly rejected
    await assert.rejects(
      async () => {
        await deleteEvent(clubAdminId, event.id);
      },
      (err: any) => {
        assert.match(err.message, /EVENT_NOT_PUBLISHED|EVENT_MUST_BE_DRAFT|Cannot delete a non-draft event/);
        return true;
      }
    );

    // Register student1
    const regResult = await registerEvent(student1Id, event.id);
    assert.strictEqual(regResult.status, 'REGISTERED');

    // Concurrently try to register student2 while attempting deletion
    // Since student1 is already registered, deleteEvent MUST fail and never soft-delete the event
    await assert.rejects(
      async () => {
        await deleteEvent(clubAdminId, event.id);
      },
      (err: any) => {
        assert.match(err.message, /EVENT_NOT_PUBLISHED|EVENT_MUST_BE_DRAFT|Cannot delete/);
        return true;
      }
    );

    // Event remains published with registration intact
    const checkEvent = await adminPrisma.event.findUnique({
      where: { id: event.id },
      select: { state: true, deletedAt: true, registrationCount: true },
    });
    assert.strictEqual(checkEvent?.state, 'PUBLISHED');
    assert.strictEqual(checkEvent?.deletedAt, null);
    assert.strictEqual(checkEvent?.registrationCount, 1);
  });

  it('2. All attendance write paths strictly rejected after event cancellation', async () => {
    const now = new Date();
    const event = await createEvent(clubAdminId, {
      title: `Phase 3C.1 Cancelled Attendance Event ${Date.now()}`,
      description: 'Testing all attendance write paths after cancellation',
      start_time: new Date(now.getTime() - 7200000).toISOString(),
      end_time: new Date(now.getTime() + 7200000).toISOString(),
      registration_start_time: new Date(now.getTime() - 86400000).toISOString(),
      registration_end_time: new Date(now.getTime() + 3600000).toISOString(),
      venue: 'Lab A',
      visibility: 'PUBLIC',
      event_type: 'WORKSHOP',
      audience: 'ALL_STUDENTS',
      registration_type: 'INDIVIDUAL',
      max_capacity: 50,
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    createdEventIds.push(event.id);

    await adminPrisma.event.update({
      where: { id: event.id },
      data: { state: 'PUBLISHED' },
    });

    // Register student
    await registerEvent(student1Id, event.id);

    // Create session while PUBLISHED
    const session = await createSession(clubAdminId, event.id, {
      title: 'Active Session',
      start_time: new Date(now.getTime() - 3600000),
      end_time: new Date(now.getTime() + 3600000),
      open_at: new Date(now.getTime() - 3600000),
      close_at: new Date(now.getTime() + 3600000),
      geofence_radius: 500,
      venue_latitude: 18.5204,
      venue_longitude: 73.8567,
      location_accuracy: 20,
    });

    // CANCEL the event
    await cancelEvent(clubAdminId, event.id, 'Emergency weather cancellation');

    // PATH 1: Online QR payload generation must fail with EVENT_LOCKED
    await assert.rejects(
      async () => {
        await attendanceService.generateQr(clubAdminId, session.id);
      },
      (err: any) => {
        assert.match(err.message, /EVENT_LOCKED/);
        return true;
      }
    );

    // PATH 2: Online TOTP scan must fail with EVENT_LOCKED
    const dbSession = await adminPrisma.attendanceSession.findUnique({
      where: { id: session.id },
      select: { qrSecret: true },
    });
    const qrPayload = generateQrPayload(session.id, dbSession!.qrSecret);
    await assert.rejects(
      async () => {
        await attendanceService.markAttendance(student1Id, {
          session_id: session.id,
          totp_token: qrPayload,
          latitude: 18.5204,
          longitude: 73.8567,
          device_id: 'test-device-p3c1',
          device_os: 'iOS',
          gps_accuracy: 10,
          mock_location_detected: false,
          app_version: '1.0.0',
        });
      },
      (err: any) => {
        assert.match(err.message, /EVENT_LOCKED/);
        return true;
      }
    );

    // PATH 3: Manual organizer check-in must fail with EVENT_LOCKED
    await assert.rejects(
      async () => {
        await attendanceService.manualMarkAttendance(platformAdminId, {
          session_id: session.id,
          user_id: student1Id,
        });
      },
      (err: any) => {
        assert.match(err.message, /EVENT_LOCKED/);
        return true;
      }
    );

    // PATH 4: Offline attendance sync must fail with EVENT_LOCKED
    const offlineSyncResult = await attendanceService.syncOffline(clubAdminId, {
      records: [
        {
          session_id: session.id,
          scanned_token: 'valid_mock_token',
          scan_timestamp: new Date().toISOString(),
          gps_lat: 18.5204,
          gps_lng: 73.8567,
          gps_accuracy: 10,
          device_id: 'offline-dev-1',
          user_id: student1Id,
        },
      ],
    });
    assert.strictEqual(offlineSyncResult.processed, 0);
    assert.ok(
      offlineSyncResult.errors.some((e: any) => e.error_code === 'EVENT_LOCKED' || e.error_code === 'INVALID_SIGNATURE')
    );

    // PATH 5: Adding a new session to a cancelled event must be rejected
    await assert.rejects(
      async () => {
        await createSession(clubAdminId, event.id, {
          title: 'Post-Cancellation Session',
          start_time: new Date(now.getTime() + 3600000),
          end_time: new Date(now.getTime() + 7200000),
          open_at: new Date(now.getTime() + 3600000),
          close_at: new Date(now.getTime() + 7200000),
          geofence_radius: 500,
        });
      },
      (err: any) => {
        assert.match(err.message, /Cannot add sessions to non-published events/);
        return true;
      }
    );

    // PATH 6: Updating an existing session on a cancelled event must be rejected
    await assert.rejects(
      async () => {
        await updateSession(clubAdminId, event.id, session.id, {
          title: 'Modified Cancelled Session',
        });
      },
      (err: any) => {
        assert.match(err.message, /EVENT_LOCKED/);
        return true;
      }
    );

    // PATH 7: Submitting attendance dispute on a cancelled event must fail with EVENT_LOCKED
    await assert.rejects(
      async () => {
        await attendanceService.submitAttendanceDispute(student1Id, {
          session_id: session.id,
          reason: 'I was present before cancellation',
        });
      },
      (err: any) => {
        assert.match(err.message, /EVENT_LOCKED/);
        return true;
      }
    );
  });

  it('3. Cancellation side-effect reliability: idempotency, deduplicated notifications, and waitlist safety', async () => {
    const now = new Date();
    const event = await createEvent(clubAdminId, {
      title: `Phase 3C.1 Notification & Waitlist Reliability Event ${Date.now()}`,
      description: 'Testing notification deduplication and waitlist promotion suppression',
      start_time: new Date(now.getTime() + 2 * 86400000).toISOString(),
      end_time: new Date(now.getTime() + 3 * 86400000).toISOString(),
      registration_start_time: new Date(now.getTime() - 3600000).toISOString(),
      registration_end_time: new Date(now.getTime() + 86400000).toISOString(),
      venue: 'Auditorium 2',
      event_type: 'WORKSHOP',
      audience: 'ALL_STUDENTS',
      registration_type: 'INDIVIDUAL',
      max_capacity: 1, // Only 1 spot to create a waitlisted participant
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    createdEventIds.push(event.id);

    await adminPrisma.event.update({
      where: { id: event.id },
      data: { state: 'PUBLISHED' },
    });

    // Student 1 registers (gets spot 1)
    const reg1 = await registerEvent(student1Id, event.id);
    assert.strictEqual(reg1.status, 'REGISTERED');

    // Student 2 registers (waitlisted)
    const reg2 = await registerEvent(student2Id, event.id);
    assert.strictEqual(reg2.status, 'WAITLISTED');

    // CANCEL the event
    const cancelRes1 = await cancelEvent(clubAdminId, event.id, 'Venue unavailable');
    assert.strictEqual(cancelRes1.state, 'CANCELLED');

    // Verify notifications were enqueued for both student 1 and student 2
    const notifs1 = await adminPrisma.notification.findMany({
      where: {
        type: 'EVENT_CANCELLED',
        metadata: { path: ['entity_ids', 'event_id'], equals: event.id },
      },
    });
    assert.strictEqual(notifs1.length, 2);
    const notifiedUserIds = notifs1.map((n) => n.userId).sort();
    assert.deepStrictEqual(notifiedUserIds, [student1Id, student2Id].sort());

    // RETRY cancellation (Idempotency test)
    const cancelRes2 = await cancelEvent(clubAdminId, event.id, 'Venue unavailable retry');
    assert.strictEqual(cancelRes2.state, 'CANCELLED');

    // Notifications count MUST NOT increase
    const notifs2 = await adminPrisma.notification.findMany({
      where: {
        type: 'EVENT_CANCELLED',
        metadata: { path: ['entity_ids', 'event_id'], equals: event.id },
      },
    });
    assert.strictEqual(notifs2.length, 2);

    // Now test waitlist promotion suppression:
    // When student 1 cancels their registration on a CANCELLED event,
    // waitlist promotion MUST NOT promote student 2!
    const cancelRegResult = await cancelRegistration(student1Id, event.id);
    assert.deepStrictEqual(cancelRegResult, []); // Empty array: zero users promoted!

    const student2Reg = await adminPrisma.eventRegistration.findFirst({
      where: { eventId: event.id, userId: student2Id },
    });
    assert.strictEqual(student2Reg?.registrationStatus, 'WAITLISTED'); // Remains waitlisted, NOT promoted!
  });

  it('4. Lifecycle transition authorization: role matrix and transition invariants', async () => {
    const now = new Date();
    const event = await createEvent(clubAdminId, {
      title: `Phase 3C.1 Lifecycle Transition Matrix Event ${Date.now()}`,
      description: 'Testing authorized and forbidden lifecycle transitions',
      start_time: new Date(now.getTime() + 86400000).toISOString(),
      end_time: new Date(now.getTime() + 2 * 86400000).toISOString(),
      registration_start_time: new Date(now.getTime() - 3600000).toISOString(),
      registration_end_time: new Date(now.getTime() + 43200000).toISOString(),
      venue: 'Hall 3',
      event_type: 'WORKSHOP',
      audience: 'ALL_STUDENTS',
      registration_type: 'INDIVIDUAL',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    createdEventIds.push(event.id);

    // Initial state is DRAFT
    assert.strictEqual(event.state, 'DRAFT');

    // A non-club admin / random student CANNOT delete or cancel the draft
    await assert.rejects(
      async () => {
        await deleteEvent(student1Id, event.id);
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED|Unauthorized/);
        return true;
      }
    );

    // Attempting to cancel a DRAFT event must fail with domain error
    await assert.rejects(
      async () => {
        await cancelEvent(clubAdminId, event.id, 'Trying to cancel draft');
      },
      (err: any) => {
        assert.match(err.message, /Draft events cannot be cancelled/);
        return true;
      }
    );

    // Attempting to archive a DRAFT event must fail with domain error
    await assert.rejects(
      async () => {
        await archiveEvent(clubAdminId, event.id);
      },
      (err: any) => {
        assert.match(err.message, /Only completed or cancelled events can be archived/);
        return true;
      }
    );

    // Publish event
    await adminPrisma.event.update({
      where: { id: event.id },
      data: { state: 'PUBLISHED' },
    });

    // Attempting to archive a future published event before end_time must fail
    await assert.rejects(
      async () => {
        await archiveEvent(clubAdminId, event.id);
      },
      (err: any) => {
        assert.match(err.message, /Cannot archive an event before its scheduled end time/);
        return true;
      }
    );

    // Cancel event as Club Admin
    const cancelled = await cancelEvent(clubAdminId, event.id, 'Authorized cancellation');
    assert.strictEqual(cancelled.state, 'CANCELLED');

    // Now archiving a cancelled event IS allowed
    const archived = await archiveEvent(clubAdminId, event.id);
    assert.strictEqual(archived.state, 'ARCHIVED');

    // Archiving an already archived event is IDEMPOTENT
    const archivedAgain = await archiveEvent(clubAdminId, event.id);
    assert.strictEqual(archivedAgain.state, 'ARCHIVED');

    // Attempting to cancel an ARCHIVED event must be rejected
    await assert.rejects(
      async () => {
        await cancelEvent(clubAdminId, event.id, 'Cancel archived');
      },
      (err: any) => {
        assert.match(err.message, /Archived events cannot be cancelled/);
        return true;
      }
    );
  });

  it('5. Public history, slug stability, and results accessibility across states', async () => {
    const now = new Date();
    const event = await createEvent(clubAdminId, {
      title: `Phase 3C.1 Public Preservation Event ${Date.now()}`,
      description: 'Preserving public history across cancelled and archived states',
      start_time: new Date(now.getTime() - 86400000).toISOString(),
      end_time: new Date(now.getTime() + 3600000).toISOString(),
      registration_start_time: new Date(now.getTime() - 3600000).toISOString(),
      registration_end_time: new Date(now.getTime() + 1800000).toISOString(),
      venue: 'Auditorium A',
      visibility: 'PUBLIC',
      event_type: 'WORKSHOP',
      audience: 'ALL_STUDENTS',
      registration_type: 'INDIVIDUAL',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    createdEventIds.push(event.id);

    // Publish event
    await adminPrisma.event.update({
      where: { id: event.id },
      data: { state: 'PUBLISHED' },
    });

    // Register student while window is open
    await registerEvent(student1Id, event.id);

    // Update endTime and registrationEndTime to past so event can be archived
    await adminPrisma.event.update({
      where: { id: event.id },
      data: {
        registrationEndTime: new Date(now.getTime() - 2000),
        endTime: new Date(now.getTime() - 1000),
      },
    });

    // Archive event (end_time is now in the past)
    await archiveEvent(clubAdminId, event.id);

    // 1. Public slug resolution remains accessible (returns event with ARCHIVED state)
    const publicEvent = await getPublicEventBySlug(event.slug);
    assert.strictEqual(publicEvent.id, event.id);
    assert.strictEqual(publicEvent.state, 'ARCHIVED');
    assert.strictEqual(publicEvent.registration_status, 'CLOSED');

    // 2. Attendance history remains readable
    const attendanceRecords = await attendanceService.getEventAttendance(clubAdminId, event.id, { limit: 10 });
    assert.ok(Array.isArray(attendanceRecords.data));

    // 3. Student attendance history remains readable
    const myAttendance = await attendanceService.getMyAttendance(student1Id, { limit: 10, filter_event_id: event.id });
    assert.ok(Array.isArray(myAttendance.data));
  });
});
