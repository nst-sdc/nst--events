/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

import type {
  TeamMemberItem as TeamMember,
  TeamDetail as Team,
  TeamsResponse,
  JoinTeamPayload,
  CreateTeamResponse,
  CreateTeamPayload,
} from '@nst/shared';

export type { TeamMember, Team, TeamsResponse, JoinTeamPayload, CreateTeamResponse, CreateTeamPayload };

export function useTeamsList(eventId: string) {
  return useInfiniteQuery<TeamsResponse, Error>({
    queryKey: ['event-teams', eventId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.append('cursor', pageParam as string);
      return apiClient<TeamsResponse>(`/v1/events/${eventId}/teams?${params.toString()}`);
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.pagination?.nextCursor || undefined,
    enabled: !!eventId,
  });
}

export function useTeamLookup(teamId?: string | null) {
  return useQuery<Team, Error>({
    queryKey: ['team', teamId],
    queryFn: () => apiClient<Team>(`/v1/teams/${teamId}`),
    enabled: !!teamId,
  });
}

export function useJoinTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (param: string | JoinTeamPayload) => {
      const teamId = typeof param === 'string' ? param : param.teamId;
      const responses = typeof param === 'string' ? undefined : param.responses;
      return apiClient(`/v1/teams/${teamId}/join`, {
        method: 'POST',
        body: responses ? JSON.stringify({ responses }) : undefined,
      });
    },
    onSuccess: (data, param) => {
      const teamId = typeof param === 'string' ? param : param.teamId;
      queryClient.setQueryData(['event-my-registration', eventId], (old: any) => old ? { ...old, team_id: teamId } : old);
      queryClient.invalidateQueries({ queryKey: ['event-my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['profileValues'] });
    },
  });
}

export function useLeaveTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => apiClient(`/v1/teams/${teamId}/leave`, { method: 'DELETE' }),
    onSuccess: (_, teamId) => {
      queryClient.setQueryData(['event-my-registration', eventId], (old: any) => old ? { ...old, team_id: null } : old);
      queryClient.invalidateQueries({ queryKey: ['event-my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    },
  });
}

export function useCreateTeam(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeamPayload) =>
      apiClient<CreateTeamResponse>(`/v1/events/${eventId}/teams`, {
        method: 'POST',
        body: JSON.stringify({ team_name: data.name, responses: data.responses }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['event-my-registration', eventId], (old: any) => old ? { ...old, team_id: data.team_id } : old);
      queryClient.invalidateQueries({ queryKey: ['event-my-registration', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['team', data.team_id] });
      queryClient.invalidateQueries({ queryKey: ['profileValues'] });
    },
  });
}

export function useTransferLeadership(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, newLeaderId }: { teamId: string; newLeaderId: string }) => 
      apiClient(`/v1/teams/${teamId}/transfer-leadership`, { method: 'POST', body: JSON.stringify({ new_leader_id: newLeaderId }) }),
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['event-teams', eventId] });
    },
  });
}
