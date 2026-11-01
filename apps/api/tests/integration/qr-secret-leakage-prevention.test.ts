import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { adminPrisma } from '../helpers/adminDb';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { generateQrPayload, verifyQrPayload } from '../../src/modules/attendance/totp.utils';
import { randomUUID } from 'crypto';

const app = createApp();

/**
 * Recursively inspects any JSON-compatible object/array/primitive
 * and asserts that no object key matches /qr.?secret|seed/i.
 */
function assertNoSecretKeys(obj: any, path: string = 'root') {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => assertNoSecretKeys(item, `${path}[${index}]`));
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      assert.ok(
        !/qr.?secret|seed/i.test(key),
        `Security violation: Key matching /qr.?secret|seed/i found at ${path}.${key}`
      );
      assertNoSecretKeys(obj[key], `${path}.${key}`);
    }
  }
}

describe('TASK P10: QR Secret & Seed Leakage Prevention Across All Roles and Endpoints', () => {
  const runId = Date.now();
  const KNOWN_QR_SECRET = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  let platformAdminId: string;
  let organizerId: string;
  let registeredStudentId: string;
  let waitlistedStudentId: string;

  let adminToken: string;
  let organizerToken: string;
  let registeredStudentToken: string;
  let waitlistedStudentToken: string;

  let clubId: string;
  let eventId: string;
  let eventSlug: string;
  let sessionId: string;
  let attendanceRecordId: string;

  before(async () => {
    platformAdminId = randomUUID();
    organizerId = randomUUID();
    registeredStudentId = randomUUID();
    waitlistedStudentId = randomUUID();
    clubId = randomUUID();
    eventId = randomUUID();
    sessionId = randomUUID();
    eventSlug = `secret-leak-test-${runId}`;

    // 1. Create Users
    await adminPrisma.user.createMany({
      data: [
        {
          id: platformAdminId,
          email: `admin_${runId}@adypu.edu.in`,
          googleSub: `sub_admin_${runId}`,
          fullName: 'Platform Admin',
          globalRole: 'PLATFORM_ADMIN',
        },
        {
          id: organizerId,
          email: `org_${runId}@adypu.edu.in`,
          googleSub: `sub_org_${runId}`,
          fullName: 'Club Organizer',
          globalRole: 'STUDENT',
        },
        {
          id: registeredStudentId,
          email: `reg_student_${runId}@adypu.edu.in`,
          googleSub: `sub_reg_${runId}`,
          fullName: 'Registered Student',
          globalRole: 'STUDENT',
        },
        {
          id: waitlistedStudentId,
          email: `wait_student_${runId}@adypu.edu.in`,
          googleSub: `sub_wait_${runId}`,
          fullName: 'Waitlisted Student',
          globalRole: 'STUDENT',
        },
      ],
    });

    // 2. Generate Auth Tokens
    adminToken = signJwt(platformAdminId);
    organizerToken = signJwt(organizerId);
    registeredStudentToken = signJwt(registeredStudentId);
    waitlistedStudentToken = signJwt(waitlistedStudentId);

    // 3. Create Club & Organizer Membership
    await adminPrisma.club.create({
      data: {
        id: clubId,
        name: `Tech Club ${runId}`,
        description: 'Testing club',
        status: 'ACTIVE',
      },
    });

    await adminPrisma.clubMembership.create({
      data: {
        clubId,
        userId: organizerId,
        role: 'CLUB_ADMIN',
      },
    });

    // 4. Create Event & Link Primary Club
    await adminPrisma.event.create({
      data: {
        id: eventId,
        title: `Security Event ${runId}`,
        slug: eventSlug,
        description: 'Event to verify qr_secret protection',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        eventType: 'WORKSHOP',
        registrationType: 'INDIVIDUAL',
        registrationMode: 'REQUIRED',
        state: 'PUBLISHED',
        visibility: 'PUBLIC',
        createdBy: organizerId,
        maxCapacity: 50,
      },
    });

    await adminPrisma.eventClub.create({
      data: {
        eventId,
        clubId,
        isPrimary: true,
      },
    });

    // 5. Create Attendance Session with Known Cryptographic Secret
    await adminPrisma.attendanceSession.create({
      data: {
        id: sessionId,
        eventId,
        title: 'Main Workshop Session',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        openAt: new Date(Date.now() - 3600000),
        closeAt: new Date(Date.now() + 3600000),
        geofenceRadius: 1000,
        venueLatitude: 18.5204,
        venueLongitude: 73.8567,
        locationAccuracy: 10,
        createdBy: organizerId,
        qrSecret: KNOWN_QR_SECRET,
      },
    });

    // 6. Create Event Registrations (Registered & Waitlisted)
    await adminPrisma.eventRegistration.createMany({
      data: [
        {
          eventId,
          userId: registeredStudentId,
          registrationStatus: 'REGISTERED',
        },
        {
          eventId,
          userId: waitlistedStudentId,
          registrationStatus: 'WAITLISTED',
        },
      ],
    });

    // 7. Create an Attendance Record for Registered Student
    const attRec = await adminPrisma.attendanceRecord.create({
      data: {
        sessionId,
        userId: registeredStudentId,
        markedAt: new Date(),
        method: 'QR',
        status: 'PRESENT',
        auditMetadata: { client: 'mobile_test' },
      },
    });
    attendanceRecordId = attRec.id;
  });

  after(async () => {
    // Teardown test entities in reverse dependency order
    await adminPrisma.attendanceRecord.deleteMany({ where: { sessionId } });
    await adminPrisma.attendanceSession.deleteMany({ where: { id: sessionId } });
    await adminPrisma.eventRegistration.deleteMany({ where: { eventId } });
    await adminPrisma.eventClub.deleteMany({ where: { eventId } });
    await adminPrisma.event.deleteMany({ where: { id: eventId } });
    await adminPrisma.clubMembership.deleteMany({ where: { clubId } });
    await adminPrisma.club.deleteMany({ where: { id: clubId } });
    await adminPrisma.user.deleteMany({
      where: { id: { in: [platformAdminId, organizerId, registeredStudentId, waitlistedStudentId] } },
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Recursive Checks Across All 4 Roles
  // ──────────────────────────────────────────────────────────────────────────

  const roles = [
    { name: 'Registered Student', getToken: () => registeredStudentToken, isOrganizerOrAdmin: false },
    { name: 'Waitlisted Student', getToken: () => waitlistedStudentToken, isOrganizerOrAdmin: false },
    { name: 'Organizer (Club Admin)', getToken: () => organizerToken, isOrganizerOrAdmin: true },
    { name: 'Platform Admin', getToken: () => adminToken, isOrganizerOrAdmin: true },
  ];

  for (const role of roles) {
    describe(`Role: ${role.name}`, () => {
      it(`GET /v1/events/:id - never returns qrSecret or seed in attendanceSessions`, async () => {
        const res = await request(app)
          .get(`/v1/events/${eventId}`)
          .set('Authorization', `Bearer ${role.getToken()}`);

        assert.strictEqual(res.status, 200);
        assertNoSecretKeys(res.body);
        assert.ok(Array.isArray(res.body.attendanceSessions));
        assert.strictEqual(res.body.attendanceSessions.length, 1);
        const session = res.body.attendanceSessions[0];
        assert.strictEqual(session.id, sessionId);
        assert.strictEqual(session.qrSecret, undefined);
        assert.strictEqual(session.qr_secret, undefined);
      });

      it(`GET /v1/events/:id/sessions - never returns qrSecret or seed in session list`, async () => {
        const res = await request(app)
          .get(`/v1/events/${eventId}/sessions`)
          .set('Authorization', `Bearer ${role.getToken()}`);

        assert.strictEqual(res.status, 200);
        assertNoSecretKeys(res.body);
        assert.ok(Array.isArray(res.body));
        assert.strictEqual(res.body.length, 1);
        const session = res.body[0];
        assert.strictEqual(session.id, sessionId);
        assert.strictEqual(session.qrSecret, undefined);
        assert.strictEqual(session.qr_secret, undefined);
      });

      it(`GET /v1/users/me/attendance - never returns qrSecret or seed in nested session`, async () => {
        const res = await request(app)
          .get('/v1/users/me/attendance')
          .set('Authorization', `Bearer ${role.getToken()}`);

        assert.strictEqual(res.status, 200);
        assertNoSecretKeys(res.body);
        if (res.body.data && res.body.data.length > 0) {
          for (const item of res.body.data) {
            if (item.session) {
              assert.strictEqual(item.session.qrSecret, undefined);
              assert.strictEqual(item.session.qr_secret, undefined);
            }
          }
        }
      });

      it(`GET /v1/events - general event list never leaks qrSecret`, async () => {
        const res = await request(app)
          .get('/v1/events?limit=20')
          .set('Authorization', `Bearer ${role.getToken()}`);

        assert.strictEqual(res.status, 200);
        assertNoSecretKeys(res.body);
      });

      it(`GET /v1/events/public - public event list never leaks qrSecret`, async () => {
        const res = await request(app)
          .get('/v1/events/public?limit=20')
          .set('Authorization', `Bearer ${role.getToken()}`);

        assert.strictEqual(res.status, 200);
        assertNoSecretKeys(res.body);
      });

      it(`GET /v1/events/public/:slug - public event by slug never leaks qrSecret`, async () => {
        const res = await request(app)
          .get(`/v1/events/public/${eventSlug}`)
          .set('Authorization', `Bearer ${role.getToken()}`);

        assert.strictEqual(res.status, 200);
        assertNoSecretKeys(res.body);
      });

      if (!role.isOrganizerOrAdmin) {
        it(`POST /v1/attendance/generate-qr - rejected for non-organizer (403 Forbidden)`, async () => {
          const res = await request(app)
            .post('/v1/attendance/generate-qr')
            .set('Authorization', `Bearer ${role.getToken()}`)
            .send({ session_id: sessionId });

          assert.strictEqual(res.status, 403);
          assertNoSecretKeys(res.body);
        });

        it(`POST /v1/events/:id/sessions - rejected for non-organizer (403 Forbidden)`, async () => {
          const res = await request(app)
            .post(`/v1/events/${eventId}/sessions`)
            .set('Authorization', `Bearer ${role.getToken()}`)
            .send({
              title: 'Hacked Session',
              start_time: new Date().toISOString(),
              end_time: new Date(Date.now() + 3600000).toISOString(),
              open_at: new Date().toISOString(),
              close_at: new Date(Date.now() + 3600000).toISOString(),
              geofence_radius: 50,
            });

          assert.strictEqual(res.status, 403);
          assertNoSecretKeys(res.body);
        });

        it(`PATCH /v1/events/:id/sessions/:sessionId - rejected for non-organizer (403 Forbidden)`, async () => {
          const res = await request(app)
            .patch(`/v1/events/${eventId}/sessions/${sessionId}`)
            .set('Authorization', `Bearer ${role.getToken()}`)
            .send({ title: 'Tampered Session Title' });

          assert.strictEqual(res.status, 403);
          assertNoSecretKeys(res.body);
        });
      } else {
        it(`GET /v1/events/:id/attendance - organizer/admin roster never leaks qrSecret`, async () => {
          const res = await request(app)
            .get(`/v1/events/${eventId}/attendance`)
            .set('Authorization', `Bearer ${role.getToken()}`);

          assert.strictEqual(res.status, 200);
          assertNoSecretKeys(res.body);
        });

        it(`GET /v1/events/:id/attendance/export - CSV export never contains secret or seed`, async () => {
          const res = await request(app)
            .get(`/v1/events/${eventId}/attendance/export`)
            .set('Authorization', `Bearer ${role.getToken()}`);

          assert.strictEqual(res.status, 200);
          assert.ok(
            res.headers['content-type'].includes('text/csv'),
            `Expected text/csv content-type, got ${res.headers['content-type']}`
          );
          const csvText = res.text;
          assert.ok(!/qr.?secret|seed/i.test(csvText), 'Secret leaked in CSV export!');
          assert.ok(!csvText.includes(KNOWN_QR_SECRET), 'Raw secret leaked in CSV export!');
        });
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Organizer Kiosk Dedicated Endpoint Verification
  // ──────────────────────────────────────────────────────────────────────────

  describe('Organizer Kiosk Dedicated Endpoint (POST /v1/attendance/generate-qr)', () => {
    it('Organizer kiosk receives rotating code but NEVER the underlying qrSecret or seed', async () => {
      const res = await request(app)
        .post('/v1/attendance/generate-qr')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ session_id: sessionId });

      assert.strictEqual(res.status, 200);
      assertNoSecretKeys(res.body);

      // Verify the returned payload shape
      assert.ok(res.body.qr_payload, 'Expected qr_payload to be present');
      assert.ok(res.body.expires_at, 'Expected expires_at to be present');

      // Assert the secret itself is NOT in the payload
      assert.strictEqual(res.body.qrSecret, undefined);
      assert.strictEqual(res.body.qr_secret, undefined);
      assert.strictEqual(res.body.seed, undefined);
      assert.ok(!res.body.qr_payload.includes(KNOWN_QR_SECRET));

      // Assert the rotating code is valid against the server's secret
      const isValid = verifyQrPayload(sessionId, res.body.qr_payload, KNOWN_QR_SECRET);
      assert.strictEqual(isValid, true, 'Organizer generated QR must be cryptographically valid');
    });

    it('Platform Admin can also trigger organizer QR generation and receives no secret', async () => {
      const res = await request(app)
        .post('/v1/attendance/generate-qr')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ session_id: sessionId });

      assert.strictEqual(res.status, 200);
      assertNoSecretKeys(res.body);
      assert.strictEqual(res.body.qrSecret, undefined);
      assert.strictEqual(res.body.qr_secret, undefined);
      assert.ok(res.body.qr_payload);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Session Mutation Endpoints (POST & PATCH /v1/events/:id/sessions)
  // ──────────────────────────────────────────────────────────────────────────

  describe('Session Mutation Endpoints (POST & PATCH /v1/events/:id/sessions)', () => {
    let newSessionId: string;

    it('POST /v1/events/:id/sessions creates session and returns DTO without qrSecret', async () => {
      // First update event to MULTI_SESSION so we can add another session
      await adminPrisma.event.update({
        where: { id: eventId },
        data: { attendanceType: 'MULTI_SESSION' },
      });

      const res = await request(app)
        .post(`/v1/events/${eventId}/sessions`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Afternoon Keynote',
          start_time: new Date(Date.now() + 10000).toISOString(),
          end_time: new Date(Date.now() + 3600000).toISOString(),
          open_at: new Date(Date.now() + 10000).toISOString(),
          close_at: new Date(Date.now() + 3600000).toISOString(),
          geofence_radius: 50,
          venue_latitude: 18.5204,
          venue_longitude: 73.8567,
          location_accuracy: 5,
        });

      assert.strictEqual(res.status, 201);
      assertNoSecretKeys(res.body);
      assert.strictEqual(res.body.qrSecret, undefined);
      assert.strictEqual(res.body.qr_secret, undefined);
      assert.strictEqual(res.body.title, 'Afternoon Keynote');
      newSessionId = res.body.id;

      // Clean up the created session
      if (newSessionId) {
        await adminPrisma.attendanceSession.delete({ where: { id: newSessionId } });
      }
    });

    it('PATCH /v1/events/:id/sessions/:sessionId updates session and returns DTO without qrSecret', async () => {
      const res = await request(app)
        .patch(`/v1/events/${eventId}/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Updated Workshop Title',
          geofence_radius: 75,
        });

      assert.strictEqual(res.status, 200);
      assertNoSecretKeys(res.body);
      assert.strictEqual(res.body.qrSecret, undefined);
      assert.strictEqual(res.body.qr_secret, undefined);
      assert.strictEqual(res.body.title, 'Updated Workshop Title');
      assert.strictEqual(res.body.geofenceRadius, 75);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Student Cryptographic Infeasibility Test
  // ──────────────────────────────────────────────────────────────────────────

  describe('Student Cryptographic Infeasibility Verification', () => {
    it('Student cannot compute a valid TOTP code from any data they can fetch', async () => {
      // Step 1: Student fetches event detail
      const eventRes = await request(app)
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${registeredStudentToken}`);
      assert.strictEqual(eventRes.status, 200);

      // Step 2: Student fetches sessions list
      const sessionsRes = await request(app)
        .get(`/v1/events/${eventId}/sessions`)
        .set('Authorization', `Bearer ${registeredStudentToken}`);
      assert.strictEqual(sessionsRes.status, 200);

      // Step 3: Student fetches own attendance history
      const attendanceRes = await request(app)
        .get('/v1/users/me/attendance')
        .set('Authorization', `Bearer ${registeredStudentToken}`);
      assert.strictEqual(attendanceRes.status, 200);

      // Step 4: Harvest every accessible string value the student could possibly try as a secret
      const candidateSeeds = [
        '',
        'secret',
        'qr_secret',
        sessionId,
        eventId,
        eventSlug,
        registeredStudentId,
        clubId,
        'Main Workshop Session',
        '18.5204',
        '73.8567',
        eventRes.body.title,
        eventRes.body.id,
      ];

      // Try generating a QR token using each harvested value
      for (const candidateSeed of candidateSeeds) {
        const studentCraftedToken = generateQrPayload(sessionId, candidateSeed);

        // Assert 1: The candidate token cannot pass server cryptographic verification
        const isValid = verifyQrPayload(sessionId, studentCraftedToken, KNOWN_QR_SECRET);
        assert.strictEqual(
          isValid,
          false,
          `Student was unexpectedly able to forge a valid token using candidate seed: "${candidateSeed}"`
        );

        // Assert 2: Submitting forged code to markAttendance is rejected by the server with 422 QR_EXPIRED
        // (Test first 2 seeds over HTTP to verify API error contract without tripping attendance rate limiter)
        if (candidateSeeds.indexOf(candidateSeed) < 2) {
          const markRes = await request(app)
            .post('/v1/attendance/mark')
            .set('Authorization', `Bearer ${registeredStudentToken}`)
            .send({
              session_id: sessionId,
              totp_token: studentCraftedToken,
              latitude: 18.5204,
              longitude: 73.8567,
              device_id: `test-device-forge-${candidateSeeds.indexOf(candidateSeed)}`,
              device_os: 'iOS',
              gps_accuracy: 5,
              mock_location_detected: false,
              app_version: '1.0.0',
            });

          assert.strictEqual(
            markRes.status,
            422,
            `Expected 422 QR_EXPIRED for candidate seed "${candidateSeed}", got ${markRes.status}`
          );
          assert.strictEqual(markRes.body.detail, 'QR_EXPIRED');
        }
      }
    });
  });
});
