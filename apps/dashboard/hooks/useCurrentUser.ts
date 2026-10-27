import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { getWebAuthStore } from '../lib/auth-store';


import type {
  CurrentUserResponse,
  CurrentUserClubMembership as ClubMembership,
  CurrentUserAcademicProfile,
} from '@nst/shared';

export type { ClubMembership, CurrentUserAcademicProfile };
export type CurrentUser = CurrentUserResponse;

export function useCurrentUser() {
  const authStore = getWebAuthStore();
  const isAuthenticated = !!authStore.accessToken;

  return useQuery<CurrentUser>({
    queryKey: ['users', 'me'],
    queryFn: () => apiClient<CurrentUser>('/users/me'),
    enabled: isAuthenticated, // Only fetch if authenticated
    staleTime: 5 * 60 * 1000,
  });
}
