import { prisma as defaultPrisma } from '../index';
import { config } from '../config';
import { logger } from '../lib/logger';

/**
 * Periodically purges notification_jobs rows in COMPLETED or ARCHIVED state
 * older than the retention threshold (default 7 days).
 *
 * Requirements:
 * - Only eligible COMPLETED and ARCHIVED jobs older than cutoff are deleted.
 * - Pending, processing, retryable, and dead-letter (FAILED) jobs are preserved.
 * - Deletions are chunked in batches to prevent transaction bloat and DB lock contention.
 * - Safe to execute repeatedly and idempotently.
 */
export async function processNotificationJobsRetention(
  prismaClient?: any,
  retentionDaysOverride?: number,
  batchSizeOverride?: number
): Promise<number> {
  const prisma = prismaClient || defaultPrisma;
  const days = retentionDaysOverride ?? (config as any).NOTIFICATION_JOBS_RETENTION_DAYS ?? 7;
  const batchSize = batchSizeOverride ?? (config as any).NOTIFICATION_JOBS_PURGE_BATCH_SIZE ?? 500;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let totalDeleted = 0;

  try {
    while (true) {
      // 1. Fetch IDs of eligible COMPLETED or ARCHIVED jobs older than cutoff in small chunks
      const eligibleJobs: Array<{ id: string }> = await prisma.notificationJob.findMany({
        where: {
          status: {
            in: ['COMPLETED', 'ARCHIVED'],
          },
          updatedAt: {
            lt: cutoffDate,
          },
        },
        select: { id: true },
        take: batchSize,
      });

      if (!eligibleJobs || eligibleJobs.length === 0) {
        break;
      }

      const jobIds = eligibleJobs.map((j) => j.id);

      // 2. Delete the selected chunk in a fast, targeted operation
      const deleted = await prisma.notificationJob.deleteMany({
        where: {
          id: {
            in: jobIds,
          },
        },
      });

      totalDeleted += deleted.count;

      logger.info(
        { batchDeleted: deleted.count, totalDeletedSoFar: totalDeleted, cutoffDate },
        '🧹 Purged batch of expired notification_jobs'
      );

      // If fewer records than batchSize were found, all eligible records have been purged
      if (eligibleJobs.length < batchSize) {
        break;
      }
    }

    if (totalDeleted > 0) {
      logger.info({ totalDeleted, cutoffDate }, '✅ Finished notification_jobs retention sweep');
    }

    return totalDeleted;
  } catch (err: any) {
    logger.error(
      { error: { failure_reason: 'NotificationJobsRetentionPurgeError', stack: err.stack }, totalDeletedBeforeError: totalDeleted },
      '❌ Error purging expired notification jobs'
    );
    return totalDeleted;
  }
}
