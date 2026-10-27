import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Event } from './useEvents';

import type { EventDetail, MyRegistrationResponse, MyRegistrationStatus } from '@nst/shared';

export type { EventDetail };

export type RegistrationStatus = MyRegistrationStatus;
export type MyRegistration = MyRegistrationResponse;

export function useEventDetail(eventId: string) {
  return useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => apiClient<EventDetail>(`/v1/events/${eventId}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyRegistration(eventId: string) {
  return useQuery<MyRegistration>({
    queryKey: ['event-my-registration', eventId],
    queryFn: () => apiClient<MyRegistration>(`/v1/events/${eventId}/my-registration`),
    staleTime: 5 * 60 * 1000,
  });
}
