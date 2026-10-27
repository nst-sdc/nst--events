/**
 * Canonical Club Data Transfer Objects (DTOs)
 * Sourced directly from backend ground truth:
 * - apps/api/src/modules/clubs/clubs.service.ts
 * - docs/frontend/shared/DATA_CONTRACT.md
 *
 * NOTE: List and Detail endpoints return different shapes.
 * - List (/clubs and /clubs/search): includes member_count, excludes members array
 * - Detail (/clubs/:id): includes members array, excludes member_count
 * Both endpoints return snake_case `banner_url`.
 */

export type ClubStatus = 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';

export interface ClubListItem {
  id: string;
  name: string;
  description: string;
  status: ClubStatus;
  banner_url: string | null;
  /** Normalized client compatibility alias */
  bannerUrl?: string | null;
  event_count: number;
  member_count: number;
}

export type ClubRole = 'CLUB_ADMIN' | 'MEMBER' | 'FACULTY_MENTOR' | 'CORE_MEMBER';

export interface ClubDetailMember {
  user_id: string;
  role: ClubRole | string;
  full_name: string;
  avatar_url: string | null;
}

export interface ClubDetail {
  id: string;
  name: string;
  description: string | null;
  status: ClubStatus;
  banner_url: string | null;
  /** Normalized client compatibility alias */
  bannerUrl?: string | null;
  event_count: number;
  members: ClubDetailMember[];
}

export interface ClubsPagination {
  next_cursor?: string | null;
  has_more: boolean;
}

export interface ClubsResponse {
  data: ClubListItem[];
  pagination: ClubsPagination;
}

export interface UpdateClubPayload {
  name?: string;
  description?: string | null;
  banner_url?: string | null;
}

export interface ClubMemberMutationPayload {
  userId: string;
  role: 'CLUB_ADMIN' | 'CORE_MEMBER' | 'MEMBER';
}
