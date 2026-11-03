import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface RateLimitBucketSetting {
  bucket: string;
  max: number;
  window_ms: number;
  floor: number;
  ceiling: number;
  effective_per_replica: number;
}

export interface RateLimitsResponse {
  replicas: number;
  window_ms: number;
  settings?: RateLimitBucketSetting[];
  buckets?: Array<{
    bucket: string;
    max_total: number;
    per_replica: number;
    enabled: boolean;
    source: string;
    min: number;
    max: number;
    default: number;
    updated_by?: string | null;
    updated_at?: string | null;
  }>;
}

export interface RateLimitOverrideItem {
  id: string;
  bucket: string;
  action: 'block' | 'allow' | 'custom_max';
  custom_max: number | null;
  target_identifier: string | null;
  target_ip: string | null;
  target_user_id: string | null;
  reason: string;
  expires_at: string;
  created_at: string;
  created_by_user_id?: string;
  subject_type?: 'user' | 'ip';
  subject?: string;
  mode?: 'block' | 'allow' | 'custom_max';
  created_by?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export interface CreateOverridePayload {
  bucket: string;
  action: 'block' | 'allow' | 'custom_max';
  custom_max?: number;
  target_identifier?: string;
  target_ip?: string;
  target_user_id?: string;
  reason: string;
  expires_in_seconds: number;
}

export function useRateLimits() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['admin', 'rate-limits'],
    queryFn: async () => {
      return apiClient<RateLimitsResponse>('/v1/admin/rate-limits');
    },
    staleTime: 10000,
  });

  const overridesQuery = useQuery({
    queryKey: ['admin', 'rate-limits', 'overrides'],
    queryFn: async (): Promise<RateLimitOverrideItem[]> => {
      const res = await apiClient<any>('/v1/admin/rate-limits/overrides');
      const rawList: any[] = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      return rawList.map((item: any): RateLimitOverrideItem => {
        const subjectType = item.subject_type || (item.target_ip ? 'ip' : (item.target_user_id ? 'user' : 'ip'));
        const subject = item.subject || item.target_ip || item.target_user_id || item.target_identifier || '';
        const mode = item.mode || item.action || 'block';
        return {
          id: item.id,
          bucket: item.bucket || 'all',
          action: mode,
          mode,
          subject_type: subjectType,
          subject,
          custom_max: item.custom_max ?? null,
          target_identifier: item.target_identifier || (subjectType !== 'ip' && subjectType !== 'user' ? subject : null),
          target_ip: item.target_ip || (subjectType === 'ip' ? subject : null),
          target_user_id: item.target_user_id || (subjectType === 'user' ? subject : null),
          reason: item.reason || '',
          expires_at: item.expires_at,
          created_at: item.created_at || new Date().toISOString(),
          created_by: item.created_by,
          created_by_user_id: item.created_by_user_id || item.created_by?.id || '',
        };
      });
    },
    staleTime: 10000,
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ bucket, max }: { bucket: string; max: number }) => {
      return apiClient(`/v1/admin/rate-limits/${bucket}`, {
        method: 'PUT',
        body: JSON.stringify({ max_total: max, max }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rate-limits'] });
    },
  });

  const resetSettingsMutation = useMutation({
    mutationFn: async () => {
      return apiClient('/v1/admin/rate-limits/reset', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rate-limits'] });
    },
  });

  const createOverrideMutation = useMutation({
    mutationFn: async (payload: CreateOverridePayload) => {
      const subjectType = payload.target_ip ? 'ip' : (payload.target_user_id ? 'user' : 'ip');
      const subject = payload.target_ip || payload.target_user_id || payload.target_identifier || '';
      const mode = payload.action;
      const expiresAt = new Date(Date.now() + payload.expires_in_seconds * 1000).toISOString();

      const body = {
        subject_type: subjectType,
        subject,
        mode,
        ...(mode === 'custom_max' && payload.custom_max ? { custom_max: payload.custom_max } : {}),
        expires_at: expiresAt,
        reason: payload.reason,
      };

      return apiClient('/v1/admin/rate-limits/overrides', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rate-limits', 'overrides'] });
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/v1/admin/rate-limits/overrides/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rate-limits', 'overrides'] });
    },
  });

  const parsedSettings: RateLimitBucketSetting[] =
    settingsQuery.data?.settings ||
    settingsQuery.data?.buckets?.map((b) => ({
      bucket: b.bucket,
      max: b.max_total ?? b.max,
      window_ms: settingsQuery.data?.window_ms || 900000,
      floor: b.min,
      ceiling: b.max,
      effective_per_replica: b.per_replica,
    })) ||
    [];

  return {
    settings: parsedSettings,
    replicas: settingsQuery.data?.replicas || 2,
    windowMs: settingsQuery.data?.window_ms || 900000,
    isLoadingSettings: settingsQuery.isLoading,
    isSettingsError: settingsQuery.isError,
    overrides: overridesQuery.data || [],
    isLoadingOverrides: overridesQuery.isLoading,
    isOverridesError: overridesQuery.isError,
    updateSetting: updateSettingMutation.mutateAsync,
    isUpdatingSetting: updateSettingMutation.isPending,
    resetSettings: resetSettingsMutation.mutateAsync,
    isResettingSettings: resetSettingsMutation.isPending,
    createOverride: createOverrideMutation.mutateAsync,
    isCreatingOverride: createOverrideMutation.isPending,
    deleteOverride: deleteOverrideMutation.mutateAsync,
    isDeletingOverride: deleteOverrideMutation.isPending,
  };
}
