import { prisma as defaultPrisma } from '../index';
import { logger } from '../lib/logger';

/**
 * Periodically purges expired rows from rate_limit_overrides.
 */
export async function processRateLimitOverridesPurge(prismaClient?: any): Promise<number> {
  const prisma = prismaClient || defaultPrisma;
  try {
    const deleted = await prisma.rateLimitOverride.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (deleted.count > 0) {
      logger.info({ count: deleted.count }, '🧹 Purged expired rate limit overrides');
    }
    return deleted.count;
  } catch (err: any) {
    logger.error(
      { error: { failure_reason: 'RateLimitOverridesPurgeError', stack: err.stack } },
      '❌ Error purging expired rate limit overrides'
    );
    return 0;
  }
}
