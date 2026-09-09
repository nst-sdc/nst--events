import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  createMobileAuthCode,
  redeemMobileAuthCode,
} from '../../src/modules/auth/mobile-auth-codes';
import { AuthTokenResponse } from '../../src/modules/auth/auth.service';
import { prisma } from '../../src/lib/prisma';

function makeFakeAuthResult(): AuthTokenResponse {
  return {
    access_token: `at_${crypto.randomBytes(16).toString('hex')}`,
    expires_in: 900,
    refreshToken: `rt_${crypto.randomBytes(16).toString('hex')}`,
  };
}

describe('Mobile Auth Codes (DB-backed)', () => {
  it('should create and redeem a valid code', async () => {
    const result = makeFakeAuthResult();
    const code = await createMobileAuthCode(result);

    assert.strictEqual(typeof code, 'string');
    assert.strictEqual(code.length, 64); // 32 bytes = 64 hex chars

    const redeemed = await redeemMobileAuthCode(code);
    assert.ok(redeemed, 'Redeemed result should not be null');
    assert.strictEqual(redeemed!.access_token, result.access_token);
    assert.strictEqual(redeemed!.refreshToken, result.refreshToken);
    assert.strictEqual(redeemed!.expires_in, result.expires_in);
  });

  it('should reject a code on second use (single-use, verifies row was consumed)', async () => {
    const result = makeFakeAuthResult();
    const code = await createMobileAuthCode(result);

    // Verify row exists before redemption
    const beforeRow = await prisma.mobileAuthCode.findUnique({ where: { code } });
    assert.ok(beforeRow, 'Row must exist in database before redemption');

    // First use succeeds and consumes the row
    const first = await redeemMobileAuthCode(code);
    assert.ok(first, 'First redemption should succeed');
    assert.strictEqual(first!.access_token, result.access_token);

    // Verify row is physically deleted from database (consumed)
    const afterRow = await prisma.mobileAuthCode.findUnique({ where: { code } });
    assert.strictEqual(afterRow, null, 'Row must be deleted after redemption');

    // Second use fails specifically because it was already consumed
    const second = await redeemMobileAuthCode(code);
    assert.strictEqual(second, null, 'Second redemption of already-consumed code should return null');
  });

  it('should reject a code that exists but has expired', async () => {
    const result = makeFakeAuthResult();
    const expiredCode = crypto.randomBytes(32).toString('hex');
    
    // Insert an expired code row directly
    await prisma.mobileAuthCode.create({
      data: {
        code: expiredCode,
        payload: result as any,
        expiresAt: new Date(Date.now() - 5000), // expired 5 seconds ago
      },
    });

    const redeemed = await redeemMobileAuthCode(expiredCode);
    assert.strictEqual(redeemed, null, 'Expired code must return null on redemption attempt');

    // Clean up
    await prisma.mobileAuthCode.deleteMany({ where: { code: expiredCode } });
  });

  it('should reject an unknown code (never existed)', async () => {
    const unknownCode = crypto.randomBytes(32).toString('hex');
    const result = await redeemMobileAuthCode(unknownCode);
    assert.strictEqual(result, null, 'Unknown code should return null');
  });

  it('should reject an empty string code', async () => {
    const result = await redeemMobileAuthCode('');
    assert.strictEqual(result, null, 'Empty code should return null');
  });

  it('should create unique codes for the same auth result', async () => {
    const result = makeFakeAuthResult();
    const code1 = await createMobileAuthCode(result);
    const code2 = await createMobileAuthCode(result);
    assert.notStrictEqual(code1, code2, 'Each code should be unique');
  });
});

