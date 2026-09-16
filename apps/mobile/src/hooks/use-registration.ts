import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { useToast } from './use-toast';
import { useNetworkStatus } from '../infrastructure/network';

export interface MyRegistrationItem {
  id: string;
  eventId: string;
  userId: string;
  teamId: string | null;
  registrationStatus: 'REGISTERED' | 'WAITLISTED' | 'CANCELLED';
  registeredAt: string;
}

export function useMyRegistrations() {
  return useQuery<MyRegistrationItem[], Error>({
    queryKey: ['my-registrations'],
    queryFn: () => apiClient('/v1/users/me/registrations'),
    staleTime: 60 * 1000,
  });
}

export function useMyRegistrationStatus(eventId: string) {
  return useQuery<{ status: 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'NOT_REGISTERED'; team_id?: string | null }, Error>({
    queryKey: ['my-registration', eventId],
    queryFn: () => apiClient(`/v1/events/${eventId}/my-registration`),
    enabled: !!eventId,
    staleTime: 60 * 1000,
  });
}

export const useRegistration = (eventId: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isOnline } = useNetworkStatus();

  const register = useMutation({
    mutationFn: async () => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/events/${eventId}/register`, { method: 'POST' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });

      if (data?.status === 'WAITLISTED') {
        toast.show('The event is full. You are on the waitlist.', 'info', 'Waitlisted');
      } else {
        toast.show('You are confirmed for the event.', 'success', 'Registered!');
      }
    },
    onError: (error: any) => {
      if (error?.status === 0 || !isOnline) {
        toast.show('You are currently offline.', 'error', 'No Connection');
      } else if (error?.status === 401) {
        toast.show('Please log in again.', 'error', 'Session Expired');
      } else if (error?.detail || error?.message) {
        toast.show(error.detail || error.message, 'error', 'Registration Failed');
      } else if (error?.status >= 500) {
        toast.show('An unexpected error occurred.', 'error', 'Server Error');
      } else {
        toast.show('Capacity reached or action invalid.', 'error', 'Action Failed');
      }
    }
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/events/${eventId}/register`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.show('Registration cancelled successfully.', 'info', 'Cancelled');
    },
    onError: (error: any) => {
      if (error?.status === 0 || !isOnline) {
        toast.show('You are currently offline.', 'error', 'No Connection');
      } else if (error?.status === 401) {
        toast.show('Please log in again.', 'error', 'Session Expired');
      } else if (error?.detail || error?.message) {
        toast.show(error.detail || error.message, 'error', 'Cancellation Failed');
      } else {
        toast.show('Action could not be completed.', 'error', 'Action Failed');
      }
    }
  });

  return {
    register: register.mutate,
    registerAsync: register.mutateAsync,
    isRegistering: register.isPending,
    error: register.error,
    cancel: cancel.mutate,
    cancelAsync: cancel.mutateAsync,
    isCancelling: cancel.isPending,
    cancelError: cancel.error,
  };
};
