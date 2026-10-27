// In-memory access token store for Web (Next.js client)
// This strictly avoids localStorage to prevent XSS exfiltration of access tokens.
// The refresh token is managed exclusively via HttpOnly cookies by the backend.

import { getQueryClient } from './query-client';

export function extractJwtSubject(token: string | null): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length >= 2) {
    try {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('utf-8');
      const parsed = JSON.parse(jsonPayload);
      if (parsed && typeof parsed === 'object') {
        const sub = parsed.sub ?? parsed.userId ?? parsed.id;
        if (typeof sub === 'string' && sub.trim()) {
          return sub.trim();
        }
      }
    } catch {
      // In case of non-JWT payload, fall through
    }
  }
  return token.trim();
}

export interface WebAuthStore {
  accessToken: string | null;
  userId: string | null;
  setAccessToken: (token: string | null, userId?: string | null) => void;
  logout: () => void;
}

const authState: WebAuthStore = {
  accessToken: null,
  userId: null,
  setAccessToken: (token: string | null, explicitUserId?: string | null) => {
    const prevUserId = authState.userId;
    const nextUserId = token
      ? (explicitUserId !== undefined ? explicitUserId : extractJwtSubject(token))
      : null;

    // Purge cache if session is explicitly cleared (revocation / logout)
    // or if the user principal has transitioned to a different user identity.
    if (prevUserId && (!nextUserId || prevUserId !== nextUserId)) {
      getQueryClient().clear();
    }

    authState.accessToken = token;
    authState.userId = nextUserId;
  },
  logout: () => {
    authState.accessToken = null;
    authState.userId = null;
    getQueryClient().clear();
    if (typeof document !== 'undefined') {
      document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem('return_to');
      window.location.href = '/login';
    }
  },
};

export const getWebAuthStore = () => authState;
