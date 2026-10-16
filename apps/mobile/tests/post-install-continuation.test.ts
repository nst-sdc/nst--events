import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseInstallReferrer,
  hasProcessedInstallReferrer,
  markInstallReferrerConsumed,
  getPersistedDestination,
  persistDestination,
  getRetryCount,
  getCachedRawReferrer,
  INSTALL_REFERRER_STATUS_KEY,
  INSTALL_REFERRER_DESTINATION_KEY,
  MAX_REFERRER_AGE_SECONDS,
  MAX_RETRY_ATTEMPTS,
} from '../src/infrastructure/install-referrer';
import { resolvePostInstallTarget } from '../src/infrastructure/post-install-continuation';
import { useAuthStore } from '../src/store/auth';
import { NativeModules, Platform } from 'react-native';

let mockSecureStorage: Record<string, string> = {};

vi.mock('expo-secure-store', () => ({
  setItemAsync: async (key: string, value: string) => {
    mockSecureStorage[key] = value;
  },
  getItemAsync: async (key: string) => mockSecureStorage[key] || null,
  deleteItemAsync: async (key: string) => {
    delete mockSecureStorage[key];
  },
  _reset: () => {
    mockSecureStorage = {};
  },
}));

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
}));

describe('Android Post-Install Event Continuation & Referrer Reliability Suite', () => {
  beforeEach(() => {
    mockSecureStorage = {};
    vi.clearAllMocks();
    Platform.OS = 'android';
    if (NativeModules) {
      delete (NativeModules as any).InstallReferrerModule;
    }
  });

  // --------------------------------------------------------------------------
  // 1. Parsing and Sanitization Unit Tests
  // --------------------------------------------------------------------------
  describe('1. Referrer Parameter Parsing & Injection Sanitization', () => {
    it('successfully extracts valid slug and eventId from standard query format', () => {
      const raw = 'slug=ai-hackathon-2026&eventId=11111111-2222-3333-4444-555555555555';
      const parsed = parseInstallReferrer(raw);
      expect(parsed).toEqual({
        slug: 'ai-hackathon-2026',
        eventId: '11111111-2222-3333-4444-555555555555',
      });
    });

    it('decodes single and double URL-encoded Google Play parameters correctly', () => {
      const encoded = 'slug%3Dcyber-def-2026%26eventId%3Da0000000-0000-4000-8000-000000000001';
      const parsed = parseInstallReferrer(encoded);
      expect(parsed).toEqual({
        slug: 'cyber-def-2026',
        eventId: 'a0000000-0000-4000-8000-000000000001',
      });
    });

    it('extracts slug when surrounded by UTM marketing tags', () => {
      const raw = 'utm_source=google-play&utm_medium=cpc&slug=robotics-summit-2026&utm_campaign=campus';
      const parsed = parseInstallReferrer(raw);
      expect(parsed).toEqual({
        slug: 'robotics-summit-2026',
        eventId: null,
      });
    });

    it('rejects XSS and script injection payloads in slug', () => {
      const raw = 'slug=<script>alert("hack")</script>&eventId=11111111-2222-3333-4444-555555555555';
      const parsed = parseInstallReferrer(raw);
      expect(parsed).toEqual({
        slug: null,
        eventId: '11111111-2222-3333-4444-555555555555',
      });
    });

    it('rejects path traversal attempts in slug', () => {
      const raw = 'slug=../../admin/secret-event';
      const parsed = parseInstallReferrer(raw);
      expect(parsed).toBeNull();
    });

    it('rejects custom scheme or protocol injection in slug', () => {
      const raw = 'slug=javascript:void(0)&eventId=not-a-uuid';
      const parsed = parseInstallReferrer(raw);
      expect(parsed).toBeNull();
    });

    it('rejects malformed or non-UUID eventId values', () => {
      const raw = 'eventId=xyz-not-a-uuid-12345';
      const parsed = parseInstallReferrer(raw);
      expect(parsed).toBeNull();
    });

    it('safely handles empty, null, undefined, or garbage strings', () => {
      expect(parseInstallReferrer(null)).toBeNull();
      expect(parseInstallReferrer(undefined)).toBeNull();
      expect(parseInstallReferrer('')).toBeNull();
      expect(parseInstallReferrer('   ')).toBeNull();
      expect(parseInstallReferrer('foo=bar&baz=qux')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Replay Prevention & Repeated App Startup Tests
  // --------------------------------------------------------------------------
  describe('2. Replay Prevention & Repeated App Startup', () => {
    it('returns false for hasProcessedInstallReferrer on fresh install', async () => {
      const processed = await hasProcessedInstallReferrer();
      expect(processed).toBe(false);
    });

    it('marks consumed status in secure store and avoids repeated execution on subsequent launches', async () => {
      await markInstallReferrerConsumed();
      const processed = await hasProcessedInstallReferrer();
      expect(processed).toBe(true);
      expect(mockSecureStorage[INSTALL_REFERRER_STATUS_KEY]).toBe('CONSUMED');

      // Subsequent resolvePostInstallTarget call bails out immediately
      const result = await resolvePostInstallTarget();
      expect(result).toEqual({ handled: false, reason: 'ALREADY_CONSUMED' });
    });
  });

  // --------------------------------------------------------------------------
  // 3. Transient Network Failure & Bounded Retries
  // --------------------------------------------------------------------------
  describe('3. Transient Network Failure & Bounded Retries', () => {
    it('does NOT permanently discard valid referrer on transient network error, preserving state for next startup', async () => {
      const { apiClient } = await import('../src/infrastructure/api');
      const nowSec = Math.floor(Date.now() / 1000);

      (NativeModules as any).InstallReferrerModule = {
        getInstallReferrer: vi.fn().mockResolvedValue({
          installReferrer: 'slug=resilient-hackathon-2026',
          referrerClickTimestampSeconds: nowSec - 120,
          installBeginTimestampSeconds: nowSec - 30,
          googlePlayInstant: false,
        }),
      };

      // 1st attempt: transient network failure (e.g. backend offline / 503)
      (apiClient as any).mockRejectedValueOnce({
        status: 503,
        message: 'Service Unavailable',
      });

      const firstResult = await resolvePostInstallTarget();
      expect(firstResult).toEqual({ handled: false, reason: 'TRANSIENT_NETWORK_ERROR' });

      // Verify referrer is NOT marked consumed
      expect(await hasProcessedInstallReferrer()).toBe(false);
      expect(await getRetryCount()).toBe(1);
      expect(await getCachedRawReferrer()).toBe('slug=resilient-hackathon-2026');

      // 2nd attempt: network is restored, backend returns healthy event payload
      (apiClient as any).mockResolvedValueOnce({
        id: '12345678-1234-4234-8234-123456789abc',
        slug: 'resilient-hackathon-2026',
        title: 'Resilient Hackathon',
      });

      const secondResult = await resolvePostInstallTarget();
      expect(secondResult).toEqual({
        handled: true,
        targetPath: '/(app)/events/12345678-1234-4234-8234-123456789abc/register',
        eventId: '12345678-1234-4234-8234-123456789abc',
        slug: 'resilient-hackathon-2026',
      });

      // Destination was persisted and referrer is now marked consumed
      expect(await hasProcessedInstallReferrer()).toBe(true);
    });

    it('safely exhausts bounded retries (MAX_RETRY_ATTEMPTS = 3) on persistent network outage and falls back', async () => {
      const { apiClient } = await import('../src/infrastructure/api');
      const nowSec = Math.floor(Date.now() / 1000);

      (NativeModules as any).InstallReferrerModule = {
        getInstallReferrer: vi.fn().mockResolvedValue({
          installReferrer: 'slug=outage-event-2026',
          referrerClickTimestampSeconds: nowSec - 100,
          installBeginTimestampSeconds: nowSec - 20,
          googlePlayInstant: false,
        }),
      };

      // Attempt 1: Network failure
      (apiClient as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const res1 = await resolvePostInstallTarget();
      expect(res1).toEqual({ handled: false, reason: 'TRANSIENT_NETWORK_ERROR' });
      expect(await getRetryCount()).toBe(1);

      // Attempt 2: Network failure
      (apiClient as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const res2 = await resolvePostInstallTarget();
      expect(res2).toEqual({ handled: false, reason: 'TRANSIENT_NETWORK_ERROR' });
      expect(await getRetryCount()).toBe(2);

      // Attempt 3: Final retry attempt also fails -> exhausted
      (apiClient as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const res3 = await resolvePostInstallTarget();
      expect(res3).toEqual({ handled: false, reason: 'RETRIES_EXHAUSTED' });

      // After exhaustion, referrer is consumed so startup never loops
      expect(await hasProcessedInstallReferrer()).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Permanent Error Handling (No Retries)
  // --------------------------------------------------------------------------
  describe('4. Permanent Error Quarantine (Zero Retries)', () => {
    it('immediately consumes referrer and does NOT retry when slug returns 404 Not Found', async () => {
      const { apiClient } = await import('../src/infrastructure/api');
      const nowSec = Math.floor(Date.now() / 1000);

      (NativeModules as any).InstallReferrerModule = {
        getInstallReferrer: vi.fn().mockResolvedValue({
          installReferrer: 'slug=deleted-or-nonexistent-event',
          referrerClickTimestampSeconds: nowSec - 100,
          installBeginTimestampSeconds: nowSec - 30,
          googlePlayInstant: false,
        }),
      };

      (apiClient as any).mockRejectedValueOnce({
        status: 404,
        message: 'Event not found',
      });

      const result = await resolvePostInstallTarget();
      expect(result).toEqual({ handled: false, reason: 'EVENT_NOT_FOUND' });
      expect(await hasProcessedInstallReferrer()).toBe(true);

      // Next launch bails immediately with ALREADY_CONSUMED
      const nextLaunch = await resolvePostInstallTarget();
      expect(nextLaunch).toEqual({ handled: false, reason: 'ALREADY_CONSUMED' });
    });

    it('immediately consumes expired referrers older than 7 days', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const staleTimestamp = nowSec - (MAX_REFERRER_AGE_SECONDS + 3600);

      (NativeModules as any).InstallReferrerModule = {
        getInstallReferrer: vi.fn().mockResolvedValue({
          installReferrer: 'slug=old-gala-2025',
          referrerClickTimestampSeconds: staleTimestamp - 60,
          installBeginTimestampSeconds: staleTimestamp,
          googlePlayInstant: false,
        }),
      };

      const result = await resolvePostInstallTarget();
      expect(result).toEqual({ handled: false, reason: 'EXPIRED_REFERRER' });
      expect(await hasProcessedInstallReferrer()).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Crash Recovery & Validated Destination Persistence
  // --------------------------------------------------------------------------
  describe('5. Crash Recovery & Validated Destination Restoration', () => {
    it('restores persisted destination if process died before navigation completed', async () => {
      const destination = {
        targetPath: '/(app)/events/77777777-6666-4555-8444-333333333333/register',
        eventId: '77777777-6666-4555-8444-333333333333',
        slug: 'crash-resilient-event',
      };

      // Simulate destination was persisted prior to app crash
      await persistDestination(destination);

      // On next startup, resolvePostInstallTarget restores destination directly without network query
      const result = await resolvePostInstallTarget();
      expect(result).toEqual({
        handled: true,
        targetPath: destination.targetPath,
        eventId: destination.eventId,
        slug: destination.slug,
      });

      expect(await hasProcessedInstallReferrer()).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Auth Continuation & Persistent Pending Deep Link
  // --------------------------------------------------------------------------
  describe('6. Auth Store Persistent Pending Deep Link', () => {
    it('persists pendingDeepLink across app restarts so unauthenticated install flow resumes after sign-in', async () => {
      const targetPath = '/(app)/events/e44b9343-2287-41a4-b02c-74a6bebe6a9d/register';

      // 1. Set pending deep link on fresh unauthenticated launch
      useAuthStore.getState().setPendingDeepLink(targetPath);
      expect(mockSecureStorage['pending_deep_link']).toBe(targetPath);

      // 2. Simulate app process restart: clear Zustand store memory
      useAuthStore.setState({
        userId: null,
        accessToken: null,
        refreshToken: null,
        isLoggedIn: false,
        isInitialized: false,
        pendingDeepLink: null,
      });

      // 3. Re-initialize session from storage
      await useAuthStore.getState().initSession();
      expect(useAuthStore.getState().pendingDeepLink).toBe(targetPath);

      // 4. Simulate successful authentication clearing pending deep link
      useAuthStore.getState().setPendingDeepLink(null);
      expect(useAuthStore.getState().pendingDeepLink).toBeNull();
      expect(mockSecureStorage['pending_deep_link']).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Non-Android Platform Isolation
  // --------------------------------------------------------------------------
  describe('7. Non-Android Platform Isolation', () => {
    it('immediately returns NO_REFERRER on iOS without attempting native Android calls', async () => {
      Platform.OS = 'ios';
      const result = await resolvePostInstallTarget();
      expect(result).toEqual({ handled: false, reason: 'NO_REFERRER' });
    });

    it('immediately returns NO_REFERRER on Web without attempting native Android calls', async () => {
      Platform.OS = 'web';
      const result = await resolvePostInstallTarget();
      expect(result).toEqual({ handled: false, reason: 'NO_REFERRER' });
    });
  });
});
