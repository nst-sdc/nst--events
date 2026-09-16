import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsDisputes {
  breakdown: { status: string; count: number }[];
}

export function useAnalyticsDisputes() {
  return useQuery<AnalyticsDisputes>({
    queryKey: ['admin-analytics-disputes'],
    queryFn: () => apiClient<AnalyticsDisputes>('/v1/admin/analytics/disputes'),
  });
}
