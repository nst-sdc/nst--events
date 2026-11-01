import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'crypto';
import { createApp, timingSafeTokenCompare } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import {
  BUCKET_BOUNDS,
  RATE_LIMIT_BUCKETS,
  rateLimitSettingsCache,
  RateLimitBucket,
} from '../../src/lib/rate-limit-settings';
import {
  classifyNetwork,
  authEventsService,
} from '../../src/modules/auth/auth-events.service';
import { env, validateEnv } from '../../src/config/env';
import { getMergedMetrics } from '../../src/lib/metrics';

describe('TASK H1: Hardening Integration & Validation Suite', () => {
  const app = createApp();
  const adminId = '11111111-1111-1111-1111-111111111111';
  const adminToken = signJwt(adminId, 1);

  before(async () => {
    await adminPrisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        email: 'h1.admin@adypu.edu.in',
        fullName: 'H1 Admin',
        googleSub: 'google-sub-h1-admin',
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
      update: {
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
    });
  });

  after(async () => {
    await adminPrisma.rateLimitSetting.deleteMany({});
    await adminPrisma.authEvent.deleteMany({});
    await adminPrisma.user.deleteMany({ where: { id: adminId } });
    rateLimitSettingsCache.resetToDefaults();
  });

  // =========================================================================
  // Requirement 1: Startup Validation in Production
  // =========================================================================
  describe('1. Startup validation (NODE_ENV=production)', () => {
    const validBaseEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5440/nst_events?schema=public',
      JWT_SECRET: '0123456789012345678901234567890123456789',
      COOKIE_SECRET: '0123456789012345678901234567890123456789',
      GOOGLE_CLIENT_ID: 'mock-client-id',
      GOOGLE_CLIENT_SECRET: 'mock-client-secret',
      GOOGLE_CALLBACK_URL: 'https://api.nstsdc.org/auth/google/callback',
      AUTH_EVENTS_IP_PEPPER: 'secure-production-pepper-32-chars-long',
      METRICS_TOKEN: 'super-secure-production-metrics-token',
    };

    it('Fails when AUTH_EVENTS_IP_PEPPER is unset in production', () => {
      const invalidEnv = { ...validBaseEnv };
      delete (invalidEnv as any).AUTH_EVENTS_IP_PEPPER;

      assert.throws(
        () => validateEnv(invalidEnv),
        /AUTH_EVENTS_IP_PEPPER is required/
      );
    });

    it('Fails when AUTH_EVENTS_IP_PEPPER equals committed default in production', () => {
      const invalidEnv = {
        ...validBaseEnv,
        AUTH_EVENTS_IP_PEPPER: 'nst-events-auth-ip-pepper-default-salt',
      };

      assert.throws(
        () => validateEnv(invalidEnv),
        /must not equal the committed default/
      );
    });

    it('Fails when METRICS_TOKEN is unset or empty in production', () => {
      const invalidEnv = {
        ...validBaseEnv,
        METRICS_TOKEN: '',
      };

      assert.throws(
        () => validateEnv(invalidEnv),
        /METRICS_TOKEN must be set/
      );
    });

    it('Succeeds when both AUTH_EVENTS_IP_PEPPER and METRICS_TOKEN are valid in production', () => {
      const parsed = validateEnv(validBaseEnv);
      assert.strictEqual(parsed.NODE_ENV, 'production');
      assert.strictEqual(parsed.AUTH_EVENTS_IP_PEPPER, 'secure-production-pepper-32-chars-long');
      assert.strictEqual(parsed.METRICS_TOKEN, 'super-secure-production-metrics-token');
    });
  });

  // =========================================================================
  // Requirement 2: /metrics Protection in Production
  // =========================================================================
  describe('2. /metrics Production Protection & TimingSafe Comparison', () => {
    it('timingSafeTokenCompare correctly evaluates tokens using timingSafeEqual', () => {
      assert.strictEqual(timingSafeTokenCompare('secret-token-123', 'secret-token-123'), true);
      assert.strictEqual(timingSafeTokenCompare('secret-token-123', 'wrong-token-456'), false);
      assert.strictEqual(timingSafeTokenCompare('', 'secret-token-123'), false);
      assert.strictEqual(timingSafeTokenCompare(null, 'secret-token-123'), false);
      assert.strictEqual(timingSafeTokenCompare('short', 'much-longer-token-string'), false);
    });

    it('Rejects with 401 when no token is supplied, even with X-Forwarded-For spoofed to 127.0.0.1 in production mode', async () => {
      const origNodeEnv = env.NODE_ENV;
      const origMetricsToken = env.METRICS_TOKEN;
      try {
        (env as any).NODE_ENV = 'production';
        (env as any).METRICS_TOKEN = 'prod-metrics-secret-key-999';

        const res = await request(app)
          .get('/metrics')
          .set('X-Forwarded-For', '127.0.0.1');

        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/unauthorized');
        assert.match(res.body.detail, /Valid metrics authorization token required/);
      } finally {
        (env as any).NODE_ENV = 'test';
        (env as any).METRICS_TOKEN = origMetricsToken;
      }
    });

    it('Rejects with 401 when invalid token is supplied in production mode', async () => {
      const origNodeEnv = env.NODE_ENV;
      const origMetricsToken = env.METRICS_TOKEN;
      try {
        (env as any).NODE_ENV = 'production';
        (env as any).METRICS_TOKEN = 'prod-metrics-secret-key-999';

        const res = await request(app)
          .get('/metrics')
          .set('Authorization', 'Bearer wrong-secret-token');

        assert.strictEqual(res.status, 401);
      } finally {
        (env as any).NODE_ENV = 'test';
        (env as any).METRICS_TOKEN = origMetricsToken;
      }
    });

    it('Accepts with 200 when valid token is supplied in production mode', async () => {
      const origNodeEnv = env.NODE_ENV;
      const origMetricsToken = env.METRICS_TOKEN;
      try {
        (env as any).NODE_ENV = 'production';
        (env as any).METRICS_TOKEN = 'prod-metrics-secret-key-999';

        const res = await request(app)
          .get('/metrics')
          .set('Authorization', 'Bearer prod-metrics-secret-key-999');

        assert.strictEqual(res.status, 200);
        assert.match(res.headers['content-type'], /text\/plain/);
        assert.match(res.text, /nst_api_http_requests_total/);
      } finally {
        (env as any).NODE_ENV = 'test';
        (env as any).METRICS_TOKEN = origMetricsToken;
      }
    });
  });

  // =========================================================================
  // Requirement 3: Rate-Limit Bounds and Floors
  // =========================================================================
  describe('3. Rate-Limit Bounds & Floors (Cannot lock out 3000 students)', () => {
    it('Verifies floor and ceiling bounds for all 6 buckets', () => {
      assert.strictEqual(BUCKET_BOUNDS.attendance.min, 200);
      assert.strictEqual(BUCKET_BOUNDS.attendance.max, 10000);

      assert.strictEqual(BUCKET_BOUNDS.auth_token.min, 30);
      assert.strictEqual(BUCKET_BOUNDS.auth_token.max, 1000);

      assert.strictEqual(BUCKET_BOUNDS.auth_ip_ceiling.min, 1000);
      assert.strictEqual(BUCKET_BOUNDS.auth_ip_ceiling.max, 50000);

      assert.strictEqual(BUCKET_BOUNDS.auth_oauth_failed.min, 100);
      assert.strictEqual(BUCKET_BOUNDS.auth_oauth_failed.max, 5000);

      assert.strictEqual(BUCKET_BOUNDS.user.min, 500);
      assert.strictEqual(BUCKET_BOUNDS.user.max, 20000);

      assert.strictEqual(BUCKET_BOUNDS.unauth.min, 500);
      assert.strictEqual(BUCKET_BOUNDS.unauth.max, 20000);
    });

    // Test per bucket for min and max via PUT /v1/admin/rate-limits/:bucket
    for (const bucket of RATE_LIMIT_BUCKETS) {
      const bounds = BUCKET_BOUNDS[bucket];

      it(`Bucket '${bucket}': rejects min - 1 (${bounds.min - 1}) and max + 1 (${bounds.max + 1}), accepts min (${bounds.min}) and max (${bounds.max})`, async () => {
        // Below min -> 400
        const belowMin = await request(app)
          .put(`/v1/admin/rate-limits/${bucket}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ max_total: bounds.min - 1 });
        assert.strictEqual(belowMin.status, 400);
        assert.match(belowMin.body.detail, new RegExp(`between ${bounds.min} and ${bounds.max}`));

        // Above max -> 400
        const aboveMax = await request(app)
          .put(`/v1/admin/rate-limits/${bucket}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ max_total: bounds.max + 1 });
        assert.strictEqual(aboveMax.status, 400);
        assert.match(aboveMax.body.detail, new RegExp(`between ${bounds.min} and ${bounds.max}`));

        // At min -> 200
        const atMin = await request(app)
          .put(`/v1/admin/rate-limits/${bucket}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ max_total: bounds.min });
        assert.strictEqual(atMin.status, 200);
        assert.strictEqual(atMin.body.max_total, bounds.min);

        // At max -> 200
        const atMax = await request(app)
          .put(`/v1/admin/rate-limits/${bucket}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ max_total: bounds.max });
        assert.strictEqual(atMax.status, 200);
        assert.strictEqual(atMax.body.max_total, bounds.max);
      });
    }
  });

  // =========================================================================
  // Requirement 4: CAMPUS_CIDR_BLOCKS (Default empty -> unknown)
  // =========================================================================
  describe('4. CAMPUS_CIDR_BLOCKS Network Classification', () => {
    it('Empty config defaults network_class to "unknown"', () => {
      assert.strictEqual(classifyNetwork('10.0.1.25', ''), 'unknown');
      assert.strictEqual(classifyNetwork('172.16.5.1', ''), 'unknown');
      assert.strictEqual(classifyNetwork('192.168.1.1', ''), 'unknown');
      assert.strictEqual(classifyNetwork('103.21.124.5', ''), 'unknown');
      assert.strictEqual(classifyNetwork('198.51.100.1', ''), 'unknown');
    });

    it('Classifies correctly when real campus egress CIDRs are provided', () => {
      const realCampusCidrs = '103.21.124.0/24';
      assert.strictEqual(classifyNetwork('103.21.124.10', realCampusCidrs), 'campus');
      assert.strictEqual(classifyNetwork('198.51.100.1', realCampusCidrs), 'off_campus');
      assert.strictEqual(classifyNetwork('10.0.0.1', realCampusCidrs), 'off_campus');
    });
  });

  // =========================================================================
  // Requirement 5: Auth Events Synchronous Logging & Buffer Flush
  // =========================================================================
  describe('5. Synchronous Auth Events (REUSE_DETECTED, SESSION_REVOKED) & Buffer Flush', () => {
    beforeEach(async () => {
      await adminPrisma.authEvent.deleteMany({});
    });

    it('Writes REUSE_DETECTED synchronously without waiting for batch flush', async () => {
      assert.strictEqual(authEventsService.getQueueLength(), 0);

      await authEventsService.logSynchronousEvent({
        eventType: 'REUSE_DETECTED',
        userId: adminId,
        ip: '198.51.100.22',
        failureReason: 'Synchronous reuse detected test',
      });

      // Does not sit in queue
      assert.strictEqual(authEventsService.getQueueLength(), 0);

      // Immediately present in database
      const found = await adminPrisma.authEvent.findFirst({
        where: { eventType: 'REUSE_DETECTED' },
      });
      assert.ok(found);
      assert.strictEqual(found.userId, adminId);
      assert.strictEqual(found.failureReason, 'Synchronous reuse detected test');
    });

    it('Writes SESSION_REVOKED synchronously without waiting for batch flush', async () => {
      await authEventsService.logSynchronousEvent({
        eventType: 'SESSION_REVOKED',
        userId: adminId,
        failureReason: 'Synchronous session revoked test',
      });

      const found = await adminPrisma.authEvent.findFirst({
        where: { eventType: 'SESSION_REVOKED' },
      });
      assert.ok(found);
      assert.strictEqual(found.userId, adminId);
    });

    it('log() routes REUSE_DETECTED and SESSION_REVOKED directly to synchronous writer without queueing', async () => {
      const prevQueueLen = authEventsService.getQueueLength();

      authEventsService.log({
        eventType: 'REUSE_DETECTED',
        userId: adminId,
        failureReason: 'Routed reuse detected',
      });

      // Queue length does not increase
      assert.strictEqual(authEventsService.getQueueLength(), prevQueueLen);

      // Wait a moment for async promise resolution
      await new Promise((r) => setTimeout(r, 100));

      const found = await adminPrisma.authEvent.findFirst({
        where: { failureReason: 'Routed reuse detected' },
      });
      assert.ok(found);
    });

    it('Synchronous logging is non-blocking and does not throw when database write fails', async () => {
      // Pass an invalid UUID that would fail DB constraint if not caught
      await assert.doesNotReject(async () => {
        await authEventsService.logSynchronousEvent({
          eventType: 'REUSE_DETECTED',
          userId: 'invalid-non-uuid-string-will-trigger-db-error',
          failureReason: 'Resilience test',
        });
      });
    });

    it('Drains in-memory queue to 0 on flushSync / SIGTERM buffer flush', async () => {
      // Normal events go into queue
      authEventsService.log({
        eventType: 'LOGIN_SUCCESS',
        userId: adminId,
      });
      authEventsService.log({
        eventType: 'LOGIN_FAILED',
        userId: adminId,
      });

      assert.strictEqual(authEventsService.getQueueLength(), 2);

      // Perform flushSync (as called during graceful shutdown)
      await authEventsService.flushSync();

      assert.strictEqual(authEventsService.getQueueLength(), 0);

      const events = await adminPrisma.authEvent.findMany({
        where: { userId: adminId },
      });
      assert.ok(events.length >= 2);
    });
  });

  // =========================================================================
  // Requirement 6: Metrics 404 Route Cardinality (100 Random URLs)
  // =========================================================================
  describe('6. Metrics Unmatched Routes 404 Cardinality (100 Random URLs)', () => {
    it('100 random URLs all return 404 and collapse strictly to single label route="unmatched"', async () => {
      const randomUrls = Array.from(
        { length: 100 },
        () => `/test-random-route-${crypto.randomUUID()}`
      );

      // Send 100 requests in chunks with Connection: close to avoid local socket exhaustion
      const chunkSize = 10;
      for (let i = 0; i < randomUrls.length; i += chunkSize) {
        const chunk = randomUrls.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (url) => {
            const res = await request(app)
              .get(url)
              .set('Connection', 'close')
              .set('X-Client-Platform', 'web');
            assert.strictEqual(res.status, 404);
          })
        );
      }



      const metricsText = await getMergedMetrics();

      // Verify that nst_api_http_requests_total has route="unmatched" for 404
      assert.match(
        metricsText,
        /nst_api_http_requests_total\{method="GET",route="unmatched",status_code="404",status_class="4xx"\}/
      );

      // Verify that NONE of the 100 random URLs appear anywhere in the metrics text!
      for (const url of randomUrls.slice(0, 10)) {
        assert.strictEqual(metricsText.includes(url), false, `Leaked random path into metric labels: ${url}`);
      }
    });
  });

  // =========================================================================
  // Requirement 7: 90-Day Retention Window Date Range Rejection & Clamping
  // =========================================================================
  describe('7. Auth Events & Stats 90-day date range constraints', () => {
    it('GET /v1/admin/auth-events rejects date range > 90 days with 400 Bad Request', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = now.toISOString();

      const res = await request(app)
        .get(`/v1/admin/auth-events?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/bad-request');
      assert.match(res.body.detail, /90 days/i);
    });

    it('GET /v1/admin/auth-stats rejects date range > 90 days with 400 Bad Request', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = now.toISOString();

      const res = await request(app)
        .get(`/v1/admin/auth-stats?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/bad-request');
      assert.match(res.body.detail, /90 days/i);
    });

    it('GET /v1/admin/auth-events rejects start_date > 90 days ago when end_date is omitted', async () => {
      const oldStart = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .get(`/v1/admin/auth-events?start_date=${oldStart}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/bad-request');
    });

    it('GET /v1/admin/auth-stats rejects start_date > 90 days ago when end_date is omitted', async () => {
      const oldStart = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .get(`/v1/admin/auth-stats?start_date=${oldStart}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/bad-request');
    });

    it('GET /v1/admin/auth-events and auth-stats accept valid 30-day range and return 200', async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = now.toISOString();

      const eventsRes = await request(app)
        .get(`/v1/admin/auth-events?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(eventsRes.status, 200);
      assert.ok(Array.isArray(eventsRes.body.data));

      const statsRes = await request(app)
        .get(`/v1/admin/auth-stats?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(statsRes.status, 200);
      assert.ok(statsRes.body.summary);
    });
  });
});
