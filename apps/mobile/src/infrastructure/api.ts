import { useAuthStore } from '../store/auth';
import { API_BASE_URL } from './config';

export { API_BASE_URL };

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = `${API_BASE_URL}${endpoint}`;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[API FETCH] Full constructed URL:', fullUrl, '| Method:', options.method || 'GET');
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[API RESP] Status:', response.status, 'for', fullUrl);
  }

  // Automatic token refresh on 401
  if (response.status === 401 && token) {
    // Deduplicate concurrent refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = useAuthStore.getState().refreshAccessToken();
    }

    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newToken) {
      // Retry the original request with the new token
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!retryResponse.ok) {
        const errorBody = await retryResponse.json().catch(() => ({}));
        const message =
          errorBody.detail ||
          errorBody.message ||
          errorBody.error ||
          'API Request Failed';
        throw { status: retryResponse.status, message, body: errorBody };
      }

      const text = await retryResponse.text();
      return text ? JSON.parse(text) : {};
    }

    // Refresh failed — session is dead
    await useAuthStore.getState().clearSession();
    throw { status: 401, message: 'Session expired' };
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody.detail ||
      errorBody.message ||
      errorBody.error ||
      'API Request Failed';
    throw { status: response.status, message, body: errorBody };
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};
