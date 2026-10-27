import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface PendingInvitation {
  invitation_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  team: {
    team_id: string;
    team_name: string;
    leader_id: string;
  };
  event: {
    event_id: string;
    event_title: string;
  };
  inviter: {
    user_id: string;
    full_name: string;
  };
}

export class UnsupportedEndpointError extends Error {
  readonly isUnsupported = true;
  readonly status = 404;
  readonly endpoint: string;

  constructor(endpoint: string) {
    super(`Endpoint ${endpoint} is not available on this server version (feature deferred).`);
    this.name = 'UnsupportedEndpointError';
    this.endpoint = endpoint;
  }
}

export function usePendingInvitations() {
  return useQuery<PendingInvitation[], Error>({
    queryKey: ['invitations'],
    queryFn: async () => {
      try {
        const res = (await apiClient('/v1/users/me/team-invitations')) as PendingInvitation[];
        return Array.isArray(res) ? res : [];
      } catch (err: any) {
        if (err?.status === 404) {
          throw new UnsupportedEndpointError('/v1/users/me/team-invitations');
        }
        throw err;
      }
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 404 || error?.isUnsupported) {
        return false;
      }
      return false;
    },
  });
}

export function useSentInvitations(eventIdOrTeamId: string, teamId?: string) {
  const actualTeamId = teamId || eventIdOrTeamId;
  return useQuery<PendingInvitation[]>({
    queryKey: ['sent-invitations', actualTeamId],
    queryFn: () => apiClient(`/v1/teams/${actualTeamId}/invitations`),
    enabled: !!actualTeamId,
  });
}

export interface InviteeSearchResult {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export function useSearchInvitees(eventId: string, query: string) {
  return useQuery<InviteeSearchResult[], Error>({
    queryKey: ['invitees', eventId, query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const params = new URLSearchParams({ q: query });
      try {
        const res = (await apiClient(`/v1/events/${eventId}/invitee-search?${params.toString()}`)) as InviteeSearchResult[];
        return Array.isArray(res) ? res : [];
      } catch (err: any) {
        if (err?.status === 404) {
          throw new UnsupportedEndpointError(`/v1/events/${eventId}/invitee-search`);
        }
        throw err;
      }
    },
    enabled: !!eventId && query.length >= 2,
    staleTime: 60 * 1000, // 1 minute
    retry: (failureCount, error: any) => {
      if (error?.status === 404 || error?.isUnsupported) {
        return false;
      }
      return false;
    },
  });
}
