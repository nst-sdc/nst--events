import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import {
  createGeneralRateLimiter,
  createAuthRateLimiter,
  createAttendanceRateLimiter,
} from '../../src/middleware/rate-limit';

describe('Campus NAT Rate Limiting & Isolation (TASK P3)', () => {
  const mainApp = createApp();

  it('Exempts /health and /ready from rate limiting', async () => {
    for (let i = 0; i < 20; i++) {
      const resHealth = await request(mainApp).get('/health');
      assert.strictEqual(resHealth.status, 200);
      assert.strictEqual(resHealth.body.status, 'ok');

      const resReady = await request(mainApp).get('/ready');
      assert.strictEqual(resReady.status, 200);
      assert.strictEqual(resReady.body.status, 'ready');
    }
  });

  it('Enforces stricter rate limits on /auth routes against brute-force attacks', async () => {
    const resAuth = await request(mainApp)
      .get('/auth/google')
      .set('X-Forwarded-For', '203.0.113.50');

    // OAuth failed attempt limit sized for 3,000+ campus students (300 per replica)
    assert.strictEqual(resAuth.headers['ratelimit-limit'], '300');
    assert.ok(
      parseInt(resAuth.headers['ratelimit-limit'], 10) < 1000,
      'Auth endpoints must be significantly stricter than general endpoints'
    );
  });

  it('Isolates two authenticated users on the same campus NAT IP in main app', async () => {
    const sharedIp = '203.0.113.100';
    const userAToken = signJwt('a0000000-0000-0000-0000-000000000001', 1);
    const userBToken = signJwt('b0000000-0000-0000-0000-000000000002', 1);

    // User A makes a request from campus NAT IP
    const resA1 = await request(mainApp)
      .get('/v1/events')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('X-Forwarded-For', sharedIp);

    assert.strictEqual(resA1.headers['ratelimit-limit'], '1000');
    const remainingA1 = parseInt(resA1.headers['ratelimit-remaining'] || '0', 10);

    // User A makes a second request
    const resA2 = await request(mainApp)
      .get('/v1/events')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('X-Forwarded-For', sharedIp);

    const remainingA2 = parseInt(resA2.headers['ratelimit-remaining'] || '0', 10);
    assert.strictEqual(remainingA2, remainingA1 - 1, 'User A bucket decrements');

    // User B makes a request from the exact same campus NAT IP
    const resB1 = await request(mainApp)
      .get('/v1/events')
      .set('Authorization', `Bearer ${userBToken}`)
      .set('X-Forwarded-For', sharedIp);

    const remainingB1 = parseInt(resB1.headers['ratelimit-remaining'] || '0', 10);
    assert.strictEqual(
      remainingB1,
      remainingA1,
      'User B must have their own independent bucket, not affected by User A'
    );
  });

  it('Returns RFC 7807 with Retry-After when user hits limit, and leaves other user on same IP unaffected', async () => {
    // Build a test harness app with tight limits (userMax: 2, unauthMax: 2)
    const testApp = express();
    testApp.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);

    const testLimiter = createGeneralRateLimiter({
      windowMs: 60 * 1000,
      userMax: 2,
      unauthMax: 2,
    });

    testApp.use(testLimiter);
    testApp.get('/test-endpoint', (req, res) => res.json({ success: true, ip: req.ip }));

    const sharedCampusIp = '198.51.100.99';
    const user1Token = signJwt('student-quota-1', 1);
    const user2Token = signJwt('student-quota-2', 1);

    // User 1 uses their 2 requests
    const r1 = await request(testApp)
      .get('/test-endpoint')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Forwarded-For', sharedCampusIp);
    assert.strictEqual(r1.status, 200);

    const r2 = await request(testApp)
      .get('/test-endpoint')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Forwarded-For', sharedCampusIp);
    assert.strictEqual(r2.status, 200);

    // User 1 hits the rate limit on 3rd request -> must get 429
    const r3 = await request(testApp)
      .get('/test-endpoint')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('X-Forwarded-For', sharedCampusIp);

    assert.strictEqual(r3.status, 429);
    assert.ok(r3.headers['retry-after'], 'Must return Retry-After header');
    assert.strictEqual(
      r3.body.type,
      'https://api.nstsdc.org/errors/too-many-requests',
      'Must return RFC 7807 type'
    );
    assert.strictEqual(r3.body.title, 'Too Many Requests', 'Must return RFC 7807 title');
    assert.strictEqual(r3.body.status, 429);
    assert.strictEqual(r3.body.instance, '/test-endpoint');

    // User 2 on the exact same campus IP is NOT throttled
    const rUser2 = await request(testApp)
      .get('/test-endpoint')
      .set('Authorization', `Bearer ${user2Token}`)
      .set('X-Forwarded-For', sharedCampusIp);

    assert.strictEqual(
      rUser2.status,
      200,
      'User 2 on the same campus IP must succeed even when User 1 is throttled'
    );
  });

  it('Provides a dedicated bucket for attendance check-in so general traffic does not starve attendance', async () => {
    const testApp = express();
    testApp.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);

    const generalLimiter = createGeneralRateLimiter({
      windowMs: 60 * 1000,
      userMax: 1, // Only 1 request allowed for general browsing
    });

    const attendanceLimiter = createAttendanceRateLimiter({
      windowMs: 60 * 1000,
      max: 5, // Dedicated quota for attendance
    });

    testApp.use('/v1/attendance/mark', attendanceLimiter);
    testApp.use(generalLimiter);

    testApp.get('/v1/events', (_req, res) => res.json({ endpoint: 'events' }));
    testApp.post('/v1/attendance/mark', (_req, res) => res.json({ endpoint: 'attendance' }));

    const token = signJwt('active-student-user', 1);

    // 1. Student uses their 1 general request browsing events
    const genRes1 = await request(testApp)
      .get('/v1/events')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(genRes1.status, 200);

    // 2. Student is now exhausted on general requests
    const genRes2 = await request(testApp)
      .get('/v1/events')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(genRes2.status, 429, 'General browsing is exhausted');

    // 3. BUT attendance check-in has its own bucket and MUST STILL SUCCEED!
    const attRes1 = await request(testApp)
      .post('/v1/attendance/mark')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(
      attRes1.status,
      200,
      'Attendance check-in must succeed in its dedicated bucket despite exhausted general traffic'
    );
  });
});
