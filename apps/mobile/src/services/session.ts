import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '../store/auth';
import { queryClient } from '../providers/QueryProvider';
import { API_BASE_URL } from '../infrastructure/config';

/**
 * Single centralized session controller / logout boundary.
 * Orchestrates server-side token revocation, local credential purging,
 * cache wiping, Google SSO sign-out, and navigation reset.
 */
export async function logout(): Promise<void> {
  // 1. Obtain stored access token and refresh token before local purge
  try {
    const state = useAuthStore.getState();
    const accessToken = state.accessToken || (await SecureStore.getItemAsync('access_token'));
    const refreshToken = state.refreshToken || (await SecureStore.getItemAsync('refresh_token'));

    if (accessToken && refreshToken) {
      // Dispatch server-side revocation to POST /auth/logout
      // Backend authRouter.post('/logout') requires Bearer auth and inspects req.cookies['refreshToken']
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Cookie: `refreshToken=${refreshToken}`,
        },
      });
    }
  } catch (err) {
    // Treat logout cleanup as local cleanup even if the server logout request fails.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Session] Server-side logout failed, proceeding with local cleanup:', err);
    }
  }

  // 2. Clear SecureStore and auth state (Zustand)
  try {
    await useAuthStore.getState().clearSession();
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Session] Failed to clear SecureStore session:', err);
    }
  }

  // 3. Clear React Query cache to prevent cross-session cache bleed
  try {
    queryClient.clear();
  } catch (err) {
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
  router.replace('/(auth)');
}
