import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { OAUTH_STATE_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '../../src/lib/cookies';
import { OAUTH_NONCE_COOKIE_NAME } from '../../src/modules/auth/auth.router';
import { env } from '../../src/config/env';
import cookieSignature from 'cookie-signature';
import { googleOAuth } from '../../src/modules/auth/google.oauth';
import sinon from 'sinon';

test('OAuth Callback & Hardening Tests', async (t) => {
  const app = createApp();

  const mockState = 'test_state_123';
  const mockNonce = 'test_nonce_456';
  // Express signed cookies require prefix 's:' + signature
  const signedStateCookie = `s:${cookieSignature.sign(mockState, env.COOKIE_SECRET)}`;
  const signedNonceCookie = `s:${cookieSignature.sign(mockNonce, env.COOKIE_SECRET)}`;

  t.afterEach(() => {
    sinon.restore();
  });

  await t.test('GET /auth/google generates auth URL containing prompt=select_account and nonce, setting signed HttpOnly cookies', async () => {
    const res = await request(app).get('/auth/google');

    assert.strictEqual(res.status, 302, 'Should return HTTP 302 redirect to Google OAuth');
    const location = res.header.location;
    assert.ok(location, 'Location header must be present');
    assert.ok(location.includes('prompt=select_account'), 'Auth URL must contain prompt=select_account');
    assert.ok(location.includes('nonce='), 'Auth URL must contain nonce parameter');
    assert.ok(location.includes('state='), 'Auth URL must contain state parameter');
    assert.ok(location.includes('access_type=offline'), 'Auth URL must contain access_type=offline');

    const setCookies: string[] = res.header['set-cookie'] || [];
    const hasStateCookie = setCookies.some((c) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`) && c.includes('HttpOnly'));
    const hasNonceCookie = setCookies.some((c) => c.startsWith(`${OAUTH_NONCE_COOKIE_NAME}=`) && c.includes('HttpOnly'));

    assert.ok(hasStateCookie, 'Should set signed HttpOnly oauth_state cookie');
    assert.ok(hasNonceCookie, 'Should set signed HttpOnly oauth_nonce cookie');
  });

  await t.test('Successful callback establishes session and redirects to WEB_APP_URL/dashboard for faculty mentor', async () => {
    const googleSub = `sub-redirect-${Date.now()}`;
    const testEmail = `redirect-${Date.now()}@newtonschool.co`;

    // Stub Google API verifications
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_id_token' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: googleSub,
      email: testEmail,
      name: 'Redirect Test User',
      nonce: mockNonce,
    });

    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Cookie', [
        `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`,
        `${OAUTH_NONCE_COOKIE_NAME}=${signedNonceCookie}`,
      ]);

    assert.strictEqual(res.status, 303, 'Should return HTTP 303 See Other');
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/dashboard`);

    // Ensure access/refresh tokens are NOT in the location
    assert.ok(!res.header.location.includes('access_token'));
    assert.ok(!res.header.location.includes('refresh_token'));
    assert.ok(!res.header.location.includes('refreshToken'));

    // Validate set-cookie headers
    const setCookies: string[] = res.header['set-cookie'] || [];
    const hasRefreshTokenCookie = setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`) && c.includes('HttpOnly'));
    assert.ok(hasRefreshTokenCookie, 'Should establish HttpOnly refresh token cookie');

    const hasUserRoleCookie = setCookies.some((c) => c.startsWith('user_role=') && c.includes('FACULTY_MENTOR'));
    assert.ok(hasUserRoleCookie, 'Should set user_role cookie for Next.js route guarding');

    // Validate both state and nonce cookies are cleared
    const hasClearStateCookie = setCookies.some((c) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=;`) || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    assert.ok(hasClearStateCookie, 'Should clear the OAuth state cookie');

    const hasClearNonceCookie = setCookies.some((c) => c.startsWith(`${OAUTH_NONCE_COOKIE_NAME}=;`) || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    assert.ok(hasClearNonceCookie, 'Should clear the OAuth nonce cookie');

    // Clean up
    await adminPrisma.user.deleteMany({ where: { email: testEmail } });
  });

  await t.test('Successful callback establishes session and redirects to WEB_APP_URL/student/home for student', async () => {
    const googleSub = `sub-student-${Date.now()}`;
    const testEmail = `s${Date.now()}@adypu.edu.in`;

    // Authorize student in directory
    await adminPrisma.authorizedStudent.create({
      data: {
        normalizedEmail: testEmail,
        status: 'ACTIVE',
      },
    });

    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_student_id_token' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: googleSub,
      email: testEmail,
      name: 'Student Redirect User',
      nonce: mockNonce,
    });

    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Cookie', [
        `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`,
        `${OAUTH_NONCE_COOKIE_NAME}=${signedNonceCookie}`,
      ]);

    assert.strictEqual(res.status, 303, 'Should return HTTP 303 See Other');
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/student/home`, 'Students must land on /student/home');

    const setCookies: string[] = res.header['set-cookie'] || [];
    const hasRefreshTokenCookie = setCookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`) && c.includes('HttpOnly'));
    assert.ok(hasRefreshTokenCookie, 'Should establish HttpOnly refresh token cookie');

    const hasUserRoleCookie = setCookies.some((c) => c.startsWith('user_role=') && c.includes('STUDENT'));
    assert.ok(hasUserRoleCookie, 'Should set user_role=STUDENT cookie for server-side route guarding');

    // Validate both state and nonce cookies are cleared
    const hasClearStateCookie = setCookies.some((c) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=;`) || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    assert.ok(hasClearStateCookie, 'Should clear the OAuth state cookie');

    const hasClearNonceCookie = setCookies.some((c) => c.startsWith(`${OAUTH_NONCE_COOKIE_NAME}=;`) || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    assert.ok(hasClearNonceCookie, 'Should clear the OAuth nonce cookie');

    // Clean up
    await adminPrisma.user.deleteMany({ where: { email: testEmail } });
    await adminPrisma.authorizedStudent.deleteMany({ where: { normalizedEmail: testEmail } });
  });

  await t.test('Failed callback (missing nonce cookie) rejects and clears cookies', async () => {
    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Cookie', `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`);

    assert.strictEqual(res.status, 303, 'Should return HTTP 303 See Other on missing nonce');
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/login?error=authentication_failed`);

    const setCookies: string[] = res.header['set-cookie'] || [];
    const hasClearNonceCookie = setCookies.some((c) => c.startsWith(`${OAUTH_NONCE_COOKIE_NAME}=;`) || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    assert.ok(hasClearNonceCookie, 'Should clear the OAuth nonce cookie on failure');
  });

  await t.test('Failed callback (mismatched nonce) rejects and clears cookies', async () => {
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_id_token' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: 'google-sub-mismatch',
      email: 'mismatch@newtonschool.co',
      name: 'Mismatch User',
      nonce: 'tampered_or_different_nonce',
    });

    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Cookie', [
        `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`,
        `${OAUTH_NONCE_COOKIE_NAME}=${signedNonceCookie}`,
      ]);

    assert.strictEqual(res.status, 303, 'Should return HTTP 303 on mismatched nonce');
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/login?error=authentication_failed`);

    const setCookies: string[] = res.header['set-cookie'] || [];
    const hasClearNonceCookie = setCookies.some((c) => c.startsWith(`${OAUTH_NONCE_COOKIE_NAME}=;`) || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    assert.ok(hasClearNonceCookie, 'Should clear the OAuth nonce cookie on mismatch');
  });

  await t.test('Failed callback (missing payload nonce) rejects', async () => {
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_id_token' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: 'google-sub-no-nonce',
      email: 'nononce@newtonschool.co',
      name: 'No Nonce User',
      // nonce is omitted
    });

    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Cookie', [
        `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`,
        `${OAUTH_NONCE_COOKIE_NAME}=${signedNonceCookie}`,
      ]);

    assert.strictEqual(res.status, 303);
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/login?error=authentication_failed`);
  });

  await t.test('Failed callback with Accept: application/json rejects with HTTP 401', async () => {
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').resolves({ id_token: 'mock_id_token' });
    sinon.stub(googleOAuth, 'verifyIdToken').resolves({
      sub: 'google-sub-mismatch',
      email: 'mismatch@newtonschool.co',
      name: 'Mismatch User',
      nonce: 'mismatched_nonce',
    });

    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Accept', 'application/json')
      .set('Cookie', [
        `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`,
        `${OAUTH_NONCE_COOKIE_NAME}=${signedNonceCookie}`,
      ]);

    assert.strictEqual(res.status, 401, 'Should return HTTP 401 when Accept: application/json is sent');
    assert.strictEqual(res.body.statusCode, 401);
  });

  await t.test('Failed callback (invalid state) redirects to WEB_APP_URL/login?error=...', async () => {
    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=wrong_state`)
      .set('Cookie', [
        `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`,
        `${OAUTH_NONCE_COOKIE_NAME}=${signedNonceCookie}`,
      ]);

    assert.strictEqual(res.status, 303, 'Should return HTTP 303 See Other on failure');
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/login?error=authentication_failed`);

    assert.ok(!res.header.location.includes('Invalid OAuth state parameter'), 'Should not expose raw error messages');
  });

  await t.test('Failed callback (missing Google tokens) redirects gracefully', async () => {
    sinon.stub(googleOAuth, 'exchangeCodeForTokens').rejects(new Error('Google API Error'));

    const res = await request(app)
      .get(`/auth/google/callback?code=mock_auth_code&state=${mockState}`)
      .set('Cookie', [
        `${OAUTH_STATE_COOKIE_NAME}=${signedStateCookie}`,
        `${OAUTH_NONCE_COOKIE_NAME}=${signedNonceCookie}`,
      ]);

    assert.strictEqual(res.status, 303);
    assert.strictEqual(res.header.location, `${env.WEB_APP_URL}/login?error=authentication_failed`);
  });

  await t.test('verifyIdToken unit check: rejects when expectedNonce is mismatched', async () => {
    const { OAuth2Client } = await import('google-auth-library');
    sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves({
      getPayload: () => ({
        sub: '12345',
        email: 'test@adypu.edu.in',
        name: 'Test',
        email_verified: true,
        nonce: 'actual_nonce',
      }),
    } as any);

    await assert.rejects(
      async () => {
        await googleOAuth.verifyIdToken('dummy_id_token', 'wrong_nonce');
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.message, 'Invalid or mismatched OAuth nonce');
        return true;
      }
    );
  });

  await t.test('verifyIdToken unit check: succeeds when expectedNonce matches payload nonce', async () => {
    const { OAuth2Client } = await import('google-auth-library');
    sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves({
      getPayload: () => ({
        sub: '12345',
        email: 'test@adypu.edu.in',
        name: 'Test',
        email_verified: true,
        nonce: 'correct_nonce',
      }),
    } as any);

    const user = await googleOAuth.verifyIdToken('dummy_id_token', 'correct_nonce');
    assert.strictEqual(user.sub, '12345');
    assert.strictEqual(user.email, 'test@adypu.edu.in');
    assert.strictEqual(user.nonce, 'correct_nonce');
  });
});
