import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { generateRefreshToken, hashToken } from '../../src/lib/hash';
import {
  REFRESH_TOKEN_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
} from '../../src/lib/cookies';
import { OAUTH_NONCE_COOKIE_NAME } from '../../src/modules/auth/auth.router';
import { env } from '../../src/config/env';

const app = createApp();
(app as any)._skipDefaultPlatformHeader = true;

describe('Task 8 Auth Verification: API Scenarios (3, 4, 6, 7)', () => {
  // Scenario 3: After logout: the refreshToken cookie is gone, DB refresh_tokens for the family are all revoked, and POST /auth/refresh with the old cookie returns 401.
  it('Scenario 3: After logout, refreshToken cookie is cleared, family rows revoked, and subsequent refresh returns 401', async () => {
    const testUser = await adminPrisma.user.create({
      data: {
        email: `scenario3-${Date.now()}@test.com`,
        googleSub: `sub-scenario3-${Date.now()}`,
        fullName: 'Scenario 3 User',
      },
    });

    const familyId = crypto.randomUUID();

    // 1. Create a parent token in the family (already rotated/revoked)
    const parentRawToken = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(parentRawToken),
        familyId,
        revokedAt: new Date(Date.now() - 3000),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 2. Create the currently active child token in the family
    const activeRawToken = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(activeRawToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 3. Dispatch POST /auth/logout with the active refreshToken cookie
    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${activeRawToken}`]);

    assert.strictEqual(logoutRes.status, 204, 'Logout must return 204 No Content');

    // 4. Assert Set-Cookie header clears the refreshToken cookie
    const setCookies: string[] = logoutRes.headers['set-cookie'] || [];
    const refreshClearCookie = setCookies.find((c: string) =>
      c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`)
    );
    assert.ok(refreshClearCookie, 'Response must include Set-Cookie clearing refreshToken');
    assert.ok(
      refreshClearCookie.includes('Max-Age=0') ||
        refreshClearCookie.includes('Expires=Thu, 01 Jan 1970'),
      'refreshToken cookie must be expired/cleared'
    );
    assert.ok(refreshClearCookie.toLowerCase().includes('path=/auth'), 'Clear cookie must match Path=/auth');
    assert.ok(refreshClearCookie.toLowerCase().includes('httponly'), 'Clear cookie must be HttpOnly');
    assert.ok(refreshClearCookie.toLowerCase().includes('samesite=strict'), 'Clear cookie must be SameSite=Strict');

    // 5. Assert DB refresh_tokens for the entire family are ALL revoked
    const familyRows = await adminPrisma.refreshToken.findMany({
      where: { familyId },
    });
    assert.strictEqual(familyRows.length, 2, 'Family must have 2 records');
    for (const row of familyRows) {
      assert.ok(row.revokedAt !== null, `Token row ${row.id} in family must be revoked`);
    }

    // 6. Assert subsequent POST /auth/refresh with the old cookie returns 401
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${activeRawToken}`]);

    assert.strictEqual(refreshRes.status, 401, 'Subsequent refresh with revoked token must return 401');

    // Cleanup
    await adminPrisma.user.delete({ where: { id: testUser.id } });
  });

  // Scenario 4: Logout with an expired access token still revokes.
  it('Scenario 4: Logout with an expired access token still revokes the session family', async () => {
    const testUser = await adminPrisma.user.create({
      data: {
        email: `scenario4-${Date.now()}@test.com`,
        googleSub: `sub-scenario4-${Date.now()}`,
        fullName: 'Scenario 4 User',
      },
    });

    const familyId = crypto.randomUUID();
    const rawRefreshToken = generateRefreshToken();

    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(rawRefreshToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Generate an expired access token (expired 15 minutes ago)
    const expiredAccessToken = jwt.sign(
      { sub: testUser.id, secVer: testUser.securityVersion },
      env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '-15m' }
    );

    // Dispatch POST /auth/logout with expired Bearer token and valid refresh cookie
    const res = await request(app)
      .post('/auth/logout')
      .set('X-Client-Platform', 'web')
      .set('Authorization', `Bearer ${expiredAccessToken}`)
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${rawRefreshToken}`]);

    assert.strictEqual(res.status, 204, 'Logout must succeed with 204 even with expired access token');

    // Verify DB token was revoked
    const tokenRow = await adminPrisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(rawRefreshToken) },
    });
    assert.ok(tokenRow, 'Token row must exist');
    assert.ok(tokenRow.revokedAt !== null, 'Refresh token must be revoked despite expired access token');

    // Cleanup
    await adminPrisma.user.delete({ where: { id: testUser.id } });
  });

  // Scenario 6: Replay a rotated refresh token after >5s -> family revoked.
  it('Scenario 6: Replay a rotated refresh token after >5s revokes all tokens in family and child token is blocked', async () => {
    const testUser = await adminPrisma.user.create({
      data: {
        email: `scenario6-${Date.now()}@test.com`,
        googleSub: `sub-scenario6-${Date.now()}`,
        fullName: 'Scenario 6 User',
      },
    });

    const familyId = crypto.randomUUID();

    // 1. Parent token was rotated and revoked 8 seconds ago (> 5 seconds window)
    const parentRawToken = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(parentRawToken),
        familyId,
        revokedAt: new Date(Date.now() - 8000),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 2. Active child token was created during that rotation
    const activeChildToken = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(activeChildToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 3. Attacker replays the parent token (>5s after rotation)
    const replayRes = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${parentRawToken}`]);

    assert.strictEqual(replayRes.status, 401, 'Replay after >5s must be rejected with 401');
    assert.ok(
      replayRes.body.detail?.toLowerCase().includes('reuse') ||
        replayRes.body.error?.toLowerCase().includes('reuse') ||
        replayRes.body.message?.toLowerCase().includes('reuse'),
      'Error detail should indicate token reuse detection'
    );

    // 4. Assert that every row in the family in DB now has revoked_at NOT NULL
    const familyRows = await adminPrisma.refreshToken.findMany({
      where: { familyId },
    });
    assert.strictEqual(familyRows.length, 2, 'Family must have 2 records');
    for (const row of familyRows) {
      assert.ok(row.revokedAt !== null, `Row ${row.id} in family must be revoked in DB`);
    }

    // 5. Assert the legitimate child token of the revoked family can no longer refresh
    const childRefreshRes = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${activeChildToken}`]);

    assert.strictEqual(childRefreshRes.status, 401, 'Child token of revoked family must be rejected with 401');

    // Cleanup
    await adminPrisma.user.delete({ where: { id: testUser.id } });
  });

  // Replay within 5s grace window does NOT revoke the family
  it('Replay within 5s grace window returns 401 without revoking family or child token', async () => {
    const testUser = await adminPrisma.user.create({
      data: {
        email: `grace-${Date.now()}@test.com`,
        googleSub: `sub-grace-${Date.now()}`,
        fullName: 'Grace Period User',
      },
    });

    const familyId = crypto.randomUUID();

    // 1. Parent token rotated 2 seconds ago (within 5-second grace window)
    const parentRawToken = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(parentRawToken),
        familyId,
        revokedAt: new Date(Date.now() - 2000),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 2. Active child token
    const activeChildToken = generateRefreshToken();
    await adminPrisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(activeChildToken),
        familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 3. Replay parent token within 5s
    const replayRes = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${parentRawToken}`]);

    assert.strictEqual(replayRes.status, 401);
    assert.ok(
      replayRes.body.detail?.includes('concurrently') ||
        replayRes.body.message?.includes('concurrently'),
      'Should report concurrent usage'
    );

    // 4. Verify child token was NOT revoked in DB
    const childRow = await adminPrisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(activeChildToken) },
    });
    assert.ok(childRow);
    assert.strictEqual(childRow.revokedAt, null, 'Child token must NOT be revoked during benign race');

    // 5. Verify child token can still refresh successfully
    const childRefreshRes = await request(app)
      .post('/auth/refresh')
      .set('X-Client-Platform', 'web')
      .set('Cookie', [`${REFRESH_TOKEN_COOKIE_NAME}=${activeChildToken}`]);

    assert.strictEqual(childRefreshRes.status, 200, 'Legitimate child token must still work');
    assert.ok(childRefreshRes.body.access_token);

    // Cleanup
    await adminPrisma.user.delete({ where: { id: testUser.id } });
  });

  // Scenario 7: Google auth URL has prompt=select_account and nonce.
  it('Scenario 7: GET /auth/google generates auth URL containing prompt=select_account and nonce with signed HttpOnly cookies', async () => {
    const res = await request(app).get('/auth/google');

    assert.strictEqual(res.status, 302, 'Should return HTTP 302 redirect to Google OAuth');
    const location = res.header.location;
    assert.ok(location, 'Location header must be present');

    // Parse URL params
    const authUrl = new URL(location);
    assert.strictEqual(authUrl.searchParams.get('prompt'), 'select_account', 'URL must include prompt=select_account');
    assert.ok(authUrl.searchParams.get('nonce'), 'URL must include nonce parameter');
    assert.ok(authUrl.searchParams.get('state'), 'URL must include state parameter');
    assert.strictEqual(authUrl.searchParams.get('access_type'), 'offline', 'URL must include access_type=offline');

    // Verify signed HttpOnly cookies
    const setCookies: string[] = res.header['set-cookie'] || [];
    const stateCookie = setCookies.find((c) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`));
    const nonceCookie = setCookies.find((c) => c.startsWith(`${OAUTH_NONCE_COOKIE_NAME}=`));

    assert.ok(stateCookie, 'Should set oauth_state cookie');
    assert.ok(stateCookie.toLowerCase().includes('httponly'), 'oauth_state cookie must be HttpOnly');
    assert.ok(nonceCookie, 'Should set oauth_nonce cookie');
    assert.ok(nonceCookie.toLowerCase().includes('httponly'), 'oauth_nonce cookie must be HttpOnly');
  });
});
