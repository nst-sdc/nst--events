/**
 * Canonical User Data Transfer Objects (DTOs)
 * Sourced directly from backend ground truth:
 * - apps/api/src/modules/users/users.service.ts (/users/me)
 * - apps/api/src/modules/admin/users.service.ts (/v1/admin/users)
 * - docs/frontend/shared/DATA_CONTRACT.md
 *
 * CRITICAL BOUNDARY:
 * - /users/me returns snake_case (`full_name`, `global_role`, `club_memberships`)
 * - /v1/admin/users returns camelCase (`fullName`, `globalRole`, `academicProfile`)
 * Do NOT merge into a single polymorphic type.
 */

export type GlobalRole = 'STUDENT' | 'FACULTY_MENTOR' | 'FACULTY_ADMIN' | 'PLATFORM_ADMIN';
export type ClubMembershipRole = 'CLUB_ADMIN' | 'CORE_MEMBER' | 'MEMBER';

// --- Current User (/users/me) ---

export interface CurrentUserClubMembership {
  club_id: string;
  club_name: string;
  role: ClubMembershipRole | string;
}

export interface CurrentUserAcademicProfile {
  batch: {
    id: string;
    program: {
      id: string;
      name: string;
      code: string;
    };
    admission_year: number;
    graduation_year: number;
  };
  assignment_source: string;
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  global_role: GlobalRole;
  club_memberships: CurrentUserClubMembership[];
  academic_profile: CurrentUserAcademicProfile | null;
}

// --- Admin Users Directory (/v1/admin/users) ---

export interface AdminUserAcademicBatchProgram {
  id: string;
  name: string;
  code: string;
}

export interface AdminUserAcademicBatch {
  id: string;
  programId: string;
  admissionYear: number;
  graduationYear: number;
  program: AdminUserAcademicBatchProgram;
}

export interface AdminUserAcademicProfile {
  batchId?: string;
  assignmentSource: string;
  assignedAt?: string;
  batch: AdminUserAcademicBatch | null;
}

export interface AdminUserClubMembership {
  id: string;
  role: string;
  club: {
    id: string;
    name: string;
  };
}

export interface AdminUserItem {
  id: string;
  email: string;
  fullName: string | null;
  globalRole: GlobalRole;
  academicProfile: AdminUserAcademicProfile | null;
  clubMemberships?: AdminUserClubMembership[];
}

export interface AdminUsersPagination {
  next_cursor?: string | null;
  has_more: boolean;
}

export interface AdminUsersResponse {
  data: AdminUserItem[];
  pagination: AdminUsersPagination;
  platform_admin_count?: number;
}
