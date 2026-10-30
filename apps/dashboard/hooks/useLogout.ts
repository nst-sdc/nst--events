import { useMutation } from '@tanstack/react-query';
import { apiClient, abortInFlightRefresh } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';
import { useRouter } from 'next/navigation';

export function useLogout() {
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      // (a) abort or invalidate any in-flight refresh and block new refreshes via a "logging out" flag in the auth store
      const store = getWebAuthStore();
      store.setLoggingOut(true);
      abortInFlightRefresh();

      // (b) await POST /auth/logout
      try {
        await apiClient('/auth/logout', { method: 'POST' });
      } catch (e) {
        // Local cleanup must happen even when the network call fails
        console.error('Logout API failed', e);
      }
    },
    onSettled: () => {
      // (c) even if it fails, clear in-memory access token, the user_role cookie, the React Query cache and any other session hints
      getWebAuthStore().logout();
      // Ensure the logging out flag remains active so late in-flight refreshes cannot set token
      getWebAuthStore().setLoggingOut(true);

      // (d) router.replace('/login')
      router.replace('/login');
    },
  });
}
