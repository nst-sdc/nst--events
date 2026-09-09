import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { AuthTokenResponse } from './auth.service';

const CODE_TTL_MS = 60_000; // 60 seconds
const CLEANUP_INTERVAL_MS = 30_000; // sweep every 30s

// Periodic cleanup of unredeemed expired codes across all replicas
// .unref() prevents this timer from keeping the process alive during graceful shutdown
setInterval(async () => {
  try {
    await prisma.mobileAuthCode.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });
  } catch {
    // Suppress background cleanup failures during transient DB disconnects
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Create a cryptographically random single-use authorization code
 * and store the AuthTokenResponse in PostgreSQL for 60 seconds.
 */
export async function createMobileAuthCode(result: AuthTokenResponse): Promise<string> {
  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.mobileAuthCode.create({
    data: {
      code,
      payload: result as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
  });

  return code;
}

/**
 * Redeem a single-use mobile authorization code.
 * Atomically deletes and returns the associated AuthTokenResponse if the code is valid and not expired.
 * Returns null if the code is invalid, expired, or already used.
 */
export async function redeemMobileAuthCode(code: string): Promise<AuthTokenResponse | null> {
  if (!code || typeof code !== 'string') return null;

  const deletedRows = await prisma.$queryRaw<Array<{ payload: AuthTokenResponse | string }>>`
    DELETE FROM mobile_auth_codes
    WHERE code = ${code} AND expires_at > now()
    RETURNING payload
  `;

  if (!deletedRows || deletedRows.length === 0) {
    return null;
  }

  const payload = deletedRows[0].payload;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as AuthTokenResponse;
    } catch {
      return null;
    }
  }

  return payload as AuthTokenResponse;
}
