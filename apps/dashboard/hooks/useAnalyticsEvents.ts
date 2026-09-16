import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AnalyticsEvents {
  pipeline_counts: Record<string, number>;
  recent_events: { id: string; title: string; state: string; createdAt: string }[];
}

export function useAnalyticsEvents() {
  return useQuery<AnalyticsEvents>({
    queryKey: ['admin-analytics-events'],
    queryFn: () => apiClient<AnalyticsEvents>('/v1/admin/analytics/events'),
  });
}
