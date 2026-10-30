import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../src/store/auth';
import { queryClient } from '../src/providers/QueryProvider';
import { logout } from '../src/services/session';
import { apiClient } from '../src/infrastructure/api';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';

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

vi.mock('expo-router', () => ({
  router: {
    replace: vi.fn(),
  },
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    signOut: vi.fn().mockResolvedValue(null),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Phase 1 Authentication Completion Tests', () => {
  beforeEach(() => {
    mockSecureStorage = {};
    vi.clearAllMocks();
  });

  describe('1. apiClient RFC 7807 Error Message Extraction Hierarchy', () => {
    it('prioritizes errorBody.detail over message, error, and fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          type: 'https://api.nstsdc.org/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED',
          message: 'Ignored message',
          error: 'Ignored error',
        }),
      });

      await expect(apiClient('/test-endpoint')).rejects.toEqual({
        status: 403,
        message: 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED',
        body: {
          type: 'https://api.nstsdc.org/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED',
          message: 'Ignored message',
          error: 'Ignored error',
        },
      });
    });

    it('falls back to errorBody.message if detail is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Invalid request payload',
          error: 'Bad Request',
        }),
      });

      await expect(apiClient('/test-endpoint')).rejects.toEqual({
        status: 400,
        message: 'Invalid request payload',
        body: {
          message: 'Invalid request payload',
          error: 'Bad Request',
        },
      });
    });

    it('falls back to errorBody.error if detail and message are missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Server crashed',
        }),
      });

      await expect(apiClient('/test-endpoint')).rejects.toEqual({
        status: 500,
        message: 'Server crashed',
        body: {
          error: 'Server crashed',
        },
      });
    });

    it('falls back to "API Request Failed" if error response body is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(apiClient('/test-endpoint')).rejects.toEqual({
        status: 502,
        message: 'API Request Failed',
        body: {},
      });
    });
  });

  describe('2. Centralized session.logout() Contract & Lifecycle', () => {
    it('dispatches POST /auth/logout with Bearer token and Cookie: refreshToken=..., clears SecureStore, cache, GoogleSignin, and routes to /(auth)', async () => {
      // 1. Establish session
      await useAuthStore.getState().setSession('user-uuid-123', 'active-access-token', 'active-refresh-token');
      expect(useAuthStore.getState().isLoggedIn).toBe(true);

      // Populate QueryClient cache
      queryClient.setQueryData(['test-query'], { data: 'sample' });
      expect(queryClient.getQueryData(['test-query'])).toEqual({ data: 'sample' });

      // Mock server logout response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      // 2. Trigger centralized logout
      await logout();

      // 3. Verify server request format
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Platform': 'mobile',
            Authorization: 'Bearer active-access-token',
          },
          body: JSON.stringify({ refresh_token: 'active-refresh-token' }),
        })
      );

      // 4. Verify SecureStore credentials are destroyed
      expect(mockSecureStorage['access_token']).toBeUndefined();
      expect(mockSecureStorage['refresh_token']).toBeUndefined();
      expect(mockSecureStorage['user_id']).toBeUndefined();

      // 5. Verify Zustand auth state is reset
      expect(useAuthStore.getState().isLoggedIn).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().refreshToken).toBeNull();
      expect(useAuthStore.getState().userId).toBeNull();

      // 6. Verify React Query cache is purged
      expect(queryClient.getQueryData(['test-query'])).toBeUndefined();

      // 7. Verify Google SSO is cleared
      expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);

      // 8. Verify redirection to auth boundary
      expect(router.replace).toHaveBeenCalledWith('/(auth)');
    });

    it('guarantees complete local cleanup even if server-side logout request rejects (offline / network error)', async () => {
      // 1. Establish session
      await useAuthStore.getState().setSession('user-uuid-456', 'stale-access-token', 'stale-refresh-token');
      queryClient.setQueryData(['cached-data'], { sensitive: true });

      // Server throws network error
      mockFetch.mockRejectedValueOnce(new Error('Network offline'));

      // 2. Execute logout
      await logout();

      // 3. Local cleanup must NOT be aborted
      expect(mockSecureStorage['access_token']).toBeUndefined();
      expect(mockSecureStorage['refresh_token']).toBeUndefined();
      expect(useAuthStore.getState().isLoggedIn).toBe(false);
      expect(queryClient.getQueryData(['cached-data'])).toBeUndefined();
      expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/(auth)');
    });
  });
});
