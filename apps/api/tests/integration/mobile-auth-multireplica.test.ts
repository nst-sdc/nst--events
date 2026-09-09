import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/app';
import { createMobileAuthCode } from '../../src/modules/auth/mobile-auth-codes';
import { prisma } from '../../src/lib/prisma';
import { AuthTokenResponse } from '../../src/modules/auth/auth.service';

function makeFakeAuthResult(): AuthTokenResponse {
  return {
    access_token: `at_${crypto.randomBytes(16).toString('hex')}`,
    expires_in: 900,
    refreshToken: `rt_${crypto.randomBytes(16).toString('hex')}`,
  };
}

describe('Auth: Multi-Replica Mobile Code Exchange', () => {
  // Simulate two separate API replica instances
  const replicaA = createApp();
  const replicaB = createApp();

  it('cross-replica exchange: created on Replica A, redeemed on Replica B', async () => {
    const authResult = makeFakeAuthResult();

    // 1. Code is generated on Replica A
    const code = await createMobileAuthCode(authResult);
    assert.strictEqual(typeof code, 'string');
    assert.strictEqual(code.length, 64);

    // Verify row exists in DB prior to redemption
    const rowBefore = await prisma.mobileAuthCode.findUnique({ where: { code } });
    assert.ok(rowBefore, 'Auth code row must exist in PostgreSQL before exchange');

    // 2. Client sends code to Replica B for exchange
    const resB = await request(replicaB)
      .post('/auth/mobile/exchange')
      .set('X-App-Version', '1.0.0')
      .send({ code })
      .expect('Content-Type', /json/);

    assert.strictEqual(resB.status, 200, `Expected 200 OK from Replica B, got ${resB.status}: ${JSON.stringify(resB.body)}`);
    assert.strictEqual(resB.body.access_token, authResult.access_token);
    assert.strictEqual(resB.body.refresh_token, authResult.refreshToken);
    assert.strictEqual(resB.body.expires_in, authResult.expires_in);

    // 3. Confirm row is physically consumed (deleted) in DB
    const rowAfter = await prisma.mobileAuthCode.findUnique({ where: { code } });
    assert.strictEqual(rowAfter, null, 'Auth code row must be deleted from PostgreSQL upon first redemption');

    // 4. Step 7 verification: Re-redeem the same code on Replica B -> 401 Unauthorized
    // This specifically exercises the "already consumed" path
    const replayResB = await request(replicaB)
      .post('/auth/mobile/exchange')
      .set('X-App-Version', '1.0.0')
      .send({ code });

    assert.strictEqual(replayResB.status, 401, 'Re-redemption of consumed code must return 401');
    assert.strictEqual(
      replayResB.body.detail,
      'Invalid, expired, or already-used authorization code'
    );

    // 5. Re-redeem on Replica A also fails with 401
    const replayResA = await request(replicaA)
      .post('/auth/mobile/exchange')
      .set('X-App-Version', '1.0.0')
      .send({ code });

    assert.strictEqual(replayResA.status, 401, 'Re-redemption of consumed code on Replica A must also return 401');
  });

  it('differentiates expired code (row exists in DB but expired) from already-consumed code', async () => {
    const authResult = makeFakeAuthResult();
    const expiredCode = crypto.randomBytes(32).toString('hex');

    // Insert an expired code directly into the database
    await prisma.mobileAuthCode.create({
      data: {
        code: expiredCode,
        payload: authResult as any,
        expiresAt: new Date(Date.now() - 5000), // expired 5 seconds ago
      },
    });

    // Verify row exists in DB before redemption attempt
    const rowBefore = await prisma.mobileAuthCode.findUnique({ where: { code: expiredCode } });
    assert.ok(rowBefore, 'Expired row exists in DB prior to redemption attempt');

    // Exchange attempt on Replica B fails with 401
    const res = await request(replicaB)
      .post('/auth/mobile/exchange')
      .set('X-App-Version', '1.0.0')
      .send({ code: expiredCode });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(
      res.body.detail,
      'Invalid, expired, or already-used authorization code'
    );

    // Verify row STILL exists in DB (because DELETE ... WHERE expires_at > now() does NOT match it)
    // Proves that expired codes are rejected without premature deletion
    const rowAfter = await prisma.mobileAuthCode.findUnique({ where: { code: expiredCode } });
    assert.ok(rowAfter, 'Expired row still exists in DB because WHERE expires_at > now() skipped it');

    // Clean up
    await prisma.mobileAuthCode.deleteMany({ where: { code: expiredCode } });
  });

  it('rejects a code that never existed in the database', async () => {
    const nonExistentCode = crypto.randomBytes(32).toString('hex');

    const res = await request(replicaB)
      .post('/auth/mobile/exchange')
      .set('X-App-Version', '1.0.0')
      .send({ code: nonExistentCode });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(
      res.body.detail,
      'Invalid, expired, or already-used authorization code'
    );
  });
});
