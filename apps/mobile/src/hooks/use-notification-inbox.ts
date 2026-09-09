import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { useAuthStore } from '../store/auth';
import { API_BASE_URL } from '../infrastructure/config';
import { SSEManager } from '../sse/manager';

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  metadata?: {
    schema_version?: number;
    routing?: {
      target: string;
      fallback: string;
      params: Record<string, string>;
    };
    entity_ids?: {
      event_id?: string;
      club_id?: string;
      dispute_id?: string;
      attendance_id?: string;
      announcement_id?: string;
      team_id?: string;
    };
    action_payload?: {
      role?: string;
      status?: string;
    };
  };
}

let globalNotificationSSE: SSEManager | null = null;
let globalNotificationSSEToken: string | null = null;
let subscriberCount = 0;

export function useNotificationInbox() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.accessToken);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  // 1. Fetch Paginated Inbox
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam = undefined }) => {
      const cursor = pageParam ? `?cursor=${pageParam}&limit=20` : '?limit=20';
      return apiClient(`/v1/notifications${cursor}`);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage: any) => {
      if (lastPage.pagination?.has_more) {
        return lastPage.pagination.next_cursor;
      }
      return undefined;
    },
    enabled: isLoggedIn,
  });

  // 2. Fetch Authoritative Unread Count
  const { data: unreadData, refetch: refetchUnreadCount } = useQuery<{ unread_count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => apiClient('/v1/notifications/unread-count'),
    enabled: isLoggedIn,
  });

  const unreadCount = unreadData?.unread_count ?? 0;

  // 3. Realtime Live Notifications via SSE (/v1/notifications/live) - Singleton
  useEffect(() => {
    if (!isLoggedIn || !token) {
      if (globalNotificationSSE) {
        globalNotificationSSE.disconnect();
        globalNotificationSSE = null;
        globalNotificationSSEToken = null;
        subscriberCount = 0;
      }
      return;
    }

    subscriberCount++;

    if (!globalNotificationSSE || globalNotificationSSEToken !== token) {
      if (globalNotificationSSE) {
        globalNotificationSSE.disconnect();
      }
      const sseUrl = `${API_BASE_URL}/v1/notifications/live?token=${token}`;
      const manager = new SSEManager(sseUrl, token);
      globalNotificationSSE = manager;
      globalNotificationSSEToken = token;

      const invalidateNotificationQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      };

      manager.on('NOTIFICATION_CREATED', invalidateNotificationQueries);
      manager.on('NOTIFICATION_READ', invalidateNotificationQueries);
      manager.on('NOTIFICATIONS_READ_ALL', invalidateNotificationQueries);

      manager.connect();
    }

    return () => {
      subscriberCount--;
      if (subscriberCount <= 0) {
        globalNotificationSSE?.disconnect();
        globalNotificationSSE = null;
        globalNotificationSSEToken = null;
        subscriberCount = 0;
      }
    };
  }, [isLoggedIn, token, queryClient]);

  // 4. Mark Single Notification as Read
  const { mutate: markAsRead } = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/v1/notifications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: () => {
      // Invalidate queries to trigger authoritative re-fetch (No optimistic updates as mandated)
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // 5. Mark All Notifications as Read
  const { mutate: markAllAsRead, isPending: isMarkingAllRead } = useMutation({
    mutationFn: async () => {
      return apiClient(`/v1/notifications/read-all`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  return {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    unreadCount,
    refetchUnreadCount,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  };
}
