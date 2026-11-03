import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface AuthEventUser {
  id: string;
  email: string;
  full_name: string;
}

export interface AuthEventItem {
  id: string;
  user_id: string | null;
  user: AuthEventUser | null;
  event_type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'REFRESH_FAILED' | 'REUSE_DETECTED' | 'LOGOUT' | 'SESSION_REVOKED';
  platform: 'web' | 'mobile';
  app_version: string | null;
  user_agent_family: string | null;
  device_class: string | null;
  ip_hash: string;
  raw_ip: string | null;
  network_class: 'campus' | 'off_campus' | 'unknown';
  failure_reason: string | null;
  created_at: string;
}

export interface AuthEventsResponse {
  data: AuthEventItem[];
  pagination: {
    next_cursor: string | null;
  };
}

export interface AuthStatsResponse {
  summary: {
    total_success: number;
    total_failed: number;
    total_attempts: number;
    failure_rate: number;
    dau: number;
    wau: number;
  };
  time_series: Array<{
    timestamp: string;
    success_count: number;
    failure_count: number;
  }>;
  platform_breakdown: Record<string, number>;
  network_breakdown: Record<string, number>;
  top_failure_reasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface UserSessionItem {
  id: string;
  family_id: string;
  user_agent: string | null;
  user_agent_family: string;
  device_class: string;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
}

export interface ListAuthEventsParams {
  cursor?: string;
  limit?: number;
  event_type?: string;
  platform?: string;
  network_class?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

export function useAuthStats(params?: { start_date?: string; end_date?: string; granularity?: 'hour' | 'day' }) {
  const queryParams = new URLSearchParams();
  if (params?.start_date) queryParams.set('start_date', params.start_date);
  if (params?.end_date) queryParams.set('end_date', params.end_date);
  if (params?.granularity) queryParams.set('granularity', params.granularity);

  const queryString = queryParams.toString();
  const endpoint = `/v1/admin/auth-stats${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['admin', 'auth-stats', params],
    queryFn: async () => {
      return apiClient<AuthStatsResponse>(endpoint);
    },
    staleTime: 15000,
  });
}

export function useAuthEvents(params: ListAuthEventsParams) {
  const queryParams = new URLSearchParams();
  if (params.cursor) queryParams.set('cursor', params.cursor);
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.event_type) queryParams.set('event_type', params.event_type);
  if (params.platform) queryParams.set('platform', params.platform);
  if (params.network_class) queryParams.set('network_class', params.network_class);
  if (params.user_id) queryParams.set('user_id', params.user_id);
  if (params.start_date) queryParams.set('start_date', params.start_date);
  if (params.end_date) queryParams.set('end_date', params.end_date);

  const queryString = queryParams.toString();
  const endpoint = `/v1/admin/auth-events${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['admin', 'auth-events', params],
    queryFn: async () => {
      return apiClient<AuthEventsResponse>(endpoint);
    },
    staleTime: 15000,
  });
}

export function useUserSessions(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'user-sessions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiClient<{ data: UserSessionItem[] }>(`/v1/admin/users/${userId}/sessions`);
      return res.data;
    },
    enabled: !!userId,
    staleTime: 5000,
  });
}

export function useRevokeUserSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return apiClient<{ message: string; revoked_count: number }>(
        `/v1/admin/users/${userId}/revoke-sessions`,
        { method: 'POST' }
      );
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-sessions', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'auth-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'auth-stats'] });
    },
  });
}
