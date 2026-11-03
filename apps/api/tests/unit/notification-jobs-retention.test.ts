import { describe, it } from 'node:test';
import assert from 'node:assert';
import { processNotificationJobsRetention } from '../../../worker/src/jobs/notification-jobs-retention';

describe('Notification Jobs Retention & Sweep Unit Tests', () => {
  it('1. Purges only COMPLETED and ARCHIVED jobs older than retention threshold', async () => {
    const cutoffThresholdDays = 7;
    const now = Date.now();
    const oldTimestamp = new Date(now - 10 * 24 * 60 * 60 * 1000);
    const recentTimestamp = new Date(now - 2 * 24 * 60 * 60 * 1000);

    const memoryDb = [
      // Eligible for purge
      { id: 'job-1', status: 'COMPLETED', updatedAt: oldTimestamp },
      { id: 'job-2', status: 'ARCHIVED', updatedAt: oldTimestamp },
      // Too recent (must be preserved)
      { id: 'job-3', status: 'COMPLETED', updatedAt: recentTimestamp },
      { id: 'job-4', status: 'ARCHIVED', updatedAt: recentTimestamp },
      // Other statuses (must NEVER be deleted, even if old)
      { id: 'job-5', status: 'PENDING', updatedAt: oldTimestamp },
      { id: 'job-6', status: 'PROCESSING', updatedAt: oldTimestamp },
      { id: 'job-7', status: 'WAITING_FOR_RECEIPTS', updatedAt: oldTimestamp },
      { id: 'job-8', status: 'RETRY_PENDING', updatedAt: oldTimestamp },
      { id: 'job-9', status: 'FAILED', updatedAt: oldTimestamp }, // Dead letter
    ];

    const mockPrisma = {
      notificationJob: {
        findMany: async ({ where, select, take }: any) => {
          return memoryDb
            .filter((j) => {
              const matchesStatus = where.status.in.includes(j.status);
              const matchesTime = j.updatedAt.getTime() < where.updatedAt.lt.getTime();
              return matchesStatus && matchesTime;
            })
            .slice(0, take)
            .map((j) => ({ id: j.id }));
        },
        deleteMany: async ({ where }: any) => {
          const idsToDelete = new Set(where.id.in);
          const initialLen = memoryDb.length;
          for (let i = memoryDb.length - 1; i >= 0; i--) {
            if (idsToDelete.has(memoryDb[i].id)) {
              memoryDb.splice(i, 1);
            }
          }
          return { count: initialLen - memoryDb.length };
        },
      },
    };

    const count = await processNotificationJobsRetention(mockPrisma, cutoffThresholdDays, 500);

    assert.strictEqual(count, 2, 'Should purge exactly 2 eligible jobs');
    assert.strictEqual(memoryDb.length, 7, 'Remaining DB should have 7 jobs');

    const remainingIds = memoryDb.map((j) => j.id);
    assert.ok(!remainingIds.includes('job-1'), 'job-1 should be purged');
    assert.ok(!remainingIds.includes('job-2'), 'job-2 should be purged');

    assert.ok(remainingIds.includes('job-3'), 'Recent COMPLETED job must be preserved');
    assert.ok(remainingIds.includes('job-4'), 'Recent ARCHIVED job must be preserved');
    assert.ok(remainingIds.includes('job-5'), 'Old PENDING job must be preserved');
    assert.ok(remainingIds.includes('job-6'), 'Old PROCESSING job must be preserved');
    assert.ok(remainingIds.includes('job-7'), 'Old WAITING_FOR_RECEIPTS job must be preserved');
    assert.ok(remainingIds.includes('job-8'), 'Old RETRY_PENDING job must be preserved');
    assert.ok(remainingIds.includes('job-9'), 'Old dead-letter FAILED job must be preserved');
  });

  it('2. Deletes large volumes in controlled chunked batches', async () => {
    const oldTimestamp = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const totalJobs = 13;
    const batchSize = 5;

    const memoryDb = Array.from({ length: totalJobs }, (_, i) => ({
      id: `job-${i + 1}`,
      status: 'COMPLETED',
      updatedAt: oldTimestamp,
    }));

    const batchCalls: number[] = [];

    const mockPrisma = {
      notificationJob: {
        findMany: async ({ where, take }: any) => {
          return memoryDb
            .filter((j) => where.status.in.includes(j.status) && j.updatedAt < where.updatedAt.lt)
            .slice(0, take)
            .map((j) => ({ id: j.id }));
        },
        deleteMany: async ({ where }: any) => {
          const idsToDelete = new Set(where.id.in);
          batchCalls.push(idsToDelete.size);
          for (let i = memoryDb.length - 1; i >= 0; i--) {
            if (idsToDelete.has(memoryDb[i].id)) {
              memoryDb.splice(i, 1);
            }
          }
          return { count: idsToDelete.size };
        },
      },
    };

    const count = await processNotificationJobsRetention(mockPrisma, 7, batchSize);

    assert.strictEqual(count, 13, 'Total purged count should match 13');
    assert.strictEqual(memoryDb.length, 0, 'Database should be completely drained of expired jobs');
    // Batches of 5, 5, 3
    assert.deepStrictEqual(batchCalls, [5, 5, 3], 'Should delete in chunks matching batch size');
  });

  it('3. Safely handles empty records idempotently without errors', async () => {
    const mockPrisma = {
      notificationJob: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
      },
    };

    const count = await processNotificationJobsRetention(mockPrisma, 7, 500);
    assert.strictEqual(count, 0, 'Should return 0 when no eligible records exist');
  });

  it('4. Handles database exceptions gracefully and reports errors', async () => {
    const mockPrisma = {
      notificationJob: {
        findMany: async () => {
          throw new Error('Database connection failed');
        },
      },
    };

    const count = await processNotificationJobsRetention(mockPrisma, 7, 500);
    assert.strictEqual(count, 0, 'Should return 0 on query failure without throwing unhandled rejection');
  });
});
