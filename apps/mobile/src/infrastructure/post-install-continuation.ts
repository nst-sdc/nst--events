import {
  hasProcessedInstallReferrer,
  markInstallReferrerConsumed,
  getNativeInstallReferrer,
  parseInstallReferrer,
  getPersistedDestination,
  persistDestination,
  getRetryCount,
  recordRetryAttempt,
  getCachedRawReferrer,
  MAX_RETRY_ATTEMPTS,
  MAX_REFERRER_AGE_SECONDS,
} from './install-referrer';
import { apiClient } from './api';

export interface PostInstallResolutionResult {
  handled: boolean;
  targetPath?: string;
  eventId?: string;
  slug?: string;
  reason?: string;
}

/**
 * Resolves the event registration target from Google Play Install Referrer.
 * 
 * Reliability & Fault-Tolerance Guarantees:
 * 1. Replay Prevention: Exits immediately if the referrer was already consumed.
 * 2. Crash Resilience: If a destination was previously validated and persisted, it is immediately
 *    restored even if the process died before navigation/auth finished.
 * 3. Transient Failure Protection: Network offline, timeout, or 5xx backend errors do NOT permanently
 *    discard the referrer. Retries are bounded to MAX_RETRY_ATTEMPTS (3).
 * 4. Permanent Error Quarantine: 404 Not Found, 400 Bad Request, malformed slugs, and expired referrers
 *    (> 7 days) are consumed immediately with zero retry loops.
 * 5. Validated Destination Persistence: The destination is persisted to SecureStore before the referrer
 *    is irreversibly consumed.
 */
export async function resolvePostInstallTarget(): Promise<PostInstallResolutionResult> {
  // 1. Replay prevention check
  const alreadyConsumed = await hasProcessedInstallReferrer();
  if (alreadyConsumed) {
    return { handled: false, reason: 'ALREADY_CONSUMED' };
  }

  // 2. Check for previously validated destination (app restarted or crashed after API resolution)
  const persistedDest = await getPersistedDestination();
  if (persistedDest && persistedDest.targetPath && persistedDest.eventId) {
    await markInstallReferrerConsumed();
    return {
      handled: true,
      targetPath: persistedDest.targetPath,
      eventId: persistedDest.eventId,
      slug: persistedDest.slug,
    };
  }

  // 3. Retrieve raw referrer (check cached raw referrer from previous transient retry first)
  let rawReferrer = await getCachedRawReferrer();
  let installBeginTimestamp = 0;

  if (!rawReferrer) {
    const details = await getNativeInstallReferrer();
    if (!details || !details.installReferrer) {
      // No Play Store referrer on this installation
      await markInstallReferrerConsumed();
      return { handled: false, reason: 'NO_REFERRER' };
    }
    rawReferrer = details.installReferrer;
    installBeginTimestamp = details.installBeginTimestampSeconds || 0;
  }

  // 4. Stale referrer expiration check (7-day cap)
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    installBeginTimestamp > 0 &&
    nowSec - installBeginTimestamp > MAX_REFERRER_AGE_SECONDS
  ) {
    await markInstallReferrerConsumed();
    return { handled: false, reason: 'EXPIRED_REFERRER' };
  }

  // 5. Parse and sanitize referrer parameters against strict regexes
  const parsed = parseInstallReferrer(rawReferrer);
  if (!parsed || (!parsed.slug && !parsed.eventId)) {
    await markInstallReferrerConsumed();
    return { handled: false, reason: 'INVALID_REFERRER_PARAMS' };
  }

  // 6. Resolve event ID from slug or validate eventId via backend API
  let resolvedEventId = parsed.eventId;

  if (parsed.slug) {
    try {
      const res: any = await apiClient(`/v1/events/public/${encodeURIComponent(parsed.slug)}`);
      if (res?.redirect && res.canonical_slug) {
        const canonicalRes: any = await apiClient(`/v1/events/public/${encodeURIComponent(res.canonical_slug)}`);
        if (canonicalRes?.id) {
          resolvedEventId = canonicalRes.id;
        }
      } else if (res?.id) {
        resolvedEventId = res.id;
      }
    } catch (err: any) {
      const httpStatus = err?.status;

      // Permanent client errors: slug definitively not found or invalid
      if (httpStatus === 404 || httpStatus === 400) {
        await markInstallReferrerConsumed();
        return { handled: false, reason: 'EVENT_NOT_FOUND' };
      }

      // Transient network or server error (timeout, network offline, 502/503/504)
      const currentRetries = await getRetryCount();
      if (currentRetries >= MAX_RETRY_ATTEMPTS - 1) {
        // Bounded retries exhausted -> fallback safely to standard app startup
        await markInstallReferrerConsumed();
        return { handled: false, reason: 'RETRIES_EXHAUSTED' };
      }

      // Record retry attempt and preserve raw referrer for next startup
      await recordRetryAttempt(rawReferrer);
      return { handled: false, reason: 'TRANSIENT_NETWORK_ERROR' };
    }
  }

  if (!resolvedEventId) {
    await markInstallReferrerConsumed();
    return { handled: false, reason: 'EVENT_NOT_FOUND' };
  }

  // 7. Validated Destination Construction & Atomic Persistence
  const targetPath = `/(app)/events/${resolvedEventId}/register`;
  const destination = {
    targetPath,
    eventId: resolvedEventId,
    slug: parsed.slug ?? undefined,
  };

  // Persist validated destination before consuming the raw referrer
  await persistDestination(destination);
  await markInstallReferrerConsumed();

  return {
    handled: true,
    targetPath,
    eventId: resolvedEventId,
    slug: parsed.slug ?? undefined,
  };
}
