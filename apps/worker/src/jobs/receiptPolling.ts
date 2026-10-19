import { expo } from '../index';
import { handleTransientError, handlePermanentError, handleDeadLetter, calculateBackoff } from './retry';
import { logger } from '../lib/logger';
import { expoApiErrorsTotal, jobsProcessedTotal } from '../lib/metrics';
import { config } from '../config';

export async function executeReceiptPolling(tx: any, job: any) {
  const ticketMap = job.ticket_ids;

  if (!ticketMap || typeof ticketMap !== 'object' || Object.keys(ticketMap).length === 0) {
    // Edge case: WAITING_FOR_RECEIPTS but no tickets.
    // Complete it and clear tickets.
    return completeJob(tx, job);
  }

  const ticketIds = Object.keys(ticketMap);
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);

  const confirmedSuccessTickets: string[] = [];
  const permanentFailureTickets: { ticketId: string; token: string; error: string }[] = [];
  const transientErrors: string[] = [];
  const pendingTickets: Record<string, string> = {};

  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const ticketId of chunk) {
        const receipt = receipts ? receipts[ticketId] : undefined;
        const token = ticketMap[ticketId];

        if (!receipt) {
          // Receipt not yet available (delayed / pending in Expo)
          pendingTickets[ticketId] = token;
          continue;
        }

        if (receipt.status === 'ok') {
          confirmedSuccessTickets.push(ticketId);
        } else if (receipt.status === 'error') {
          const errCode = receipt.details?.error || 'Unknown';
          expoApiErrorsTotal.labels({ error_code: errCode }).inc();
          logger.error({ job_id: job.id, ticket_id: ticketId, error: { failure_reason: 'ExpoReceiptError', message: receipt.message, error_code: errCode } }, `Expo receipt error for ticket ${ticketId}`);

          if (errCode === 'DeviceNotRegistered') {
            if (token) {
              logger.info({ job_id: job.id, ticket_id: ticketId, token_snippet: token.slice(-8) }, `🗑️ Expo DeviceNotRegistered: Deleting stale push token`);
              await tx.$executeRaw`DELETE FROM push_tokens WHERE expo_token = ${token}`;
            }
            permanentFailureTickets.push({ ticketId, token, error: errCode });
          } else if (errCode === 'MessageTooBig' || errCode === 'InvalidCredentials') {
            permanentFailureTickets.push({ ticketId, token, error: errCode });
          } else {
            // Transient receipt error (e.g., provider temporary glitch)
            transientErrors.push(errCode);
            pendingTickets[ticketId] = token;
          }
        }
      }
    } catch (error: any) {
      expoApiErrorsTotal.labels({ error_code: 'network_timeout' }).inc();
      logger.error({ job_id: job.id, error: { failure_reason: 'ExpoReceiptNetworkError', stack: error.stack } }, `Expo receipt network error for job ${job.id}`);
      for (const ticketId of chunk) {
        pendingTickets[ticketId] = ticketMap[ticketId];
      }
      transientErrors.push(error.message);
    }
  }

  const pendingCount = Object.keys(pendingTickets).length;
  const notificationId = job.payload?.notification_id;

  // Stamp delivered_at on the notification row immediately upon confirmed receipt
  if (confirmedSuccessTickets.length > 0 && notificationId) {
    await tx.$executeRaw`
      UPDATE notifications
      SET delivered_at = now(), delivery_failed_at = NULL, delivery_error = NULL
      WHERE id = ${notificationId}::uuid
        AND delivered_at IS NULL
    `;
  }

  // Check if this notification has at least one confirmed delivery (either this poll or earlier)
  let hasAnyDelivery = confirmedSuccessTickets.length > 0;
  if (!hasAnyDelivery && notificationId) {
    const notifRows: any[] = await tx.$queryRaw`
      SELECT delivered_at FROM notifications WHERE id = ${notificationId}::uuid
    `;
    if (notifRows.length > 0 && notifRows[0].delivered_at) {
      hasAnyDelivery = true;
    }
  }

  // 1. If tickets remain pending or had transient network issues:
  if (pendingCount > 0 || transientErrors.length > 0) {
    const newAttemptCount = (job.attemptCount || 0) + 1;

    if (newAttemptCount > config.WORKER_MAX_RETRIES) {
      if (hasAnyDelivery) {
        // At least one device was delivered, complete the job even if other pending receipts timed out
        return completeJob(tx, job);
      }
      return handleDeadLetter(tx, job, `Receipt polling attempts exhausted. Pending: ${pendingCount}, Errors: ${transientErrors.join(', ')}`);
    }

    const backoffMs = calculateBackoff(newAttemptCount);
    const updatedTickets = pendingCount > 0 ? pendingTickets : ticketMap;
    const ticketsJson = JSON.stringify(updatedTickets);

    logger.warn({
      job_id: job.id,
      status: 'WAITING_FOR_RECEIPTS',
      attempt_count: newAttemptCount,
      pending_tickets: Object.keys(updatedTickets).length,
      backoff_ms: backoffMs,
    }, `⏳ Receipts pending for job ${job.id}. Scheduling next poll in ${backoffMs}ms.`);

    await tx.$executeRaw`
      UPDATE notification_jobs
      SET status = 'WAITING_FOR_RECEIPTS',
          attempt_count = ${newAttemptCount},
          ticket_ids = ${ticketsJson}::jsonb,
          available_at = now() + interval '1 millisecond' * ${backoffMs},
          updated_at = now()
      WHERE id = ${job.id}::uuid
    `;
    return;
  }

  // 2. All tickets resolved, and at least one device was delivered:
  if (hasAnyDelivery) {
    logger.info({
      job_id: job.id,
      success_count: confirmedSuccessTickets.length,
      permanent_failures: permanentFailureTickets.length,
    }, `🎉 Confirmed receipt delivery for job ${job.id}. Completing job.`);

    return completeJob(tx, job);
  }

  // 3. All tickets resolved, zero successes, all were permanent failures (e.g. DeviceNotRegistered)
  const failureReason = permanentFailureTickets.map(f => f.error).join(', ') || 'All receipts failed permanently';
  return handlePermanentError(tx, job, failureReason);
}

async function completeJob(tx: any, job: any) {
  logger.info({ job_id: job.id, status: 'COMPLETED' }, `🎉 Job ${job.id} completed receipt polling successfully.`);
  jobsProcessedTotal.labels({ status: 'COMPLETED', notification_type: job.payload?.job_type || 'unknown' }).inc();
  await tx.$executeRaw`
    UPDATE notification_jobs
    SET status = 'COMPLETED', ticket_ids = NULL, updated_at = now()
    WHERE id = ${job.id}::uuid
  `;

  // Stamp delivered_at on the notification row
  const notificationId = job.payload?.notification_id;
  if (notificationId) {
    await tx.$executeRaw`
      UPDATE notifications
      SET delivered_at = now(), delivery_failed_at = NULL, delivery_error = NULL
      WHERE id = ${notificationId}::uuid
    `;
  }
}
