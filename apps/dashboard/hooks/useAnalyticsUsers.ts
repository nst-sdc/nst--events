import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsUsers {
  role_breakdown: { role: string; count: number }[];
}

export function useAnalyticsUsers() {
  return useQuery<AnalyticsUsers>({
    queryKey: ['admin-analytics-users'],
    queryFn: () => apiClient<AnalyticsUsers>('/v1/admin/analytics/users'),
    retry: false, // Don't retry on 403 Forbidden for CLUB admins
  });
}
