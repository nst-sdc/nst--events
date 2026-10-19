import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { prisma } from '../../src/lib/prisma';
import { signJwt } from '../../src/lib/jwt';
import { createTeam, joinTeam, leaveTeam } from '../../src/modules/teams/teams.service';
import { randomUUID, createHmac } from 'crypto';

const app = createApp();

function generateTokenForTime(sessionId: string, qrSecret: string, timestampMs: number): string {
  const windowEpoch = Math.floor(timestampMs / 30000);
  const hmacInput = `v1:${sessionId}:${windowEpoch}`;
  const hmac = createHmac('sha256', qrSecret);
  hmac.update(hmacInput);
  const base64 = hmac.digest('base64');
  const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signature = base64Url.substring(0, 16);
  return `v1:${sessionId}:${signature}`;
}

describe('Phase 2A Remediation Integration Suite', () => {
  const runId = Date.now().toString().slice(-6);

  // Users
  const studentLeaderId = randomUUID();
  const studentMember1Id = randomUUID();
  const studentMember2Id = randomUUID();
  const studentMember3Id = randomUUID();
  const studentWaitlistLeaderId = randomUUID();
  const studentWaitlistMemberId = randomUUID();
  const organizerId = randomUUID();

  // Club & Events
  const clubId = randomUUID();
  const teamEventId = randomUUID();
  const multiTeamEventId = randomUUID();
  const individualEventId = randomUUID();
  const attendanceEventId = randomUUID();

  // Sessions
  const activeSessionId = randomUUID();
  const expiredSessionId = randomUUID();
  const futureSessionId = randomUUID();

  const activeSecret = 'phase2a_active_secret_key_12345';
  const expiredSecret = 'phase2a_expired_secret_key_12345';
  const futureSecret = 'phase2a_future_secret_key_12345';

  // Tokens
  let leaderToken: string;
  let member1Token: string;
  let member2Token: string;
  let member3Token: string;
  let waitlistLeaderToken: string;
  let waitlistMemberToken: string;
  let organizerToken: string;

  beforeAll(async () => {
    // 1. Create Club
    await adminPrisma.club.create({
      data: {
        id: clubId,
        name: `Club Phase2A ${runId}`,
      },
    });

    // 2. Create Users
    await adminPrisma.user.createMany({
      data: [
        { id: studentLeaderId, email: `lead_${runId}@adypu.edu.in`, fullName: 'Team Leader', globalRole: 'STUDENT', googleSub: `sub_ld_${runId}` },
        { id: studentMember1Id, email: `m1_${runId}@adypu.edu.in`, fullName: 'Member 1', globalRole: 'STUDENT', googleSub: `sub_m1_${runId}` },
        { id: studentMember2Id, email: `m2_${runId}@adypu.edu.in`, fullName: 'Member 2', globalRole: 'STUDENT', googleSub: `sub_m2_${runId}` },
        { id: studentMember3Id, email: `m3_${runId}@adypu.edu.in`, fullName: 'Member 3', globalRole: 'STUDENT', googleSub: `sub_m3_${runId}` },
        { id: studentWaitlistLeaderId, email: `wld_${runId}@adypu.edu.in`, fullName: 'Waitlist Leader', globalRole: 'STUDENT', googleSub: `sub_wld_${runId}` },
        { id: studentWaitlistMemberId, email: `wm_${runId}@adypu.edu.in`, fullName: 'Waitlist Member', globalRole: 'STUDENT', googleSub: `sub_wm_${runId}` },
        { id: organizerId, email: `org_${runId}@adypu.edu.in`, fullName: 'Organizer', globalRole: 'STUDENT', googleSub: `sub_org_${runId}` },
      ],
    });

    await adminPrisma.clubMembership.create({
      data: {
        userId: organizerId,
        clubId,
        role: 'CLUB_ADMIN',
      },
    });

    // Generate JWTs
    leaderToken = signJwt(studentLeaderId, 1);
    member1Token = signJwt(studentMember1Id, 1);
    member2Token = signJwt(studentMember2Id, 1);
    member3Token = signJwt(studentMember3Id, 1);
    waitlistLeaderToken = signJwt(studentWaitlistLeaderId, 1);
    waitlistMemberToken = signJwt(studentWaitlistMemberId, 1);
    organizerToken = signJwt(organizerId, 1);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneHourLater = new Date(now.getTime() + 3600000);
    const twoHoursLater = new Date(now.getTime() + 7200000);

    // 3. Create Events
    await adminPrisma.event.createMany({
      data: [
        {
          id: teamEventId,
          title: `Team Event Cap ${runId}`,
          description: 'Testing team participant capacity',
          slug: `team-event-cap-${runId}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'TEAM',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          createdBy: organizerId,
          maxCapacity: 2, // max 2 teams
          maxParticipants: 3, // max 3 individual participants total
          startTime: oneHourAgo,
          endTime: twoHoursLater,
          registrationStartTime: oneHourAgo,
          registrationEndTime: oneHourLater,
          metadata: { minimum_team_size: 1, maximum_team_size: 4 },
        },
        {
          id: multiTeamEventId,
          title: `Multi Team Event ${runId}`,
          description: 'Testing registrationCount vs participantCount semantics',
          slug: `multi-team-event-${runId}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'TEAM',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'COMPETITION',
          createdBy: organizerId,
          maxCapacity: 4, // max 4 teams
          maxParticipants: 10, // max 10 participants
          startTime: oneHourAgo,
          endTime: twoHoursLater,
          registrationStartTime: oneHourAgo,
          registrationEndTime: oneHourLater,
          metadata: { minimum_team_size: 1, maximum_team_size: 4 },
        },
        {
          id: individualEventId,
          title: `Individual Event ${runId}`,
          description: 'Testing individual contract and redirect',
          slug: `individual-event-${runId}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'INDIVIDUAL',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          createdBy: organizerId,
          maxCapacity: 50,
          maxParticipants: 50,
          startTime: oneHourAgo,
          endTime: twoHoursLater,
          registrationStartTime: oneHourAgo,
          registrationEndTime: oneHourLater,
        },
        {
          id: attendanceEventId,
          title: `Attendance Event ${runId}`,
          description: 'Testing offline attendance window enforcement',
          slug: `attend-event-${runId}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'INDIVIDUAL',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          createdBy: organizerId,
          maxCapacity: 100,
          startTime: oneHourAgo,
          endTime: twoHoursLater,
          registrationStartTime: oneHourAgo,
          registrationEndTime: oneHourLater,
        },
      ],
    });

    await adminPrisma.eventClub.createMany({
      data: [
        { eventId: teamEventId, clubId, isPrimary: true },
        { eventId: multiTeamEventId, clubId, isPrimary: true },
        { eventId: individualEventId, clubId, isPrimary: true },
        { eventId: attendanceEventId, clubId, isPrimary: true },
      ],
    });

    // Create 3 Sessions:
    // a. Active: opened 10 mins ago, closes in 20 mins
    await adminPrisma.attendanceSession.create({
      data: {
        id: activeSessionId,
        eventId: attendanceEventId,
        title: 'Active Session',
        qrSecret: activeSecret,
        startTime: new Date(now.getTime() - 600000),
        endTime: new Date(now.getTime() + 1200000),
        openAt: new Date(now.getTime() - 600000),
        closeAt: new Date(now.getTime() + 1200000),
        createdBy: organizerId,
      },
    });

    // b. Expired: opened 2 hours ago, closed 1 hour ago
    await adminPrisma.attendanceSession.create({
      data: {
        id: expiredSessionId,
        eventId: attendanceEventId,
        title: 'Expired Session',
        qrSecret: expiredSecret,
        startTime: new Date(now.getTime() - 7200000),
        endTime: new Date(now.getTime() - 3600000),
        openAt: new Date(now.getTime() - 7200000),
        closeAt: new Date(now.getTime() - 3600000),
        createdBy: organizerId,
      },
    });

    // c. Future: opens in 1 hour, closes in 2 hours
    await adminPrisma.attendanceSession.create({
      data: {
        id: futureSessionId,
        eventId: attendanceEventId,
        title: 'Future Session',
        qrSecret: futureSecret,
        startTime: new Date(now.getTime() + 3600000),
        endTime: new Date(now.getTime() + 7200000),
        openAt: new Date(now.getTime() + 3600000),
        closeAt: new Date(now.getTime() + 7200000),
        createdBy: organizerId,
      },
    });

    // Register studentLeaderId and studentMember1Id for attendanceEventId
    await adminPrisma.eventRegistration.createMany({
      data: [
        {
          id: randomUUID(),
          eventId: attendanceEventId,
          userId: studentLeaderId,
          registrationStatus: 'REGISTERED',
        },
        {
          id: randomUUID(),
          eventId: attendanceEventId,
          userId: studentMember1Id,
          registrationStatus: 'REGISTERED',
        },
      ],
    });
  });

  afterAll(async () => {
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId: { in: [activeSessionId, expiredSessionId, futureSessionId] } } }).catch(() => {});
    await adminPrisma.attendanceAttempt.deleteMany({ where: { sessionId: { in: [activeSessionId, expiredSessionId, futureSessionId] } } }).catch(() => {});
    await adminPrisma.attendanceSession.deleteMany({ where: { id: { in: [activeSessionId, expiredSessionId, futureSessionId] } } }).catch(() => {});
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId: { in: [teamEventId, multiTeamEventId, individualEventId, attendanceEventId] } } }).catch(() => {});
    await adminPrisma.team.deleteMany({ where: { eventId: { in: [teamEventId, multiTeamEventId] } } }).catch(() => {});
    await adminPrisma.eventClub.deleteMany({ where: { eventId: { in: [teamEventId, multiTeamEventId, individualEventId, attendanceEventId] } } }).catch(() => {});
    await adminPrisma.event.deleteMany({ where: { id: { in: [teamEventId, multiTeamEventId, individualEventId, attendanceEventId] } } }).catch(() => {});
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } }).catch(() => {});
    await adminPrisma.club.deleteMany({ where: { id: clubId } }).catch(() => {});
    await adminPrisma.user.deleteMany({
      where: {
        id: { in: [studentLeaderId, studentMember1Id, studentMember2Id, studentMember3Id, studentWaitlistLeaderId, studentWaitlistMemberId, organizerId] }
      }
    }).catch(() => {});
  });

  // =========================================================================
  // WORKSTREAM 1: FINDING-TEAM-01 — Team Participant Capacity Accounting
  // =========================================================================
  describe('Workstream 1: FINDING-TEAM-01 — Team Participant Capacity', () => {
    it('enforces exact participant limit, limit-plus-one on registered teams, cancellation/freeing, and reactivation', async () => {
      // 1. Create team 1 with 1 member (participant count = 1 <= max_participants 3)
      const res = await createTeam(studentLeaderId, teamEventId, `Team Alpha ${runId}`);
      assert.strictEqual(res.status, 'REGISTERED');
      const team1Id = res.team_id;

      // 2. Member 1 joins team 1 (participant count = 2 <= max_participants 3)
      const resM1 = await joinTeam(studentMember1Id, team1Id);
      assert.strictEqual(resM1.status, 'REGISTERED');
      assert.ok(resM1.registration_id);

      // 3. Member 2 joins team 1 (exact limit: participant count = 3 == max_participants 3)
      const resM2 = await joinTeam(studentMember2Id, team1Id);
      assert.strictEqual(resM2.status, 'REGISTERED');
      assert.ok(resM2.registration_id);

      // 4. Member 3 attempts to join registered team 1 (limit-plus-one: 4 > max_participants 3) -> rejected
      await assert.rejects(
        async () => {
          await joinTeam(studentMember3Id, team1Id);
        },
        (err: any) => {
          assert.match(err.message, /capacity.*full/i);
          return true;
        }
      );

      // 5. Cancellation: Member 2 leaves team, freeing 1 slot
      await leaveTeam(studentMember2Id, team1Id);

      // 6. Reactivation: Now Member 3 can successfully join
      const resM3 = await joinTeam(studentMember3Id, team1Id);
      assert.strictEqual(resM3.status, 'REGISTERED');
      assert.ok(resM3.registration_id);

      // 7. Member 2 (who left/cancelled previously) can re-register once a slot frees up
      // First member 3 leaves to free slot
      await leaveTeam(studentMember3Id, team1Id);
      const resM2Reactivated = await joinTeam(studentMember2Id, team1Id);
      assert.strictEqual(resM2Reactivated.status, 'REGISTERED');
    });

    it('verifies WAITLISTED registrations do NOT consume max_participants and permits waitlist team creation', async () => {
      // At this point, team 1 has leader + member 1 + member 2 (3/3 registered participants)
      // When participant capacity is full, creating a new team creates a WAITLISTED team
      const resWaitlist = await createTeam(studentWaitlistLeaderId, teamEventId, `Waitlist Team ${runId}`);
      assert.strictEqual(resWaitlist.status, 'WAITLISTED');
      const waitlistTeamId = resWaitlist.team_id;

      // Joining a WAITLISTED team succeeds with WAITLISTED status (does not throw U0057)
      const resJoinWaitlist = await joinTeam(studentWaitlistMemberId, waitlistTeamId);
      assert.strictEqual(resJoinWaitlist.status, 'WAITLISTED');

      // Verify DB counts: exactly 3 REGISTERED participants, and 2 WAITLISTED participants
      const registeredCount = await adminPrisma.eventRegistration.count({
        where: { eventId: teamEventId, registrationStatus: 'REGISTERED', deletedAt: null },
      });
      const waitlistedCount = await adminPrisma.eventRegistration.count({
        where: { eventId: teamEventId, registrationStatus: 'WAITLISTED', deletedAt: null },
      });

      assert.strictEqual(registeredCount, 3, 'Must have exactly 3 registered participants');
      assert.strictEqual(waitlistedCount, 2, 'Must have exactly 2 waitlisted participants without cap rejection');
    });

    it('enforces participant limit atomically under concurrent joins (no race condition overfill)', async () => {
      const concurrentEventId = randomUUID();
      const oneHourAgo = new Date(Date.now() - 3600000);
      const twoHoursLater = new Date(Date.now() + 7200000);

      await adminPrisma.event.create({
        data: {
          id: concurrentEventId,
          title: `Concurrent Join Event ${runId}`,
          description: 'Testing race condition on join_team',
          slug: `concurrent-join-${runId}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'TEAM',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          createdBy: organizerId,
          maxCapacity: 2,
          maxParticipants: 2, // Only 2 participants total!
          startTime: oneHourAgo,
          endTime: twoHoursLater,
          registrationStartTime: oneHourAgo,
          registrationEndTime: twoHoursLater,
          metadata: { minimum_team_size: 1, maximum_team_size: 2 },
          eventClubs: {
            create: {
              clubId,
              isPrimary: true,
            },
          },
        },
      });

      // Temporary users for clean concurrent test
      const cLeaderId = randomUUID();
      const cMember1Id = randomUUID();
      const cMember2Id = randomUUID();

      await adminPrisma.user.createMany({
        data: [
          { id: cLeaderId, email: `clead_${runId}@adypu.edu.in`, fullName: 'C Leader', globalRole: 'STUDENT', googleSub: `csub_ld_${runId}` },
          { id: cMember1Id, email: `cm1_${runId}@adypu.edu.in`, fullName: 'C Member 1', globalRole: 'STUDENT', googleSub: `csub_m1_${runId}` },
          { id: cMember2Id, email: `cm2_${runId}@adypu.edu.in`, fullName: 'C Member 2', globalRole: 'STUDENT', googleSub: `csub_m2_${runId}` },
        ],
      });

      // Leader creates team (participant count = 1 / 2)
      const res = await createTeam(cLeaderId, concurrentEventId, `Race Team ${runId}`);
      assert.strictEqual(res.status, 'REGISTERED');
      const raceTeamId = res.team_id;

      // Two users concurrently attempt to join for the 1 remaining registered slot
      const [attempt1, attempt2] = await Promise.allSettled([
        joinTeam(cMember1Id, raceTeamId),
        joinTeam(cMember2Id, raceTeamId),
      ]);

      const successes = [attempt1, attempt2].filter(a => a.status === 'fulfilled');
      const rejections = [attempt1, attempt2].filter(a => a.status === 'rejected');

      assert.strictEqual(successes.length, 1, 'Exactly one concurrent join must succeed');
      assert.strictEqual(rejections.length, 1, 'Exactly one concurrent join must be rejected');

      // Verify active registrations in DB does not exceed max_participants (2)
      const count = await adminPrisma.eventRegistration.count({
        where: {
          eventId: concurrentEventId,
          registrationStatus: 'REGISTERED',
          deletedAt: null,
        },
      });
      assert.strictEqual(count, 2, 'Active registrations must strictly equal max_participants (2)');

      // Cleanup
      await adminPrisma.eventRegistration.deleteMany({ where: { eventId: concurrentEventId } });
      await adminPrisma.team.deleteMany({ where: { eventId: concurrentEventId } });
      await adminPrisma.eventClub.deleteMany({ where: { eventId: concurrentEventId } });
      await adminPrisma.event.delete({ where: { id: concurrentEventId } });
      await adminPrisma.notification.deleteMany({ where: { userId: { in: [cLeaderId, cMember1Id, cMember2Id] } } }).catch(() => {});
      await adminPrisma.user.deleteMany({ where: { id: { in: [cLeaderId, cMember1Id, cMember2Id] } } });
    });
  });

  // =========================================================================
  // WORKSTREAM 2: FINDING-ATTEND-01 — Offline Attendance Enforcement & Batch Error Integrity
  // =========================================================================
  describe('Workstream 2: FINDING-ATTEND-01 — Offline Attendance Enforcement', () => {
    it('rejects offline attendance when timestamp is outside session window (SESSION_CLOSED)', async () => {
      const expiredScanTime = new Date(Date.now() - 1800000).toISOString();
      const token = generateTokenForTime(expiredSessionId, expiredSecret, new Date(expiredScanTime).getTime());

      const res = await request(app)
        .post('/v1/attendance/sync-offline')
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('X-App-Version', '1.0.0')
        .send({
          records: [
            {
              user_id: studentLeaderId,
              session_id: expiredSessionId,
              scanned_token: token,
              scan_timestamp: expiredScanTime,
              device_id: 'device-test-01',
              gps_lat: 18.5204,
              gps_lng: 73.8567,
              gps_accuracy: 10,
              mock_location_detected: false,
              offline_seq: 1,
            },
          ],
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.processed, 0);
      assert.strictEqual(res.body.skipped, 1);
      assert.strictEqual(res.body.errors.length, 1);
      assert.strictEqual(res.body.errors[0].error_code, 'SESSION_CLOSED');
      assert.strictEqual(res.body.errors[0].user_id, studentLeaderId);
      assert.strictEqual(res.body.errors[0].batch_index, 0);
    });

    it('rejects forged future timestamp (> 5 minutes ahead) with FUTURE_TIMESTAMP', async () => {
      const futureScanTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const token = generateTokenForTime(activeSessionId, activeSecret, new Date(futureScanTime).getTime());

      const res = await request(app)
        .post('/v1/attendance/sync-offline')
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('X-App-Version', '1.0.0')
        .send({
          records: [
            {
              user_id: studentLeaderId,
              session_id: activeSessionId,
              scanned_token: token,
              scan_timestamp: futureScanTime,
              device_id: 'device-test-02',
              gps_lat: 18.5204,
              gps_lng: 73.8567,
              gps_accuracy: 10,
              mock_location_detected: false,
              offline_seq: 2,
            },
          ],
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.processed, 0);
      assert.strictEqual(res.body.skipped, 1);
      assert.strictEqual(res.body.errors.length, 1);
      assert.strictEqual(res.body.errors[0].error_code, 'FUTURE_TIMESTAMP');
      assert.strictEqual(res.body.errors[0].user_id, studentLeaderId);
      assert.strictEqual(res.body.errors[0].batch_index, 0);
    });

    it('processes valid scan and isolates errors with multiple records, duplicate sequence IDs, and missing sequence IDs', async () => {
      const validScanTime = new Date().toISOString();
      const validToken = generateTokenForTime(activeSessionId, activeSecret, Date.now());

      const expiredScanTime = new Date(Date.now() - 1800000).toISOString();
      const expiredToken = generateTokenForTime(expiredSessionId, expiredSecret, new Date(expiredScanTime).getTime());

      const futureScanTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const invalidFutureToken = generateTokenForTime(activeSessionId, activeSecret, new Date(futureScanTime).getTime());

      // 4 records in a batch:
      // index 0: valid scan (active session)
      // index 1: invalid expired scan (same user, expired session, missing offline_seq)
      // index 2: invalid future scan (same user, future timestamp, duplicate offline_seq = 1)
      // index 3: invalid expired scan (different user, expired session, duplicate offline_seq = 1)
      const res = await request(app)
        .post('/v1/attendance/sync-offline')
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('X-App-Version', '1.0.0')
        .send({
          records: [
            {
              user_id: studentLeaderId,
              session_id: activeSessionId,
              scanned_token: validToken,
              scan_timestamp: validScanTime,
              device_id: 'device-test-valid',
              gps_lat: 18.5204,
              gps_lng: 73.8567,
              gps_accuracy: 10,
              mock_location_detected: false,
              // missing offline_seq
            },
            {
              user_id: studentLeaderId,
              session_id: expiredSessionId,
              scanned_token: expiredToken,
              scan_timestamp: expiredScanTime,
              device_id: 'device-test-expired-1',
              gps_lat: 18.5204,
              gps_lng: 73.8567,
              gps_accuracy: 10,
              mock_location_detected: false,
              // missing offline_seq
            },
            {
              user_id: studentLeaderId,
              session_id: activeSessionId,
              scanned_token: invalidFutureToken,
              scan_timestamp: futureScanTime,
              device_id: 'device-test-future',
              gps_lat: 18.5204,
              gps_lng: 73.8567,
              gps_accuracy: 10,
              mock_location_detected: false,
              offline_seq: 1, // duplicate seq
            },
            {
              user_id: studentMember1Id,
              session_id: expiredSessionId,
              scanned_token: expiredToken,
              scan_timestamp: expiredScanTime,
              device_id: 'device-test-expired-2',
              gps_lat: 18.5204,
              gps_lng: 73.8567,
              gps_accuracy: 10,
              mock_location_detected: false,
              offline_seq: 1, // duplicate seq with different user
            },
          ],
        });

      assert.strictEqual(res.status, 200);
      // Valid record was processed
      assert.strictEqual(res.body.processed, 1);
      // 3 invalid records were skipped
      assert.strictEqual(res.body.skipped, 3);
      assert.strictEqual(res.body.errors.length, 3);

      // Verify each error maps to the exact batch index and offending user:
      const err1 = res.body.errors.find((e: any) => e.batch_index === 1);
      assert.ok(err1, 'Must have error for batch index 1');
      assert.strictEqual(err1.error_code, 'SESSION_CLOSED');
      assert.strictEqual(err1.user_id, studentLeaderId);

      const err2 = res.body.errors.find((e: any) => e.batch_index === 2);
      assert.ok(err2, 'Must have error for batch index 2');
      assert.strictEqual(err2.error_code, 'FUTURE_TIMESTAMP');
      assert.strictEqual(err2.user_id, studentLeaderId);

      const err3 = res.body.errors.find((e: any) => e.batch_index === 3);
      assert.ok(err3, 'Must have error for batch index 3');
      assert.strictEqual(err3.error_code, 'SESSION_CLOSED');
      assert.strictEqual(err3.user_id, studentMember1Id);
    });
  });

  // =========================================================================
  // WORKSTREAM 3: FINDING-CONTRACT-01 — Team Hub Contract & Event Detail Semantics
  // =========================================================================
  describe('Workstream 3: FINDING-CONTRACT-01 — Team Hub Contract & Event Detail', () => {
    it('GET /v1/events/:id returns distinct registrationCount (teams) vs participantCount (individuals) for team events', async () => {
      // Create Team 1 with 2 members in multiTeamEventId
      const t1 = await createTeam(studentLeaderId, multiTeamEventId, `Squad One ${runId}`);
      assert.strictEqual(t1.status, 'REGISTERED');
      await joinTeam(studentMember1Id, t1.team_id);

      // Create Team 2 with 3 members in multiTeamEventId
      const t2 = await createTeam(studentMember2Id, multiTeamEventId, `Squad Two ${runId}`);
      assert.strictEqual(t2.status, 'REGISTERED');
      await joinTeam(studentMember3Id, t2.team_id);
      await joinTeam(studentWaitlistLeaderId, t2.team_id);

      const res = await request(app)
        .get(`/v1/events/${multiTeamEventId}`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('X-App-Version', '1.0.0');

      assert.strictEqual(res.status, 200);
      const data = res.body;

      // Verify distinction between teams and individual participants:
      // Exactly 2 registered teams
      assert.strictEqual(data.registrationCount, 2, 'registrationCount must represent registered team count');
      assert.strictEqual(data.registeredTeamCount, 2, 'registeredTeamCount must represent registered team count');
      assert.strictEqual(data.maxCapacity, 4, 'maxCapacity is 4 teams');

      // Exactly 5 registered participants (2 in Team 1 + 3 in Team 2)
      assert.strictEqual(data.participantCount, 5, 'participantCount must represent registered individuals count');
      assert.strictEqual(data.registeredParticipantCount, 5, 'registeredParticipantCount must represent registered individuals count');
      assert.strictEqual(data.maxParticipants, 10, 'maxParticipants is 10 individuals');

      // Verify contract fields
      assert.strictEqual(data.registrationType, 'TEAM');
      assert.ok(data.lockDeadline);
      assert.ok(data.lock_deadline);
      assert.strictEqual(data.lockDeadline, data.lock_deadline);
      assert.ok(data.lock_state);
    });

    it('GET /v1/events/:id returns identical registrationCount and participantCount for individual event', async () => {
      // Register 2 individual users
      await request(app)
        .post(`/v1/events/${individualEventId}/register`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('X-App-Version', '1.0.0');

      await request(app)
        .post(`/v1/events/${individualEventId}/register`)
        .set('Authorization', `Bearer ${member1Token}`)
        .set('X-App-Version', '1.0.0');

      const res = await request(app)
        .get(`/v1/events/${individualEventId}`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('X-App-Version', '1.0.0');

      assert.strictEqual(res.status, 200);
      const data = res.body;
      assert.strictEqual(data.id, individualEventId);
      assert.strictEqual(data.registrationType, 'INDIVIDUAL');
      assert.strictEqual(data.registrationCount, 2);
      assert.strictEqual(data.participantCount, 2);
      assert.strictEqual(data.registeredTeamCount, null);
      assert.strictEqual(data.registeredParticipantCount, 2);
      assert.ok(data.lockDeadline);
    });
  });
});
