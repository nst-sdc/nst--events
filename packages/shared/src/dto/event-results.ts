/**
 * Canonical Event Results & Leaderboard Data Transfer Objects (DTOs)
 * Sourced directly from backend ground truth:
 * - apps/api/src/modules/event-results/event-results.service.ts
 * - docs/frontend/shared/DATA_CONTRACT.md
 */

export type AwardType = 'RANKED_PLACEMENT' | 'SPECIAL_AWARD' | 'HONORABLE_MENTION' | 'CUSTOM';
export type RecipientType = 'INDIVIDUAL' | 'TEAM' | 'EXTERNAL';
export type TieRankingType = 'COMPETITION' | 'DENSE';
export type ResultLifecycleState = 'NOT_CONFIGURED' | 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN';

export interface StudentWinnerSnapshot {
  id: string;
  name: string;
  slug?: string | null;
  avatar_url?: string | null;
  roll_number?: string | null;
  program?: string | null;
  batch?: string | null;
}

export interface TeamMemberWinnerSnapshot {
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
  student?: StudentWinnerSnapshot;
  team?: {
    id: string;
    name: string;
  };
  members?: TeamMemberWinnerSnapshot[];
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

export interface PublicResultsEventInfo {
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
  } | null;
}

export interface PublicResultsResponse {
  status: 'PUBLISHED' | 'DRAFT' | 'WITHDRAWN' | 'NOT_CONFIGURED' | 'UNAUTHENTICATED_RESTRICTED';
  redirect?: boolean;
  canonical_slug?: string;
  event?: PublicResultsEventInfo;
  awards: FormattedAward[];
  published_at?: string | null;
  last_revised_at?: string | null;
}

export interface EventResultsResponse {
  id: string;
  event_id: string;
  state: ResultLifecycleState;
  published_at?: string | null;
  awards: FormattedAward[];
  summary?: string | null;
}
