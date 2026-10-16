import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface ClubListItem {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
  banner_url: string | null;
  event_count: number;
  member_count: number;
}

export interface ClubMember {
  user_id: string;
  role: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ClubDetail {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
  event_count: number;
  members: ClubMember[];
}

export interface ClubsResponse {
  data: ClubListItem[];
  pagination: {
    next_cursor?: string | null;
    has_more: boolean;
  };
}

export function useClubs(query: string = '', enabled = true) {
  const trimmed = query.trim();
  return useQuery<ClubsResponse, Error>({
    queryKey: ['clubs', { query: trimmed }],
    queryFn: async () => {
      if (trimmed) {
        const res = await apiClient(`/clubs/search?q=${encodeURIComponent(trimmed)}`);
        return res as ClubsResponse;
      }
      const res = await apiClient('/clubs');
      return res as ClubsResponse;
    },
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useClub(clubId: string, enabled = true) {
  return useQuery<ClubDetail, Error>({
    queryKey: ['clubs', 'detail', clubId],
    queryFn: async () => {
      const res = await apiClient(`/clubs/${clubId}`);
      return res as ClubDetail;
    },
    enabled: enabled && !!clubId,
    staleTime: 5 * 60 * 1000,
  });
}
