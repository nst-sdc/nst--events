import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueNotification, ContextRestorationError, type EnqueueParams } from '../src/notifications.js';
import { PrismaClient } from '@nst/database';

describe('enqueueNotification transaction-context safety & regression suite', () => {
  const validMetadata = {
    schema_version: 1 as const,
    routing: {
      target: '/events/123',
      fallback: '/events',
      params: { eventId: '123' },
    },
    entity_ids: {},
  };

  const dummyNotificationRow = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    user_id: 'target-user-456',
    title: 'Test Title',
    body: 'Test Body',
    type: 'EVENT_REMINDER',
    metadata: validMetadata,
    read_at: null,
    delivered_at: null,
    delivery_failed_at: null,
    delivery_error: null,
    idempotency_key: 'test-hash-123',
    created_at: new Date(),
  };

  function createMockTx(options?: {
    callerUid?: string | null;
    insertError?: Error | null;
    restoreError?: Error | null;
    conflictExisting?: any | null;
    prefs?: { pushEnabled?: boolean; clubAnnouncements?: boolean; eventReminders?: boolean; attendanceAlerts?: boolean } | null;
  }) {
    const callerUid = options?.callerUid !== undefined ? options.callerUid : 'caller-user-123';
    const executeRawCalls: Array<{ strings: TemplateStringsArray; values: any[] }> = [];
    const queryRawCalls: Array<{ strings: TemplateStringsArray; values: any[] }> = [];

    const mockTx: any = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        queryRawCalls.push({ strings, values });
        const text = strings.join('?');
        if (text.includes("current_setting('app.user_id', true)")) {
          return [{ uid: callerUid }];
        }
        if (text.includes('INSERT INTO notifications')) {
          if (options?.insertError) {
            throw options.insertError;
          }
          if (options?.conflictExisting) {
            // Conflict -> 0 rows returned
            return [];
          }
          return [dummyNotificationRow];
        }
        if (text.includes('SELECT * FROM notifications WHERE idempotency_key')) {
          return [options?.conflictExisting || dummyNotificationRow];
        }
        return [];
      }),

      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        executeRawCalls.push({ strings, values });
        const text = strings.join('?');
        if (text.includes("set_config('app.user_id'") && values[0] === (callerUid ?? '')) {
          // Restoration call
          if (options?.restoreError) {
            throw options.restoreError;
          }
        }
        return 1;
      }),

      notificationPreference: {
        findUnique: vi.fn(async () => {
          if (options?.prefs !== undefined) return options.prefs;
          return {
            userId: 'target-user-456',
            pushEnabled: true,
            clubAnnouncements: true,
            eventReminders: true,
            attendanceAlerts: true,
          };
        }),
      },

      notification: {
        findUnique: vi.fn(async () => options?.conflictExisting || null),
      },
    };

    return { mockTx, executeRawCalls, queryRawCalls };
  }

  // 1. Successful enqueue restores the caller's original context
  describe('Requirement 1: Context restoration on success', () => {
    it('restores caller context to original non-empty user ID on successful enqueue', async () => {
      const { mockTx, executeRawCalls } = createMockTx({ callerUid: 'caller-user-123' });

      const result = await enqueueNotification({
        tx: mockTx,
        userId: 'target-user-456',
        type: 'EVENT_REMINDER',
        title: 'Event Soon',
        body: 'Do not miss it!',
        metadata: validMetadata,
        preferenceGate: 'event_reminders',
        idempotencyString: 'idem-1',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(dummyNotificationRow.id);

      // Verify sequence of set_config calls
      const setConfigCalls = executeRawCalls.filter((c) =>
        c.strings.join('').includes("set_config('app.user_id'")
      );
      expect(setConfigCalls.length).toBe(2);

      // Call 1: switched to recipient
      expect(setConfigCalls[0].values[0]).toBe('target-user-456');

      // Call 2: restored to caller
      expect(setConfigCalls[1].values[0]).toBe('caller-user-123');
    });

    it('restores empty context when original caller context is null (e.g. system worker)', async () => {
      const { mockTx, executeRawCalls } = createMockTx({ callerUid: null });

      await enqueueNotification({
        tx: mockTx,
        userId: 'target-user-456',
        type: 'EVENT_REMINDER',
        title: 'Event Soon',
        body: 'Do not miss it!',
        metadata: validMetadata,
        preferenceGate: 'event_reminders',
        idempotencyString: 'idem-2',
      });

      const setConfigCalls = executeRawCalls.filter((c) =>
        c.strings.join('').includes("set_config('app.user_id'")
      );
      expect(setConfigCalls.length).toBe(2);

      // Call 1: recipient
      expect(setConfigCalls[0].values[0]).toBe('target-user-456');

      // Call 2: restored to empty string (which evaluates to NULL under nullif)
      expect(setConfigCalls[1].values[0]).toBe('');
    });
  });

  // 2. Notification insertion failure still attempts context restoration
  describe('Requirement 2: Context restoration on insertion failure', () => {
    it('still executes context restoration and throws original error when insertion fails', async () => {
      const dbInsertError = new Error('database connection lost during insert');
      const { mockTx, executeRawCalls } = createMockTx({
        callerUid: 'caller-user-123',
        insertError: dbInsertError,
      });

      await expect(
        enqueueNotification({
          tx: mockTx,
          userId: 'target-user-456',
          type: 'EVENT_REMINDER',
          title: 'Event Soon',
          body: 'Do not miss it!',
          metadata: validMetadata,
          preferenceGate: 'event_reminders',
          idempotencyString: 'idem-fail-1',
        })
      ).rejects.toThrow('database connection lost during insert');

      // Verify that restoration was STILL attempted
      const setConfigCalls = executeRawCalls.filter((c) =>
        c.strings.join('').includes("set_config('app.user_id'")
      );
      expect(setConfigCalls.length).toBe(2);
      expect(setConfigCalls[0].values[0]).toBe('target-user-456');
      expect(setConfigCalls[1].values[0]).toBe('caller-user-123');
    });
  });

  // 3. Validation or metadata failure does not leak a changed context
  describe('Requirement 3: In-memory validation before context manipulation', () => {
    it('throws ZodError on invalid notification type without touching database context', async () => {
      const { mockTx, executeRawCalls, queryRawCalls } = createMockTx();

      await expect(
        enqueueNotification({
          tx: mockTx,
          userId: 'target-user-456',
          type: 'INVALID_BOGUS_TYPE' as any,
          title: 'Invalid',
          body: 'Body',
          metadata: validMetadata,
          preferenceGate: 'bypass',
          idempotencyString: 'idem-bad-type',
        })
      ).rejects.toThrow();

      // Zero DB calls should have been made
      expect(queryRawCalls.length).toBe(0);
      expect(executeRawCalls.length).toBe(0);
    });

    it('throws ZodError on invalid metadata without touching database context', async () => {
      const { mockTx, executeRawCalls, queryRawCalls } = createMockTx();

      const invalidMetadata: any = {
        schema_version: 999, // only version 1 is permitted
        routing: null,
      };

      await expect(
        enqueueNotification({
          tx: mockTx,
          userId: 'target-user-456',
          type: 'EVENT_REMINDER',
          title: 'Invalid',
          body: 'Body',
          metadata: invalidMetadata,
          preferenceGate: 'bypass',
          idempotencyString: 'idem-bad-meta',
        })
      ).rejects.toThrow();

      // Zero DB calls should have been made
      expect(queryRawCalls.length).toBe(0);
      expect(executeRawCalls.length).toBe(0);
    });
  });

  // 4. Restoration failure handling (no masking of insertion failure, no false claims of success)
  describe('Requirement 4: Robust error handling when restoration fails', () => {
    it('surfaces original operation error with attached restoration diagnostics if BOTH fail', async () => {
      const dbInsertError = new Error('insert failed: unique constraint');
      const dbRestoreError = new Error('restoration failed: transaction aborted');

      const { mockTx } = createMockTx({
        callerUid: 'caller-user-123',
        insertError: dbInsertError,
        restoreError: dbRestoreError,
      });

      let caughtError: any = null;
      try {
        await enqueueNotification({
          tx: mockTx,
          userId: 'target-user-456',
          type: 'EVENT_REMINDER',
          title: 'Event Soon',
          body: 'Do not miss it!',
          metadata: validMetadata,
          preferenceGate: 'event_reminders',
          idempotencyString: 'idem-dual-fail',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBe(dbInsertError);
      expect(caughtError.message).toBe('insert failed: unique constraint');
      expect(caughtError.restorationError).toBe(dbRestoreError);
      expect(caughtError.contextRestored).toBe(false);
    });

    it('throws ContextRestorationError if operation succeeded but restoration failed', async () => {
      const dbRestoreError = new Error('network timeout during context restore');

      const { mockTx } = createMockTx({
        callerUid: 'caller-user-123',
        restoreError: dbRestoreError,
      });

      let caughtError: any = null;
      try {
        await enqueueNotification({
          tx: mockTx,
          userId: 'target-user-456',
          type: 'EVENT_REMINDER',
          title: 'Event Soon',
          body: 'Do not miss it!',
          metadata: validMetadata,
          preferenceGate: 'event_reminders',
          idempotencyString: 'idem-restore-fail',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ContextRestorationError);
      expect(caughtError.message).toContain('Failed to restore transaction security context');
      expect(caughtError.restorationError).toBe(dbRestoreError);
      expect(caughtError.contextRestored).toBe(false);
    });
  });

  // 5. Dynamic identity values are passed through parameterized SQL rather than interpolated SQL text
  describe('Requirement 5: Parameterized SQL without string interpolation', () => {
    it('passes malicious injection payloads as bound parameters rather than SQL text', async () => {
      const maliciousUserId = "target-user'; DROP TABLE notifications; --";
      const maliciousCallerUid = "caller-user'; DROP TABLE users; --";

      const { mockTx, executeRawCalls } = createMockTx({ callerUid: maliciousCallerUid });

      await enqueueNotification({
        tx: mockTx,
        userId: maliciousUserId,
        type: 'EVENT_REMINDER',
        title: 'Test',
        body: 'Body',
        metadata: validMetadata,
        preferenceGate: 'bypass',
        idempotencyString: 'idem-sql-inj',
      });

      // Verify executeRawUnsafe is not used
      expect((mockTx as any).$executeRawUnsafe).toBeUndefined();

      // Check the set_config executeRaw calls
      const setConfigCalls = executeRawCalls.filter((c) =>
        c.strings.join('').includes("set_config('app.user_id'")
      );
      expect(setConfigCalls.length).toBe(2);

      // Verify the template strings array DO NOT contain the injected text
      const templateChunks1 = Array.from(setConfigCalls[0].strings);
      expect(templateChunks1.join('')).not.toContain('DROP TABLE');
      expect(setConfigCalls[0].values[0]).toBe(maliciousUserId);

      const templateChunks2 = Array.from(setConfigCalls[1].strings);
      expect(templateChunks2.join('')).not.toContain('DROP TABLE');
      expect(setConfigCalls[1].values[0]).toBe(maliciousCallerUid);
    });
  });

  // 6. Existing notification deduplication and preference behavior remain unchanged
  describe('Requirement 6: Deduplication and preference gating preservation', () => {
    it('skips push job creation when preferenceGate is push_enabled and push is disabled', async () => {
      const { mockTx, executeRawCalls } = createMockTx({
        prefs: { pushEnabled: false },
      });

      await enqueueNotification({
        tx: mockTx,
        userId: 'target-user-456',
        type: 'EVENT_REMINDER',
        title: 'Event Reminder',
        body: 'Body',
        metadata: validMetadata,
        preferenceGate: 'push_enabled',
        idempotencyString: 'idem-pref-1',
      });

      // Verify no notification_jobs insertion was executed
      const jobInsertCalls = executeRawCalls.filter((c) =>
        c.strings.join('').includes('INSERT INTO notification_jobs')
      );
      expect(jobInsertCalls.length).toBe(0);
    });

    it('enqueues push job when preferenceGate is bypass even if push is disabled', async () => {
      const { mockTx, executeRawCalls } = createMockTx({
        prefs: { pushEnabled: false },
      });

      await enqueueNotification({
        tx: mockTx,
        userId: 'target-user-456',
        type: 'SYSTEM_ALERT',
        title: 'Critical Alert',
        body: 'Important',
        metadata: validMetadata,
        preferenceGate: 'bypass',
        idempotencyString: 'idem-bypass-1',
      });

      // Verify notification_jobs insertion was executed
      const jobInsertCalls = executeRawCalls.filter((c) =>
        c.strings.join('').includes('INSERT INTO notification_jobs')
      );
      expect(jobInsertCalls.length).toBe(1);
    });

    it('handles conflict deduplication without re-emitting SSE live events', async () => {
      const existingNotification = {
        ...dummyNotificationRow,
        id: 'existing-notif-uuid',
        delivered_at: new Date(),
      };

      const { mockTx, executeRawCalls } = createMockTx({
        conflictExisting: existingNotification,
      });

      const result = await enqueueNotification({
        tx: mockTx,
        userId: 'target-user-456',
        type: 'EVENT_REMINDER',
        title: 'Reminder',
        body: 'Body',
        metadata: validMetadata,
        preferenceGate: 'event_reminders',
        idempotencyString: 'idem-dup-1',
      });

      expect(result.id).toBe('existing-notif-uuid');

      // Verify pg_notify SSE was NOT called for an existing conflict
      const sseCalls = executeRawCalls.filter((c) =>
        c.strings.join('').includes('pg_notify')
      );
      expect(sseCalls.length).toBe(0);
    });

    it('normalizes snake_case and camelCase output properties', async () => {
      const { mockTx } = createMockTx();

      const result = await enqueueNotification({
        tx: mockTx,
        userId: 'target-user-456',
        type: 'EVENT_REMINDER',
        title: 'Reminder',
        body: 'Body',
        metadata: validMetadata,
        preferenceGate: 'event_reminders',
        idempotencyString: 'idem-norm-1',
      });

      expect(result.userId).toBe('target-user-456');
      expect(result.user_id).toBe('target-user-456');
      expect(result.idempotencyKey).toBe(dummyNotificationRow.idempotency_key);
      expect(result.idempotency_key).toBe(dummyNotificationRow.idempotency_key);
    });
  });

  // 7. Live PostgreSQL transaction integration test
  describe('Requirement 7: Live PostgreSQL transaction-local isolation', () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      process.env.ADMIN_DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5440/nst_events_clean_test?schema=public';

    let testPrisma: PrismaClient | null = null;
    let isDbAvailable = false;

    beforeEach(async () => {
      if (testPrisma === null) {
        try {
          testPrisma = new PrismaClient({
            datasources: { db: { url: testDbUrl } },
          });
          await testPrisma.$queryRaw`SELECT 1`;
          isDbAvailable = true;
        } catch {
          isDbAvailable = false;
        }
      }
    });

    it('preserves caller session context across enqueue in a live Postgres transaction', async () => {
      if (!isDbAvailable || !testPrisma) {
        console.warn('Skipping live Postgres test: test database not reachable at', testDbUrl);
        return;
      }

      const callerId = 'caller-session-live-123';

      await testPrisma.$transaction(async (tx) => {
        // Create user inside transaction
        const targetUser = await tx.user.create({
          data: {
            email: `shared-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@example.com`,
            googleSub: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            fullName: 'Shared Test User',
          },
        });

        // Set initial caller context
        await tx.$executeRaw`SELECT set_config('app.user_id', ${callerId}, true)`;

        // Verify initial caller context
        const [initial] = await tx.$queryRaw<Array<{ uid: string | null }>>`
          SELECT current_setting('app.user_id', true) as uid
        `;
        expect(initial.uid).toBe(callerId);

        // Run enqueueNotification
        const result = await enqueueNotification({
          tx,
          userId: targetUser.id,
          type: 'EVENT_REMINDER',
          title: 'Live Event Reminder',
          body: 'Check live context',
          metadata: validMetadata,
          preferenceGate: 'bypass',
          idempotencyString: `live-idem-${Date.now()}`,
        });

        expect(result).toBeDefined();
        expect(result.userId).toBe(targetUser.id);

        // Verify caller context was restored in the transaction
        const [restored] = await tx.$queryRaw<Array<{ uid: string | null }>>`
          SELECT current_setting('app.user_id', true) as uid
        `;
        expect(restored.uid).toBe(callerId);

        // Force a rollback so test does not mutate DB
        throw new Error('ROLLBACK_TRANSACTION');
      }).catch((err) => {
        if (err.message !== 'ROLLBACK_TRANSACTION') throw err;
      });
    });

    it('restores empty/null session context when caller context was not set', async () => {
      if (!isDbAvailable || !testPrisma) {
        return;
      }

      await testPrisma.$transaction(async (tx) => {
        const targetUser = await tx.user.create({
          data: {
            email: `shared-null-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@example.com`,
            googleSub: `sub-null-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            fullName: 'Shared Null Test User',
          },
        });

        // Ensure session has no app.user_id set
        await tx.$executeRaw`SELECT set_config('app.user_id', '', true)`;

        const [initial] = await tx.$queryRaw<Array<{ uid: string | null }>>`
          SELECT current_setting('app.user_id', true) as uid
        `;
        // current_setting returns '' or null
        expect(initial.uid === '' || initial.uid === null).toBe(true);

        await enqueueNotification({
          tx,
          userId: targetUser.id,
          type: 'EVENT_REMINDER',
          title: 'Live Event Reminder',
          body: 'Check live context',
          metadata: validMetadata,
          preferenceGate: 'bypass',
          idempotencyString: `live-idem-null-${Date.now()}`,
        });

        const [restored] = await tx.$queryRaw<Array<{ uid: string | null }>>`
          SELECT current_setting('app.user_id', true) as uid
        `;
        expect(restored.uid === '' || restored.uid === null).toBe(true);

        throw new Error('ROLLBACK_TRANSACTION');
      }).catch((err) => {
        if (err.message !== 'ROLLBACK_TRANSACTION') throw err;
      });
    });

    it('preserves operation error and surfaces restoration diagnostic when live transaction is aborted', async () => {
      if (!isDbAvailable || !testPrisma) {
        return;
      }

      const callerId = 'caller-session-live-abort-test';
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';

      let caughtError: any = null;

      await testPrisma.$transaction(async (tx) => {
        // Set initial caller context
        await tx.$executeRaw`SELECT set_config('app.user_id', ${callerId}, true)`;

        // Trigger enqueueNotification for non-existent user to cause FK violation
        await enqueueNotification({
          tx,
          userId: nonExistentUserId,
          type: 'EVENT_REMINDER',
          title: 'Should Fail',
          body: 'Foreign key failure',
          metadata: validMetadata,
          preferenceGate: 'bypass',
          idempotencyString: `live-idem-fail-${Date.now()}`,
        });
      }).catch((err) => {
        caughtError = err;
      });

      expect(caughtError).toBeDefined();
      // Primary error is the insertion FK violation, NOT masked by the restoration failure
      expect(caughtError.message).toContain('notifications_user_id_fkey');
      // Context was NOT restored because transaction was aborted
      expect(caughtError.contextRestored).toBe(false);
      // Restoration error is preserved as diagnostic info
      expect(caughtError.restorationError).toBeDefined();
      expect(caughtError.restorationError.message).toContain('current transaction is aborted');
    });
  });
});

