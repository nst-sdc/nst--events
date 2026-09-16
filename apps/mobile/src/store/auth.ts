import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../infrastructure/config';

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  isInitialized: boolean;
  initSession: () => Promise<void>;
  setSession: (userId: string, accessToken: string, refreshToken: string) => Promise<void>;
  clearSession: () => Promise<void>;
  refreshAccessToken: () => Promise<RefreshResult>;
}

export type RefreshResult =
  | { status: 'SUCCESS'; token: string }
  | { status: 'SESSION_DEAD' }
  | { status: 'RATE_LIMITED'; retryAfter?: number }
  | { status: 'TRANSIENT_ERROR' };

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  accessToken: null,
  refreshToken: null,
  isLoggedIn: false,
  isInitialized: false,

  initSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const userId = await SecureStore.getItemAsync('user_id');
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (token && userId && refreshToken) {
        set({ userId, accessToken: token, refreshToken, isLoggedIn: true, isInitialized: true });
      } else {
        set({ userId: null, accessToken: null, refreshToken: null, isLoggedIn: false, isInitialized: true });
      }
    } catch {
      set({ userId: null, accessToken: null, refreshToken: null, isLoggedIn: false, isInitialized: true });
    }
  },

  setSession: async (userId, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('user_id', userId);
    await SecureStore.setItemAsync('refresh_token', refreshToken);
    set({ userId, accessToken, refreshToken, isLoggedIn: true, isInitialized: true });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('user_id');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ userId: null, accessToken: null, refreshToken: null, isLoggedIn: false, isInitialized: true });
  },

  /**
   * Refresh the access token using the stored refresh token.
   * Calls POST /auth/refresh DIRECTLY via fetch() — never through apiClient —
   * to prevent recursive 401-retry handling.
   * Returns the new access_token on success, or null on failure.
   */
  refreshAccessToken: async (): Promise<RefreshResult> => {
    const currentRefresh = get().refreshToken;
    if (!currentRefresh) return { status: 'SESSION_DEAD' };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentRefresh }),
      });

      if (response.status === 401) return { status: 'SESSION_DEAD' };
      if (response.status === 429) {
        const retryHeader = response.headers.get('retry-after');
        const retryAfter = retryHeader ? parseInt(retryHeader, 10) : undefined;
        return { status: 'RATE_LIMITED', retryAfter };
      }
      if (!response.ok) return { status: 'TRANSIENT_ERROR' };

      const data = await response.json();
      if (data.access_token && data.refresh_token) {
        await SecureStore.setItemAsync('access_token', data.access_token);
        await SecureStore.setItemAsync('refresh_token', data.refresh_token);
        set({ accessToken: data.access_token, refreshToken: data.refresh_token });
        return { status: 'SUCCESS', token: data.access_token };
      }
      return { status: 'SESSION_DEAD' };
    } catch {
      return { status: 'TRANSIENT_ERROR' };
    }
  },
}));
