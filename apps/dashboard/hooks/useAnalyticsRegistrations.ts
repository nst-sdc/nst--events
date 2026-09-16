import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsRegistrations {
  time_series: { date: string; count: number }[];
}

export function useAnalyticsRegistrations(dateRange: { start: string; end: string }) {
  return useQuery<AnalyticsRegistrations>({
    queryKey: ['admin-analytics-registrations', dateRange],
    queryFn: () => apiClient<AnalyticsRegistrations>(`/v1/admin/analytics/registrations?start=${dateRange.start}&end=${dateRange.end}`),
    enabled: !!dateRange.start && !!dateRange.end,
  });
}
