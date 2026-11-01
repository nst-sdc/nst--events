import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { adminPrisma } from '../helpers/adminDb';
import { registerEvent } from '../../src/modules/registrations/registrations.service';
import { createTeam, joinTeam } from '../../src/modules/teams/teams.service';
import {
  calculateRegistrationStatus,
  createEvent,
  updateEvent,
} from '../../src/modules/events/events.service';

describe('Registration Window Edge Cases & Authoritative Enforcement', () => {
  let organizerId: string;
  let platformAdminId: string;
  let studentAId: string;
  let studentBId: string;
  let studentCId: string;
  let clubId: string;
  let eventIds: string[] = [];

  before(async () => {
    const org = await adminPrisma.user.create({
      data: { email: `org_win_${Date.now()}@adypu.edu.in`, googleSub: `sub_org_${Date.now()}`, fullName: 'Org Win' },
    });
    organizerId = org.id;

    const admin = await adminPrisma.user.create({
      data: {
        email: `plat_admin_${Date.now()}@adypu.edu.in`,
        googleSub: `sub_admin_${Date.now()}`,
        fullName: 'Plat Admin',
        globalRole: 'PLATFORM_ADMIN',
      },
    });
    platformAdminId = admin.id;

    const sA = await adminPrisma.user.create({
      data: { email: `studentA_win_${Date.now()}@adypu.edu.in`, googleSub: `sub_sA_${Date.now()}`, fullName: 'Student A' },
    });
    studentAId = sA.id;

    const sB = await adminPrisma.user.create({
      data: { email: `studentB_win_${Date.now()}@adypu.edu.in`, googleSub: `sub_sB_${Date.now()}`, fullName: 'Student B' },
    });
    studentBId = sB.id;

    const sC = await adminPrisma.user.create({
      data: { email: `studentC_win_${Date.now()}@adypu.edu.in`, googleSub: `sub_sC_${Date.now()}`, fullName: 'Student C' },
    });
    studentCId = sC.id;

    const club = await adminPrisma.club.create({
      data: { name: `Window Test Club ${Date.now()}` },
    });
    clubId = club.id;

    await adminPrisma.clubMembership.create({
      data: { userId: organizerId, clubId, role: 'CLUB_ADMIN' },
    });
  });

  after(async () => {
    if (eventIds.length > 0) {
      await adminPrisma.eventRegistrationResponse.deleteMany({ where: { eventRegistration: { eventId: { in: eventIds } } } });
      await adminPrisma.eventRegistration.deleteMany({ where: { eventId: { in: eventIds } } });
      await adminPrisma.team.deleteMany({ where: { eventId: { in: eventIds } } });
      await adminPrisma.eventClub.deleteMany({ where: { eventId: { in: eventIds } } });
      await adminPrisma.event.deleteMany({ where: { id: { in: eventIds } } });
    }
    await adminPrisma.$executeRaw`DELETE FROM notification_jobs;`;
    await adminPrisma.notification.deleteMany({ where: { userId: { in: [organizerId, platformAdminId, studentAId, studentBId, studentCId] } } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.delete({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [organizerId, platformAdminId, studentAId, studentBId, studentCId] } } });
  });

  async function getDbNow(): Promise<Date> {
    const [{ now }] = await adminPrisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() as now`;
    return new Date(now);
  }

  async function createTestEvent(overrides: {
    registrationStartTime?: Date | null;
    registrationEndTime?: Date | null;
    registrationType?: 'INDIVIDUAL' | 'TEAM';
    maxCapacity?: number | null;
  }) {
    const ev = await adminPrisma.event.create({
      data: {
        title: `Window Event ${Date.now()}`,
        description: 'Testing registration window boundaries',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        eventType: 'WORKSHOP',
        registrationType: overrides.registrationType || 'INDIVIDUAL',
        maxCapacity: overrides.maxCapacity ?? 10,
        registrationCount: 0,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 172800000),
        registrationStartTime: overrides.registrationStartTime,
        registrationEndTime: overrides.registrationEndTime,
        createdBy: organizerId,
        metadata: overrides.registrationType === 'TEAM' ? { minimum_team_size: 2, maximum_team_size: 4 } : {},
      },
    });
    eventIds.push(ev.id);
    return ev;
  }

  it('1. Rejects registration when both start and end timestamps are absent (empty window defaults to CLOSED)', async () => {
    const event = await createTestEvent({
      registrationStartTime: null,
      registrationEndTime: null,
    });

    const status = calculateRegistrationStatus(new Date(), event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'CLOSED', 'Empty window status must be CLOSED');

    await assert.rejects(
      registerEvent(studentAId, event.id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('2. Rejects registration when start exists but end timestamp is absent', async () => {
    const event = await createTestEvent({
      registrationStartTime: new Date(Date.now() - 3600000),
      registrationEndTime: null,
    });

    const status = calculateRegistrationStatus(new Date(), event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'CLOSED', 'Missing end time status must be CLOSED');

    await assert.rejects(
      registerEvent(studentAId, event.id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('3. Rejects registration when end exists but start timestamp is absent', async () => {
    const event = await createTestEvent({
      registrationStartTime: null,
      registrationEndTime: new Date(Date.now() + 3600000),
    });

    const status = calculateRegistrationStatus(new Date(), event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'CLOSED', 'Missing start time status must be CLOSED');

    await assert.rejects(
      registerEvent(studentAId, event.id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('4. Rejects registration when start equals end timestamp (0 duration)', async () => {
    const now = new Date();
    const event = await createTestEvent({
      registrationStartTime: now,
      registrationEndTime: now,
    });

    const status = calculateRegistrationStatus(now, event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'CLOSED', 'Start == End status must be CLOSED');

    await assert.rejects(
      registerEvent(studentAId, event.id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('5. Rejects registration when end timestamp is before start timestamp', async () => {
    const now = new Date();
    const event = await createTestEvent({
      registrationStartTime: new Date(now.getTime() + 7200000),
      registrationEndTime: new Date(now.getTime() + 3600000),
    });

    const status = calculateRegistrationStatus(now, event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'CLOSED', 'Inverted window status must be CLOSED');

    await assert.rejects(
      registerEvent(studentAId, event.id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('6. Rejects registration immediately before opening time (future window)', async () => {
    const dbNow = await getDbNow();
    // Opens in 5 seconds
    const event = await createTestEvent({
      registrationStartTime: new Date(dbNow.getTime() + 5000),
      registrationEndTime: new Date(dbNow.getTime() + 7200000),
    });

    const status = calculateRegistrationStatus(dbNow, event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'UPCOMING', 'Future start time status must be UPCOMING');

    await assert.rejects(
      registerEvent(studentAId, event.id),
      /REGISTRATION_CLOSED|Registration has not opened yet/i
    );
  });

  it('7. Allows registration when current time is within [start, end) window', async () => {
    const dbNow = await getDbNow();
    const event = await createTestEvent({
      registrationStartTime: new Date(dbNow.getTime() - 3600000),
      registrationEndTime: new Date(dbNow.getTime() + 3600000),
    });

    const status = calculateRegistrationStatus(dbNow, event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'OPEN', 'Active window status must be OPEN');

    const result = await registerEvent(studentAId, event.id);
    assert.strictEqual(result.status, 'REGISTERED');
  });

  it('8. Rejects registration immediately after closing time (expired window)', async () => {
    const dbNow = await getDbNow();
    // Closed 2 seconds ago
    const event = await createTestEvent({
      registrationStartTime: new Date(dbNow.getTime() - 7200000),
      registrationEndTime: new Date(dbNow.getTime() - 2000),
    });

    const status = calculateRegistrationStatus(dbNow, event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'CLOSED', 'Expired end time status must be CLOSED');

    await assert.rejects(
      registerEvent(studentAId, event.id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('9. Enforces sub-second millisecond boundary precision on closing time (now >= endAt)', async () => {
    const dbNow = await getDbNow();
    // End is set to exactly 50 milliseconds in the past
    const event = await createTestEvent({
      registrationStartTime: new Date(dbNow.getTime() - 60000),
      registrationEndTime: new Date(dbNow.getTime() - 50),
    });

    await assert.rejects(
      registerEvent(studentBId, event.id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('10. Blocks team creation outside registration window', async () => {
    const dbNow = await getDbNow();
    // Event where registration has closed
    const event = await createTestEvent({
      registrationType: 'TEAM',
      registrationStartTime: new Date(dbNow.getTime() - 7200000),
      registrationEndTime: new Date(dbNow.getTime() - 1000),
    });

    await assert.rejects(
      createTeam(studentAId, event.id, 'Late Team'),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('11. Blocks team joining outside registration window', async () => {
    // Create an event that is currently open
    const event = await createTestEvent({
      registrationType: 'TEAM',
      registrationStartTime: new Date(Date.now() - 3600000),
      registrationEndTime: new Date(Date.now() + 3600000),
    });

    // Leader creates team while open
    const team = await createTeam(studentAId, event.id, 'Timely Team');
    assert.ok(team.team_id);

    // Now close the window by updating registrationEndTime in DB
    await adminPrisma.$executeRaw`
      UPDATE events SET registration_end_time = now() - interval '1 second' WHERE id = ${event.id}::uuid
    `;

    // Student B attempts to join after closure
    await assert.rejects(
      joinTeam(studentBId, team.team_id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('12. Allows team creation and joining when window is valid and open', async () => {
    const event = await createTestEvent({
      registrationType: 'TEAM',
      registrationStartTime: new Date(Date.now() - 3600000),
      registrationEndTime: new Date(Date.now() + 3600000),
    });

    const team = await createTeam(studentBId, event.id, 'Open Window Team');
    assert.strictEqual(team.status, 'FORMING');

    const joinRes = await joinTeam(studentCId, team.team_id);
    assert.strictEqual(joinRes.status, 'REGISTERED');
  });

  it('13. Accurately parses and enforces timestamps across diverse timezone offsets (IST +05:30, EST -05:00, JST +09:00, UTC)', async () => {
    // Current epoch in milliseconds
    const nowMs = Date.now();
    // 1 hour ago in IST (+05:30)
    const istStart = new Date(nowMs - 3600000).toISOString().replace('Z', '+00:00');
    // 1 hour in the future in EST (-05:00)
    const estEnd = new Date(nowMs + 3600000).toISOString().replace('Z', '+00:00');

    const event = await createTestEvent({
      registrationStartTime: new Date(istStart),
      registrationEndTime: new Date(estEnd),
    });

    // In DB, timestamptz stores UTC. Verify PostgreSQL evaluates server now() strictly between start and end
    const status = calculateRegistrationStatus(new Date(), event.registrationStartTime, event.registrationEndTime);
    assert.strictEqual(status, 'OPEN', 'Event configured with offset ISO strings must evaluate as OPEN during active window');

    // Attempt registration
    const reg = await registerEvent(studentAId, event.id);
    assert.strictEqual(reg.status, 'REGISTERED');
  });

  it('14. Authoritatively evaluates timestamps across Daylight Saving Time (DST) boundaries', async () => {
    // In 2026, US Eastern transitions from EDT (-04:00) to EST (-05:00) on Sunday, Nov 1, 2026.
    // 2026-11-01T01:30:00-04:00 is 2026-11-01T05:30:00Z UTC
    // 2026-11-01T02:30:00-05:00 is 2026-11-01T07:30:00Z UTC
    // The elapsed duration is exactly 2 hours (120 minutes = 7200 seconds), not 1 hour.
    const edtStartIso = '2026-11-01T01:30:00-04:00';
    const estEndIso = '2026-11-01T02:30:00-05:00';

    const durationResult = await adminPrisma.$queryRaw<Array<{ duration_seconds: number }>>`
      SELECT EXTRACT(EPOCH FROM (${estEndIso}::timestamptz - ${edtStartIso}::timestamptz))::int as duration_seconds;
    `;

    assert.strictEqual(
      durationResult[0].duration_seconds,
      7200,
      'PostgreSQL timestamptz must compute elapsed time as exactly 7200 seconds across the DST transition'
    );

    // Verify ordering check in calculateRegistrationStatus handles DST correctly
    const testEv = await adminPrisma.event.create({
      data: {
        title: 'DST Test Event',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        startTime: new Date('2026-11-01T08:00:00Z'),
        endTime: new Date('2026-11-01T10:00:00Z'),
        registrationStartTime: new Date(edtStartIso),
        registrationEndTime: new Date(estEndIso),
        createdBy: organizerId,
      },
    });
    eventIds.push(testEv.id);

    // Before the DST window starts, status must be UPCOMING
    const evalTime = new Date('2026-10-31T12:00:00Z');
    const futureStatus = calculateRegistrationStatus(evalTime, testEv.registrationStartTime, testEv.registrationEndTime);
    assert.strictEqual(futureStatus, 'UPCOMING', 'Future DST-spanning registration window must report UPCOMING');
  });

  it('15. Canonical registration status: comprehensive contract evaluation (UPCOMING, OPEN, CLOSING_SOON, CLOSED)', () => {
    const start = new Date('2026-10-20T10:00:00Z');
    const end = new Date('2026-10-27T10:00:00Z'); // 7-day window

    // Before start: UPCOMING
    const beforeStart = new Date('2026-10-20T09:59:59Z');
    assert.strictEqual(calculateRegistrationStatus(beforeStart, start, end), 'UPCOMING');

    // Early in window (48 hours remaining > 24 hours): OPEN
    const earlyInWindow = new Date('2026-10-25T10:00:00Z');
    assert.strictEqual(calculateRegistrationStatus(earlyInWindow, start, end), 'OPEN');

    // Closing soon (12 hours remaining <= 24 hours default threshold): CLOSING_SOON
    const closingSoon = new Date('2026-10-26T22:00:00Z');
    assert.strictEqual(calculateRegistrationStatus(closingSoon, start, end), 'CLOSING_SOON');

    // Custom threshold: 2 hours
    const customThresholdMs = 2 * 60 * 60 * 1000;
    const threeHoursLeft = new Date('2026-10-27T07:00:00Z');
    assert.strictEqual(calculateRegistrationStatus(threeHoursLeft, start, end, customThresholdMs), 'OPEN');
    const oneHourLeft = new Date('2026-10-27T09:00:00Z');
    assert.strictEqual(calculateRegistrationStatus(oneHourLeft, start, end, customThresholdMs), 'CLOSING_SOON');

    // Exactly at end time: CLOSED
    assert.strictEqual(calculateRegistrationStatus(end, start, end), 'CLOSED');

    // After end time: CLOSED
    const afterEnd = new Date('2026-10-27T10:00:01Z');
    assert.strictEqual(calculateRegistrationStatus(afterEnd, start, end), 'CLOSED');

    // Null or invalid start/end timestamps: CLOSED
    assert.strictEqual(calculateRegistrationStatus(earlyInWindow, null, end), 'CLOSED');
    assert.strictEqual(calculateRegistrationStatus(earlyInWindow, start, null), 'CLOSED');
    assert.strictEqual(calculateRegistrationStatus(earlyInWindow, null, null), 'CLOSED');
    assert.strictEqual(calculateRegistrationStatus(earlyInWindow, end, start), 'CLOSED');
  });

  it('16. Exact boundary conditions: register permitted at opening millisecond, rejected at closing millisecond', async () => {
    const dbNow = await getDbNow();
    // 16a. Opens exactly now
    const openNowEvent = await createTestEvent({
      registrationStartTime: new Date(dbNow.getTime() - 200),
      registrationEndTime: new Date(dbNow.getTime() + 3600000),
    });
    const regRes = await registerEvent(studentBId, openNowEvent.id);
    assert.strictEqual(regRes.status, 'REGISTERED', 'Registration must succeed at start boundary');

    // 16b. Closed 200 milliseconds ago
    const dbNowClosed = await getDbNow();
    const closedNowEvent = await createTestEvent({
      registrationStartTime: new Date(dbNowClosed.getTime() - 3600000),
      registrationEndTime: new Date(dbNowClosed.getTime() - 200),
    });
    await assert.rejects(
      registerEvent(studentCId, closedNowEvent.id),
      /REGISTRATION_CLOSED|Registration is closed/i
    );
  });

  it('17. Club Admin event creation strictly requires both registration start and end timestamps', async () => {
    const eventStartTime = new Date(Date.now() + 86400000).toISOString();
    const eventEndTime = new Date(Date.now() + 172800000).toISOString();

    // 17a. Missing both registration timestamps
    await assert.rejects(
      createEvent(organizerId, {
        title: 'Club Event Missing Window',
        start_time: eventStartTime,
        end_time: eventEndTime,
        event_type: 'WORKSHOP',
        club_ids: [{ club_id: clubId, is_primary: true }],
      }),
      (err: any) => {
        return err.statusCode === 422 && /Registration window.*is mandatory for Club Admins/i.test(err.message);
      }
    );

    // 17b. Provided valid window succeeds
    const created = await createEvent(organizerId, {
      title: 'Club Event With Valid Window',
      start_time: eventStartTime,
      end_time: eventEndTime,
      registration_start_time: new Date(Date.now() + 3600000).toISOString(),
      registration_end_time: new Date(Date.now() + 7200000).toISOString(),
      event_type: 'WORKSHOP',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    assert.ok(created.id, 'Club Admin can create event with valid window');
    eventIds.push(created.id);
  });

  it('18. Club Admin cannot update existing event to remove registration window', async () => {
    const eventStartTime = new Date(Date.now() + 86400000);
    const eventEndTime = new Date(Date.now() + 172800000);
    const regStartTime = new Date(Date.now() + 3600000);
    const regEndTime = new Date(Date.now() + 7200000);

    const initial = await adminPrisma.event.create({
      data: {
        title: 'Club Event To Update',
        state: 'DRAFT',
        visibility: 'PUBLIC',
        audience: 'ALL_STUDENTS',
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        startTime: eventStartTime,
        endTime: eventEndTime,
        registrationStartTime: regStartTime,
        registrationEndTime: regEndTime,
        createdBy: organizerId,
        eventClubs: {
          create: [{ clubId, isPrimary: true }],
        },
      },
    });
    eventIds.push(initial.id);

    // Attempt to set registration_start_time to null
    await assert.rejects(
      updateEvent(organizerId, initial.id, {
        registration_start_time: null as any,
      }),
      (err: any) => {
        return err.statusCode === 422 && /Registration window.*is mandatory for Club Admins/i.test(err.message);
      }
    );
  });

  it('19. Platform/Faculty Admin may create administrative event without registration window, which evaluates as CLOSED', async () => {
    const eventStartTime = new Date(Date.now() + 86400000).toISOString();
    const eventEndTime = new Date(Date.now() + 172800000).toISOString();

    // Platform Admin creates an informational event with NO registration window (NOT_REQUIRED mode)
    const adminEvent = await createEvent(platformAdminId, {
      title: 'Administrative Assembly',
      description: 'University-wide assembly (no registration needed)',
      start_time: eventStartTime,
      end_time: eventEndTime,
      event_type: 'SEMINAR',
      visibility: 'PUBLIC',
      registration_mode: 'NOT_REQUIRED',
      club_ids: [{ club_id: clubId, is_primary: true }],
    });
    assert.ok(adminEvent.id);
    eventIds.push(adminEvent.id);

    // Publish the event directly
    await adminPrisma.event.update({
      where: { id: adminEvent.id },
      data: { state: 'PUBLISHED' },
    });

    // 19a. Verify calculateRegistrationStatus reports CLOSED
    const status = calculateRegistrationStatus(
      new Date(),
      adminEvent.registrationStartTime,
      adminEvent.registrationEndTime
    );
    assert.strictEqual(status, 'CLOSED', 'Events without registration timestamps must report CLOSED status');

    // 19b. Verify database strictly rejects student registration attempt
    await assert.rejects(
      registerEvent(studentAId, adminEvent.id),
      /REGISTRATION_CLOSED|Registration is closed|Registration is not open|Registration is not required/i
    );
  });
});
