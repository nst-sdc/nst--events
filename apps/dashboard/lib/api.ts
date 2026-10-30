/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Minimal Web API Foundation Architecture
 * Establishes typed client, error handling, and authentication boundaries for Dashboard.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL !== undefined && process.env.NEXT_PUBLIC_API_URL !== ''
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:3001';
import { getWebAuthStore } from './auth-store';
import { formatErrorMessage } from './error-utils';

export class ApiError extends Error {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  requestId?: string;
  retryAfter?: number;

  constructor(status: number, message: string, data: any, requestId?: string, retryAfter?: number) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.status = status;
    this.data = data;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
    this.name = 'ApiError';
  }
}

export type RefreshResult =
  | { status: 'SUCCESS'; token: string }
  | { status: 'SESSION_DEAD' }
  | { status: 'RATE_LIMITED'; retryAfter?: number }
  | { status: 'TRANSIENT_ERROR' };

// Module-level promise to prevent duplicate concurrent refresh requests across remounts and queries
let refreshPromise: Promise<RefreshResult> | null = null;
let refreshAbortController: AbortController | null = null;

export const abortInFlightRefresh = () => {
  if (refreshAbortController) {
    refreshAbortController.abort();
    refreshAbortController = null;
  }
  refreshPromise = null;
};

export const refreshToken = async (): Promise<RefreshResult> => {
  const authStore = getWebAuthStore();
  if (authStore.isLoggingOut) {
    return { status: 'SESSION_DEAD' };
  }

  if (!refreshPromise) {
    refreshAbortController = new AbortController();
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
      },
      credentials: 'include',
      signal: refreshAbortController.signal,
    })
      .then(async (res) => {
        if (authStore.isLoggingOut) {
          return { status: 'SESSION_DEAD' as const };
        }
        if (res.status === 401) {
          return { status: 'SESSION_DEAD' as const };
        }
        if (res.status === 429) {
          const retryHeader = res.headers.get('retry-after');
          const retryAfter = retryHeader ? parseInt(retryHeader, 10) : undefined;
          return { status: 'RATE_LIMITED' as const, retryAfter };
        }
        if (!res.ok) {
          return { status: 'TRANSIENT_ERROR' as const };
        }
        try {
          const data = await res.json();
          if (authStore.isLoggingOut) {
            return { status: 'SESSION_DEAD' as const };
          }
          if (data?.access_token) {
            if (typeof document !== 'undefined' && data?.user?.global_role) {
              document.cookie = `user_role=${data.user.global_role}; path=/; max-age=2592000; SameSite=Lax`;
            }
            return { status: 'SUCCESS' as const, token: data.access_token };
          }
          return { status: 'SESSION_DEAD' as const };
        } catch {
          return { status: 'SESSION_DEAD' as const };
        }
      })
      .catch((err) => {
        if (authStore.isLoggingOut || err?.name === 'AbortError') {
          return { status: 'SESSION_DEAD' as const };
        }
        return { status: 'TRANSIENT_ERROR' as const };
      })
      .finally(() => {
        refreshPromise = null;
        refreshAbortController = null;
      });
  }
  return refreshPromise;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiClient = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  // Web Authentication Integration Boundary
  // Expects cookies (httpOnly) or localStorage fallback depending on future auth implementation.
  // Currently backend relies on `Authorization: Bearer` or cookies. Dashboard will use cookies.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    'X-Client-Platform': 'web',
    ...(options.headers as Record<string, string> || {}),
  };

  if (isFormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  const authStore = getWebAuthStore();

  if (authStore.accessToken) {
    headers['Authorization'] = `Bearer ${authStore.accessToken}`;
  }

  // Ensure credentials (cookies) are sent with every request
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: (endpoint === '/auth/refresh' || endpoint === '/auth/logout') ? 'include' : 'omit',
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
  let requestId = response.headers.get('x-request-id') || undefined;

  // Intercept 401 Unauthorized for transparent refresh & retry (exactly once)
  let refreshResult: RefreshResult | null = null;
  if (response.status === 401 && endpoint !== '/auth/refresh' && endpoint !== '/auth/logout') {
    if (authStore.isLoggingOut) {
      throw new ApiError(response.status, 'Session logged out', null, requestId);
    }
    refreshResult = await refreshToken();
    
    if (refreshResult.status === 'SUCCESS' && !authStore.isLoggingOut) {
      const newToken = refreshResult.token;
      authStore.setAccessToken(newToken);
      // Retry original request with new token
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': `Bearer ${newToken}`,
      };
      response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
      requestId = response.headers.get('x-request-id') || undefined;
    }
  }

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errorBody: any = {};
    try {
      errorBody = await response.json();
    } catch {
      // Body might be empty or plain text
    }
    
    // Terminal authentication failure: ONLY logout if refresh specifically returned 401 (SESSION_DEAD)
    // NEVER logout if refresh or original request returned 429 or transient error
    if (endpoint !== '/auth/refresh' && refreshResult?.status === 'SESSION_DEAD') {
      authStore.logout();
    }
    if (endpoint === '/auth/refresh' && response.status === 401) {
      authStore.logout();
    }

    const retryHeader = response.headers.get('retry-after');
    const retryAfter = retryHeader ? parseInt(retryHeader, 10) : errorBody?.retryAfter;
    const rawMessage = errorBody?.detail || errorBody?.message;
    const humanMessage = rawMessage
      ? formatErrorMessage(rawMessage || errorBody, rawMessage)
      : 'API Request Failed';

    throw new ApiError(
      response.status,
      humanMessage,
      errorBody,
      requestId,
      retryAfter
    );
  }

  // Handle empty 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
};
