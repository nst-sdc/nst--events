import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

import type {
  EventListItem,
  EventLockState,
  CanonicalRegistrationStatus,
  EventsResponse,
} from '@nst/shared';

export type { EventLockState };

export type Event = EventListItem;

export type { EventsResponse };

export interface EventsQueryParams {
  q?: string;
  filter_state?: string;
  filter_club_id?: string;
  filter_event_type?: string;
  limit?: number;
  cursor?: string;
}

export function useEvents(params?: EventsQueryParams) {
  return useQuery<EventsResponse>({
    queryKey: ['events', 'list', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', (params?.limit || 20).toString());
      if (params?.q) searchParams.set('q', params.q);
      if (params?.filter_state) searchParams.set('filter_state', params.filter_state);
      if (params?.filter_club_id) searchParams.set('filter_club_id', params.filter_club_id);
      if (params?.filter_event_type) searchParams.set('filter_event_type', params.filter_event_type);
      if (params?.cursor) searchParams.set('cursor', params.cursor);

      return apiClient<EventsResponse>(`/v1/events?${searchParams.toString()}`);
    },
  });
}
