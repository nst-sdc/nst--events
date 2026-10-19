import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { adminPrisma } from '../helpers/adminDb';
import { enqueueNotification } from '@nst/shared';

// Mock Expo access token before importing worker
process.env.EXPO_ACCESS_TOKEN = 'mock_expo_access_token_for_tests';
process.env.WORKER_DATABASE_URL = process.env.WORKER_DATABASE_URL || process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5440/nst_events_clean_test?schema=public';

import { processBatch } from '../../../worker/src/worker';
import { expo } from '../../../worker/src/index';

const testMetadata = {
  schema_version: 1 as const,
  routing: {
    target: '/test',
    fallback: '/test',
    params: {},
  },
  entity_ids: {},
};

async function createTestUserWithTokens(tokenCount: number, pushEnabled = true) {
  const uid = crypto.randomUUID();
  const user = await adminPrisma.user.create({
    data: {
      id: uid,
      email: `p3a-${Date.now()}-${crypto.randomBytes(4).toString('hex')}@test.com`,
      googleSub: `sub-p3a-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      fullName: 'Phase 3A User',
      notificationPreferences: {
        create: {
          pushEnabled,
          clubAnnouncements: true,
          eventReminders: true,
          attendanceAlerts: true,
        }
      }
    }
  });

  const tokens = [];
  for (let i = 0; i < tokenCount; i++) {
    const pt = await adminPrisma.pushToken.create({
      data: {
        userId: user.id,
        deviceId: `dev-${i}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        expoToken: `ExponentPushToken[p3a-token-${i}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}]`,
        platform: i % 2 === 0 ? 'ios' : 'android',
      }
    });
    tokens.push(pt);
  }

  return { user, tokens };
}

async function cleanupUser(userId: string) {
  await adminPrisma.notificationJob.deleteMany({
    where: {
      payload: {
        path: ['user_id'],
        equals: userId,
      }
    }
  });
  await adminPrisma.notification.deleteMany({ where: { userId } });
  await adminPrisma.pushToken.deleteMany({ where: { userId } });
  await adminPrisma.notificationPreference.deleteMany({ where: { userId } });
  await adminPrisma.user.delete({ where: { id: userId } });
}

test('FINDING-NOTIF-01: Multi-device push failure isolation', async (suite) => {

  await suite.test('1. Stale token followed by a valid token', async (t) => {
    const { user, tokens } = await createTestUserWithTokens(2);
    const staleToken = tokens[0].expoToken;
    const validToken = tokens[1].expoToken;

    // Mock sendPushNotificationsAsync: stale token errors with DeviceNotRegistered, valid succeeds
    t.mock.method(expo, 'sendPushNotificationsAsync', async (messages: any[]) => {
      return messages.map((m: any) => {
        if (m.to === staleToken) {
          return {
            status: 'error',
            message: 'DeviceNotRegistered',
            details: { error: 'DeviceNotRegistered' },
          };
        }
        return {
          status: 'ok',
          id: 'ticket-valid-dev-1',
        };
      });
    });

    const notif = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'Reminder 1',
      body: 'Stale then valid test',
      metadata: testMetadata,
      idempotencyString: `stale-then-valid-${Date.now()}`,
      preferenceGate: 'event_reminders',
    });

    // Run sendPush batch
    await processBatch();

    // Verify stale token was pruned
    const pruned = await adminPrisma.pushToken.findFirst({ where: { expoToken: staleToken } });
    assert.strictEqual(pruned, null, 'Stale token must be pruned from push_tokens');

    // Verify valid token remains
    const kept = await adminPrisma.pushToken.findFirst({ where: { expoToken: validToken } });
    assert.ok(kept, 'Valid token must be kept in push_tokens');

    // Job must transition to WAITING_FOR_RECEIPTS with the valid ticket
    const job = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['notification_id'], equals: notif?.id } }
    });
    assert.strictEqual(job?.status, 'WAITING_FOR_RECEIPTS', 'Job must reach WAITING_FOR_RECEIPTS');
    assert.ok((job?.ticketIds as any)?.['ticket-valid-dev-1'], 'Job must retain valid ticket');
    assert.strictEqual(Object.keys(job?.ticketIds as any).length, 1);

    // Now mock receipt polling returning ok
    t.mock.method(expo, 'getPushNotificationReceiptsAsync', async (ticketIds: string[]) => {
      const res: Record<string, any> = {};
      for (const tid of ticketIds) {
        res[tid] = { status: 'ok' };
      }
      return res;
    });

    // Make job available immediately for receipt polling
    await adminPrisma.notificationJob.update({
      where: { id: job!.id },
      data: { availableAt: new Date(Date.now() - 1000) }
    });

    await processBatch();

    const completedJob = await adminPrisma.notificationJob.findUnique({ where: { id: job!.id } });
    assert.strictEqual(completedJob?.status, 'COMPLETED', 'Job must reach COMPLETED');

    const updatedNotif = await adminPrisma.notification.findUnique({ where: { id: notif!.id } });
    assert.ok(updatedNotif?.deliveredAt, 'Notification must be marked delivered_at');

    await cleanupUser(user.id);
  });

  await suite.test('2. Valid token followed by a stale token', async (t) => {
    const { user, tokens } = await createTestUserWithTokens(2);
    const validToken = tokens[0].expoToken;
    const staleToken = tokens[1].expoToken;

    t.mock.method(expo, 'sendPushNotificationsAsync', async (messages: any[]) => {
      return messages.map((m: any) => {
        if (m.to === staleToken) {
          return {
            status: 'error',
            message: 'DeviceNotRegistered',
            details: { error: 'DeviceNotRegistered' },
          };
        }
        return {
          status: 'ok',
          id: 'ticket-valid-dev-0',
        };
      });
    });

    const notif = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'Reminder 2',
      body: 'Valid then stale test',
      metadata: testMetadata,
      idempotencyString: `valid-then-stale-${Date.now()}`,
      preferenceGate: 'event_reminders',
    });

    await processBatch();

    // Verify stale token pruned, valid token kept
    const pruned = await adminPrisma.pushToken.findFirst({ where: { expoToken: staleToken } });
    assert.strictEqual(pruned, null, 'Stale token must be pruned');
    const kept = await adminPrisma.pushToken.findFirst({ where: { expoToken: validToken } });
    assert.ok(kept, 'Valid token must be kept');

    const job = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['notification_id'], equals: notif?.id } }
    });
    assert.strictEqual(job?.status, 'WAITING_FOR_RECEIPTS');
    assert.ok((job?.ticketIds as any)?.['ticket-valid-dev-0']);
    assert.strictEqual(Object.keys(job?.ticketIds as any).length, 1);

    await cleanupUser(user.id);
  });

  await suite.test('3. Multiple valid devices with mixed receipt outcomes', async (t) => {
    const { user, tokens } = await createTestUserWithTokens(2);

    // Both succeed at send time
    t.mock.method(expo, 'sendPushNotificationsAsync', async (messages: any[]) => {
      return messages.map((m: any, idx: number) => ({
        status: 'ok',
        id: `ticket-dev-${idx}`,
      }));
    });

    const notif = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'Mixed Receipts',
      body: 'Testing mixed receipt outcomes',
      metadata: testMetadata,
      idempotencyString: `mixed-receipts-${Date.now()}`,
      preferenceGate: 'event_reminders',
    });

    await processBatch();

    const job = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['notification_id'], equals: notif?.id } }
    });
    assert.strictEqual(job?.status, 'WAITING_FOR_RECEIPTS');

    // On receipt polling: ticket-dev-0 is DeviceNotRegistered, ticket-dev-1 is ok
    t.mock.method(expo, 'getPushNotificationReceiptsAsync', async () => {
      return {
        'ticket-dev-0': {
          status: 'error',
          message: 'The device cannot receive push notifications',
          details: { error: 'DeviceNotRegistered' },
        },
        'ticket-dev-1': {
          status: 'ok',
        },
      };
    });

    await adminPrisma.notificationJob.update({
      where: { id: job!.id },
      data: { availableAt: new Date(Date.now() - 1000) }
    });

    await processBatch();

    // Assert stale device token pruned
    const pruned = await adminPrisma.pushToken.findFirst({ where: { expoToken: tokens[0].expoToken } });
    assert.strictEqual(pruned, null, 'Device 0 token must be pruned following DeviceNotRegistered receipt');

    // Assert second device kept
    const kept = await adminPrisma.pushToken.findFirst({ where: { expoToken: tokens[1].expoToken } });
    assert.ok(kept, 'Device 1 token must be kept');

    // Job completed because at least one device was successfully delivered
    const completedJob = await adminPrisma.notificationJob.findUnique({ where: { id: job!.id } });
    assert.strictEqual(completedJob?.status, 'COMPLETED', 'Job must reach COMPLETED because 1 device succeeded');

    const updatedNotif = await adminPrisma.notification.findUnique({ where: { id: notif!.id } });
    assert.ok(updatedNotif?.deliveredAt, 'Notification must be marked delivered_at');

    await cleanupUser(user.id);
  });

  await suite.test('4. Transient provider errors alongside permanent token errors', async (t) => {
    const { user, tokens } = await createTestUserWithTokens(2);

    t.mock.method(expo, 'sendPushNotificationsAsync', async (messages: any[]) => {
      return messages.map((m: any) => {
        if (m.to === tokens[0].expoToken) {
          return {
            status: 'error',
            message: 'DeviceNotRegistered',
            details: { error: 'DeviceNotRegistered' },
          };
        }
        return {
          status: 'error',
          message: 'Rate limit exceeded',
          details: { error: 'MessageRateExceeded' },
        };
      });
    });

    const notif = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'Transient Error',
      body: 'Rate limit with stale token',
      metadata: testMetadata,
      idempotencyString: `transient-and-perm-${Date.now()}`,
      preferenceGate: 'event_reminders',
    });

    await processBatch();

    // Token 0 was DeviceNotRegistered -> pruned
    const pruned = await adminPrisma.pushToken.findFirst({ where: { expoToken: tokens[0].expoToken } });
    assert.strictEqual(pruned, null, 'Stale token must be pruned');

    // Token 1 had rate limit -> kept
    const kept = await adminPrisma.pushToken.findFirst({ where: { expoToken: tokens[1].expoToken } });
    assert.ok(kept, 'Transient failed token must NOT be pruned');

    // Job must transition to RETRY_PENDING with attemptCount = 1
    const job = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['notification_id'], equals: notif?.id } }
    });
    assert.strictEqual(job?.status, 'RETRY_PENDING', 'Job must transition to RETRY_PENDING');
    assert.strictEqual(job?.attemptCount, 1, 'Attempt count must be incremented to 1');

    await cleanupUser(user.id);
  });

  await suite.test('5. All devices invalid', async (t) => {
    const { user } = await createTestUserWithTokens(2);

    t.mock.method(expo, 'sendPushNotificationsAsync', async (messages: any[]) => {
      return messages.map(() => ({
        status: 'error',
        message: 'DeviceNotRegistered',
        details: { error: 'DeviceNotRegistered' },
      }));
    });

    const notif = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'All Invalid',
      body: 'All devices invalid test',
      metadata: testMetadata,
      idempotencyString: `all-invalid-${Date.now()}`,
      preferenceGate: 'event_reminders',
    });

    await processBatch();

    // Both tokens purged
    const remainingTokens = await adminPrisma.pushToken.findMany({ where: { userId: user.id } });
    assert.strictEqual(remainingTokens.length, 0, 'All tokens must be purged');

    // Job transitions to FAILED
    const job = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['notification_id'], equals: notif?.id } }
    });
    assert.strictEqual(job?.status, 'FAILED', 'Job must transition to FAILED');

    // Notification marked delivery_failed_at, NOT delivered_at
    const updatedNotif = await adminPrisma.notification.findUnique({ where: { id: notif!.id } });
    assert.strictEqual(updatedNotif?.deliveredAt, null, 'delivered_at must remain null');
    assert.ok(updatedNotif?.deliveryFailedAt, 'delivery_failed_at must be set');
    assert.ok(updatedNotif?.deliveryError?.includes('DeviceNotRegistered'), 'delivery_error must describe failure');

    await cleanupUser(user.id);
  });

  await suite.test('6. Partial success followed by a retry of pending receipts', async (t) => {
    const { user } = await createTestUserWithTokens(2);

    t.mock.method(expo, 'sendPushNotificationsAsync', async () => [
      { status: 'ok', id: 'ticket-partial-1' },
      { status: 'ok', id: 'ticket-partial-2' },
    ]);

    const notif = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'Partial Success',
      body: 'One receipt ready, one delayed',
      metadata: testMetadata,
      idempotencyString: `partial-receipt-${Date.now()}`,
      preferenceGate: 'event_reminders',
    });

    await processBatch();

    const job = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['notification_id'], equals: notif?.id } }
    });
    assert.strictEqual(job?.status, 'WAITING_FOR_RECEIPTS');

    // Receipt polling: ticket-partial-1 is ok, ticket-partial-2 is missing (not ready yet)
    t.mock.method(expo, 'getPushNotificationReceiptsAsync', async () => ({
      'ticket-partial-1': { status: 'ok' },
    }));

    await adminPrisma.notificationJob.update({
      where: { id: job!.id },
      data: { availableAt: new Date(Date.now() - 1000) }
    });

    await processBatch();

    // Notification is stamped delivered immediately upon partial success
    const updatedNotif = await adminPrisma.notification.findUnique({ where: { id: notif!.id } });
    assert.ok(updatedNotif?.deliveredAt, 'Notification must be marked delivered on first successful receipt');

    // Job updates ticketIds to only remaining pending tickets
    const jobAfterPoll = await adminPrisma.notificationJob.findUnique({ where: { id: job!.id } });
    assert.strictEqual(jobAfterPoll?.status, 'WAITING_FOR_RECEIPTS', 'Job remains WAITING_FOR_RECEIPTS for remaining ticket');
    assert.ok((jobAfterPoll?.ticketIds as any)?.['ticket-partial-2'], 'Job tickets must be narrowed to pending ticket only');
    assert.strictEqual(Object.keys(jobAfterPoll?.ticketIds as any).length, 1);

    // Second poll: ticket-partial-2 is now ok
    t.mock.method(expo, 'getPushNotificationReceiptsAsync', async () => ({
      'ticket-partial-2': { status: 'ok' },
    }));

    await adminPrisma.notificationJob.update({
      where: { id: job!.id },
      data: { availableAt: new Date(Date.now() - 1000) }
    });

    await processBatch();

    const finalJob = await adminPrisma.notificationJob.findUnique({ where: { id: job!.id } });
    assert.strictEqual(finalJob?.status, 'COMPLETED', 'Job completes after all tickets confirmed');

    await cleanupUser(user.id);
  });

  await suite.test('7. Repeated receipt polling and already-terminal jobs', async (t) => {
    const { user } = await createTestUserWithTokens(1);

    const job = await adminPrisma.notificationJob.create({
      data: {
        status: 'COMPLETED',
        payload: { job_type: 'SEND_PUSH', user_id: user.id },
        idempotencyKey: `already-terminal-${Date.now()}`,
        availableAt: new Date(Date.now() - 1000),
      }
    });

    // processBatch should ignore COMPLETED jobs
    await processBatch();

    const sameJob = await adminPrisma.notificationJob.findUnique({ where: { id: job.id } });
    assert.strictEqual(sameJob?.status, 'COMPLETED');

    await adminPrisma.notificationJob.delete({ where: { id: job.id } });
    await cleanupUser(user.id);
  });

  await suite.test('8. Missing, delayed, or failed receipts', async (t) => {
    const { user } = await createTestUserWithTokens(1);

    t.mock.method(expo, 'sendPushNotificationsAsync', async () => [
      { status: 'ok', id: 'ticket-delayed-1' },
    ]);

    const notif = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'Delayed Receipt',
      body: 'Delayed test',
      metadata: testMetadata,
      idempotencyString: `delayed-receipt-${Date.now()}`,
      preferenceGate: 'event_reminders',
    });

    await processBatch();

    const job = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['notification_id'], equals: notif?.id } }
    });

    // Mock receipts returning empty map (Expo hasn't finished processing delivery receipt yet)
    t.mock.method(expo, 'getPushNotificationReceiptsAsync', async () => ({}));

    await adminPrisma.notificationJob.update({
      where: { id: job!.id },
      data: { availableAt: new Date(Date.now() - 1000) }
    });

    await processBatch();

    const waitingJob = await adminPrisma.notificationJob.findUnique({ where: { id: job!.id } });
    assert.strictEqual(waitingJob?.status, 'WAITING_FOR_RECEIPTS', 'Job must stay in WAITING_FOR_RECEIPTS when receipts delayed');
    assert.strictEqual(waitingJob?.attemptCount, 1, 'Attempt count must increment on delayed polling');
    assert.ok(waitingJob!.availableAt > new Date(), 'available_at must be pushed into future for backoff');

    await cleanupUser(user.id);
  });
});

test('FINDING-NOTIF-02: Inbox notification duplication and idempotency', async (suite) => {

  await suite.test('9. Retried enqueue does not create duplicate inbox rows or duplicate delivery jobs', async () => {
    const { user } = await createTestUserWithTokens(1);
    const key = `idempotency-key-${Date.now()}`;

    const n1 = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'CLUB_ANNOUNCEMENT',
      title: 'Announcement',
      body: 'First call',
      metadata: testMetadata,
      idempotencyString: key,
      preferenceGate: 'club_announcements',
    });

    const n2 = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'CLUB_ANNOUNCEMENT',
      title: 'Announcement Retried',
      body: 'Second call',
      metadata: testMetadata,
      idempotencyString: key,
      preferenceGate: 'club_announcements',
    });

    assert.strictEqual(n1.id, n2.id, 'Both calls must return the same notification entity');

    const notifCount = await adminPrisma.notification.count({
      where: { userId: user.id }
    });
    assert.strictEqual(notifCount, 1, 'Exactly one inbox notification row must exist');

    const jobCount = await adminPrisma.notificationJob.count({
      where: { payload: { path: ['user_id'], equals: user.id } }
    });
    assert.strictEqual(jobCount, 1, 'Exactly one delivery job must exist in queue');

    await cleanupUser(user.id);
  });

  await suite.test('10. Preserves unread/read state, delivery history, and metadata on retries', async () => {
    const { user } = await createTestUserWithTokens(1);
    const key = `preserve-read-state-${Date.now()}`;

    const original = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'CLUB_ANNOUNCEMENT',
      title: 'Announcement',
      body: 'Read state test',
      metadata: testMetadata,
      idempotencyString: key,
      preferenceGate: 'club_announcements',
    });

    const readTimestamp = new Date();
    const deliveredTimestamp = new Date();

    // User marks notification as read and worker marks as delivered
    await adminPrisma.notification.update({
      where: { id: original.id },
      data: {
        readAt: readTimestamp,
        deliveredAt: deliveredTimestamp,
      }
    });

    // Retry enqueue with the same idempotency key
    const retried = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'CLUB_ANNOUNCEMENT',
      title: 'Announcement New Title',
      body: 'New Body',
      metadata: testMetadata,
      idempotencyString: key,
      preferenceGate: 'club_announcements',
    });

    assert.strictEqual(retried.id, original.id);
    assert.strictEqual(retried.readAt?.getTime(), readTimestamp.getTime(), 'read_at timestamp must be preserved');
    assert.strictEqual(retried.deliveredAt?.getTime(), deliveredTimestamp.getTime(), 'delivered_at timestamp must be preserved');

    await cleanupUser(user.id);
  });

  await suite.test('11. Concurrent enqueue requests for the same logical notification', async () => {
    const { user } = await createTestUserWithTokens(1);
    const key = `concurrent-enqueue-${Date.now()}`;

    // 10 simultaneous enqueue requests
    const results = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        enqueueNotification({
          tx: adminPrisma,
          userId: user.id,
          type: 'EVENT_REMINDER',
          title: `Concurrent ${i}`,
          body: `Concurrent attempt ${i}`,
          metadata: testMetadata,
          idempotencyString: key,
          preferenceGate: 'event_reminders',
        })
      )
    );

    const firstId = results[0].id;
    for (const r of results) {
      assert.strictEqual(r.id, firstId, 'All concurrent calls must resolve to the identical notification ID');
    }

    const notifs = await adminPrisma.notification.findMany({ where: { userId: user.id } });
    assert.strictEqual(notifs.length, 1, 'Only 1 notification row in DB');

    const jobs = await adminPrisma.notificationJob.findMany({
      where: { payload: { path: ['user_id'], equals: user.id } }
    });
    assert.strictEqual(jobs.length, 1, 'Only 1 job in DB');

    await cleanupUser(user.id);
  });

  await suite.test('12. In-app only notifications (pushDisabled)', async () => {
    const { user } = await createTestUserWithTokens(0, false); // pushEnabled = false, 0 devices

    const notif = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'CLUB_ANNOUNCEMENT',
      title: 'In App Only',
      body: 'Push disabled user',
      metadata: testMetadata,
      idempotencyString: `in-app-only-${Date.now()}`,
      preferenceGate: 'club_announcements',
    });

    assert.ok(notif, 'Notification row created');
    assert.ok(!notif.deliveredAt, 'deliveredAt is not stamped at enqueue time');

    const jobs = await adminPrisma.notificationJob.findMany({
      where: { payload: { path: ['user_id'], equals: user.id } }
    });
    assert.strictEqual(jobs.length, 0, 'No push job created when push is disabled');

    await cleanupUser(user.id);
  });

  await suite.test('13. Multi-recipient announcement scoping (same logical announcement ID)', async () => {
    const { user: userA } = await createTestUserWithTokens(1);
    const { user: userB } = await createTestUserWithTokens(1);
    const announcementId = `announcement-shared-${Date.now()}`;

    // Both users receive the same announcement with identical idempotencyString
    const nA = await enqueueNotification({
      tx: adminPrisma,
      userId: userA.id,
      type: 'CLUB_ANNOUNCEMENT',
      title: 'Global Announcement',
      body: 'Campus wide announcement',
      metadata: testMetadata,
      idempotencyString: announcementId,
      preferenceGate: 'club_announcements',
    });

    const nB = await enqueueNotification({
      tx: adminPrisma,
      userId: userB.id,
      type: 'CLUB_ANNOUNCEMENT',
      title: 'Global Announcement',
      body: 'Campus wide announcement',
      metadata: testMetadata,
      idempotencyString: announcementId,
      preferenceGate: 'club_announcements',
    });

    assert.notStrictEqual(nA.id, nB.id, 'Users must have separate inbox notification rows');
    assert.strictEqual(nA.userId, userA.id);
    assert.strictEqual(nB.userId, userB.id);

    const jobA = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['user_id'], equals: userA.id } }
    });
    const jobB = await adminPrisma.notificationJob.findFirst({
      where: { payload: { path: ['user_id'], equals: userB.id } }
    });
    assert.ok(jobA, 'User A must have a delivery job');
    assert.ok(jobB, 'User B must have a delivery job');
    assert.notStrictEqual(jobA.id, jobB.id);

    // Retrying for User A must not create a duplicate
    const nARetry = await enqueueNotification({
      tx: adminPrisma,
      userId: userA.id,
      type: 'CLUB_ANNOUNCEMENT',
      title: 'Global Announcement',
      body: 'Campus wide announcement',
      metadata: testMetadata,
      idempotencyString: announcementId,
      preferenceGate: 'club_announcements',
    });
    assert.strictEqual(nARetry.id, nA.id, 'Retrying User A returns existing row');

    await cleanupUser(userA.id);
    await cleanupUser(userB.id);
  });

  await suite.test('14. Reliable recovery for inbox row whose delivery job was missing', async () => {
    const { user } = await createTestUserWithTokens(1);
    const key = `recovery-test-${Date.now()}`;

    // 1. Initial enqueue creates both notification and job
    const n1 = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'Reminder',
      body: 'Before job drop',
      metadata: testMetadata,
      idempotencyString: key,
      preferenceGate: 'event_reminders',
    });

    // 2. Simulate worker queue crash/drop: delete the job while notification remains undelivered
    await adminPrisma.notificationJob.deleteMany({
      where: { payload: { path: ['user_id'], equals: user.id } }
    });

    const jobsBefore = await adminPrisma.notificationJob.findMany({
      where: { payload: { path: ['user_id'], equals: user.id } }
    });
    assert.strictEqual(jobsBefore.length, 0, 'Job was dropped/missing');

    // 3. Retry enqueue: must recover and re-create the missing delivery job
    const recovered = await enqueueNotification({
      tx: adminPrisma,
      userId: user.id,
      type: 'EVENT_REMINDER',
      title: 'Reminder Retried',
      body: 'Recovery attempt',
      metadata: testMetadata,
      idempotencyString: key,
      preferenceGate: 'event_reminders',
    });

    assert.strictEqual(recovered.id, n1.id, 'Inbox row preserved');

    const jobsAfter = await adminPrisma.notificationJob.findMany({
      where: { payload: { path: ['user_id'], equals: user.id } }
    });
    assert.strictEqual(jobsAfter.length, 1, 'Delivery job reliably recovered and re-created in queue');

    await cleanupUser(user.id);
  });
});
