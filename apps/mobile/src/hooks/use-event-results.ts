import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

import type {
  AwardType,
  RecipientType,
  TieRankingType,
  StudentWinnerSnapshot,
  TeamMemberWinnerSnapshot,
  AwardRecipientData,
  AwardProjectLinkData,
  FormattedAward,
} from '@nst/shared';

export type {
  AwardType,
  RecipientType,
  TieRankingType,
  StudentWinnerSnapshot,
  TeamMemberWinnerSnapshot,
  AwardRecipientData,
  AwardProjectLinkData,
  FormattedAward,
};

export interface PublicResultsResponse {
  status: 'PUBLISHED' | 'DRAFT' | 'WITHDRAWN' | 'NOT_CONFIGURED' | 'UNAUTHENTICATED_RESTRICTED';
  redirect?: boolean;
  canonical_slug?: string;
  event: {
    id: string;
    title: string;
    slug: string;
    start_time?: string;
    end_time?: string;
    event_type?: string;
    registration_type?: string;
    visibility?: string;
    primary_club?: {
      id: string;
      name: string;
      banner_url?: string | null;
      bannerUrl?: string | null;
    } | null;
  };
  results: {
    revision_number: number;
    published_at: string;
    correction_reason?: string | null;
    is_correction: boolean;
    podium: FormattedAward[];
    additional_ranked: FormattedAward[];
    special_awards: FormattedAward[];
    total_awards: number;
    total_recipients: number;
  } | null;
}

export interface StudentAchievementItem {
  id: string;
  award_title: string;
  award_type: AwardType;
  placement?: number | null;
  is_team_award: boolean;
  team_name?: string | null;
  published_at: string;
  event: {
    id: string;
    title: string;
    slug: string;
    start_time?: string | null;
  };
  linked_project?: {
    id: string;
    title: string;
    slug: string;
    cover_image_url?: string | null;
  } | null;
}

export function useEventResults(slugOrId?: string, enabled = true) {
  return useQuery<PublicResultsResponse, Error>({
    queryKey: ['events', slugOrId, 'results'],
    queryFn: async () => {
      if (!slugOrId) throw new Error('Missing event slug or ID');
      try {
        const data = await apiClient(`/v1/events/public/${encodeURIComponent(slugOrId)}/results`);
        return data as PublicResultsResponse;
      } catch (err: any) {
        if (err?.status === 404) {
          if (err?.body?.status === 'UNAUTHENTICATED_RESTRICTED') {
            return err.body as PublicResultsResponse;
          }
          return {
            status: 'NOT_CONFIGURED',
            event: { id: '', title: '', slug: slugOrId },
            results: null,
          } as PublicResultsResponse;
        }
        throw err;
      }
    },
    enabled: !!slugOrId && enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function useStudentAchievements(userId?: string, enabled = true) {
  return useQuery<{ achievements: StudentAchievementItem[] }, Error>({
    queryKey: ['users', userId, 'achievements'],
    queryFn: async () => {
      if (!userId) return { achievements: [] };
      return apiClient(`/v1/events/users/${userId}/achievements`);
    },
    enabled: !!userId && enabled,
    staleTime: 60 * 1000,
  });
}

export function useSubmitResultReport(eventId: string) {
  return useMutation<{ success: boolean; report_id: string }, Error, { reason: string; details: string }>({
    mutationFn: async (payload) => {
      return apiClient(`/v1/events/${eventId}/results/report`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  });
}
