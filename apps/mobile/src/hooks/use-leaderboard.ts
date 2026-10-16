import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface LeaderboardStudent {
  rank: number;
  user_id: string;
  display_name: string;
  total_points: number;
  attendance_points?: number;
  contribution_points?: number;
  competition_points?: number;
  last_refreshed_at?: string;
}

export interface LeaderboardClub {
  rank: number;
  club_id: string;
  club_name: string;
  total_points: number;
  event_count: number;
  member_count: number;
  last_refreshed_at?: string;
}

export interface MyRankResponse {
  rank: number | null;
  total_points: number;
}

export interface LeaderboardResponse<T> {
  data: T[];
  nextCursor?: string;
}

export function useMyLeaderboardRank() {
  return useQuery<MyRankResponse, Error>({
    queryKey: ['leaderboard', 'me'],
    queryFn: async () => {
      const res = await apiClient('/v1/leaderboard/me');
      return res as MyRankResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudentLeaderboard(limit: number = 50) {
  return useQuery<LeaderboardResponse<LeaderboardStudent>, Error>({
    queryKey: ['leaderboard', 'students', { limit }],
    queryFn: async () => {
      const res = await apiClient(`/v1/leaderboard/students?limit=${limit}`);
      return res as LeaderboardResponse<LeaderboardStudent>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useClubLeaderboard(limit: number = 50) {
  return useQuery<LeaderboardResponse<LeaderboardClub>, Error>({
    queryKey: ['leaderboard', 'clubs', { limit }],
    queryFn: async () => {
      const res = await apiClient(`/v1/leaderboard/clubs?limit=${limit}`);
      return res as LeaderboardResponse<LeaderboardClub>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
