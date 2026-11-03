import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import {
  RateLimitSettingsCache,
  rateLimitSettingsCache,
  BUCKET_BOUNDS,
} from '../../src/lib/rate-limit-settings';
import { processRateLimitOverridesPurge } from '../../../worker/src/jobs/rate-limits-purge';
import { sseEventBus } from '../../src/modules/sse/event-bus';

describe('PHASE 1: Dynamic Rate Limits & Overrides Integration Suite', () => {
  const app = createApp();

  const adminId = 'a1111111-1111-1111-1111-111111111111';
  const studentId = 'b2222222-2222-2222-2222-222222222222';

  const adminToken = signJwt(adminId, 1);
  const studentToken = signJwt(studentId, 1);

  before(async () => {
    // Seed test users
    await adminPrisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        email: 'admin.ratelimit@adypu.edu.in',
        fullName: 'RateLimit Admin',
        googleSub: 'google-sub-admin-ratelimit',
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
      update: {
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
    });

    await adminPrisma.user.upsert({
      where: { id: studentId },
      create: {
        id: studentId,
        email: 'student.ratelimit@adypu.edu.in',
        fullName: 'RateLimit Student',
        googleSub: 'google-sub-student-ratelimit',
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
    // Clean up rate limit settings and overrides
    await adminPrisma.rateLimitSetting.deleteMany({});
    await adminPrisma.rateLimitOverride.deleteMany({});
    await rateLimitSettingsCache.reload();
  });

  after(async () => {
    await adminPrisma.rateLimitSetting.deleteMany({});
    await adminPrisma.rateLimitOverride.deleteMany({});
    await adminPrisma.user.deleteMany({
      where: { id: { in: [adminId, studentId] } },
    });
    rateLimitSettingsCache.resetToDefaults();
  });

  it('1. GET /v1/admin/rate-limits enforces PLATFORM_ADMIN access control', async () => {
    // Unauthenticated -> 401
    const unauth = await request(app).get('/v1/admin/rate-limits');
    assert.strictEqual(unauth.status, 401);
    assert.strictEqual(unauth.body.type, 'https://api.nstsdc.org/errors/unauthorized');

    // Student (non-admin) -> 403
    const forbidden = await request(app)
      .get('/v1/admin/rate-limits')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(forbidden.status, 403);
    assert.strictEqual(forbidden.body.type, 'https://api.nstsdc.org/errors/forbidden');

    // Platform Admin -> 200
    const ok = await request(app)
      .get('/v1/admin/rate-limits')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(ok.status, 200);
    assert.ok(Array.isArray(ok.body.buckets));
    assert.strictEqual(ok.body.buckets.length, 6);
    assert.ok(ok.body.replicas >= 1);
    assert.ok(ok.body.window_ms > 0);

    const authTokenBucket = ok.body.buckets.find((b: any) => b.bucket === 'auth_token');
    assert.ok(authTokenBucket);
    assert.strictEqual(authTokenBucket.min, 30);
    assert.strictEqual(authTokenBucket.max, 1000);
    assert.strictEqual(authTokenBucket.source, 'ENV');
  });

  it('2. PUT /v1/admin/rate-limits/:bucket rejects out-of-range values with RFC 7807 400', async () => {
    // Floor violation for auth_token (min is 30, test 10)
    const floorRes = await request(app)
      .put('/v1/admin/rate-limits/auth_token')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_total: 10 });
    assert.strictEqual(floorRes.status, 400);
    assert.strictEqual(floorRes.body.type, 'https://api.nstsdc.org/errors/bad-request');
    assert.match(floorRes.body.detail, /between 30 and 1000/);

    // Ceiling violation for auth_token (max is 1000, test 5000)
    const ceilingRes = await request(app)
      .put('/v1/admin/rate-limits/auth_token')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_total: 5000 });
    assert.strictEqual(ceilingRes.status, 400);
    assert.strictEqual(ceilingRes.body.type, 'https://api.nstsdc.org/errors/bad-request');

    // Floor violation for attendance (min is 200, test 100)
    const attendanceFloorRes = await request(app)
      .put('/v1/admin/rate-limits/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_total: 100 });
    assert.strictEqual(attendanceFloorRes.status, 400);
    assert.match(attendanceFloorRes.body.detail, /between 200 and 10000/);


    // Invalid bucket name
    const invalidBucketRes = await request(app)
      .put('/v1/admin/rate-limits/nonexistent_bucket')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_total: 500 });
    assert.strictEqual(invalidBucketRes.status, 400);
  });

  it('3. PUT /v1/admin/rate-limits/:bucket updates setting, writes audit log, and notifies cache', async () => {
    const updateRes = await request(app)
      .put('/v1/admin/rate-limits/auth_token')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_total: 120, enabled: true });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.bucket, 'auth_token');
    assert.strictEqual(updateRes.body.max_total, 120);
    assert.strictEqual(updateRes.body.source, 'DATABASE');

    // Verify local cache reloaded with new setting
    const cached = rateLimitSettingsCache.getBucketSetting('auth_token');
    assert.strictEqual(cached.maxTotal, 120);
    assert.strictEqual(cached.source, 'DATABASE');

    // Verify transactional audit log record was created
    const auditRow = await adminPrisma.auditLog.findFirst({
      where: {
        actorId: adminId,
        action: 'RATE_LIMIT_UPDATED',
        entityType: 'RateLimitSetting',
      },
      orderBy: { id: 'desc' },
    });

    assert.ok(auditRow);
    assert.strictEqual((auditRow.newState as any).bucket, 'auth_token');
    assert.strictEqual((auditRow.newState as any).max_total, 120);
  });

  it('4. Multi-replica propagation: change reaches a second replica instance within poll/notify', async () => {
    // Create a simulated second replica cache
    const replica2Cache = new RateLimitSettingsCache();
    await replica2Cache.reload();

    assert.strictEqual(replica2Cache.getBucketSetting('auth_token').maxTotal, BUCKET_BOUNDS.auth_token.envDefault);

    // Replica 1 applies update via API
    const updateRes = await request(app)
      .put('/v1/admin/rate-limits/auth_token')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_total: 240 });
    assert.strictEqual(updateRes.status, 200);

    // Simulated event trigger or poll on replica 2
    await replica2Cache.reload();

    // Verify replica 2 observed the updated limit
    const replica2Setting = replica2Cache.getBucketSetting('auth_token');
    assert.strictEqual(replica2Setting.maxTotal, 240);
    assert.strictEqual(replica2Setting.source, 'DATABASE');

    replica2Cache.stop();
  });

  it('5. Fault tolerance: DB downtime keeps last good cached values', async () => {
    // 1. Establish valid custom setting in cache
    await request(app)
      .put('/v1/admin/rate-limits/user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_total: 4500 });

    const beforeSetting = rateLimitSettingsCache.getBucketSetting('user');
    assert.strictEqual(beforeSetting.maxTotal, 4500);

    // 2. Simulate database failure during reload
    const origQueryRaw = (adminPrisma as any).$queryRaw;
    try {
      const failingCache = new RateLimitSettingsCache();
      // Seed with initial good values
      await failingCache.reload();

      // Mock DB failure
      (failingCache as any).prisma = {
        $queryRaw: async () => {
          throw new Error('Connection refused (Postgres unreachable)');
        },
      };

      // Reload while DB is down
      await failingCache.reload();

      // Verify it retained the last good values
      const retainedSetting = failingCache.getBucketSetting('user');
      assert.strictEqual(retainedSetting.maxTotal, 4500);
      failingCache.stop();
    } finally {
      (adminPrisma as any).$queryRaw = origQueryRaw;
    }
  });

  it('6. POST /v1/admin/rate-limits/reset reverts settings to env defaults and logs audit', async () => {
    // Update setting first
    await request(app)
      .put('/v1/admin/rate-limits/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_total: 800 });

    assert.strictEqual(rateLimitSettingsCache.getBucketSetting('attendance').maxTotal, 800);

    // Reset settings
    const resetRes = await request(app)
      .post('/v1/admin/rate-limits/reset')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(resetRes.status, 200);

    // Verify cache reverted to envDefault
    const reverted = rateLimitSettingsCache.getBucketSetting('attendance');
    assert.strictEqual(reverted.maxTotal, BUCKET_BOUNDS.attendance.envDefault);
    assert.strictEqual(reverted.source, 'ENV');

    // Verify audit log for reset
    const resetAudit = await adminPrisma.auditLog.findFirst({
      where: {
        actorId: adminId,
        action: 'RATE_LIMIT_RESET',
      },
      orderBy: { id: 'desc' },
    });
    assert.ok(resetAudit);
  });

  it('7. Rate limit overrides: create, enforce, ignore expired, and purge via worker', async () => {
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();

    // 1. Create active block override
    const createBlockRes = await request(app)
      .post('/v1/admin/rate-limits/overrides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject_type: 'ip',
        subject: '198.51.100.25',
        mode: 'block',
        expires_at: futureExpiry,
        reason: 'Malicious probe abuse detected',
      });
    assert.strictEqual(createBlockRes.status, 201);
    assert.strictEqual(createBlockRes.body.mode, 'block');

    // 2. Verify override resolution: blocked subject receives max = 0
    const quotaBlock = rateLimitSettingsCache.resolveQuota('unauth', { ip: '198.51.100.25' });
    assert.strictEqual(quotaBlock.max, 0);
    assert.strictEqual(quotaBlock.mode, 'block');

    // 3. Create allow override for specific user
    const createAllowRes = await request(app)
      .post('/v1/admin/rate-limits/overrides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject_type: 'user',
        subject: studentId,
        mode: 'allow',
        expires_at: futureExpiry,
        reason: 'VIP benchmark student exemption',
      });
    assert.strictEqual(createAllowRes.status, 201);

    const quotaAllow = rateLimitSettingsCache.resolveQuota('user', { userId: studentId });
    assert.strictEqual(quotaAllow.skip, true);
    assert.strictEqual(quotaAllow.mode, 'allow');

    // 4. Create custom_max override
    const createCustomRes = await request(app)
      .post('/v1/admin/rate-limits/overrides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject_type: 'ip',
        subject: '203.0.113.50',
        mode: 'custom_max',
        custom_max: 300,
        expires_at: futureExpiry,
        reason: 'Campus lab machine cluster burst',
      });
    assert.strictEqual(createCustomRes.status, 201);

    const quotaCustom = rateLimitSettingsCache.resolveQuota('unauth', { ip: '203.0.113.50' });
    assert.strictEqual(quotaCustom.mode, 'custom_max');
    assert.strictEqual(quotaCustom.max, 150); // 300 / 2 replicas = 150

    // 5. Expired override is ignored
    // Manually insert an expired override directly to DB
    const expiredId = 'e0000000-0000-0000-0000-000000000001';
    await adminPrisma.rateLimitOverride.create({
      data: {
        id: expiredId,
        subjectType: 'ip',
        subject: '192.0.2.99',
        mode: 'block',
        expiresAt: new Date(Date.now() - 5000),
        reason: 'Old expired restriction',
        createdBy: adminId,
      },
    });

    await rateLimitSettingsCache.reload();

    // Expired override is ignored -> normal mode
    const quotaExpired = rateLimitSettingsCache.resolveQuota('unauth', { ip: '192.0.2.99' });
    assert.strictEqual(quotaExpired.mode, 'normal');

    // 6. Worker purge job removes expired rows
    const purgedCount = await processRateLimitOverridesPurge(adminPrisma);
    assert.ok(purgedCount >= 1);

    const remainingExpired = await adminPrisma.rateLimitOverride.findUnique({
      where: { id: expiredId },
    });
    assert.strictEqual(remainingExpired, null);

    // 7. Delete override via API
    const deleteRes = await request(app)
      .delete(`/v1/admin/rate-limits/overrides/${createBlockRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(deleteRes.status, 200);

    // Verify deletion audit
    const deleteAudit = await adminPrisma.auditLog.findFirst({
      where: {
        actorId: adminId,
        action: 'RATE_LIMIT_OVERRIDE_DELETED',
        entityId: createBlockRes.body.id,
      },
    });
    assert.ok(deleteAudit);
  });
});
