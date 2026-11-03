import { prisma as defaultPrisma } from '../index';
import { config } from '../config';
import { logger } from '../lib/logger';

/**
 * Periodically purges auth_events rows older than the retention threshold (default 90 days).
 */
export async function processAuthEventsRetention(
  prismaClient?: any,
  retentionDaysOverride?: number
): Promise<number> {
  const prisma = prismaClient || defaultPrisma;
  const days = retentionDaysOverride ?? config.AUTH_EVENTS_RETENTION_DAYS;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const deleted = await prisma.authEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    if (deleted.count > 0) {
      logger.info({ count: deleted.count, cutoffDate }, '🧹 Purged expired auth_events');
    }
    return deleted.count;
  } catch (err: any) {
    logger.error(
      { error: { failure_reason: 'AuthEventsRetentionPurgeError', stack: err.stack } },
      '❌ Error purging expired auth events'
    );
    return 0;
  }
}
