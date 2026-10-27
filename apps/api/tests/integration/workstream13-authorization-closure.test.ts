import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { generateRefreshToken, hashToken } from '../../src/lib/hash';
import { mapDatabaseError } from '../../src/lib/errors/database-error-mapper';
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from '../../src/lib/errors';
import { randomUUID } from 'crypto';

const app = createApp();

describe('Workstream 13: API Authorization & IDOR Closure Integration Suite', () => {
  const runId = Date.now().toString().slice(-6);

  // Entities
  const clubAId = randomUUID();
  const clubBId = randomUUID();

  const platformAdminId = randomUUID();
  const clubAdminAId = randomUUID();
  const clubAdminBId = randomUUID();
  const studentAId = randomUUID();
  const studentBId = randomUUID();

  const eventAId = randomUUID();
  const eventBId = randomUUID();
  const draftEventAId = randomUUID();

  const sessionAId = randomUUID();
  const sessionBId = randomUUID();

  const teamDraftId = randomUUID();
  const teamPubId = randomUUID();

  // Tokens
  let platformAdminToken: string;
  let clubAdminAToken: string;
  let clubAdminBToken: string;
  let studentAToken: string;
  let studentBToken: string;

  beforeAll(async () => {
    // 1. Create Clubs
    await adminPrisma.club.createMany({
      data: [
        { id: clubAId, name: `Club Alpha ${runId}` },
        { id: clubBId, name: `Club Beta ${runId}` },
      ],
    });

    // 2. Create Users
    await adminPrisma.user.createMany({
      data: [
        {
          id: platformAdminId,
          email: `admin-${runId}@adypu.edu.in`,
          fullName: `Admin ${runId}`,
          globalRole: 'PLATFORM_ADMIN',
          googleSub: `sub-admin-${runId}`,
          securityVersion: 1,
        },
        {
          id: clubAdminAId,
          email: `clubadminA-${runId}@adypu.edu.in`,
          fullName: `Club Admin A ${runId}`,
          globalRole: 'STUDENT',
          googleSub: `sub-caA-${runId}`,
          securityVersion: 1,
        },
        {
          id: clubAdminBId,
          email: `clubadminB-${runId}@adypu.edu.in`,
          fullName: `Club Admin B ${runId}`,
          globalRole: 'STUDENT',
          googleSub: `sub-caB-${runId}`,
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
      ],
    });

    // 3. Create Club Memberships
    await adminPrisma.clubMembership.createMany({
      data: [
        { clubId: clubAId, userId: clubAdminAId, role: 'CLUB_ADMIN' },
        { clubId: clubBId, userId: clubAdminBId, role: 'CLUB_ADMIN' },
      ],
    });

    // 4. Create Events
    const now = new Date();
    const future = new Date(Date.now() + 86400000 * 5);
    const past = new Date(Date.now() - 3600000);

    await adminPrisma.event.createMany({
      data: [
        {
          id: eventAId,
          title: `Published Event A ${runId}`,
          description: `Desc A ${runId}`,
          slug: `pub-event-a-${runId}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'INDIVIDUAL',
          registrationMode: 'REQUIRED',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          createdBy: platformAdminId,
          startTime: past,
          endTime: future,
        },
        {
          id: eventBId,
          title: `Published Event B ${runId}`,
          description: `Desc B ${runId}`,
          slug: `pub-event-b-${runId}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'INDIVIDUAL',
          registrationMode: 'REQUIRED',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          createdBy: platformAdminId,
          startTime: past,
          endTime: future,
        },
        {
          id: draftEventAId,
          title: `Draft Event A ${runId}`,
          description: `Draft Desc ${runId}`,
          slug: `draft-event-a-${runId}`,
          state: 'DRAFT',
          visibility: 'RESTRICTED',
          registrationType: 'TEAM',
          registrationMode: 'REQUIRED',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          createdBy: platformAdminId,
          startTime: past,
          endTime: future,
        },
      ],
    });

    // 5. Associate Events with Clubs
    await adminPrisma.eventClub.createMany({
      data: [
        { eventId: eventAId, clubId: clubAId, isPrimary: true },
        { eventId: eventBId, clubId: clubBId, isPrimary: true },
        { eventId: draftEventAId, clubId: clubAId, isPrimary: true },
      ],
    });

    // 6. Create Attendance Sessions
    await adminPrisma.attendanceSession.createMany({
      data: [
        {
          id: sessionAId,
          eventId: eventAId,
          title: 'Session Alpha',
          startTime: past,
          endTime: future,
          openAt: past,
          closeAt: future,
          qrSecret: 'qr_secret_a_' + runId,
          createdBy: platformAdminId,
        },
        {
          id: sessionBId,
          eventId: eventBId,
          title: 'Session Beta',
          startTime: past,
          endTime: future,
          openAt: past,
          closeAt: future,
          qrSecret: 'qr_secret_b_' + runId,
          createdBy: platformAdminId,
        },
      ],
    });

    // 7. Create Teams for Draft and Published Events
    await adminPrisma.team.createMany({
      data: [
        {
          id: teamDraftId,
          eventId: draftEventAId,
          leaderId: clubAdminAId,
          name: `Draft Team ${runId}`,
          normalizedName: `draft team ${runId}`.toLowerCase(),
          status: 'REGISTERED',
        },
        {
          id: teamPubId,
          eventId: eventAId,
          leaderId: studentAId,
          name: `Pub Team ${runId}`,
          normalizedName: `pub team ${runId}`.toLowerCase(),
          status: 'REGISTERED',
        },
      ],
    });

    // 8. Register Student A for Event A
    await adminPrisma.eventRegistration.create({
      data: {
        eventId: eventAId,
        userId: studentAId,
        registrationStatus: 'REGISTERED',
      },
    });

    // Generate Tokens
    platformAdminToken = signJwt(platformAdminId, 1);
    clubAdminAToken = signJwt(clubAdminAId, 1);
    clubAdminBToken = signJwt(clubAdminBId, 1);
    studentAToken = signJwt(studentAId, 1);
    studentBToken = signJwt(studentBId, 1);
  });

  afterAll(async () => {
    try {
      await adminPrisma.attendanceRecord.deleteMany({
        where: { sessionId: { in: [sessionAId, sessionBId] } },
      });
      await adminPrisma.attendanceSession.deleteMany({
        where: { id: { in: [sessionAId, sessionBId] } },
      });
      await adminPrisma.eventRegistrationResponse.deleteMany({
        where: { eventRegistration: { eventId: { in: [eventAId, eventBId, draftEventAId] } } },
      });
      await adminPrisma.eventRegistration.deleteMany({
        where: { eventId: { in: [eventAId, eventBId, draftEventAId] } },
      });
      await adminPrisma.team.deleteMany({
        where: { id: { in: [teamDraftId, teamPubId] } },
      });
      await adminPrisma.eventClub.deleteMany({
        where: { eventId: { in: [eventAId, eventBId, draftEventAId] } },
      });
      await adminPrisma.event.deleteMany({
        where: { id: { in: [eventAId, eventBId, draftEventAId] } },
      });
      await adminPrisma.clubMembership.deleteMany({
        where: { clubId: { in: [clubAId, clubBId] } },
      });
      await adminPrisma.club.deleteMany({
        where: { id: { in: [clubAId, clubBId] } },
      });
      await adminPrisma.refreshToken.deleteMany({
        where: { userId: { in: [platformAdminId, clubAdminAId, clubAdminBId, studentAId, studentBId] } },
      });
      await adminPrisma.auditLog.deleteMany({
        where: { actorId: { in: [platformAdminId, clubAdminAId, clubAdminBId, studentAId, studentBId] } },
      });
      await adminPrisma.user.deleteMany({
        where: { id: { in: [platformAdminId, clubAdminAId, clubAdminBId, studentAId, studentBId] } },
      });
    } catch {}
  });

  // =========================================================================
  // DEFECT 1: Child-Parent Relationship Validation on Manual Attendance
  // =========================================================================
  describe('Defect 1: Manual Attendance Child-Parent Relationship (IDOR / BOLA)', () => {
    it('1.1: Unauthenticated request is rejected with 401', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventAId}/attendance/manual`)
        .send({ session_id: sessionAId, user_id: studentAId });
      assert.strictEqual(res.status, 401);
    });

    it('1.2: Student without club admin role is rejected with 403', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventAId}/attendance/manual`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ session_id: sessionAId, user_id: studentAId });
      assert.strictEqual(res.status, 403);
    });

    it('1.3: Club Admin of Event A attempting cross-event IDOR (session of Event B) is rejected with 404', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventAId}/attendance/manual`)
        .set('Authorization', `Bearer ${clubAdminAToken}`)
        .send({ session_id: sessionBId, user_id: studentAId });

      assert.strictEqual(res.status, 404);
      assert.ok(res.body.detail?.includes('Session not found in this event') || res.body.detail?.includes('Session not found'));

      // Assert persisted DB state: NO attendance record was created for sessionB and studentA
      const record = await adminPrisma.attendanceRecord.findFirst({
        where: { sessionId: sessionBId, userId: studentAId },
      });
      assert.strictEqual(record, null, 'No attendance record should exist after denied cross-event write');
    });

    it('1.4: Authorized Club Admin marking attendance for their own event session succeeds', async () => {
      const res = await request(app)
        .post(`/v1/events/${eventAId}/attendance/manual`)
        .set('Authorization', `Bearer ${clubAdminAToken}`)
        .send({ session_id: sessionAId, user_id: studentAId });

      assert.ok(res.status === 200 || res.status === 201);
      assert.strictEqual(res.body.user_id, studentAId);

      // Verify DB persistence
      const record = await adminPrisma.attendanceRecord.findFirst({
        where: { sessionId: sessionAId, userId: studentAId },
      });
      assert.ok(record !== null);
      assert.strictEqual(record.status, 'PRESENT');
    });
  });

  // =========================================================================
  // DEFECT 2: Session Revocation Invalidates Active Access Tokens & Refresh Tokens
  // =========================================================================
  describe('Defect 2: Session Revocation SecurityVersion & Refresh Token Invalidation', () => {
    it('2.1: Non-admin caller is rejected with 403 when attempting revoke-sessions', async () => {
      const res = await request(app)
        .post(`/v1/admin/users/${studentAId}/revoke-sessions`)
        .set('Authorization', `Bearer ${studentBToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('2.2: Platform Admin gets 404 when target user does not exist', async () => {
      const fakeUserId = randomUUID();
      const res = await request(app)
        .post(`/v1/admin/users/${fakeUserId}/revoke-sessions`)
        .set('Authorization', `Bearer ${platformAdminToken}`);
      assert.strictEqual(res.status, 404);
    });

    it('2.3: Platform Admin revokes sessions: increments securityVersion, revokes refresh tokens, invalidates active token', async () => {
      // Create a refresh token for student B
      const rawRt = generateRefreshToken();
      await adminPrisma.refreshToken.create({
        data: {
          userId: studentBId,
          tokenHash: hashToken(rawRt),
          familyId: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Verify studentBToken works before revocation
      const preCheck = await request(app)
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${studentBToken}`);
      assert.strictEqual(preCheck.status, 200);

      // Admin revokes sessions for studentB
      const revokeRes = await request(app)
        .post(`/v1/admin/users/${studentBId}/revoke-sessions`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      assert.strictEqual(revokeRes.status, 200);
      assert.strictEqual(revokeRes.body.revoked_count, 1);

      // Verify DB state: user.securityVersion was incremented
      const updatedUser = await adminPrisma.user.findUnique({
        where: { id: studentBId },
        select: { securityVersion: true },
      });
      assert.strictEqual(updatedUser?.securityVersion, 2);

      // Verify DB state: refresh token is revoked
      const rtRecord = await adminPrisma.refreshToken.findFirst({
        where: { userId: studentBId },
      });
      assert.ok(rtRecord?.revokedAt !== null, 'Refresh token must have revokedAt set');

      // CRITICAL ASSERTION: The previously active studentBToken (with secVer: 1) is now IMMEDIATELY rejected!
      const postCheck = await request(app)
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${studentBToken}`);
      assert.strictEqual(postCheck.status, 401);
      assert.ok(postCheck.body.detail?.includes('Session revoked') || postCheck.body.message?.includes('Session revoked'));
    });
  });

  // =========================================================================
  // DEFECT 3: Mobile Logout Revocation
  // =========================================================================
  describe('Defect 3: Mobile Logout Refresh Token Revocation (Body payload)', () => {
    it('3.1: Mobile client posting { refresh_token } to /auth/logout revokes the token in DB', async () => {
      // Create fresh token for student A
      const mobileRt = generateRefreshToken();
      const mobileHash = hashToken(mobileRt);
      await adminPrisma.refreshToken.create({
        data: {
          userId: studentAId,
          tokenHash: mobileHash,
          familyId: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Call logout passing refresh_token in request body (no cookies)
      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ refresh_token: mobileRt });

      assert.strictEqual(logoutRes.status, 204);

      // Assert persisted DB state: token is revoked in database
      const revokedRt = await adminPrisma.refreshToken.findFirst({
        where: { tokenHash: mobileHash },
      });
      assert.ok(revokedRt?.revokedAt !== null, 'Refresh token must be revoked in DB');

      // Attempting to refresh with the revoked token must fail with 401
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: mobileRt });
      assert.strictEqual(refreshRes.status, 401);
    });
  });

  // =========================================================================
  // DEFECT 4: Attendance Disputes Club Scoping
  // =========================================================================
  describe('Defect 4: Attendance Disputes Oversight Authorization', () => {
    it('4.1: Unauthenticated request to /v1/attendance/disputes is rejected with 401', async () => {
      const res = await request(app).get('/v1/attendance/disputes');
      assert.strictEqual(res.status, 401);
    });

    it('4.2: Club Admin A querying disputes for Club B is rejected with 403 (not 500)', async () => {
      const res = await request(app)
        .get(`/v1/attendance/disputes?filter_club_id=${clubBId}`)
        .set('Authorization', `Bearer ${clubAdminAToken}`);

      assert.strictEqual(res.status, 403);
      assert.ok(res.body.detail?.includes('Unauthorized to view disputes for this club'));
    });

    it('4.3: Club Admin A querying disputes for their own Club A succeeds with 200', async () => {
      const res = await request(app)
        .get(`/v1/attendance/disputes?filter_club_id=${clubAId}`)
        .set('Authorization', `Bearer ${clubAdminAToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });

    it('4.4: Platform Admin querying disputes for Club B succeeds with 200', async () => {
      const res = await request(app)
        .get(`/v1/attendance/disputes?filter_club_id=${clubBId}`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  // =========================================================================
  // DEFECT 5: Database Error Mapper Pattern Handling
  // =========================================================================
  describe('Defect 5: mapDatabaseError Stored Procedure Error Handling', () => {
    it('5.1: Database error with UNAUTHORIZED message maps to ForbiddenError (403)', () => {
      const dbErr = new Error('ERROR: UNAUTHORIZED at review_flagged_attendance');
      (dbErr as any).code = 'P0001';

      assert.throws(
        () => mapDatabaseError(dbErr),
        (err: any) => err instanceof ForbiddenError && err.statusCode === 403
      );
    });

    it('5.2: Database error with ATTENDANCE_NOT_FOUND maps to NotFoundError (404)', () => {
      const dbErr = new Error('ERROR: ATTENDANCE_NOT_FOUND');
      (dbErr as any).code = 'P0001';

      assert.throws(
        () => mapDatabaseError(dbErr),
        (err: any) => err instanceof NotFoundError && err.statusCode === 404
      );
    });

    it('5.3: Database error with EVENT_LOCKED maps to UnprocessableEntityError (422)', () => {
      const dbErr = new Error('ERROR: EVENT_LOCKED');
      (dbErr as any).code = 'P0001';

      assert.throws(
        () => mapDatabaseError(dbErr),
        (err: any) => err instanceof UnprocessableEntityError && err.statusCode === 422
      );
    });
  });

  // =========================================================================
  // DEFECT 6: Draft Event Team Information Concealment
  // =========================================================================
  describe('Defect 6: Draft Event Team Authorization & Concealment', () => {
    it('6.1: Student accessing teams of draft event receives 404 (not 500 crash or leak)', async () => {
      const res = await request(app)
        .get(`/v1/events/${draftEventAId}/teams`)
        .set('Authorization', `Bearer ${studentAToken}`);

      assert.strictEqual(res.status, 404);
      assert.ok(res.body.detail?.includes('Event not found') || res.body.message?.includes('Event not found'));
    });

    it('6.2: Student accessing team of draft event by ID receives 404 (not 500 crash)', async () => {
      const res = await request(app)
        .get(`/v1/teams/${teamDraftId}`)
        .set('Authorization', `Bearer ${studentAToken}`);

      assert.strictEqual(res.status, 404);
      assert.ok(res.body.detail?.includes('Team not found') || res.body.message?.includes('Team not found'));
    });

    it('6.3: Student accessing teams of published event succeeds with 200', async () => {
      const res = await request(app)
        .get(`/v1/events/${eventAId}/teams`)
        .set('Authorization', `Bearer ${studentAToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  // =========================================================================
  // DEFECT 7: Attendance QR Generation for Missing Session
  // =========================================================================
  describe('Defect 7: QR Generation Missing Session Error Handling', () => {
    it('7.1: Generating QR for non-existent session returns 404 (not 500)', async () => {
      const fakeSessionId = randomUUID();
      const res = await request(app)
        .post('/v1/attendance/generate-qr')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ session_id: fakeSessionId });

      assert.strictEqual(res.status, 404);
      assert.ok(res.body.detail?.includes('Session not found') || res.body.message?.includes('Session not found'));
    });
  });
});
