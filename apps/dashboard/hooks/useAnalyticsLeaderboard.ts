import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsLeaderboard {
  reason_breakdown: { reason: string; count: number; total_points: number }[];
}

export function useAnalyticsLeaderboard() {
  return useQuery<AnalyticsLeaderboard>({
    queryKey: ['admin-analytics-leaderboard'],
    queryFn: () => apiClient<AnalyticsLeaderboard>('/v1/admin/analytics/leaderboard'),
    retry: false,
  });
}
