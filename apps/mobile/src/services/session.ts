import { router } from 'expo-router';
import { safeSecureStore } from '../lib/secure-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../store/auth';
import { queryClient } from '../providers/QueryProvider';
import { API_BASE_URL } from '../infrastructure/config';

export const DEFAULT_SERVER_REVOCATION_TIMEOUT_MS = 2000;

let activeTeardownPromise: Promise<void> | null = null;

export interface TeardownOptions {
  /**
   * If true, dispatches POST /auth/logout to revoke server-side refresh token.
   * Defaults to false (for terminal SESSION_DEAD expiry, where the server session is already dead).
   */
  notifyServer?: boolean;
  /**
   * Maximum duration in ms to await server revocation before proceeding with local cleanup.
   * Defaults to 2000ms.
   */
  serverTimeoutMs?: number;
}

/**
 * Authoritative single session teardown path for mobile client.
 * Orchestrates server-side token revocation (if requested), local credential purging,
 * React Query cache purging, Google SSO sign-out, and navigation reset.
 *
 * Coalesces concurrent teardown invocations to guarantee safe, idempotent execution.
 */
export async function teardownSession(options?: TeardownOptions): Promise<void> {
  if (activeTeardownPromise) {
    return activeTeardownPromise;
  }

  activeTeardownPromise = (async () => {
    let localCleanupError: unknown = null;

    try {
      // 1. Best-effort bounded server-side revocation
      if (options?.notifyServer) {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
          const state = useAuthStore.getState();
          const accessToken = state.accessToken || (await safeSecureStore.getItemAsync('access_token'));
          const refreshToken = state.refreshToken || (await safeSecureStore.getItemAsync('refresh_token'));

          if (refreshToken) {
            const timeoutMs = options.serverTimeoutMs ?? DEFAULT_SERVER_REVOCATION_TIMEOUT_MS;
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

            const timeoutPromise = new Promise<void>((_, reject) => {
              timeoutId = setTimeout(() => {
                try {
                  controller?.abort();
                } catch {}
                reject(new Error('Server logout timed out'));
              }, timeoutMs);
            });

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'X-Client-Platform': 'mobile',
            };
            if (accessToken) {
              headers['Authorization'] = `Bearer ${accessToken}`;
            }

            const fetchPromise = (async () => {
              try {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ refresh_token: refreshToken }),
                  signal: controller?.signal,
                });
              } catch (err) {
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                  console.warn('[Session] Server-side logout request error:', err);
                }
              }
            })();

            await Promise.race([fetchPromise, timeoutPromise]);
          }
        } catch (err) {
          // Bounded timeout or unexpected setup error: log and proceed to local cleanup
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn('[Session] Server-side logout failed or timed out, proceeding with local cleanup:', err);
          }
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }

      // 2. Clear SecureStore and auth state (Zustand)
      try {
        await useAuthStore.getState().clearSession();
      } catch (err) {
        // Guarantee in-memory auth state is reset even if persistent storage deletion failed
        useAuthStore.setState({
          userId: null,
          accessToken: null,
          refreshToken: null,
          isLoggedIn: false,
          isInitialized: true,
          pendingDeepLink: null,
        });
        localCleanupError = err;
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[Session] Failed to clear SecureStore session:', err);
        }
      }

      // 3. Clear React Query cache to prevent cross-session cache bleed
      try {
        queryClient.clear();
      } catch (err) {
        if (!localCleanupError) localCleanupError = err;
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[Session] Failed to clear query client cache:', err);
        }
      }

      // 4. Sign out of Google SSO to permit subsequent account selection
      try {
        await GoogleSignin.signOut();
      } catch (err) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[Session] Google sign out failed:', err);
        }
      }

      // 5. Reset navigation to authentication boundary
      try {
        router.replace('/(auth)');
      } catch (err) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[Session] Navigation reset failed:', err);
        }
      }

      // If local credential removal or cache clearing failed, do not falsely report success
      if (localCleanupError) {
        throw localCleanupError;
      }
    } finally {
      activeTeardownPromise = null;
    }
  })();

  return activeTeardownPromise;
}

/**
 * Single centralized session controller / logout boundary.
 * Revokes server-side refresh token within a bounded timeout and performs full local session teardown.
 */
export async function logout(options?: Pick<TeardownOptions, 'serverTimeoutMs'>): Promise<void> {
  return teardownSession({ notifyServer: true, serverTimeoutMs: options?.serverTimeoutMs });
}
