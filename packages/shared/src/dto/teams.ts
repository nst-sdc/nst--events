/**
 * Canonical Team Data Transfer Objects (DTOs)
 * Sourced directly from backend ground truth:
 * - apps/api/src/modules/teams/teams.service.ts
 * - docs/frontend/shared/DATA_CONTRACT.md
 */

export interface TeamMemberItem {
  user_id: string;
  full_name: string;
  registration_status: string;
}

export interface TeamListItem {
  id: string;
  name: string;
  leader_id: string;
  leader_name: string;
  member_count: number;
  status?: string;
  below_minimum?: boolean;
  members: TeamMemberItem[];
}

export interface TeamDetail {
  id: string;
  name: string;
  leader_id: string;
  leader_name: string;
  member_count: number;
  status?: string;
  below_minimum?: boolean;
  members: TeamMemberItem[];
}

export interface TeamsPagination {
  nextCursor?: string | null;
  next_cursor?: string | null;
}

export interface TeamsResponse {
  data: TeamListItem[];
  pagination: TeamsPagination;
}

export type Team = TeamListItem;
export type TeamMember = TeamMemberItem;

export interface JoinTeamPayload {
  teamId: string;
  responses?: Array<{ fieldDefinitionId: string; value: string }>;
}

export interface CreateTeamResponse {
  team_id: string;
  name: string;
  leader_id: string;
  status: string;
  registration_id: string;
}

export interface CreateTeamPayload {
  name: string;
  responses?: Array<{ fieldDefinitionId: string; value: string }>;
}

