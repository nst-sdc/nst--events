import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { authService } from '../../src/modules/auth/auth.service';
import { generateRefreshToken, hashToken } from '../../src/lib/hash';
import {
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../../src/lib/cookies';
import { env } from '../../src/config/env';

const app = createApp();
(app as any)._skipDefaultPlatformHeader = true;

describe('POST /auth/logout Session Revocation Suite', () => {
  // Test 1: logout with cookie revokes all rows in the family
  it('logout with cookie revokes all rows in the family', async () => {
    const testUser = await adminPrisma.user.create({
      data: {
        email: `logout-cookie-${Date.now()}@test.com`,
        googleSub: `sub-logout-${Date.now()}`,
        fullName: 'Logout Family User',
      },
    });

    const familyId = crypto.randomUUID();

    // Old rotated token in family (already revoked)
    const oldRawToken = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(oldRawToken),
        familyId,
        revokedAt: new Date(Date.now() - 5000),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Active token 1 in family
    const activeRawToken1 = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(activeRawToken1),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Active token 2 in family (simulated descendant/concurrent token in same family)
    const activeRawToken2 = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(activeRawToken2),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Call logout using active token 1 in Cookie
    const res = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${activeRawToken1}`]);

    assert.strictEqual(res.status, 204);

    // Assert that ALL rows with familyId are now revoked
    const familyRows = await adminPrisma.refreshToken.findMany({
      where: { familyId },
    });

    assert.strictEqual(familyRows.length, 3);
    for (const row of familyRows) {
      assert.ok(row.revokedAt !== null, `Row ${row.id} in family must be revoked`);
    }

    // Assert users.security_version was NOT incremented
    const refreshedUser = await adminPrisma.user.findUnique({
      where: { id: testUser.id },
    });
    assert.strictEqual(refreshedUser?.securityVersion, testUser.securityVersion);

    // Cleanup
    await adminPrisma.user.delete({ where: { id: testUser.id } });
  });

  // Test 2: subsequent /auth/refresh with that cookie returns 401
  it('subsequent /auth/refresh with that cookie returns 401', async () => {
    const testUser = await adminPrisma.user.create({
      data: {
        email: `logout-refresh-${Date.now()}@test.com`,
        googleSub: `sub-logout-refresh-${Date.now()}`,
        fullName: 'Logout Refresh User',
      },
    });

    const familyId = crypto.randomUUID();
    const rawToken = generateRefreshToken();

    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(rawToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Log out with the cookie
    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${rawToken}`]);
    assert.strictEqual(logoutRes.status, 204);

    // Subsequent refresh with the same cookie must return 401
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${rawToken}`]);
    assert.strictEqual(refreshRes.status, 401);

    // Cleanup
    await adminPrisma.user.delete({ where: { id: testUser.id } });
  });

  // Test 3: logout with expired access token still works
  it('logout with expired access token still works and revokes token', async () => {
    const testUser = await adminPrisma.user.create({
      data: {
        email: `logout-expired-access-${Date.now()}@test.com`,
        googleSub: `sub-logout-expired-${Date.now()}`,
        fullName: 'Expired Access User',
      },
    });

    const familyId = crypto.randomUUID();
    const rawToken = generateRefreshToken();

    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(rawToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Generate expired access token (expired 10 minutes ago)
    const expiredAccessToken = jwt.sign(
      { sub: testUser.id, secVer: testUser.securityVersion },
      env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '-10m' }
    );

    // Send logout with expired access token in Authorization header
    const res = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web')
      .set('Authorization', `Bearer ${expiredAccessToken}`)
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${rawToken}`]);

    assert.strictEqual(res.status, 204);

    // Confirm refresh token was still successfully revoked
    const tokenRow = await adminPrisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(rawToken) },
    });
    assert.ok(tokenRow?.revokedAt !== null, 'Refresh token must be revoked despite expired access token');

    // Cleanup
    await adminPrisma.user.delete({ where: { id: testUser.id } });
  });

  // Test 4: logout with no token returns 204
  it('logout with no token returns 204 and clears cookies', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web');

    assert.strictEqual(res.status, 204);

    // Check Set-Cookie headers are present to clear cookies
    const setCookieHeaders = res.headers['set-cookie'];
    assert.ok(Array.isArray(setCookieHeaders) && setCookieHeaders.length > 0);
    const refreshTokenClearHeader = setCookieHeaders.find((c: string) =>
      c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`)
    );
    assert.ok(refreshTokenClearHeader, 'Must clear refreshToken cookie');
  });

  // Test 5: Set-Cookie clear attributes match the set attributes
  it('Set-Cookie clear attributes match the set attributes', async () => {
    const setOpts = getRefreshTokenCookieOptions();
    const clearOpts = getClearRefreshTokenCookieOptions();

    // Check structural equality of key cookie properties
    assert.strictEqual(clearOpts.httpOnly, setOpts.httpOnly, 'httpOnly must match');
    assert.strictEqual(clearOpts.secure, setOpts.secure, 'secure must match');
    assert.strictEqual(clearOpts.sameSite, setOpts.sameSite, 'sameSite must match');
    assert.strictEqual(clearOpts.path, setOpts.path, 'path must match');
    assert.strictEqual(clearOpts.domain, setOpts.domain, 'domain must match');

    // Also verify on wire via HTTP response
    const res = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web');
    assert.strictEqual(res.status, 204);
    const setCookies: string[] = res.headers['set-cookie'] || [];
    const clearCookieStr = setCookies.find((h) => h.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`));
    assert.ok(clearCookieStr, 'Set-Cookie for refreshToken must be present');

    assert.ok(clearCookieStr.toLowerCase().includes('path=/auth'), 'Clear cookie must have Path=/auth');
    assert.ok(clearCookieStr.toLowerCase().includes('httponly'), 'Clear cookie must have HttpOnly');
    assert.ok(clearCookieStr.toLowerCase().includes('samesite=strict'), 'Clear cookie must have SameSite=Strict');
    if (setOpts.secure) {
      assert.ok(clearCookieStr.toLowerCase().includes('secure'), 'Clear cookie must have Secure');
    }
  });

  // Test 6: a refresh racing a logout cannot leave an active token in the family
  it('a refresh racing a logout cannot leave an active token in the family', async () => {
    const testUser = await adminPrisma.user.create({
      data: {
        email: `race-${Date.now()}@test.com`,
        googleSub: `sub-race-${Date.now()}`,
        fullName: 'Race Test User',
      },
    });

    const familyId = crypto.randomUUID();
    const rawToken = generateRefreshToken();

    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(rawToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Fire refresh and logout concurrently
    const [refreshResult, logoutResult] = await Promise.allSettled([
      authService.refreshTokens(rawToken),
      authService.logout(rawToken),
    ]);

    // Logout should always succeed
    assert.strictEqual(logoutResult.status, 'fulfilled');

    // Query all tokens belonging to the family in the database
    const allFamilyTokens = await adminPrisma.refreshToken.findMany({
      where: { familyId },
    });

    // Verify that NO token in this family remains active
    const activeTokens = allFamilyTokens.filter((t) => t.revokedAt === null);
    assert.strictEqual(
      activeTokens.length,
      0,
      'No active tokens may remain in the family after a refresh racing a logout'
    );

    // If refresh returned a new token before logout processed, trying to use it must now fail
    if (refreshResult.status === 'fulfilled') {
      const rotatedRawToken = refreshResult.value.refreshToken;
      await assert.rejects(
        () => authService.refreshTokens(rotatedRawToken),
        /all sessions revoked|concurrently|Invalid refresh token/
      );
    }

    // Cleanup
    await adminPrisma.user.delete({ where: { id: testUser.id } });
  });
});

describe('Task 6: X-Client-Platform Header Enforcement & CORS Preflight Suite', () => {
  it('1. POST /auth/refresh without X-Client-Platform returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.title, 'Bad Request');
    assert.match(res.body.detail, /X-Client-Platform/);
  });

  it('2. POST /auth/logout without X-Client-Platform returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .send({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.title, 'Bad Request');
    assert.match(res.body.detail, /X-Client-Platform/);
  });

  it('3. POST /auth/refresh with invalid X-Client-Platform returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'desktop')
      .send({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.title, 'Bad Request');
    assert.match(res.body.detail, /Expected "web" or "mobile"/);
  });

  it('4. POST /auth/logout with invalid X-Client-Platform returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'curl_script')
      .send({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.title, 'Bad Request');
    assert.match(res.body.detail, /Expected "web" or "mobile"/);
  });

  it('5. POST /auth/refresh with valid X-Client-Platform (web / mobile) passes header check', async () => {
    // web: should pass header check (then fails with 401 Missing refresh token, proving header was accepted)
    const webRes = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .send({});
    assert.strictEqual(webRes.status, 401);
    assert.strictEqual(webRes.body.title, 'Unauthorized');

    // mobile: should also pass header check
    const mobileRes = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .send({});
    assert.strictEqual(mobileRes.status, 401);
    assert.strictEqual(mobileRes.body.title, 'Unauthorized');
  });

  it('6. POST /auth/logout with valid X-Client-Platform (web / mobile) passes header check and returns 204', async () => {
    const webRes = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web');
    assert.strictEqual(webRes.status, 204);

    const mobileRes = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'mobile');
    assert.strictEqual(mobileRes.status, 204);
  });

  it('7. CORS preflight OPTIONS to /auth/refresh from allowed origin allows X-Client-Platform', async () => {
    const res = await request(app)
      .options('/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, X-Client-Platform');

    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
    assert.ok(allowedHeaders.includes('x-client-platform'), 'CORS preflight must allow X-Client-Platform');
  });

  it('8. CORS preflight OPTIONS to /auth/logout from allowed origin allows X-Client-Platform', async () => {
    const res = await request(app)
      .options('/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, X-Client-Platform');

    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
    assert.ok(allowedHeaders.includes('x-client-platform'), 'CORS preflight must allow X-Client-Platform');
  });

  it('9. CORS preflight OPTIONS from unauthorized origin is rejected', async () => {
    const res = await request(app)
      .options('/auth/refresh')
      .set('Origin', 'https://malicious-attacker.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, X-Client-Platform');

    // CORS middleware does not set Access-Control-Allow-Origin for unauthorized origins
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
  });
});

