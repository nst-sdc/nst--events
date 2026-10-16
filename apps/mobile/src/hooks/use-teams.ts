import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { useToast } from './use-toast';
import { useNetworkStatus } from '../infrastructure/network';

export interface TeamMember {
  user_id: string;
  full_name: string;
  registration_status: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string;
  leader_name: string;
  member_count: number;
  status?: string;
  below_minimum?: boolean;
  members: TeamMember[];
}

export interface TeamsResponse {
  data: Team[];
  pagination: {
    nextCursor?: string | null;
    next_cursor?: string | null;
    has_more?: boolean;
  };
}

export interface CreateTeamPayload {
  name: string;
  responses?: Array<{ fieldDefinitionId: string; value: string }>;
}

export interface JoinTeamPayload {
  teamId: string;
  responses?: Array<{ fieldDefinitionId: string; value: string }>;
}

export function useTeamsList(eventId: string) {
  const { isOnline } = useNetworkStatus();
  return useQuery<TeamsResponse, Error>({
    queryKey: ['teams', eventId],
    queryFn: async () => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      const response = await apiClient(`/v1/events/${eventId}/teams?limit=50`);
      return response as TeamsResponse;
    },
    enabled: !!eventId,
  });
}

export function useTeamLookup(teamId?: string | null) {
  const { isOnline } = useNetworkStatus();
  return useQuery<Team, Error>({
    queryKey: ['team', teamId],
    queryFn: async () => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      const response = await apiClient(`/v1/teams/${teamId}`);
      return response as Team;
    },
    enabled: !!teamId,
  });
}

export const useTeams = (eventId: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isOnline } = useNetworkStatus();

  const createTeam = useMutation({
    mutationFn: async (param: string | CreateTeamPayload) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      const team_name = typeof param === 'string' ? param : param.name;
      const responses = typeof param === 'string' ? undefined : param.responses;
      return apiClient(`/v1/events/${eventId}/teams`, {
        method: 'POST',
        body: JSON.stringify({ team_name, responses }),
      });
    },
    onSuccess: (data: any) => {
      const teamId = data?.team_id || data?.id;
      if (teamId) {
        queryClient.setQueryData(['events', eventId, 'registration'], (old: any) =>
          old ? { ...old, team_id: teamId } : { team_id: teamId }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['profileValues'] });
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      }
      toast.show('Team Created.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  const joinTeam = useMutation({
    mutationFn: async (param: string | JoinTeamPayload) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      const teamId = typeof param === 'string' ? param : param.teamId;
      const responses = typeof param === 'string' ? undefined : param.responses;
      return apiClient(`/v1/teams/${teamId}/join`, {
        method: 'POST',
        body: responses ? JSON.stringify({ responses }) : undefined,
      });
    },
    onSuccess: (_, param) => {
      const teamId = typeof param === 'string' ? param : param.teamId;
      queryClient.setQueryData(['events', eventId, 'registration'], (old: any) =>
        old ? { ...old, team_id: teamId } : { team_id: teamId }
      );
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['profileValues'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      toast.show('You joined the team.', 'success', 'Team Joined');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  const leaveTeam = useMutation({
    mutationFn: async (teamId: string) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/leave`, { method: 'DELETE' });
    },
    onSuccess: (_, teamId) => {
      queryClient.setQueryData(['events', eventId, 'registration'], (old: any) =>
        old ? { ...old, team_id: null } : { team_id: null }
      );
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      toast.show('You left the team.', 'info', 'Team Left');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  const inviteMember = useMutation({
    mutationFn: async ({ teamId, inviteeId }: { teamId: string; inviteeId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ invitee_id: inviteeId }),
      });
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['sent-invitations'] });
      toast.show('Invitation sent successfully.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  const acceptInvitation = useMutation({
    mutationFn: async ({ teamId, invitationId }: { teamId: string; invitationId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/invitations/${invitationId}/accept`, { method: 'POST' });
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'registrations'] });
      toast.show('Invitation accepted.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  const declineInvitation = useMutation({
    mutationFn: async ({ teamId, invitationId }: { teamId: string; invitationId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/invitations/${invitationId}/decline`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.show('Invitation declined.', 'info', 'Declined');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  const cancelInvitation = useMutation({
    mutationFn: async ({ teamId, invitationId }: { teamId: string; invitationId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/invitations/${invitationId}`, { method: 'DELETE' });
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['sent-invitations'] });
      toast.show('Invitation cancelled.', 'info', 'Cancelled');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  const removeMember = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'registration'] });
      toast.show('Member removed.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  const transferLeadership = useMutation({
    mutationFn: async ({ teamId, newLeaderId }: { teamId: string; newLeaderId: string }) => {
      if (!isOnline) throw { status: 0, message: 'Offline' };
      return apiClient(`/v1/teams/${teamId}/transfer-leadership`, {
        method: 'POST',
        body: JSON.stringify({ new_leader_id: newLeaderId }),
      });
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      toast.show('Leadership transferred.', 'success', 'Success');
    },
    onError: (error: any) => {
      handleError(error, toast, isOnline);
    },
  });

  return {
    createTeam: createTeam.mutate,
    createTeamAsync: createTeam.mutateAsync,
    isCreating: createTeam.isPending,
    joinTeam: joinTeam.mutate,
    joinTeamAsync: joinTeam.mutateAsync,
    isJoining: joinTeam.isPending,
    leaveTeam: leaveTeam.mutate,
    leaveTeamAsync: leaveTeam.mutateAsync,
    isLeaving: leaveTeam.isPending,
    inviteMember: inviteMember.mutate,
    inviteMemberAsync: inviteMember.mutateAsync,
    isInviting: inviteMember.isPending,
    acceptInvitation: acceptInvitation.mutate,
    acceptInvitationAsync: acceptInvitation.mutateAsync,
    isAccepting: acceptInvitation.isPending,
    declineInvitation: declineInvitation.mutate,
    declineInvitationAsync: declineInvitation.mutateAsync,
    isDeclining: declineInvitation.isPending,
    cancelInvitation: cancelInvitation.mutate,
    cancelInvitationAsync: cancelInvitation.mutateAsync,
    isCancelling: cancelInvitation.isPending,
    removeMember: removeMember.mutate,
    removeMemberAsync: removeMember.mutateAsync,
    isRemoving: removeMember.isPending,
    transferLeadership: transferLeadership.mutate,
    transferLeadershipAsync: transferLeadership.mutateAsync,
    isTransferring: transferLeadership.isPending,
  };
};

function handleError(error: any, toast: any, isOnline: boolean) {
  if (error?.status === 0 || !isOnline) {
    toast.show('You are currently offline.', 'error', 'No Connection');
  } else if (error?.status === 401) {
    toast.show('Please log in again.', 'error', 'Session Expired');
  } else if (error?.status >= 500) {
    toast.show('An unexpected error occurred.', 'error', 'Server Error');
  } else if (error?.message) {
    if (error.message.includes('AUDIENCE_NOT_ELIGIBLE')) {
      toast.show('This student is not eligible for this event.', 'error', 'Not Eligible');
    } else if (error.message.includes('EVENT_LOCKED') || error.message.includes('TEAM_LOCKED')) {
      toast.show('This event is no longer accepting team changes.', 'error', 'Locked');
    } else if (error.message.includes('Invitation expired')) {
      toast.show('Invitation expired.', 'error', 'Expired');
    } else if (error.message.includes('TEAM_MAXIMUM_REACHED')) {
      toast.show('This team is already at its maximum size.', 'error', 'Team Full');
    } else if (error.message.includes('ALREADY_IN_TEAM')) {
      toast.show('You are already part of a team for this event.', 'error', 'Already In Team');
    } else if (error.message.includes('TEAM_NAME_TAKEN') || error.message.includes('taken')) {
      toast.show('This team name is already taken for this event.', 'error', 'Name Taken');
    } else {
      toast.show(error.message, 'error', 'Error');
    }
  } else {
    toast.show('Capacity reached or action invalid.', 'error', 'Action Failed');
  }
}

