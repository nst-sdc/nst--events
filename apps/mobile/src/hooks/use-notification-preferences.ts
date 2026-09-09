import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface NotificationPreferences {
  push_enabled: boolean;
  event_reminders: boolean;
  club_announcements: boolean;
  attendance_alerts: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push_enabled: true,
  event_reminders: true,
  club_announcements: true,
  attendance_alerts: true,
};

export function useNotificationPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery<NotificationPreferences, Error>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res: any = await apiClient('/v1/notifications/preferences');
      return {
        push_enabled: res.push_enabled ?? true,
        event_reminders: res.event_reminders ?? true,
        club_announcements: res.club_announcements ?? true,
        attendance_alerts: res.attendance_alerts ?? true,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<NotificationPreferences>) => {
      return apiClient('/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences'] });
      const previous = queryClient.getQueryData<NotificationPreferences>(['notification-preferences']) || DEFAULT_NOTIFICATION_PREFERENCES;
      queryClient.setQueryData<NotificationPreferences>(['notification-preferences'], {
        ...previous,
        ...patch,
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notification-preferences'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  return {
    preferences: query.data || DEFAULT_NOTIFICATION_PREFERENCES,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isUpdating: mutation.isPending,
    updatePreferences: mutation.mutate,
  };
}
