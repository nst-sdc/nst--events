import { test, expect, vi, beforeEach, describe } from 'vitest';
import { useAuthStore } from '../src/store/auth';
import { queryClient } from '../src/providers/QueryProvider';
import { logout, teardownSession } from '../src/services/session';
import { apiClient } from '../src/infrastructure/api';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';

let store: Record<string, string> = {};

vi.mock('expo-secure-store', () => ({
  setItemAsync: async (key: string, value: string) => { store[key] = value; },
  getItemAsync: async (key: string) => store[key] || null,
  deleteItemAsync: async (key: string) => { delete store[key]; },
  _reset: () => { store = {}; }
}));

vi.mock('expo-router', () => ({
  router: {
    replace: vi.fn(),
  }
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    signOut: vi.fn().mockResolvedValue(null),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Mobile Session Isolation & Teardown Security', () => {
  beforeEach(() => {
    store = {};
    queryClient.clear();
    vi.clearAllMocks();
  });

  test('1. Terminal refresh failure (SESSION_DEAD) flushes React Query cache', async () => {
    // 1. Establish User A session
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    expect(useAuthStore.getState().isLoggedIn).toBe(true);

    // 2. Seed queryClient with private queries
    queryClient.setQueryData(['events', 'private-event-1'], { title: 'Secret Event' });
    queryClient.setQueryData(['registrations', 'user-a-uuid'], [{ id: 'reg-101' }]);
    queryClient.setQueryData(['user-profile'], { id: 'user-a-uuid', email: 'student-a@nst.edu' });

    expect(queryClient.getQueryData(['events', 'private-event-1'])).toBeDefined();
    expect(queryClient.getQueryData(['registrations', 'user-a-uuid'])).toBeDefined();
    expect(queryClient.getQueryData(['user-profile'])).toBeDefined();

    // 3. Mock 401 on endpoint and 401 on /auth/refresh
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          status: 401,
          ok: false,
          json: async () => ({ message: 'Refresh token expired' }),
        };
      }
      return {
        status: 401,
        ok: false,
        text: async () => JSON.stringify({ message: 'Unauthorized' }),
        json: async () => ({ message: 'Unauthorized' }),
      };
    });

    // 4. Trigger request that encounters SESSION_DEAD
    await expect(apiClient('/events/private-event-1')).rejects.toEqual({
      status: 401,
      message: 'Session expired',
    });

    // 5. Assert React Query cache was completely cleared
    expect(queryClient.getQueryData(['events', 'private-event-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['registrations', 'user-a-uuid'])).toBeUndefined();
    expect(queryClient.getQueryData(['user-profile'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll().length).toBe(0);
  });

  test('2. Authentication cleanup: removes persisted credentials and in-memory state on terminal expiry', async () => {
    // 1. Establish User A session with credentials in SecureStore and Zustand
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    await SecureStore.setItemAsync('access_token', 'token-a');
    await SecureStore.setItemAsync('refresh_token', 'refresh-a');
    await SecureStore.setItemAsync('user_id', 'user-a-uuid');

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return { status: 401, ok: false, json: async () => ({ message: 'Invalid refresh token' }) };
      }
      return { status: 401, ok: false, text: async () => '', json: async () => ({}) };
    });

    // 2. Trigger SESSION_DEAD
    await expect(apiClient('/student/private-resource')).rejects.toEqual({
      status: 401,
      message: 'Session expired',
    });

    // 3. Verify in-memory Zustand auth state is reset
    const authState = useAuthStore.getState();
    expect(authState.isLoggedIn).toBe(false);
    expect(authState.userId).toBeNull();
    expect(authState.accessToken).toBeNull();
    expect(authState.refreshToken).toBeNull();

    // 4. Verify SecureStore credentials are removed
    expect(await SecureStore.getItemAsync('access_token')).toBeNull();
    expect(await SecureStore.getItemAsync('refresh_token')).toBeNull();
    expect(await SecureStore.getItemAsync('user_id')).toBeNull();

    // 5. Verify Google SSO is cleared and navigation reset to auth
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });

  test('3. Account-switch isolation: User B cannot observe User A cached data after SESSION_DEAD teardown', async () => {
    // 1. User A is authenticated and loads sensitive data
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    queryClient.setQueryData(['disputes', 'student-a'], [{ id: 'disp-1', issue: 'Private grade dispute' }]);
    queryClient.setQueryData(['achievements', 'student-a'], { totalScore: 999 });

    // 2. User A encounters terminal session expiry
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return { status: 401, ok: false, json: async () => ({ message: 'Session dead' }) };
      }
      return { status: 401, ok: false, text: async () => '', json: async () => ({}) };
    });

    await expect(apiClient('/disputes')).rejects.toEqual({
      status: 401,
      message: 'Session expired',
    });

    // 3. Verify User A data is gone from cache
    expect(queryClient.getQueryData(['disputes', 'student-a'])).toBeUndefined();
    expect(queryClient.getQueryData(['achievements', 'student-a'])).toBeUndefined();

    // 4. User B logs in on the same device
    await useAuthStore.getState().setSession('user-b-uuid', 'token-b', 'refresh-b');
    expect(useAuthStore.getState().userId).toBe('user-b-uuid');

    // 5. User B attempts to access User A's cache keys
    expect(queryClient.getQueryData(['disputes', 'student-a'])).toBeUndefined();
    expect(queryClient.getQueryData(['achievements', 'student-a'])).toBeUndefined();

    // 6. User B populates their own cache
    queryClient.setQueryData(['disputes', 'user-b-uuid'], [{ id: 'disp-2', issue: 'User B issue' }]);
    expect(queryClient.getQueryData(['disputes', 'user-b-uuid'])).toEqual([{ id: 'disp-2', issue: 'User B issue' }]);
    expect(queryClient.getQueryData(['disputes', 'student-a'])).toBeUndefined();
  });

  test('4. Transient failure: network or 5xx refresh errors do NOT force teardown or flush cache', async () => {
    // 1. Establish User A session
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    queryClient.setQueryData(['events', 'cached-event'], { title: 'Cached Event' });

    // 2. Mock 401 on initial request, but 500 internal server error on /auth/refresh
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          status: 500,
          ok: false,
          json: async () => ({ message: 'Database temporary outage' }),
        };
      }
      return {
        status: 401,
        ok: false,
        text: async () => JSON.stringify({ message: 'Token expired' }),
        json: async () => ({ message: 'Token expired' }),
      };
    });

    // 3. Call apiClient — must throw retryable API error, NOT session expired
    await expect(apiClient('/events/cached-event')).rejects.toEqual({
      status: 401,
      message: 'API Request Failed',
    });

    // 4. Cache must NOT be cleared on transient refresh failures
    expect(queryClient.getQueryData(['events', 'cached-event'])).toEqual({ title: 'Cached Event' });

    // 5. User must remain logged in
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('token-a');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-a');

    // 6. Repeat test for 429 Rate Limiting
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          status: 429,
          ok: false,
          headers: { get: (k: string) => (k.toLowerCase() === 'retry-after' ? '30' : null) },
          json: async () => ({ message: 'Too Many Requests' }),
        };
      }
      return {
        status: 401,
        ok: false,
        text: async () => JSON.stringify({ message: 'Token expired' }),
        json: async () => ({ message: 'Token expired' }),
      };
    });

    await expect(apiClient('/events/cached-event')).rejects.toEqual({
      status: 401,
      message: 'API Request Failed',
    });

    expect(queryClient.getQueryData(['events', 'cached-event'])).toEqual({ title: 'Cached Event' });
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
  });

  test('5. Repeated & concurrent failures: multiple concurrent requests hitting SESSION_DEAD coalesce safely', async () => {
    // 1. Establish User A session
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    queryClient.setQueryData(['data-1'], 'value-1');
    queryClient.setQueryData(['data-2'], 'value-2');
    queryClient.setQueryData(['data-3'], 'value-3');

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          status: 401,
          ok: false,
          json: async () => ({ message: 'Session dead' }),
        };
      }
      return {
        status: 401,
        ok: false,
        text: async () => JSON.stringify({ message: 'Unauthorized' }),
        json: async () => ({ message: 'Unauthorized' }),
      };
    });

    // 2. Dispatch 3 concurrent requests that all hit 401 simultaneously
    const results = await Promise.allSettled([
      apiClient('/req-1'),
      apiClient('/req-2'),
      apiClient('/req-3'),
    ]);

    // 3. Verify all 3 requests reject predictably with terminal error
    for (const res of results) {
      expect(res.status).toBe('rejected');
      if (res.status === 'rejected') {
        expect(res.reason).toEqual({
          status: 401,
          message: 'Session expired',
        });
      }
    }

    // 4. Cache must be completely wiped
    expect(queryClient.getQueryData(['data-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['data-2'])).toBeUndefined();
    expect(queryClient.getQueryData(['data-3'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll().length).toBe(0);

    // 5. Auth state must be wiped
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().userId).toBeNull();

    // 6. Idempotent follow-up: calling teardown again when already cleared is safe
    await expect(teardownSession({ notifyServer: false })).resolves.toBeUndefined();
    expect(queryClient.getQueryCache().getAll().length).toBe(0);
  });

  test('6. Explicit logout() uses the same teardown path and notifies server', async () => {
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    queryClient.setQueryData(['logout-test'], 'secret');

    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await logout();

    // Server was notified
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': 'mobile',
          Authorization: 'Bearer token-a',
        },
        body: JSON.stringify({ refresh_token: 'refresh-a' }),
      })
    );

    // Cache wiped
    expect(queryClient.getQueryData(['logout-test'])).toBeUndefined();
    // Auth cleared
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });

  test('7. Explicit logout clears credentials and cache when server logout request rejects (network failure)', async () => {
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    await SecureStore.setItemAsync('access_token', 'token-a');
    queryClient.setQueryData(['network-fail-key'], { sensitive: true });

    // Server request rejects with a network error
    mockFetch.mockRejectedValueOnce(new Error('Network connection dropped'));

    await logout();

    // Local cleanup must NOT be aborted by network rejection
    expect(queryClient.getQueryData(['network-fail-key'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll().length).toBe(0);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(await SecureStore.getItemAsync('access_token')).toBeNull();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });

  test('8. Explicit logout completes local cleanup when server logout hangs beyond configured bound', async () => {
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    await SecureStore.setItemAsync('access_token', 'token-a');
    queryClient.setQueryData(['hanging-server-key'], { sensitive: true });

    // Server request hangs indefinitely
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/auth/logout')) {
        return new Promise(() => {}); // never resolves
      }
      return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
    });

    const startTime = Date.now();
    // Execute logout with a 50ms bound
    await logout({ serverTimeoutMs: 50 });
    const elapsedTime = Date.now() - startTime;

    // Must have bounded execution (timed out around 50ms, well below default 2000ms)
    expect(elapsedTime).toBeGreaterThanOrEqual(40);
    expect(elapsedTime).toBeLessThan(1000);

    // Local cleanup must have completed despite hanging server
    expect(queryClient.getQueryData(['hanging-server-key'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll().length).toBe(0);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(await SecureStore.getItemAsync('access_token')).toBeNull();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });

  test('9. Local cleanup failures are not swallowed as successful credential removal', async () => {
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    queryClient.setQueryData(['corrupted-storage-key'], { sensitive: true });

    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    // Mock SecureStore failure on delete
    const deleteSpy = vi.spyOn(SecureStore, 'deleteItemAsync').mockRejectedValueOnce(new Error('Hardware storage failure'));

    try {
      // Must reject with the local cleanup failure
      await expect(logout()).rejects.toThrow('Hardware storage failure');

      // However, in-memory state and cache must STILL be purged to prevent memory leakage
      expect(useAuthStore.getState().isLoggedIn).toBe(false);
      expect(queryClient.getQueryData(['corrupted-storage-key'])).toBeUndefined();
    } finally {
      deleteSpy.mockRestore();
    }
  });

  test('10. User-switch cache isolation: setSession with a different userId clears queryClient cache', async () => {
    // 1. Establish User A session and seed cache with User A queries
    await useAuthStore.getState().setSession('user-a-uuid', 'token-a', 'refresh-a');
    queryClient.setQueryData(['my-registration', 'evt-100'], { status: 'CONFIRMED' });
    expect(queryClient.getQueryData(['my-registration', 'evt-100'])).toBeDefined();

    // 2. Switch directly to User B
    await useAuthStore.getState().setSession('user-b-uuid', 'token-b', 'refresh-b');

    // 3. Assert QueryClient cache was cleared to prevent session bleed
    expect(queryClient.getQueryData(['my-registration', 'evt-100'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll().length).toBe(0);
    expect(useAuthStore.getState().userId).toBe('user-b-uuid');
  });

  test('11. Mobile logout sends JSON body { refresh_token }, Content-Type, and no manual Cookie header', async () => {
    await useAuthStore.getState().setSession('user-a-uuid', 'active-access-token', 'active-refresh-token');
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await logout();

    const logoutCall = mockFetch.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('/auth/logout')
    );
    expect(logoutCall).toBeDefined();
    if (!logoutCall) throw new Error('Logout call was not dispatched');

    const [, options] = logoutCall;
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
      Authorization: 'Bearer active-access-token',
    });
    expect(options.headers.Cookie).toBeUndefined();
    expect(options.body).toBe(JSON.stringify({ refresh_token: 'active-refresh-token' }));
  });

  test('12. Mobile logout without accessToken still sends JSON body with refresh_token and no Cookie header', async () => {
    useAuthStore.setState({
      userId: 'user-a-uuid',
      accessToken: null,
      refreshToken: 'active-refresh-token',
      isLoggedIn: true,
    });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await logout();

    const logoutCall = mockFetch.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('/auth/logout')
    );
    expect(logoutCall).toBeDefined();
    if (!logoutCall) throw new Error('Logout call was not dispatched');

    const [, options] = logoutCall;
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
    });
    expect(options.headers.Cookie).toBeUndefined();
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.body).toBe(JSON.stringify({ refresh_token: 'active-refresh-token' }));
  });

  test('13. Scenario 8: Mobile logout sends body token and clears SecureStore even offline', async () => {
    // 1. Establish authenticated mobile session with credentials and cached data
    await useAuthStore.getState().setSession('offline-user-uuid', 'offline-access-token', 'offline-refresh-token');
    queryClient.setQueryData(['offline-data'], { status: 'CONFIDENTIAL' });
    expect(await SecureStore.getItemAsync('access_token')).toBe('offline-access-token');
    expect(await SecureStore.getItemAsync('refresh_token')).toBe('offline-refresh-token');
    expect(await SecureStore.getItemAsync('user_id')).toBe('offline-user-uuid');

    // 2. Simulate offline condition: fetch rejects with NetworkError
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    // 3. Trigger mobile logout
    await logout();

    // 4. Verify request attempted to send refresh_token in JSON body with mobile platform header
    const logoutCall = mockFetch.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('/auth/logout')
    );
    expect(logoutCall).toBeDefined();
    if (!logoutCall) throw new Error('Logout call was not dispatched');

    const [, options] = logoutCall;
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
      Authorization: 'Bearer offline-access-token',
    });
    expect(options.headers.Cookie).toBeUndefined();
    expect(options.body).toBe(JSON.stringify({ refresh_token: 'offline-refresh-token' }));

    // 5. Verify SecureStore credentials are purged despite network failure
    expect(await SecureStore.getItemAsync('access_token')).toBeNull();
    expect(await SecureStore.getItemAsync('refresh_token')).toBeNull();
    expect(await SecureStore.getItemAsync('user_id')).toBeNull();

    // 6. Verify in-memory state and React Query cache are wiped
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().userId).toBeNull();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(queryClient.getQueryData(['offline-data'])).toBeUndefined();
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });
});

