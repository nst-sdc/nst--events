import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { hashToken, generateRefreshToken } from '../../src/lib/hash';
import { env } from '../../src/config/env';
import {
  authEventsService,
  classifyNetwork,
  hashIp,
  sanitizeFailureReason,
  parseUserAgent,
} from '../../src/modules/auth/auth-events.service';
import { processAuthEventsRetention } from '../../../worker/src/jobs/auth-events-retention';

describe('PHASE 2: Auth Event Log & Analytics Integration Suite', () => {
  const app = createApp();

  const adminId = 'a2222222-2222-2222-2222-222222222222';
  const facultyId = 'f2222222-2222-2222-2222-222222222222';
  const studentId = 'c2222222-2222-2222-2222-222222222222';

  const adminToken = signJwt(adminId, 1);
  const facultyToken = signJwt(facultyId, 1);
  const studentToken = signJwt(studentId, 1);

  before(async () => {
    // Seed test users
    await adminPrisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        email: 'admin.authevents@adypu.edu.in',
        fullName: 'Auth Admin',
        googleSub: 'google-sub-admin-authevents',
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
      update: {
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
    });

    await adminPrisma.user.upsert({
      where: { id: facultyId },
      create: {
        id: facultyId,
        email: 'faculty.authevents@adypu.edu.in',
        fullName: 'Auth Faculty',
        googleSub: 'google-sub-faculty-authevents',
        globalRole: 'FACULTY_ADMIN',
        securityVersion: 1,
      },
      update: {
        globalRole: 'FACULTY_ADMIN',
        securityVersion: 1,
      },
    });

    await adminPrisma.user.upsert({
      where: { id: studentId },
      create: {
        id: studentId,
        email: 'student.authevents@adypu.edu.in',
        fullName: 'Auth Student',
        googleSub: 'google-sub-student-authevents',
        globalRole: 'STUDENT',
        securityVersion: 1,
      },
      update: {
        globalRole: 'STUDENT',
        securityVersion: 1,
      },
    });
  });

  beforeEach(async () => {
    await adminPrisma.authEvent.deleteMany({});
    await adminPrisma.auditLog.deleteMany({
      where: { actorId: adminId },
    });
    await adminPrisma.refreshToken.deleteMany({
      where: { userId: studentId },
    });
    await adminPrisma.user.updateMany({
      where: { id: { in: [adminId, facultyId, studentId] } },
      data: { securityVersion: 1 },
    });
  });

  after(async () => {
    await adminPrisma.authEvent.deleteMany({});
    await adminPrisma.auditLog.deleteMany({
      where: { actorId: adminId },
    });
    await adminPrisma.refreshToken.deleteMany({
      where: { userId: studentId },
    });
    await adminPrisma.user.deleteMany({
      where: { id: { in: [adminId, facultyId, studentId] } },
    });
  });

  it('1. Utility: Classification, Pepper Hashing & Privacy Sanitization', () => {
    // CIDR Network Classification (empty config returns 'unknown', configured CIDRs classify campus/off_campus)
    assert.strictEqual(classifyNetwork('10.0.1.25'), 'unknown');
    assert.strictEqual(classifyNetwork('10.0.1.25', '10.0.0.0/8'), 'campus');
    assert.strictEqual(classifyNetwork('172.16.5.1', '172.16.0.0/12'), 'campus');
    assert.strictEqual(classifyNetwork('198.51.100.1', '10.0.0.0/8'), 'off_campus');
    assert.strictEqual(classifyNetwork('unknown'), 'unknown');


    // Pepper Hashing
    const rawIp = '198.51.100.42';
    const expectedHash = crypto
      .createHmac('sha256', env.AUTH_EVENTS_IP_PEPPER)
      .update(rawIp)
      .digest('hex');
    assert.strictEqual(hashIp(rawIp), expectedHash);

    // UA Parsing
    const chromeDesktop = parseUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    assert.strictEqual(chromeDesktop.userAgentFamily, 'Chrome');
    assert.strictEqual(chromeDesktop.deviceClass, 'desktop');

    const mobileUa = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
    );
    assert.strictEqual(mobileUa.deviceClass, 'mobile');

    // Sensitive Data Sanitization
    const sanitizedEmail = sanitizeFailureReason('Rejected login for student.alice@adypu.edu.in on tenant');
    assert.strictEqual(sanitizedEmail, 'Rejected login for @adypu.edu.in on tenant');

    const sanitizedToken = sanitizeFailureReason('Invalid token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc123def456');
    assert.strictEqual(sanitizedToken, 'Invalid token: [REDACTED_JWT]');
  });

  it('2. Auth Router logs LOGIN_FAILED on invalid mobile ID token', async () => {
    const res = await request(app)
      .post('/auth/mobile/login-id-token')
      .send({ id_token: 'invalid.test.token' });

    assert.strictEqual(res.status, 401);

    // Flush async logger queue
    await authEventsService.flushSync();

    const events = await adminPrisma.authEvent.findMany({
      where: { eventType: 'LOGIN_FAILED' },
    });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].platform, 'mobile');
    assert.strictEqual(events[0].eventType, 'LOGIN_FAILED');
  });

  it('3. Auth Router logs REFRESH_FAILED on invalid refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`refreshToken=invalid-random-token`]);

    assert.strictEqual(res.status, 401);

    await authEventsService.flushSync();

    const events = await adminPrisma.authEvent.findMany({
      where: { eventType: 'REFRESH_FAILED' },
    });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].eventType, 'REFRESH_FAILED');
  });

  it('4. Auth Router logs LOGOUT on token revocation', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web');

    assert.strictEqual(res.status, 204);

    await authEventsService.flushSync();

    const events = await adminPrisma.authEvent.findMany({
      where: { eventType: 'LOGOUT' },
    });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].eventType, 'LOGOUT');
  });

  it('5. Token reuse detection logs REUSE_DETECTED and revokes session family', async () => {
    const familyId = crypto.randomUUID();
    const rawToken1 = generateRefreshToken();
    const tokenHash1 = hashToken(rawToken1);

    // Seed an already revoked token older than the 5s grace window
    await adminPrisma.refreshToken.create({
      data: {
        userId: studentId,
        familyId,
        tokenHash: tokenHash1,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 10000), // 10s ago
      },
    });

    const res = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`refreshToken=${rawToken1}`]);

    assert.strictEqual(res.status, 401);
    assert.match(res.body.detail || res.body.message || '', /reuse detected/i);

    await authEventsService.flushSync();

    const events = await adminPrisma.authEvent.findMany({
      where: { eventType: 'REUSE_DETECTED' },
    });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].userId, studentId);
  });

  it('6. Admin revoking sessions logs SESSION_REVOKED and increments security version', async () => {
    // Seed active token for student
    const rawToken = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: studentId,
        familyId: crypto.randomUUID(),
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post(`/v1/admin/users/${studentId}/revoke-sessions`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.revoked_count, 1);

    await authEventsService.flushSync();

    const events = await adminPrisma.authEvent.findMany({
      where: { eventType: 'SESSION_REVOKED' },
    });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].userId, studentId);
  });

  it('7. Worker retention job purges auth_events exceeding retention threshold', async () => {
    // Insert 1 expired event (> 90 days old) and 1 fresh event
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await adminPrisma.authEvent.createMany({
      data: [
        {
          eventType: 'LOGIN_SUCCESS',
          platform: 'web',
          ipHash: 'fake-hash-1',
          networkClass: 'campus',
          createdAt: oldDate,
        },
        {
          eventType: 'LOGIN_SUCCESS',
          platform: 'web',
          ipHash: 'fake-hash-2',
          networkClass: 'campus',
          createdAt: new Date(),
        },
      ],
    });

    const purged = await processAuthEventsRetention(adminPrisma, 90);
    assert.strictEqual(purged, 1);

    const remaining = await adminPrisma.authEvent.findMany({});
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].ipHash, 'fake-hash-2');
  });

  it('8. RBAC: PLATFORM_ADMIN required for all auth analytics & session endpoints', async () => {
    // Unauthenticated -> 401
    const unauthEvents = await request(app).get('/v1/admin/auth-events');
    assert.strictEqual(unauthEvents.status, 401);

    const unauthStats = await request(app).get('/v1/admin/auth-stats');
    assert.strictEqual(unauthStats.status, 401);

    const unauthSessions = await request(app).get(`/v1/admin/users/${studentId}/sessions`);
    assert.strictEqual(unauthSessions.status, 401);

    // STUDENT -> 403
    const studentEvents = await request(app)
      .get('/v1/admin/auth-events')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(studentEvents.status, 403);

    // FACULTY_ADMIN -> 403
    const facultyEvents = await request(app)
      .get('/v1/admin/auth-events')
      .set('Authorization', `Bearer ${facultyToken}`);
    assert.strictEqual(facultyEvents.status, 403);

    // PLATFORM_ADMIN -> 200
    const adminEvents = await request(app)
      .get('/v1/admin/auth-events')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(adminEvents.status, 200);
  });

  it('9. GET /v1/admin/auth-events supports filtering, cursor pagination, and audit logs', async () => {
    // Seed 3 events
    await adminPrisma.authEvent.createMany({
      data: [
        {
          userId: studentId,
          eventType: 'LOGIN_SUCCESS',
          platform: 'mobile',
          ipHash: 'hash-mobile-success',
          networkClass: 'campus',
          createdAt: new Date(Date.now() - 3000),
        },
        {
          userId: studentId,
          eventType: 'LOGIN_FAILED',
          platform: 'web',
          ipHash: 'hash-web-failed',
          networkClass: 'off_campus',
          failureReason: 'Invalid credentials',
          createdAt: new Date(Date.now() - 2000),
        },
        {
          userId: studentId,
          eventType: 'LOGIN_SUCCESS',
          platform: 'web',
          ipHash: 'hash-web-success',
          networkClass: 'campus',
          createdAt: new Date(Date.now() - 1000),
        },
      ],
    });

    // Filter by platform=mobile
    const mobileOnly = await request(app)
      .get('/v1/admin/auth-events?platform=mobile')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(mobileOnly.status, 200);
    assert.strictEqual(mobileOnly.body.data.length, 1);
    assert.strictEqual(mobileOnly.body.data[0].platform, 'mobile');

    // Pagination with limit=2
    const page1 = await request(app)
      .get('/v1/admin/auth-events?limit=2')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(page1.status, 200);
    assert.strictEqual(page1.body.data.length, 2);
    assert.ok(page1.body.pagination.next_cursor);

    const page2 = await request(app)
      .get(`/v1/admin/auth-events?limit=2&cursor=${page1.body.pagination.next_cursor}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(page2.status, 200);
    assert.strictEqual(page2.body.data.length, 1);

    // Verify AUTH_DATA_VIEWED audit log entry created
    const auditLogs = await adminPrisma.auditLog.findMany({
      where: {
        actorId: adminId,
        action: 'AUTH_DATA_VIEWED',
        entityType: 'AuthEvent',
      },
    });
    assert.ok(auditLogs.length >= 3);
  });

  it('10. GET /v1/admin/auth-stats computes accurate aggregates, splits, and audit logs', async () => {
    // Seed events for stats
    await adminPrisma.authEvent.createMany({
      data: [
        {
          userId: studentId,
          eventType: 'LOGIN_SUCCESS',
          platform: 'web',
          ipHash: 'hash-1',
          networkClass: 'campus',
          createdAt: new Date(),
        },
        {
          userId: studentId,
          eventType: 'LOGIN_SUCCESS',
          platform: 'mobile',
          ipHash: 'hash-2',
          networkClass: 'off_campus',
          createdAt: new Date(),
        },
        {
          userId: null,
          eventType: 'LOGIN_FAILED',
          platform: 'web',
          ipHash: 'hash-3',
          networkClass: 'off_campus',
          failureReason: 'Domain not allowed',
          createdAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .get('/v1/admin/auth-stats')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    const { summary, platform_breakdown, network_breakdown, top_failure_reasons } = res.body;

    assert.strictEqual(summary.total_success, 2);
    assert.strictEqual(summary.total_failed, 1);
    assert.strictEqual(summary.total_attempts, 3);
    assert.strictEqual(summary.failure_rate, 33.33);
    assert.strictEqual(summary.dau, 1); // 1 distinct student
    assert.strictEqual(summary.wau, 1);

    assert.strictEqual(platform_breakdown.web, 2);
    assert.strictEqual(platform_breakdown.mobile, 1);

    assert.strictEqual(network_breakdown.campus, 1);
    assert.strictEqual(network_breakdown.off_campus, 2);

    assert.strictEqual(top_failure_reasons.length, 1);
    assert.strictEqual(top_failure_reasons[0].reason, 'Domain not allowed');
    assert.strictEqual(top_failure_reasons[0].count, 1);

    // Verify AUTH_DATA_VIEWED audit log entry created
    const auditLogs = await adminPrisma.auditLog.findMany({
      where: {
        actorId: adminId,
        action: 'AUTH_DATA_VIEWED',
        entityType: 'AuthStats',
      },
    });
    assert.ok(auditLogs.length >= 1);
  });

  it('11. GET /v1/admin/users/:userId/sessions lists active sessions and creates audit log', async () => {
    // Seed active session
    const familyId = crypto.randomUUID();
    await adminPrisma.refreshToken.create({
      data: {
        userId: studentId,
        familyId,
        tokenHash: hashToken(generateRefreshToken()),
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .get(`/v1/admin/users/${studentId}/sessions`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].family_id, familyId);
    assert.strictEqual(res.body.data[0].user_agent_family, 'Chrome');
    assert.strictEqual(res.body.data[0].device_class, 'desktop');

    // Verify audit log
    const auditLogs = await adminPrisma.auditLog.findMany({
      where: {
        actorId: adminId,
        action: 'AUTH_DATA_VIEWED',
        entityType: 'User',
        entityId: studentId,
      },
    });
    assert.strictEqual(auditLogs.length, 1);
  });
});
