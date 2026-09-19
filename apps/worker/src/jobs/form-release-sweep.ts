import { prisma } from '../index';
import { logger } from '../lib/logger';
import { enqueueNotification } from '@nst/shared';

export async function processFormReleaseSweep() {
  try {
    // 1. Claim forms atomically
    const releasedForms: any[] = await prisma.$queryRaw`
      UPDATE event_forms 
      SET notified_at = now() 
      WHERE release_at <= now() 
        AND notified_at IS NULL 
      RETURNING *
    `;

    if (releasedForms.length === 0) {
      return;
    }

    logger.info(`📦 Claimed ${releasedForms.length} released forms for notification sweep.`);

    for (const form of releasedForms) {
      try {
        // Find all active registered students for this event using queryRaw
        const registrations = await prisma.$queryRaw<any[]>`
          SELECT user_id as "userId" 
          FROM event_registrations 
          WHERE event_id = ${form.event_id}::uuid 
            AND registration_status = 'REGISTERED' 
            AND deleted_at IS NULL
        `;

        let successCount = 0;
        let failCount = 0;

        for (const reg of registrations) {
          try {
            await prisma.$transaction(async (tx) => {
              await enqueueNotification({
                tx: tx as any,
                userId: reg.userId,
                type: 'SYSTEM_ALERT', // Or a custom one, but SYSTEM_ALERT fits best if not extending enum
                title: 'New Form Available',
                body: `The form "${form.title}" is now available for you to fill out.`,
                metadata: {
                  schema_version: 1,
                  routing: {
                    target: 'EventForm',
                    fallback: 'Home',
                    params: { eventId: form.event_id, formId: form.id },
                  },
                  entity_ids: { event_id: form.event_id },
                },
                preferenceGate: 'push_enabled', // or generic bypass if we want to force
                idempotencyString: `${form.id}_${reg.userId}_FORM_RELEASE`,
              });
            });
            successCount++;
          } catch (e: any) {
            failCount++;
            logger.error({ error: { failure_reason: 'FormReleaseEnqueueError', stack: e.stack, userId: reg.userId, formId: form.id } }, '❌ Failed to enqueue form release notification for user');
          }
        }

        logger.info(`✅ Form ${form.id} release sweep complete. Enqueued: ${successCount}, Failed: ${failCount}`);
      } catch (formError: any) {
         logger.error({ error: { failure_reason: 'FormReleaseSweepError', stack: formError.stack, formId: form.id } }, '❌ Failed to process released form notifications');
         // We do not revert `notified_at` because we don't want to infinite-loop on a permanently failing form.
      }
    }
  } catch (error: any) {
    logger.error({ error: { failure_reason: 'FormReleaseSweepDbError', stack: error.stack } }, '❌ Database error during form release sweep');
  }
}
