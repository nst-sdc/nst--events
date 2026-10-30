import { create } from 'zustand';
import { safeSecureStore } from '../lib/secure-storage';
import { API_BASE_URL } from '../infrastructure/config';
import { queryClient } from '../providers/QueryProvider';

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  isInitialized: boolean;
  pendingDeepLink: string | null;
  setPendingDeepLink: (link: string | null) => void;
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
  pendingDeepLink: null,
  setPendingDeepLink: (pendingDeepLink) => {
    if (pendingDeepLink) {
      safeSecureStore.setItemAsync('pending_deep_link', pendingDeepLink).catch(() => {});
    } else {
      safeSecureStore.deleteItemAsync('pending_deep_link').catch(() => {});
    }
    set({ pendingDeepLink });
  },

  initSession: async () => {
    try {
      const token = await safeSecureStore.getItemAsync('access_token');
      const userId = await safeSecureStore.getItemAsync('user_id');
      const refreshToken = await safeSecureStore.getItemAsync('refresh_token');
      const persistedPendingDeepLink = await safeSecureStore.getItemAsync('pending_deep_link');
      if (token && userId && refreshToken) {
        set({
          userId,
          accessToken: token,
          refreshToken,
          isLoggedIn: true,
          isInitialized: true,
          pendingDeepLink: persistedPendingDeepLink ?? null,
        });
      } else {
        set({
          userId: null,
          accessToken: null,
          refreshToken: null,
          isLoggedIn: false,
          isInitialized: true,
          pendingDeepLink: persistedPendingDeepLink ?? null,
        });
      }
    } catch {
      set({ userId: null, accessToken: null, refreshToken: null, isLoggedIn: false, isInitialized: true, pendingDeepLink: null });
    }
  },

  setSession: async (userId, accessToken, refreshToken) => {
    const prevUserId = get().userId;
    if (prevUserId && prevUserId !== userId) {
      try {
        queryClient.clear();
      } catch {}
    }
    await safeSecureStore.setItemAsync('access_token', accessToken);
    await safeSecureStore.setItemAsync('user_id', userId);
    await safeSecureStore.setItemAsync('refresh_token', refreshToken);
    set({ userId, accessToken, refreshToken, isLoggedIn: true, isInitialized: true });
  },

  clearSession: async () => {
    await safeSecureStore.deleteItemAsync('access_token');
    await safeSecureStore.deleteItemAsync('user_id');
    await safeSecureStore.deleteItemAsync('refresh_token');
    await safeSecureStore.deleteItemAsync('pending_deep_link');
    set({ userId: null, accessToken: null, refreshToken: null, isLoggedIn: false, isInitialized: true, pendingDeepLink: null });
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
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Platform': 'mobile',
        },
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
        await safeSecureStore.setItemAsync('access_token', data.access_token);
        await safeSecureStore.setItemAsync('refresh_token', data.refresh_token);
        set({ accessToken: data.access_token, refreshToken: data.refresh_token });
        return { status: 'SUCCESS', token: data.access_token };
      }
      return { status: 'SESSION_DEAD' };
    } catch {
      return { status: 'TRANSIENT_ERROR' };
    }
  },
}));
