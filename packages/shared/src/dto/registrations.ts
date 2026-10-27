/**
 * Canonical Registration Data Transfer Objects (DTOs)
 * Sourced directly from backend ground truth:
 * - apps/api/src/modules/registrations/registrations.service.ts
 * - docs/frontend/shared/DATA_CONTRACT.md
 */

export type MyRegistrationStatus = 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'NOT_REGISTERED' | 'FORMING';

export interface MyRegistrationResponse {
  status: MyRegistrationStatus;
  team_id?: string | null;
  waitlist_position?: number | null;
}

export interface EventRegistrationItem {
  id: string;
  eventId: string;
  userId: string;
  teamId: string | null;
  registrationStatus: string;
  participationRole: string;
  registeredAt: string;
  user?: {
    fullName: string;
    globalRole: string;
  };
}

export interface EventRegistrationsResponse {
  data: EventRegistrationItem[];
  pagination?: {
    next_cursor?: string | null;
    has_more: boolean;
  };
}
