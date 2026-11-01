import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import sinon from 'sinon';
import { createApp } from '../../src/app';
import { authService } from '../../src/modules/auth/auth.service';
import {
  createAuthRateLimiter,
  createAuthOAuthRateLimiter,
  createAuthTokenRateLimiter,
  extractRefreshTokenFromRequest,
  hashRefreshToken,
} from '../../src/middleware/rate-limit';

describe('TASK P11: /auth Rate Limiting & Campus NAT Isolation', () => {
  const mainApp = createApp();
  const sharedCampusIp = '203.0.113.195';

  beforeEach(() => {
    sinon.restore();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('1. 500 distinct simulated students on ONE IP each doing login + refresh within window all succeed', async () => {
    // Stub refreshTokens so DB queries are bypassed and legitimate 200 responses are returned
    sinon.stub(authService, 'refreshTokens').callsFake(async (rawRefreshToken: string) => {
      return {
        access_token: `mock_jwt_access_${rawRefreshToken}`,
        expires_in: 900,
        refreshToken: `mock_new_refresh_${rawRefreshToken}`,
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'student@adypu.edu.in',
          full_name: 'Campus Student',
          global_role: 'STUDENT',
        },
      } as any;
    });

    const studentCount = 500;
    const batchSize = 25;

    for (let i = 0; i < studentCount; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, studentCount - i) }, (_, idx) => i + idx + 1);

      await Promise.all(
        batch.map(async (studentId) => {
          // A. Google login start on shared campus IP:
          // Returns 302 Found redirect to Google OAuth.
          // Because skipSuccessfulRequests: true, this successful redirect does NOT consume failure quota!
          const loginRes = await request(mainApp)
            .get('/auth/google')
            .set('X-Forwarded-For', sharedCampusIp);

          assert.strictEqual(loginRes.status, 302, `Student ${studentId} login must return 302 redirect`);

          // B. Token refresh on the exact same shared campus IP:
          // Keyed by SHA-256(refreshToken), giving each student their own independent bucket.
          const refreshToken = `campus-student-refresh-token-${studentId}`;
          const refreshRes = await request(mainApp)
            .post('/auth/refresh')
            .set('X-Forwarded-For', sharedCampusIp)
            .set('X-Client-Platform', 'web')
            .set('Cookie', [`refreshToken=${refreshToken}`]);

          assert.strictEqual(
            refreshRes.status,
            200,
            `Student ${studentId} refresh on shared IP must succeed with 200 (not throttled by other students)`
          );
          assert.strictEqual(
            refreshRes.body.access_token,
            `mock_jwt_access_${refreshToken}`
          );
        })
      );
    }
  });

  it('2. One token hammering refresh gets 429 with Retry-After, while other students on the same IP succeed', async () => {
    sinon.stub(authService, 'refreshTokens').callsFake(async (rawRefreshToken: string) => {
      return {
        access_token: `mock_jwt_${rawRefreshToken}`,
        expires_in: 900,
        refreshToken: `mock_rotated_${rawRefreshToken}`,
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'student@adypu.edu.in',
          full_name: 'Campus Student',
          global_role: 'STUDENT',
        },
      } as any;
    });

    const victimToken = 'hammer-looping-refresh-token-xyz';
    // Default RATE_LIMIT_AUTH_TOKEN_MAX = 60, with 2 replicas = 30 per replica
    const perReplicaTokenLimit = 30;

    // Send 30 requests with the same token -> all 30 must succeed
    for (let reqNum = 1; reqNum <= perReplicaTokenLimit; reqNum++) {
      const res = await request(mainApp)
        .post('/auth/refresh')
        .set('X-Forwarded-For', sharedCampusIp)
        .set('X-Client-Platform', 'web')
        .set('Cookie', [`refreshToken=${victimToken}`]);

      assert.strictEqual(
        res.status,
        200,
        `Request ${reqNum} for victim token should succeed within quota`
      );
    }

    // 31st request with the exact same token -> MUST be throttled with HTTP 429
    const throttledRes = await request(mainApp)
      .post('/auth/refresh')
      .set('X-Forwarded-For', sharedCampusIp)
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`refreshToken=${victimToken}`]);

    assert.strictEqual(throttledRes.status, 429, 'Excessive refresh requests on the same token must return 429');
    assert.ok(throttledRes.headers['retry-after'], 'Throttled response must include Retry-After header');
    assert.strictEqual(
      throttledRes.body.type,
      'https://api.nstsdc.org/errors/too-many-requests',
      'Must return standard RFC 7807 error type'
    );
    assert.strictEqual(throttledRes.body.title, 'Too Many Requests');
    assert.strictEqual(throttledRes.body.status, 429);

    // CRITICAL: A DIFFERENT student on the exact same campus NAT IP must NOT be throttled!
    const innocentToken = 'innocent-student-token-abc';
    const innocentRes = await request(mainApp)
      .post('/auth/refresh')
      .set('X-Forwarded-For', sharedCampusIp)
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`refreshToken=${innocentToken}`]);

    assert.strictEqual(
      innocentRes.status,
      200,
      'Another student on the same campus IP must succeed even when one token is throttled'
    );
  });

  it('3. An abusive IP sending failed requests gets 429 with RFC 7807 & Retry-After', async () => {
    // Create test app with custom tighter OAuth limit (max: 4 failed attempts) to verify exact cutoff
    const testApp = express();
    testApp.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);
    testApp.use(express.json());

    const oauthLimiter = createAuthOAuthRateLimiter({
      windowMs: 60 * 1000,
      max: 4,
    });

    testApp.use('/oauth-test', oauthLimiter);
    testApp.post('/oauth-test', (req, res) => {
      if (req.body?.simulateSuccess) {
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({ error: 'unauthorized_attempt' });
    });

    const abusiveIp = '198.51.100.222';
    const legitimateIp = '198.51.100.111';

    // A. Successful requests do NOT increment failure quota (skipSuccessfulRequests)
    for (let i = 0; i < 10; i++) {
      const successRes = await request(testApp)
        .post('/oauth-test')
        .set('X-Forwarded-For', abusiveIp)
        .send({ simulateSuccess: true });
      assert.strictEqual(successRes.status, 200);
    }

    // B. Send 4 failed requests from abusive IP -> all return 401
    for (let i = 1; i <= 4; i++) {
      const failRes = await request(testApp)
        .post('/oauth-test')
        .set('X-Forwarded-For', abusiveIp)
        .send({ simulateSuccess: false });
      assert.strictEqual(failRes.status, 401, `Failed attempt ${i} returns 401`);
    }

    // C. 5th request from abusive IP -> hits rate limit (HTTP 429)
    const abusiveRes = await request(testApp)
      .post('/oauth-test')
      .set('X-Forwarded-For', abusiveIp)
      .send({ simulateSuccess: false });

    assert.strictEqual(abusiveRes.status, 429, 'Abusive IP exceeding failed threshold must return 429');
    assert.ok(abusiveRes.headers['retry-after'], 'Must contain Retry-After header');
    assert.strictEqual(abusiveRes.body.type, 'https://api.nstsdc.org/errors/too-many-requests');
    assert.strictEqual(abusiveRes.body.title, 'Too Many Requests');

    // D. Legitimate IP is completely unaffected
    const legitRes = await request(testApp)
      .post('/oauth-test')
      .set('X-Forwarded-For', legitimateIp)
      .send({ simulateSuccess: true });
    assert.strictEqual(legitRes.status, 200, 'Legitimate IP must not be throttled by abusive IP');
  });

  it('4. When refresh token is absent, falls back to generous IP unauthenticated quota', async () => {
    const testApp = express();
    testApp.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);

    const tokenLimiter = createAuthTokenRateLimiter({
      windowMs: 60 * 1000,
      tokenMax: 2, // Very tight token limit
      unauthMax: 50, // Generous IP fallback limit
    });

    testApp.use('/token-test', tokenLimiter);
    testApp.post('/token-test', (_req, res) => res.json({ ok: true }));

    const clientIp = '198.51.100.55';

    // Send 10 requests WITHOUT a refresh token -> should all pass because unauthMax is 50 (not 2)
    for (let i = 0; i < 10; i++) {
      const res = await request(testApp)
        .post('/token-test')
        .set('X-Forwarded-For', clientIp);
      assert.strictEqual(
        res.status,
        200,
        `Unauthenticated request ${i + 1} must use generous unauthMax and succeed`
      );
    }
  });

  it('5. Extracts refresh token from request body (mobile platform flow)', () => {
    const req = {
      body: { refresh_token: 'mobile-refresh-token-value' },
      cookies: {},
      signedCookies: {},
    } as any;

    const extracted = extractRefreshTokenFromRequest(req);
    assert.strictEqual(extracted, 'mobile-refresh-token-value');

    const hash = hashRefreshToken(extracted!);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64, 'SHA-256 hash must be 64 hexadecimal characters');
  });

  it('6. Per-IP ceiling: 6000 requests with rotating random tokens from one IP get 429 after ceiling; 500 distinct students still pass', async () => {
    const testApp = express();
    testApp.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);

    // Configured with per-IP ceiling of 2,500 (replicas=2 default of 5,000 cluster-wide), and tokenMax=30
    const tokenLimiter = createAuthTokenRateLimiter({
      windowMs: 15 * 60 * 1000,
      tokenMax: 30,
      ipCeilingMax: 2500,
    });

    testApp.use('/refresh-test', tokenLimiter);
    testApp.post('/refresh-test', (_req, res) => res.json({ access_token: 'ok' }));

    const attackerIp = '198.51.100.99';
    let passedCount = 0;
    let blockedCount = 0;
    let firstBlockedResponse: any = null;

    // Simulate 6,000 requests with random distinct tokens from one attacker IP
    // Direct Express dispatch for sub-millisecond RAM performance across 6,000 iterations
    for (let i = 1; i <= 6000; i++) {
      const mockReq: any = {
        ip: attackerIp,
        path: '/refresh-test',
        originalUrl: '/refresh-test',
        url: '/refresh-test',
        method: 'POST',
        headers: { 'x-forwarded-for': attackerIp },
        cookies: { refreshToken: `random-rotating-token-${i}-${Math.random()}` },
        signedCookies: {},
        body: {},
      };

      let statusCode = 200;
      let responseBody: any = null;
      let headers: Record<string, any> = {};
      let resolve: () => void;

      const mockRes: any = {
        headersSent: false,
        setHeader: (k: string, v: any) => { headers[k.toLowerCase()] = v; },
        getHeader: (k: string) => headers[k.toLowerCase()],
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          mockRes.headersSent = true;
          responseBody = data;
          resolve();
          return mockRes;
        },
      };

      await new Promise<void>((r) => {
        resolve = r;
        tokenLimiter(mockReq, mockRes, () => {
          statusCode = 200;
          resolve();
        });
      });

      if (statusCode === 200) {
        passedCount++;
      } else if (statusCode === 429) {
        blockedCount++;
        if (!firstBlockedResponse) {
          firstBlockedResponse = { statusCode, body: responseBody, headers };
        }
      }
    }

    assert.strictEqual(passedCount, 2500, 'Exactly 2,500 requests must pass before reaching IP ceiling');
    assert.strictEqual(blockedCount, 3500, 'Remaining 3,500 of 6,000 requests must be blocked by IP ceiling with 429');
    assert.strictEqual(firstBlockedResponse.statusCode, 429);
    assert.strictEqual(firstBlockedResponse.body.type, 'https://api.nstsdc.org/errors/too-many-requests');
    assert.strictEqual(firstBlockedResponse.body.title, 'Too Many Requests');
    assert.strictEqual(firstBlockedResponse.body.status, 429);
    assert.ok(firstBlockedResponse.headers['retry-after'], 'Must contain Retry-After header');

    // Legitimacy check: 500 distinct students from a separate campus NAT IP all succeed
    const campusNatIp = '203.0.113.200';
    let campusPassed = 0;

    for (let i = 1; i <= 500; i++) {
      const mockReq: any = {
        ip: campusNatIp,
        path: '/refresh-test',
        originalUrl: '/refresh-test',
        url: '/refresh-test',
        method: 'POST',
        headers: { 'x-forwarded-for': campusNatIp },
        cookies: { refreshToken: `legit-student-token-${i}` },
        signedCookies: {},
        body: {},
      };

      let statusCode = 200;
      let resolveCampus: () => void;
      const mockRes: any = {
        headersSent: false,
        setHeader: () => {},
        getHeader: () => undefined,
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: () => {
          mockRes.headersSent = true;
          resolveCampus();
          return mockRes;
        },
      };

      await new Promise<void>((r) => {
        resolveCampus = r;
        tokenLimiter(mockReq, mockRes, () => {
          statusCode = 200;
          resolveCampus();
        });
      });

      if (statusCode === 200) campusPassed++;
    }

    assert.strictEqual(campusPassed, 500, 'All 500 distinct students from campus IP must pass under the ceiling');
  });
});
