import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

import type {
  ClubListItem,
  ClubDetailMember as ClubMember,
  ClubDetail,
  ClubsResponse,
} from '@nst/shared';

export type { ClubListItem, ClubMember, ClubDetail, ClubsResponse };

export function useClubs(query: string = '', enabled = true) {
  const trimmed = query.trim();
  return useQuery<ClubsResponse, Error>({
    queryKey: ['clubs', { query: trimmed }],
    queryFn: async () => {
      let res: ClubsResponse;
      if (trimmed) {
        res = (await apiClient(`/clubs/search?q=${encodeURIComponent(trimmed)}`)) as ClubsResponse;
      } else {
        res = (await apiClient('/clubs')) as ClubsResponse;
      }
      const data = (res.data || []).map((club: any) => ({
        ...club,
        banner_url: club.banner_url ?? club.bannerUrl ?? null,
        bannerUrl: club.bannerUrl ?? club.banner_url ?? null,
      }));
      return { ...res, data };
    },
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useClub(clubId: string, enabled = true) {
  return useQuery<ClubDetail, Error>({
    queryKey: ['clubs', 'detail', clubId],
    queryFn: async () => {
      const res = (await apiClient(`/clubs/${clubId}`)) as ClubDetail;
      return {
        ...res,
        banner_url: (res as any)?.banner_url ?? (res as any)?.bannerUrl ?? null,
        bannerUrl: (res as any)?.bannerUrl ?? (res as any)?.banner_url ?? null,
      };
    },
    enabled: enabled && !!clubId,
    staleTime: 5 * 60 * 1000,
  });
}
