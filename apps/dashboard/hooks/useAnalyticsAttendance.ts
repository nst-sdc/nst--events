import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsAttendance {
  time_series: { date: string; success: number; fail: number }[];
  failure_breakdown: { reason: string; count: number }[];
}

export function useAnalyticsAttendance(dateRange: { start: string; end: string }) {
  return useQuery<AnalyticsAttendance>({
    queryKey: ['admin-analytics-attendance', dateRange],
    queryFn: () => apiClient<AnalyticsAttendance>(`/v1/admin/analytics/attendance?start=${dateRange.start}&end=${dateRange.end}`),
    enabled: !!dateRange.start && !!dateRange.end,
  });
}
