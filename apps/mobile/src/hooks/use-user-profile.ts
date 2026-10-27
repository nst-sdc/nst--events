import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

import type {
  CurrentUserResponse,
  CurrentUserClubMembership as ClubMembershipItem,
  CurrentUserAcademicProfile as AcademicProfileItem,
} from '@nst/shared';

export type { ClubMembershipItem, AcademicProfileItem };
export type UserProfileResponse = CurrentUserResponse;

export function useUserProfile() {
  return useQuery<UserProfileResponse, Error>({
    queryKey: ['user-profile'],
    queryFn: () => apiClient('/users/me'),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });
}
