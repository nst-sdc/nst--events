import type { Prisma } from '@nst/database';
import { z } from 'zod';

/**
 * Computes SHA-256 hex digest using standard JavaScript bitwise operations.
 * Pure-JS implementation avoids importing Node.js 'crypto' so @nst/shared can safely
 * be bundled in React Native / Expo without Node runtime errors.
 */
function sha256Hex(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const utf8 = new TextEncoder().encode(str);
  const bitLength = utf8.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  // Create padded array
  const totalLength = (((utf8.length + 8) >> 6) + 1) << 4;
  const words = new Uint32Array(totalLength);
  for (i = 0; i < utf8.length; i++) {
    words[i >> 2] |= utf8[i] << (((3 - i) % 4) * 8);
  }
  words[utf8.length >> 2] |= 0x80 << (((3 - utf8.length) % 4) * 8);
  words[totalLength - 2] = (bitLength / maxWord) | 0;
  words[totalLength - 1] = bitLength | 0;

  for (j = 0; j < words.length; j += 16) {
    const w = new Uint32Array(64);
    for (i = 0; i < 16; i++) w[i] = words[j + i];
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      if (i >= 16) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      const s1_h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1_h + ch + k[i] + w[i]) | 0;
      const s0_h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0_h + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

const uuidSchema = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  { message: 'Invalid UUID' }
);

export const NotificationMetadataSchema = z.object({
  schema_version: z.literal(1),
  routing: z.object({
    target: z.string(),
    fallback: z.string(),
    params: z.record(z.string(), z.string()),
  }),
  entity_ids: z.object({
    event_id: uuidSchema.optional(),
    club_id: uuidSchema.optional(),
    dispute_id: uuidSchema.optional(),
    attendance_id: uuidSchema.optional(),
    announcement_id: uuidSchema.optional(),
    team_id: uuidSchema.optional(),
    project_id: uuidSchema.optional(),
    contributor_id: uuidSchema.optional(),
  }),
  action_payload: z.object({
    role: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
});

export const ValidNotificationTypesSchema = z.enum([
  'WAITLIST_PROMOTED', 'APPROVAL_REQUEST', 'EVENT_APPROVED', 'EVENT_REJECTED',
  'ATTENDANCE_DISPUTE_RESOLVED', 'ROLE_CHANGED', 'CLUB_ANNOUNCEMENT',
  'SYSTEM_ALERT', 'EVENT_REMINDER', 'ATTENDANCE_ALERT',
  'TEAM_REGISTERED', 'TEAM_WAITLISTED', 'TEAM_CANCELLED',
  'TEAM_LEADERSHIP_TRANSFERRED', 'TEAM_MEMBER_REMOVED', 'TEAM_WAITLIST_PROMOTED',
  'EVENT_CANCELLED', 'PROJECT_INVITATION', 'PROJECT_COLLABORATION_ACCEPTED'
]);

export type NotificationMetadata = {
  schema_version: 1;
  routing: {
    target: string;
    fallback: string;
    params: Record<string, string>;
  };
  entity_ids: {
    event_id?: string;
    club_id?: string;
    dispute_id?: string;
    attendance_id?: string;
    announcement_id?: string;
    team_id?: string;
    project_id?: string;
    contributor_id?: string;
  };
  action_payload?: {
    role?: string;
    status?: string;
  };
};

export class ContextRestorationError extends Error {
  public readonly originalError?: unknown;
  public readonly restorationError: unknown;
  public readonly contextRestored = false;

  constructor(message: string, restorationError: unknown, originalError?: unknown) {
    super(message);
    this.name = 'ContextRestorationError';
    this.restorationError = restorationError;
    this.originalError = originalError;
    if (originalError instanceof Error && !this.cause) {
      this.cause = originalError;
    }
  }
}

export type EnqueueParams = {
  tx: Prisma.TransactionClient;
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata: NotificationMetadata;
  preferenceGate: 'push_enabled' | 'club_announcements' | 'event_reminders' | 'attendance_alerts' | 'bypass';
  priority?: 'HIGH' | 'NORMAL';
  idempotencyString: string;
};

export const enqueueNotification = async ({
  tx,
  userId,
  type,
  title,
  body,
  metadata,
  preferenceGate,
  priority = 'NORMAL',
  idempotencyString,
}: EnqueueParams) => {
  // 0. Runtime Validation (pure in-memory validation before any database interaction)
  ValidNotificationTypesSchema.parse(type);
  NotificationMetadataSchema.parse(metadata);

  // Read current transaction context (caller identity)
  const callerRows = await tx.$queryRaw<Array<{ uid: string | null }>>`
    SELECT current_setting('app.user_id', true) AS uid
  `;
  const originalUserId = callerRows?.[0]?.uid ?? null;

  let operationError: unknown = null;
  let notificationResult: any = null;

  try {
    // Establish recipient context for the notification operation using parameterized SQL
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;

    // 1. Enforce preference gates
    let pushEnabled = true;
    if (preferenceGate !== 'bypass') {
      const prefs = await tx.notificationPreference.findUnique({
        where: { userId },
      });
      if (prefs) {
        if (!prefs.pushEnabled) {
          pushEnabled = false;
        } else if (preferenceGate === 'club_announcements') {
          pushEnabled = prefs.clubAnnouncements;
        } else if (preferenceGate === 'event_reminders') {
          pushEnabled = prefs.eventReminders;
        } else if (preferenceGate === 'attendance_alerts') {
          pushEnabled = prefs.attendanceAlerts;
        } else if (preferenceGate === 'push_enabled') {
          pushEnabled = prefs.pushEnabled;
        }
      }
    }

    // 2. Compute Idempotency Key (scoped to userId so identical logical announcements reach all recipients)
    const scopedKey = idempotencyString.includes(userId) ? idempotencyString : `${userId}:${idempotencyString}`;
    const idempotencyKey = sha256Hex(scopedKey);

    // 3. Atomically Create or Retrieve Inbox Notification
    const insertedRows = await tx.$queryRaw<any[]>`
      INSERT INTO notifications (
        id, user_id, title, body, type, metadata, idempotency_key, created_at
      )
      VALUES (
        gen_random_uuid(), ${userId}::uuid, ${title}, ${body}, ${type}, ${metadata}::jsonb, ${idempotencyKey}, now()
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, user_id, title, body, type, metadata, read_at, delivered_at, delivery_failed_at, delivery_error, idempotency_key, created_at;
    `;

    let notification: any;
    let isNew = false;

    if (insertedRows && insertedRows.length > 0) {
      notification = insertedRows[0];
      isNew = true;
    } else {
      // Conflict occurred - retrieve the existing notification without altering read_at or delivery timestamps
      notification = await tx.notification.findUnique({
        where: { idempotencyKey },
      });
      if (!notification) {
        const rows = await tx.$queryRaw<any[]>`SELECT * FROM notifications WHERE idempotency_key = ${idempotencyKey} LIMIT 1`;
        notification = rows[0];
      }
    }

    // 4. Create Queue Job only if push is enabled
    // Created for new notifications, or as recovery if an existing notification never had a delivery job created
    const isPendingDelivery = notification && !(notification.delivered_at || notification.deliveredAt) && !(notification.delivery_failed_at || notification.deliveryFailedAt);
    const shouldEnqueueJob = isNew || isPendingDelivery;

    if (pushEnabled && shouldEnqueueJob) {
      const payload = {
        schema_version: 1,
        job_type: 'SEND_PUSH',
        notification_type: type,
        notification_id: notification.id, // For worker to update delivered_at
        user_id: userId,
        title,
        body,
        metadata,
        delivery_channel: 'PUSH_AND_INAPP',
      };

      await tx.$executeRaw`
        INSERT INTO notification_jobs (
          id, status, payload, priority, attempt_count, max_attempts,
          available_at, idempotency_key, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), 'PENDING', ${payload}::jsonb, ${priority}, 0, 4,
          now(), ${idempotencyKey}, now(), now()
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      `;
    }

    // 5. Emit Realtime SSE Event only for newly created notifications
    if (isNew) {
      await tx.$executeRaw`
        SELECT pg_notify(
          ${`user_${userId}_notifications_live`},
          ${JSON.stringify({
            type: 'NOTIFICATION_CREATED',
            notification: {
              id: notification.id,
              title: notification.title,
              body: notification.body,
              type: notification.type,
              metadata: notification.metadata,
              readAt: notification.readAt || notification.read_at,
              createdAt: notification.createdAt || notification.created_at
            }
          })}
        )
      `;
    }

    notificationResult = {
      ...notification,
      userId: notification.userId || notification.user_id,
      user_id: notification.user_id || notification.userId,
      readAt: notification.readAt || notification.read_at,
      read_at: notification.read_at || notification.readAt,
      deliveredAt: notification.deliveredAt || notification.delivered_at,
      delivered_at: notification.delivered_at || notification.deliveredAt,
      deliveryFailedAt: notification.deliveryFailedAt || notification.delivery_failed_at,
      delivery_failed_at: notification.delivery_failed_at || notification.deliveryFailedAt,
      createdAt: notification.createdAt || notification.created_at,
      created_at: notification.created_at || notification.createdAt,
      idempotencyKey: notification.idempotencyKey || notification.idempotency_key,
      idempotency_key: notification.idempotency_key || notification.idempotencyKey,
    };
  } catch (err) {
    operationError = err;
  }

  // Restore transaction context to caller's original context on both success and failure
  let restorationError: unknown = null;
  try {
    const restoreUid = originalUserId ?? '';
    await tx.$executeRaw`SELECT set_config('app.user_id', ${restoreUid}, true)`;
  } catch (err) {
    restorationError = err;
  }

  // Handle outcome and exceptions safely without masking or false reporting
  if (operationError) {
    if (restorationError) {
      // Both operation and restoration failed
      // Preserve original operation error while retaining adequate diagnostics
      if (operationError instanceof Error) {
        (operationError as any).restorationError = restorationError;
        (operationError as any).contextRestored = false;
        if (!('cause' in operationError && operationError.cause)) {
          try {
            (operationError as any).cause = restorationError;
          } catch {}
        }
      }
      console.error('[Notification Context] Restoration failed after operation failure:', {
        operationError,
        restorationError,
      });
    }
    // Throw original operation error (never masked by restoration error)
    throw operationError;
  }

  if (restorationError) {
    // Operation succeeded but restoration failed!
    // Never falsely claim caller's context was restored.
    console.error('[Notification Context] Restoration failed after successful enqueue:', restorationError);
    const errorToThrow = new ContextRestorationError(
      'Failed to restore transaction security context after notification enqueue',
      restorationError
    );
    throw errorToThrow;
  }

  return notificationResult;
};
