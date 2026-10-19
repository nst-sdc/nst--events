import { expo } from '../index';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { handleTransientError, handlePermanentError, handleArchived } from './retry';
import { config } from '../config';
import { logger } from '../lib/logger';
import { expoApiErrorsTotal, jobsProcessedTotal } from '../lib/metrics';

export async function executePush(tx: any, job: any) {
  const userId = job.payload.user_id;
  
  if (!userId) {
    return handlePermanentError(tx, job, 'Missing user_id in payload');
  }

  // 1. Fetch user and check if entity is deleted
  const user = await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid`;
  if (user.length === 0) {
    return handleArchived(tx, job, `User ${userId} deleted`);
  }

  // 2. Fetch active push tokens for user
  const tokens: any[] = await tx.$queryRaw`SELECT expo_token FROM push_tokens WHERE user_id = ${userId}::uuid`;
  
  if (tokens.length === 0) {
    logger.info({ job_id: job.id, user_id: userId, status: 'COMPLETED' }, `ℹ️ No push tokens for user ${userId}. Job ${job.id} completed silently.`);
    jobsProcessedTotal.labels({ status: 'COMPLETED', notification_type: job.payload?.job_type || 'unknown' }).inc();
    await tx.$executeRaw`
      UPDATE notification_jobs
      SET status = 'COMPLETED', updated_at = now()
      WHERE id = ${job.id}::uuid
    `;
    return;
  }

  // Construct message
  const messages: ExpoPushMessage[] = tokens.map(t => ({
    to: t.expo_token,
    sound: 'default',
    title: job.payload.title,
    body: job.payload.body,
    data: job.payload.metadata || {},
  }));

  // Chunk messages
  const chunks = expo.chunkPushNotifications(messages);
  const ticketMap: Record<string, string> = {};
  const transientErrors: string[] = [];
  const permanentJobErrors: string[] = [];
  const invalidTokens: string[] = [];

  // Send chunks
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      for (let i = 0; i < ticketChunk.length; i++) {
        const ticket = ticketChunk[i];
        const token = chunk[i].to as string;
        
        if (ticket.status === 'ok') {
          ticketMap[ticket.id] = token;
        } else {
          const errCode = ticket.details?.error || 'Unknown';
          expoApiErrorsTotal.labels({ error_code: errCode }).inc();
          
          if (errCode === 'DeviceNotRegistered') {
            invalidTokens.push(token);
            logger.info({ job_id: job.id, token_snippet: token.slice(-8) }, `🗑️ Stale token detected on send: DeviceNotRegistered. Purging token.`);
            await tx.$executeRaw`DELETE FROM push_tokens WHERE expo_token = ${token}`;
          } else if (errCode === 'MessageTooBig' || errCode === 'InvalidCredentials') {
            permanentJobErrors.push(errCode);
          } else {
            transientErrors.push(ticket.message || errCode);
          }
        }
      }
    } catch (error: any) {
      expoApiErrorsTotal.labels({ error_code: 'network_timeout' }).inc();
      logger.error({ job_id: job.id, error: { failure_reason: 'ExpoSendError', stack: error.stack } }, `Expo send error for job ${job.id}`);
      transientErrors.push(error.message);
    }
  }

  // 1. Permanent fatal payload/credential error
  if (permanentJobErrors.length > 0) {
    return handlePermanentError(tx, job, permanentJobErrors.join(', '));
  }

  // 2. At least one ticket was accepted by Expo
  if (Object.keys(ticketMap).length > 0) {
    logger.info({ job_id: job.id, status: 'WAITING_FOR_RECEIPTS', tickets_count: Object.keys(ticketMap).length }, `✅ Sent push for job ${job.id}, received ${Object.keys(ticketMap).length} tickets. Transitioning to WAITING_FOR_RECEIPTS.`);
    
    const ticketsJson = JSON.stringify(ticketMap);
    await tx.$executeRaw`
      UPDATE notification_jobs
      SET status = 'WAITING_FOR_RECEIPTS', 
          ticket_ids = ${ticketsJson}::jsonb, 
          available_at = now() + interval '1 minute' * ${config.EXPO_RECEIPT_DELAY_MINUTES},
          updated_at = now()
      WHERE id = ${job.id}::uuid
    `;
    return;
  }

  // 3. No tickets accepted: check if all tokens were invalid vs transient errors
  if (invalidTokens.length > 0 && invalidTokens.length === tokens.length) {
    logger.warn({ job_id: job.id, invalid_count: invalidTokens.length }, `❌ All registered devices for user ${userId} are unregistered (DeviceNotRegistered).`);
    return handlePermanentError(tx, job, 'DeviceNotRegistered: All registered devices are invalid');
  }

  // 4. Transient failure (network/timeout/rate limit)
  if (transientErrors.length > 0) {
    return handleTransientError(tx, job, transientErrors.join(', '));
  }

  // 5. Fallback edge case
  return handlePermanentError(tx, job, 'Unknown failure: No tickets accepted and no errors returned.');
}
