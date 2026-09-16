import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsAccess {
  scope: 'GLOBAL' | 'CLUB' | 'NONE';
  clubIds?: string[];
}

export function useAnalyticsAccess() {
  return useQuery<AnalyticsAccess>({
    queryKey: ['analytics-access'],
    queryFn: () => apiClient<AnalyticsAccess>('/v1/admin/analytics/access'),
    retry: false, // Don't retry on 403 Forbidden
  });
}
