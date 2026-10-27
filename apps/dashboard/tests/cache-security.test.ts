import { test, expect, vi, beforeEach } from 'vitest';
import { getWebAuthStore } from '../lib/auth-store';
import { getQueryClient } from '../lib/query-client';
const queryClient = getQueryClient();

beforeEach(() => {
  vi.unstubAllGlobals();
  getWebAuthStore().logout();
});

test('Web Foundation: Logout completely clears the QueryClient cache', () => {
  // Pre-populate some dummy private data in the cache
  queryClient.setQueryData(['private-user-data'], { secret: '123' });
  
  expect(queryClient.getQueryData(['private-user-data'])).toEqual({ secret: '123' });

  // Trigger logout
  getWebAuthStore().logout();

  // Cache must be cleared
  expect(queryClient.getQueryData(['private-user-data'])).toBeUndefined();
  expect(getWebAuthStore().accessToken).toBeNull();
});

test('Web Foundation: Auth store is memory only', () => {
  const store = getWebAuthStore();
  store.setAccessToken('token');
  expect(store.accessToken).toBe('token');
});

test('Web Foundation: Switching access token clears the QueryClient cache to prevent cross-session query bleed', () => {
  const store = getWebAuthStore();
  store.setAccessToken('user-a-token');
  queryClient.setQueryData(['current-user-data'], { userId: 'user-a', email: 'a@example.com' });
  expect(queryClient.getQueryData(['current-user-data'])).toEqual({ userId: 'user-a', email: 'a@example.com' });

  // Switch to User B without explicit logout
  store.setAccessToken('user-b-token');

  // Cache must be cleared on user switch
  expect(queryClient.getQueryData(['current-user-data'])).toBeUndefined();
  expect(store.accessToken).toBe('user-b-token');
});

function createMockJwt(sub: string, exp: number = 3600): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub, exp, iat: Math.floor(Date.now() / 1000) }));
  return `${header}.${payload}.mock-signature`;
}

test('Web Foundation: Same-user token rotation preserves valid query cache without clearing', () => {
  const store = getWebAuthStore();
  const tokenA1 = createMockJwt('user-uuid-100', 3600);
  const tokenA2 = createMockJwt('user-uuid-100', 7200);

  // Initial authentication
  store.setAccessToken(tokenA1);
  queryClient.setQueryData(['dashboard-events'], [{ id: 'evt-1' }]);
  expect(queryClient.getQueryData(['dashboard-events'])).toEqual([{ id: 'evt-1' }]);

  // Routine token refresh for the same user
  store.setAccessToken(tokenA2);

  // Cached data must remain intact
  expect(queryClient.getQueryData(['dashboard-events'])).toEqual([{ id: 'evt-1' }]);
  expect(store.accessToken).toBe(tokenA2);
  expect(store.userId).toBe('user-uuid-100');
});

test('Web Foundation: Switching users via JWT with different sub purges QueryClient cache', () => {
  const store = getWebAuthStore();
  const tokenA = createMockJwt('user-uuid-alice', 3600);
  const tokenB = createMockJwt('user-uuid-bob', 3600);

  store.setAccessToken(tokenA);
  queryClient.setQueryData(['alice-private-dossier'], { secret: 'alice-secret' });
  expect(queryClient.getQueryData(['alice-private-dossier'])).toBeDefined();

  // Switch directly to Bob
  store.setAccessToken(tokenB);

  // Alice's cached queries must be purged
  expect(queryClient.getQueryData(['alice-private-dossier'])).toBeUndefined();
  expect(store.accessToken).toBe(tokenB);
  expect(store.userId).toBe('user-uuid-bob');
});

test('Web Foundation: Token revocation (setAccessToken(null)) purges QueryClient cache', () => {
  const store = getWebAuthStore();
  const token = createMockJwt('user-uuid-charlie', 3600);

  store.setAccessToken(token);
  queryClient.setQueryData(['charlie-query'], { data: 'val' });
  expect(queryClient.getQueryData(['charlie-query'])).toBeDefined();

  // Invalidate session
  store.setAccessToken(null);

  expect(queryClient.getQueryData(['charlie-query'])).toBeUndefined();
  expect(store.accessToken).toBeNull();
  expect(store.userId).toBeNull();
});
