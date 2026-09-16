import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsClubs {
  clubs: { id: string; name: string; events_count: number; members_count: number }[];
}

export function useAnalyticsClubs() {
  return useQuery<AnalyticsClubs>({
    queryKey: ['admin-analytics-clubs'],
    queryFn: () => apiClient<AnalyticsClubs>('/v1/admin/analytics/clubs'),
  });
}
