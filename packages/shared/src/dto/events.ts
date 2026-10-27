/**
 * Canonical Event Data Transfer Objects (DTOs)
 * Sourced directly from backend ground truth:
 * - apps/api/src/modules/events/events.service.ts
 * - docs/frontend/shared/DATA_CONTRACT.md
 */

export type EventLockState = 'UNLOCKED' | 'MANUALLY_LOCKED' | 'PERMANENTLY_LOCKED';
export type CanonicalRegistrationStatus = 'UPCOMING' | 'OPEN' | 'CLOSING_SOON' | 'CLOSED';
export type EventType = 'HACKATHON' | 'WORKSHOP' | 'SEMINAR' | 'SOCIAL' | 'COMPETITION' | 'OTHER';
export type EventVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
export type EventRegistrationType = 'INDIVIDUAL' | 'TEAM';
export type EventRegistrationMode = 'REQUIRED' | 'NOT_REQUIRED';
export type EventAttendanceType = 'SINGLE' | 'MULTI_SESSION';
export type EventAudience = 'ALL_STUDENTS' | 'SPECIFIC_BATCHES';

export interface EventClubAssociation {
  clubId: string;
  isPrimary: boolean;
  club: {
    id: string;
    name: string;
    bannerUrl?: string | null;
  };
}

export interface AttendanceSessionItem {
  id: string;
  eventId: string;
  title: string | null;
  startTime: string;
  endTime: string;
  openAt: string;
  closeAt: string;
  geofenceRadius?: number;
}

export interface EventMetadataAgendaItem {
  time: string;
  title: string;
  description?: string;
}

export interface EventMetadata {
  minimum_team_size?: number;
  maximum_team_size?: number;
  agenda?: EventMetadataAgendaItem[];
  [key: string]: unknown;
}

export interface EventListItem {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  registrationStartTime: string | null;
  registrationEndTime: string | null;
  registrationStatus: CanonicalRegistrationStatus;
  locationName: string | null;
  state: string;
  maxCapacity: number | null;
  maxParticipants: number | null;
  participantCount: number;
  registrationCount: number;
  isLocked: boolean;
  attendanceType: EventAttendanceType;
  eventType: EventType;
  visibility: EventVisibility;
  registrationType: EventRegistrationType;
  registrationMode: EventRegistrationMode;
  registration_mode?: EventRegistrationMode;
  audience: EventAudience;
  audienceBatchIds?: string[];
  location_geofence: Record<string, unknown> | null;
  lock_deadline: string;
  lockDeadline?: string;
  lock_state: EventLockState;
  below_minimum_team_count?: number;
  metadata?: EventMetadata | null;
  eventClubs?: EventClubAssociation[];
}

export interface EventDetail extends EventListItem {
  attendanceSessions?: AttendanceSessionItem[];
}

export interface EventsPagination {
  next_cursor?: string | null;
  has_more: boolean;
}

export interface EventsResponse {
  data: EventListItem[];
  pagination: EventsPagination;
}
