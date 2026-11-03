import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore, type RefreshResult } from '../store/auth';
import { useAppVersionStore } from '../store/app-version-store';
import { API_BASE_URL } from './config';
import { teardownSession } from '../services/session';

export { API_BASE_URL };

export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

let isRefreshing = false;
let refreshPromise: Promise<RefreshResult> | null = null;

const executeFetch = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch (err: any) {
    if (
      Platform.OS === 'android' &&
      (url.includes('localhost') || url.includes('127.0.0.1'))
    ) {
      const fallbackUrl = url
        .replace('localhost', '10.0.2.2')
        .replace('127.0.0.1', '10.0.2.2');
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
          `[API] Direct connection to localhost failed on Android. Retrying with emulator alias: ${fallbackUrl}`
        );
      }
      return await fetch(fallbackUrl, init);
    }
    throw err;
  }
};

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': APP_VERSION,
    'X-Client-Platform': 'mobile',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = `${API_BASE_URL}${endpoint}`;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const sanitizedUrl = fullUrl.split('?')[0];
    console.log('[API FETCH] URL:', sanitizedUrl, '| Method:', options.method || 'GET');
  }

  const response = await executeFetch(fullUrl, {
    ...options,
    headers,
  });
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const sanitizedUrl = fullUrl.split('?')[0];
    console.log('[API RESP] Status:', response.status, 'for', sanitizedUrl);
  }

  // Automatic token refresh on 401
  let refreshResult: RefreshResult | null = null;
  if (response.status === 401 && token) {
    // Deduplicate concurrent refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = useAuthStore.getState().refreshAccessToken();
    }

    refreshResult = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshResult?.status === 'SUCCESS') {
      const newToken = refreshResult.token;
      // Retry the original request with the new token
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await executeFetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (retryResponse.status === 426) {
        const errorBody = await retryResponse.json().catch(() => ({}));
        const minVersion = errorBody.minVersion || null;
        const message =
          errorBody.message ||
          errorBody.detail ||
          'App update required. Please update to the latest version of NST Events to continue.';
        useAppVersionStore.getState().setUpdateRequired({
          required: true,
          minVersion,
        });
        throw {
          status: 426,
          code: 'APP_VERSION_UNSUPPORTED',
          message,
          minVersion,
          body: errorBody,
        };
      }

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

    // Refresh failed — check if session is dead
    if (refreshResult?.status === 'SESSION_DEAD') {
      await teardownSession({ notifyServer: false });
      throw { status: 401, message: 'Session expired' };
    }
    
    // Otherwise it was RATE_LIMITED or TRANSIENT_ERROR, just throw so react query can retry
    throw { status: response.status, message: 'API Request Failed' };
  }

  if (response.status === 426) {
    const errorBody = await response.json().catch(() => ({}));
    const minVersion = errorBody.minVersion || null;
    const message =
      errorBody.message ||
      errorBody.detail ||
      'App update required. Please update to the latest version of NST Events to continue.';
    useAppVersionStore.getState().setUpdateRequired({
      required: true,
      minVersion,
    });
    throw {
      status: 426,
      code: 'APP_VERSION_UNSUPPORTED',
      message,
      minVersion,
      body: errorBody,
    };
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody.detail ||
      errorBody.message ||
      errorBody.error ||
      'API Request Failed';
    const retryHeader = response.headers?.get?.('retry-after');
    const retryAfter = retryHeader ? parseInt(retryHeader, 10) : errorBody?.retryAfter;
    const errorObj: any = { status: response.status, message, body: errorBody };
    if (retryAfter !== undefined) errorObj.retryAfter = retryAfter;
    throw errorObj;
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};
