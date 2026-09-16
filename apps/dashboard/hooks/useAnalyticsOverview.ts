import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsOverview {
  total_events: number;
  total_registrations: number;
  attendance_rate: number;
  active_clubs: number;
}

export function useAnalyticsOverview() {
  return useQuery<AnalyticsOverview>({
    queryKey: ['admin-analytics-overview'],
    queryFn: () => apiClient<AnalyticsOverview>('/v1/admin/analytics/overview'),
  });
}
