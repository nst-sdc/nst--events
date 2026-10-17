import { UserProfileResponse } from '../hooks/use-user-profile';

/**
 * Checks if a user has an administrator role that prohibits registering for events.
 * Prohibited roles according to backend validateRegistrationEligibility:
 * - PLATFORM_ADMIN
 * - FACULTY_ADMIN
 * - FACULTY_MENTOR
 * - Any active CLUB_ADMIN membership
 */
import type { CurrentUserResponse, AdminUserItem } from '@nst/shared';

export type AuthUser = CurrentUserResponse | AdminUserItem | (Partial<CurrentUserResponse> & Partial<AdminUserItem>);

export function isAdministratorAccount(user?: AuthUser | null): boolean {
  if (!user) return false;
  const role = ('global_role' in user ? user.global_role : undefined) ?? ('globalRole' in user ? user.globalRole : undefined);
  if (role === 'PLATFORM_ADMIN' || role === 'FACULTY_ADMIN' || role === 'FACULTY_MENTOR') {
    return true;
  }
  if ('club_memberships' in user && Array.isArray(user.club_memberships)) {
    return user.club_memberships.some((m: any) => m.role === 'CLUB_ADMIN' && !m.deletedAt && !m.deleted_at);
  }
  if ('clubMemberships' in user && Array.isArray(user.clubMemberships)) {
    return user.clubMemberships.some((m: any) => m.role === 'CLUB_ADMIN' && !m.deletedAt && !m.deleted_at);
  }
  return false;
}

export type RegistrationWindowStatus = 'UPCOMING' | 'OPEN' | 'CLOSING_SOON' | 'CLOSED';

/**
 * Calculates whether the event registration window is UPCOMING, OPEN, CLOSING_SOON, or CLOSED.
 * Matches backend calculateRegistrationStatus and PostgreSQL RPC boundaries:
 * - If neither start nor end is provided: returns backendStatus if provided, else 'CLOSED' (authoritative DB policy)
 * - Missing start or end, or start >= end: CLOSED
 * - now < start: UPCOMING
 * - now >= end: CLOSED
 * - remaining time <= threshold: CLOSING_SOON
 * - otherwise: OPEN
 */
export function calculateRegistrationWindowStatus(
  now: Date,
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  backendStatus?: RegistrationWindowStatus | string | null
): RegistrationWindowStatus {
  const normalizedBackend = backendStatus?.toUpperCase();
  if (!start && !end) {
    if (
      normalizedBackend === 'CLOSED' ||
      normalizedBackend === 'UPCOMING' ||
      normalizedBackend === 'OPEN' ||
      normalizedBackend === 'CLOSING_SOON'
    ) {
      return normalizedBackend as RegistrationWindowStatus;
    }
    return 'OPEN';
  }

  // If one timestamp is provided but the other is missing, the window is invalid/closed per backend semantics
  if (!start || !end) return 'CLOSED';

  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 'CLOSED';
  if (startDate.getTime() >= endDate.getTime()) return 'CLOSED';

  const nowMs = now.getTime();
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (nowMs < startMs) return 'UPCOMING';
  if (nowMs >= endMs) return 'CLOSED';

  if (normalizedBackend === 'CLOSING_SOON') return 'CLOSING_SOON';

  const totalDuration = endMs - startMs;
  const remainingMs = endMs - nowMs;
  const defaultThreshold =
    totalDuration > 24 * 60 * 60 * 1000
      ? 24 * 60 * 60 * 1000
      : Math.min(totalDuration * 0.25, 2 * 60 * 60 * 1000);

  if (remainingMs <= defaultThreshold) {
    return 'CLOSING_SOON';
  }

  return 'OPEN';
}
