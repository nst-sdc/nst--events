import { apiClient, API_BASE_URL } from './api';

export type AwardType = 'RANKED_PLACEMENT' | 'SPECIAL_AWARD' | 'HONORABLE_MENTION' | 'CUSTOM';
export type RecipientType = 'INDIVIDUAL' | 'TEAM' | 'EXTERNAL';
export type TieRankingType = 'COMPETITION' | 'DENSE';
export type ResultLifecycleState = 'NOT_CONFIGURED' | 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN';

export interface StudentSnapshot {
  id: string;
  name: string;
  slug?: string | null;
  avatar_url?: string | null;
  roll_number?: string | null;
  program?: string | null;
  batch?: string | null;
}

export interface TeamMemberSnapshot {
  id?: string;
  user_id?: string | null;
  name: string;
  slug?: string | null;
  avatar_url?: string | null;
  roll_number?: string | null;
  program?: string | null;
  batch?: string | null;
  team_role?: string | null;
  is_authorized_exception?: boolean;
}

export interface AwardRecipientData {
  id?: string;
  recipient_type: RecipientType;
  student?: StudentSnapshot;
  team?: {
    id: string;
    name: string;
  };
  members?: TeamMemberSnapshot[];
  external?: {
    name: string;
    details?: string | null;
  };
  is_authorized_exception?: boolean;
}

export interface AwardProjectLinkData {
  id?: string;
  type: 'NST_PROJECT' | 'EXTERNAL_URL';
  project_id?: string | null;
  project?: {
    id: string;
    title: string;
    slug: string;
    tagline?: string | null;
    cover_image_url?: string | null;
  } | null;
  external_url?: string | null;
  title_snapshot?: string | null;
}

export interface FormattedAward {
  id?: string;
  title: string;
  award_type: AwardType;
  placement?: number | null;
  description?: string | null;
  display_order: number;
  is_tied: boolean;
  tie_ranking_type?: TieRankingType | null;
  recipients: AwardRecipientData[];
  project_links?: AwardProjectLinkData[];
}

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
    all_awards: FormattedAward[];
  } | null;
}

export interface OrganizerWorkspaceResponse {
  event: {
    id: string;
    title: string;
    slug: string;
    state: string;
    visibility: string;
    registration_type: string;
    primary_club: { id: string; name: string } | null;
  };
  result_set: {
    id: string;
    status: ResultLifecycleState;
    active_published_revision_id?: string | null;
  };
  draft: any | null;
  active_published: any | null;
  revision_history: any[];
}

export interface EligibleParticipant {
  registration_id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  roll_number?: string | null;
  program?: string | null;
  batch?: string | null;
}

export interface EligibleTeamMember {
  registration_id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  roll_number?: string | null;
  program?: string | null;
  batch?: string | null;
  team_role?: string;
}

export interface EligibleTeam {
  team_id: string;
  name: string;
  leader_id: string;
  status: string;
  members: EligibleTeamMember[];
}

export const eventResultsApi = {
  // Organizer APIs
  async getOrganizerWorkspace(eventId: string): Promise<OrganizerWorkspaceResponse> {
    return apiClient<OrganizerWorkspaceResponse>(`/v1/events/${eventId}/results/manage`);
  },

  async getEligibleParticipants(eventId: string, search?: string): Promise<{ participants: EligibleParticipant[] }> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient<{ participants: EligibleParticipant[] }>(`/v1/events/${eventId}/results/eligible-participants${q}`);
  },

  async getEligibleTeams(eventId: string, search?: string): Promise<{ teams: EligibleTeam[] }> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient<{ teams: EligibleTeam[] }>(`/v1/events/${eventId}/results/eligible-teams${q}`);
  },

  async saveDraft(eventId: string, data: { version: number; awards: any[] }) {
    return apiClient<{ success: boolean; version: number }>(`/v1/events/${eventId}/results/draft`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async publish(
    eventId: string,
    data: {
      revision_id: string;
      version: number;
      notify_winners: boolean;
      announce_participants: boolean;
    }
  ) {
    return apiClient<{ success: boolean; revision_id: string; revision_number: number }>(
      `/v1/events/${eventId}/results/publish`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  async createCorrection(eventId: string, data: { correction_reason: string }) {
    return apiClient<{ success: boolean; revision_id: string; revision_number: number }>(
      `/v1/events/${eventId}/results/correction`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  async withdraw(eventId: string, data: { reason: string }) {
    return apiClient<{ success: boolean }>(`/v1/events/${eventId}/results/withdraw`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async restore(eventId: string, data: { reason: string }) {
    return apiClient<{ success: boolean }>(`/v1/events/${eventId}/results/restore`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Public APIs
  async getPublicResultsBySlug(slug: string, viewerToken?: string): Promise<PublicResultsResponse> {
    const headers: Record<string, string> = {};
    if (viewerToken) {
      headers['Authorization'] = `Bearer ${viewerToken}`;
    }
    const res = await fetch(`${API_BASE_URL}/v1/events/public/${encodeURIComponent(slug)}/results`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
        ...headers,
      },
      credentials: 'include',
      next: { revalidate: 60 },
    });

    if (res.status === 404) {
      const errData = await res.json().catch(() => ({}));
      if (errData?.status === 'UNAUTHENTICATED_RESTRICTED') {
        return errData as PublicResultsResponse;
      }
      throw new Error('Event not found or results are private');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch results');
    }

    return res.json();
  },

  async submitReport(eventId: string, data: { reason: string; details: string }) {
    return apiClient<{ success: boolean; report_id: string }>(`/v1/events/${eventId}/results/report`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getStudentAchievements(userId: string) {
    return apiClient<{ achievements: any[] }>(`/v1/events/users/${userId}/achievements`);
  },
};
