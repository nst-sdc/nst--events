import { Platform, NativeModules } from 'react-native';
import { safeSecureStore } from '../lib/secure-storage';

export const INSTALL_REFERRER_STATUS_KEY = 'nst_install_referrer_status';
export const INSTALL_REFERRER_STORAGE_KEY = 'nst_install_referrer_processed'; // legacy / fallback
export const INSTALL_REFERRER_DESTINATION_KEY = 'nst_install_referrer_destination';
export const INSTALL_REFERRER_RETRY_COUNT_KEY = 'nst_install_referrer_retry_count';
export const INSTALL_REFERRER_CACHED_RAW_KEY = 'nst_install_referrer_cached_raw';

export const MAX_RETRY_ATTEMPTS = 3;
export const MAX_REFERRER_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days max age

export interface InstallReferrerDetails {
  installReferrer: string | null;
  referrerClickTimestampSeconds: number;
  installBeginTimestampSeconds: number;
  googlePlayInstant: boolean;
}

export interface ParsedInstallReferrer {
  slug: string | null;
  eventId: string | null;
}

export interface ResolvedDestination {
  targetPath: string;
  eventId: string;
  slug?: string;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Safely parses and validates a raw Google Play install referrer string.
 * Supports single and double URL-encoded query parameters.
 * Validates slug and eventId formats with strict regexes to prevent script/path injection.
 */
export function parseInstallReferrer(rawReferrer: string | null | undefined): ParsedInstallReferrer | null {
  if (!rawReferrer || typeof rawReferrer !== 'string') {
    return null;
  }

  let decoded = rawReferrer.trim();
  try {
    decoded = decodeURIComponent(decoded);
    // Handle double-encoded play store params (e.g., referrer=slug%3Dabc%26eventId%3Dxyz)
    if (decoded.includes('%3D') || decoded.includes('%26')) {
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // Malformed URI encoding - fail safely
    return null;
  }

  // Parse key-value pairs
  const pairs = decoded.split('&');
  let extractedSlug: string | null = null;
  let extractedEventId: string | null = null;

  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join('=').trim();

    if (key === 'slug' && value) {
      // Validate slug format and reasonable length
      if (value.length >= 2 && value.length <= 100 && SLUG_REGEX.test(value)) {
        extractedSlug = value.toLowerCase();
      }
    } else if ((key === 'eventid' || key === 'event_id') && value) {
      if (UUID_REGEX.test(value)) {
        extractedEventId = value.toLowerCase();
      }
    }
  }

  if (!extractedSlug && !extractedEventId) {
    return null;
  }

  return {
    slug: extractedSlug,
    eventId: extractedEventId,
  };
}

/**
 * Checks whether post-install referrer has been irreversibly consumed.
 */
export async function hasProcessedInstallReferrer(): Promise<boolean> {
  try {
    const status = await safeSecureStore.getItemAsync(INSTALL_REFERRER_STATUS_KEY);
    if (status === 'CONSUMED') return true;
    const legacy = await safeSecureStore.getItemAsync(INSTALL_REFERRER_STORAGE_KEY);
    return legacy === 'true' && status !== 'PENDING_RETRY' && status !== 'RESOLVED';
  } catch {
    return false;
  }
}

/**
 * Permanently marks the post-install referrer as consumed, preventing replay.
 * Cleans up temporary retry and payload storage.
 */
export async function markInstallReferrerConsumed(): Promise<void> {
  try {
    await safeSecureStore.setItemAsync(INSTALL_REFERRER_STATUS_KEY, 'CONSUMED');
    await safeSecureStore.setItemAsync(INSTALL_REFERRER_STORAGE_KEY, 'true');
    await safeSecureStore.deleteItemAsync(INSTALL_REFERRER_DESTINATION_KEY);
    await safeSecureStore.deleteItemAsync(INSTALL_REFERRER_RETRY_COUNT_KEY);
    await safeSecureStore.deleteItemAsync(INSTALL_REFERRER_CACHED_RAW_KEY);
  } catch (err) {
    console.error('[InstallReferrer] Failed to persist consumed marker in SecureStore:', err);
  }
}

/**
 * Backwards-compatible alias for markInstallReferrerConsumed.
 */
export async function markInstallReferrerProcessed(): Promise<void> {
  return markInstallReferrerConsumed();
}

/**
 * Retrieves a previously resolved and persisted destination if available.
 */
export async function getPersistedDestination(): Promise<ResolvedDestination | null> {
  try {
    const val = await safeSecureStore.getItemAsync(INSTALL_REFERRER_DESTINATION_KEY);
    if (!val) return null;
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed.targetPath === 'string' && typeof parsed.eventId === 'string') {
      return parsed as ResolvedDestination;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists a validated destination prior to consuming the referrer.
 */
export async function persistDestination(dest: ResolvedDestination): Promise<void> {
  try {
    await safeSecureStore.setItemAsync(INSTALL_REFERRER_DESTINATION_KEY, JSON.stringify(dest));
    await safeSecureStore.setItemAsync(INSTALL_REFERRER_STATUS_KEY, 'RESOLVED');
  } catch (err) {
    console.error('[InstallReferrer] Failed to persist validated destination:', err);
  }
}

/**
 * Gets current count of resolution retry attempts.
 */
export async function getRetryCount(): Promise<number> {
  try {
    const countStr = await safeSecureStore.getItemAsync(INSTALL_REFERRER_RETRY_COUNT_KEY);
    return countStr ? parseInt(countStr, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Records a retry attempt for transient backend failures and caches the raw referrer string.
 */
export async function recordRetryAttempt(rawReferrer: string): Promise<number> {
  try {
    const current = await getRetryCount();
    const next = current + 1;
    await safeSecureStore.setItemAsync(INSTALL_REFERRER_RETRY_COUNT_KEY, next.toString());
    await safeSecureStore.setItemAsync(INSTALL_REFERRER_CACHED_RAW_KEY, rawReferrer);
    await safeSecureStore.setItemAsync(INSTALL_REFERRER_STATUS_KEY, 'PENDING_RETRY');
    return next;
  } catch {
    return 1;
  }
}

/**
 * Retrieves cached raw referrer string from previous transient failure.
 */
export async function getCachedRawReferrer(): Promise<string | null> {
  try {
    return await safeSecureStore.getItemAsync(INSTALL_REFERRER_CACHED_RAW_KEY);
  } catch {
    return null;
  }
}

/**
 * Retrieves the raw Google Play Install Referrer details via first-party native Android module.
 * Protects against stalled IPC calls with a bounded timeout (default: 3500ms).
 * Returns null immediately on iOS, Web, or non-Android environments.
 */
export async function getNativeInstallReferrer(timeoutMs = 3500): Promise<InstallReferrerDetails | null> {
  if (Platform.OS !== 'android') {
    return null;
  }

  const nativeModule = NativeModules.InstallReferrerModule;
  if (!nativeModule || typeof nativeModule.getInstallReferrer !== 'function') {
    return null;
  }

  try {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        resolve(null);
      }, timeoutMs)
    );
    const details = await Promise.race([
      nativeModule.getInstallReferrer(),
      timeoutPromise,
    ]);
    return details as InstallReferrerDetails | null;
  } catch (err) {
    console.warn('[InstallReferrer] Native getInstallReferrer error:', err);
    return null;
  }
}
