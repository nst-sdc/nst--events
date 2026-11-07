import { withUserContext } from '@nst/database';
import { mapDatabaseError } from '../../lib/errors/database-error-mapper';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { NotFoundError, UnprocessableEntityError, ForbiddenError, BadRequestError, UnauthorizedError } from '../../lib/errors';
import { Prisma, Event, AttendanceSession } from '@nst/database';
import crypto from 'crypto';
import {
  CreateEventInput,
  EventClubInput,
  ListEventsQuery,
  UpdateEventInput,
  CreateSessionInput,
  UpdateSessionInput,
  EventLockState,
  UpdateEventFormFieldsInput,
  PublicEventsQuery,
} from './events.schema';
import { enqueueNotification } from '@nst/shared';
import { checkAudienceEligibility } from './audience.service';
import { generateSlug, isValidSlug, isReservedSlug } from '../../utils/slug-utils';

export interface UserForEligibilityCheck {
  id?: string;
  email?: string | null;
  googleSub?: string | null;
  deletedAt?: Date | null;
  globalRole?: string | null;
  clubMemberships?: Array<{ role: string; deletedAt?: Date | null }>;
}

export function isInstitutionalEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === 'nstevents.reviewer@gmail.com') return true;
  const parts = normalized.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const domain = parts[1];
  if (domain === 'adypu.edu.in' || domain === 'newtonschool.co') return true;
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_EMAIL_DOMAINS === 'true') {
    if (['example.com', 'test.local', 'test.com', 'nst.com'].includes(domain)) return true;
  }
  return false;
}

export function validateVerifiedUser(user?: UserForEligibilityCheck | null): void {
  if (!user) {
    throw new ForbiddenError('User not found');
  }
  if (user.deletedAt) {
    throw new ForbiddenError('Account deactivated');
  }
  if (!user.email || !isInstitutionalEmail(user.email)) {
    throw new ForbiddenError('Registration requires an institutional email account (@adypu.edu.in or @newtonschool.co)');
  }
  if (!user.googleSub || user.googleSub.trim() === '' || user.googleSub.startsWith('unverified')) {
    throw new ForbiddenError('Registration requires a verified institutional email account');
  }
}

export function validateRegistrationEligibility(user?: UserForEligibilityCheck | null): void {
  validateVerifiedUser(user);
  if (
    user?.globalRole === 'PLATFORM_ADMIN' ||
    user?.globalRole === 'FACULTY_ADMIN' ||
    user?.clubMemberships?.some((m) => m.role === 'CLUB_ADMIN' && !m.deletedAt)
  ) {
    throw new ForbiddenError('Administrator accounts cannot register for events');
  }
}

export async function generateUniqueSlug(
  tx: any,
  title: string,
  eventId?: string
): Promise<string> {
  let baseSlug = generateSlug(title);
  if (!baseSlug || isReservedSlug(baseSlug)) {
    baseSlug = `event-${crypto.randomBytes(3).toString('hex')}`;
  }

  let candidate = baseSlug;
  let counter = 2;

  while (true) {
    const existingEvent = await tx.event.findFirst({
      where: {
        slug: candidate,
        ...(eventId ? { id: { not: eventId } } : {}),
      },
      select: { id: true },
    });

    const existingHistory = await tx.eventSlugHistory.findFirst({
      where: {
        slug: candidate,
        ...(eventId ? { eventId: { not: eventId } } : {}),
      },
      select: { id: true },
    });

    if (!existingEvent && !existingHistory) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function validateAndNormalizeSlug(
  tx: any,
  desiredSlug: string,
  eventId?: string
): Promise<{ valid: boolean; available: boolean; normalizedSlug: string; reason?: string }> {
  const normalized = generateSlug(desiredSlug);

  if (!isValidSlug(desiredSlug)) {
    return {
      valid: false,
      available: false,
      normalizedSlug: normalized,
      reason: 'Slug must be between 3 and 100 characters and contain only lowercase alphanumeric characters and hyphens without spaces.',
    };
  }

  if (isReservedSlug(normalized)) {
    return {
      valid: false,
      available: false,
      normalizedSlug: normalized,
      reason: 'This URL slug is a reserved system path and cannot be used.',
    };
  }

  const existingEvent = await tx.event.findFirst({
    where: {
      slug: normalized,
      ...(eventId ? { id: { not: eventId } } : {}),
    },
    select: { id: true },
  });

  if (existingEvent) {
    return {
      valid: true,
      available: false,
      normalizedSlug: normalized,
      reason: 'This URL slug is already in use by another event.',
    };
  }

  const existingHistory = await tx.eventSlugHistory.findFirst({
    where: {
      slug: normalized,
      ...(eventId ? { eventId: { not: eventId } } : {}),
    },
    select: { id: true },
  });

  if (existingHistory) {
    return {
      valid: true,
      available: false,
      normalizedSlug: normalized,
      reason: 'This URL slug is reserved as a historical redirect for another event.',
    };
  }

  return {
    valid: true,
    available: true,
    normalizedSlug: normalized,
  };
}

export const validateSlugAvailability = async (slug: string, eventId?: string) => {
  return withUserContext(null, async (tx) => {
    const res = await validateAndNormalizeSlug(tx, slug, eventId);
    let suggestedSlug: string | undefined;
    if (!res.available) {
      suggestedSlug = await generateUniqueSlug(tx, slug, eventId);
    }
    return {
      valid: res.valid,
      available: res.available,
      reason: res.reason,
      normalized_slug: res.normalizedSlug,
      suggested_slug: suggestedSlug,
    };
  });
};

export const calculateLockState = (isLocked: boolean, endTime: Date, dbNow: Date): EventLockState => {
  const finalDeadline = endTime.getTime() + 24 * 60 * 60 * 1000;
  if (dbNow.getTime() >= finalDeadline) {
    return 'PERMANENTLY_LOCKED';
  }
  return isLocked ? 'MANUALLY_LOCKED' : 'UNLOCKED';
};

export type CanonicalRegistrationStatus = 'UPCOMING' | 'OPEN' | 'CLOSING_SOON' | 'CLOSED';

export const calculateRegistrationStatus = (
  dbNow: Date,
  start: Date | null,
  end: Date | null,
  closingSoonThresholdMs?: number
): CanonicalRegistrationStatus => {
  if (!start || !end || start >= end) return 'CLOSED';
  if (dbNow < start) return 'UPCOMING';
  if (dbNow >= end) return 'CLOSED';

  const totalDuration = end.getTime() - start.getTime();
  const remainingMs = end.getTime() - dbNow.getTime();

  // If explicit threshold is provided, use it. Otherwise, default to 24 hours (or up to 25% of total window for short events <= 24h)
  const defaultThreshold = totalDuration > 24 * 60 * 60 * 1000
    ? 24 * 60 * 60 * 1000
    : Math.min(totalDuration * 0.25, 2 * 60 * 60 * 1000);
  const threshold = closingSoonThresholdMs !== undefined ? closingSoonThresholdMs : defaultThreshold;

  if (remainingMs <= threshold) {
    return 'CLOSING_SOON';
  }

  return 'OPEN';
};

export const createEvent = async (callerId: string, data: CreateEventInput): Promise<any> => {
  return withUserContext(callerId, async (tx) => {
    const primaryClubs = data.club_ids.filter((c: EventClubInput) => c.is_primary);
    if (primaryClubs.length !== 1) {
      throw new UnprocessableEntityError('Exactly one club must be marked as primary');
    }

    // 1. Atomic Authorization Check (in same transaction as write)
    const user = await tx.user.findUnique({
      where: { id: callerId },
      select: { globalRole: true },
    });
    if (!user) throw new ForbiddenError('User not found');

    const isGlobalAdmin = ['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole);
    let isClubAdmin = false;

    if (!isGlobalAdmin) {
      for (const clubItem of data.club_ids) {
        const membership = await tx.clubMembership.findFirst({
          where: { clubId: clubItem.club_id, userId: callerId, deletedAt: null },
          select: { role: true },
        });
        if (!membership || !['CLUB_ADMIN', 'CORE_MEMBER'].includes(membership.role)) {
          throw new ForbiddenError(`Insufficient club role for club ${clubItem.club_id}`);
        }
        if (membership.role === 'CLUB_ADMIN') {
          isClubAdmin = true;
        }
      }
    }

    const regMode = data.registration_mode || 'REQUIRED';
    if (isClubAdmin && regMode === 'REQUIRED') {
      if (!data.registration_start_time || !data.registration_end_time) {
        throw new UnprocessableEntityError('Registration window (opening and closing date/time) is mandatory for Club Admins');
      }
      const regStart = new Date(data.registration_start_time).getTime();
      const regEnd = new Date(data.registration_end_time).getTime();
      if (isNaN(regStart) || isNaN(regEnd)) {
        throw new UnprocessableEntityError('Invalid registration window timestamps');
      }
      if (regStart >= regEnd) {
        throw new UnprocessableEntityError('Registration closing time must be later than opening time');
      }
    }

    let slug: string;
    if (data.slug) {
      const slugCheck = await validateAndNormalizeSlug(tx, data.slug);
      if (!slugCheck.valid || !slugCheck.available) {
        throw new UnprocessableEntityError(slugCheck.reason || 'Invalid or unavailable slug');
      }
      slug = slugCheck.normalizedSlug;
    } else {
      slug = await generateUniqueSlug(tx, data.title);
    }

    const event = await tx.event.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        startTime: data.start_time,
        endTime: data.end_time,
        registrationMode: regMode,
        registrationStartTime: regMode === 'NOT_REQUIRED' ? null : data.registration_start_time,
        registrationEndTime: regMode === 'NOT_REQUIRED' ? null : data.registration_end_time,
        locationName: data.location_name,
        eventType: data.event_type,
        visibility: data.visibility || null,
        registrationType: data.registration_type,
        attendanceType: data.attendance_type,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        createdBy: callerId,
        maxCapacity: data.max_capacity,
        maxParticipants: data.max_participants,
        audience: data.audience,
        eventClubs: {
          create: data.club_ids.map((c: EventClubInput) => ({
            clubId: c.club_id,
            isPrimary: c.is_primary,
          })),
        },
      },
      include: {
        eventClubs: { include: { club: true } },
      },
    });

    if (data.audience === 'SPECIFIC_BATCHES' && data.audience_batch_ids?.length) {
      const batches = await tx.academicBatch.findMany({
        where: { id: { in: data.audience_batch_ids } }
      });
      if (batches.length !== data.audience_batch_ids.length) {
        throw new BadRequestError('One or more audience batch IDs are invalid');
      }

      await tx.eventAudienceBatch.createMany({
        data: data.audience_batch_ids.map((batchId: string) => ({
          eventId: event.id,
          batchId
        }))
      });
    }

    if (data.location_lat !== undefined && data.location_lng !== undefined) {
      await tx.$executeRaw`
        UPDATE events 
        SET location_geofence = ST_SetSRID(ST_MakePoint(${data.location_lng}, ${data.location_lat}), 4326) 
        WHERE id = ${event.id}::uuid
      `;
      const geo = await tx.$queryRaw<{ geojson: string }[]>`
        SELECT ST_AsGeoJSON(location_geofence) as geojson FROM events WHERE id = ${event.id}::uuid
      `;
      (event as any).location_geofence = geo[0]?.geojson ? JSON.parse(geo[0].geojson) : null;
    } else {
      (event as any).location_geofence = null;
    }

    return event;
  });
};

export const listEvents = async (callerId: string, query: ListEventsQuery): Promise<any> => {
  return withUserContext(callerId, async (tx) => {
    const where: Prisma.EventWhereInput = { deletedAt: null };

    if (query.filter_state) where.state = query.filter_state;
    if (query.filter_event_type) where.eventType = query.filter_event_type;
    if (query.filter_visibility) where.visibility = query.filter_visibility;
    if (query.filter_club_id) {
      where.eventClubs = { some: { clubId: query.filter_club_id } };
    }

    if (query.q) {
      const fts = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM events 
        WHERE deleted_at IS NULL
        AND search_vector @@ plainto_tsquery('english', ${query.q})
        LIMIT 1000
      `;
      where.id = { in: fts.map((f) => f.id) };
    }

    const items = await tx.event.findMany({
      where,
      take: query.limit + 1,
      skip: query.cursor ? 1 : undefined,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [
        query.sort === 'created_at' ? { createdAt: query.order } : { startTime: query.order },
        { id: 'asc' }
      ],
      include: { 
        eventClubs: { include: { club: true } }, 
        eventAudienceBatches: true,
        _count: { select: { eventRegistrations: { where: { deletedAt: null, registrationStatus: { not: 'CANCELLED' } } } } },
      },
    });

    const has_more = items.length > query.limit;
    if (has_more) items.pop();
    const next_cursor = has_more ? items[items.length - 1].id : undefined;

    let finalItems: any = items;
    if (items.length > 0) {
      const ids = items.map((i) => i.id);
      const geo = await tx.$queryRaw<{ id: string; geojson: string }[]>`
        SELECT id, ST_AsGeoJSON(location_geofence) as geojson 
        FROM events 
        WHERE id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
      `;
      const geoMap = new Map(geo.map((g) => [g.id, g.geojson ? JSON.parse(g.geojson) : null]));
      
      const attentionResult = await tx.$queryRaw<{ event_id: string; below_minimum_team_count: number }[]>`
        SELECT
          e.id as event_id,
          COUNT(t.id)::int as below_minimum_team_count
        FROM events e
        JOIN teams t ON t.event_id = e.id
        WHERE e.id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
          AND t.status = 'REGISTERED'
          AND t.deleted_at IS NULL
          AND e.deleted_at IS NULL
          AND e.registration_type = 'TEAM'
          AND e.metadata->>'minimum_team_size' IS NOT NULL
          AND (
            SELECT COUNT(*) FROM event_registrations er
            WHERE er.team_id = t.id AND er.deleted_at IS NULL
          ) < (e.metadata->>'minimum_team_size')::int
        GROUP BY e.id
      `;
      const attentionMap = new Map(attentionResult.map((a) => [a.event_id, a.below_minimum_team_count]));
      
      const timeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
      const dbNow = timeResult[0].now;

      finalItems = items.map((item) => {
        const { eventAudienceBatches, _count, ...rest } = item;
        const participantCount = _count?.eventRegistrations ?? 0;
        return {
          ...rest,
          participantCount,
          participant_count: participantCount,
          audienceBatchIds: eventAudienceBatches.map(b => b.batchId),
          location_geofence: geoMap.get(item.id) || null,
          lock_deadline: new Date(item.endTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          lock_state: calculateLockState(item.isLocked, item.endTime, dbNow),
          registrationStatus: calculateRegistrationStatus(dbNow, item.registrationStartTime, item.registrationEndTime),
          registration_mode: item.registrationMode,
          registrationMode: item.registrationMode,
          below_minimum_team_count: attentionMap.get(item.id) || 0,
        };
      });
    }

    return { data: finalItems, pagination: { next_cursor, has_more } };
  });
};

export const ATTENDANCE_SESSION_SAFE_SELECT = {
  id: true,
  eventId: true,
  title: true,
  startTime: true,
  endTime: true,
  openAt: true,
  closeAt: true,
  geofenceRadius: true,
  venueLatitude: true,
  venueLongitude: true,
  locationAccuracy: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

type GetEventByIdResponse = Prisma.EventGetPayload<{
  include: {
    eventClubs: { include: { club: true } };
    attendanceSessions: {
      select: typeof ATTENDANCE_SESSION_SAFE_SELECT;
    };
    _count: { select: { eventRegistrations: true } };
  };
}> & {
  location_geofence: any;
  lock_deadline: string;
  lockDeadline: string;
  lock_state: EventLockState;
  registrationStatus: CanonicalRegistrationStatus;
  audienceBatchIds?: string[];
  below_minimum_team_count: number;
  participantCount: number;
  participant_count: number;
  registrationCount: number;
  registeredParticipantCount: number;
  registeredTeamCount: number | null;
};

export const getEventById = async (callerId: string, eventId: string): Promise<GetEventByIdResponse> => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        eventClubs: { include: { club: true } },
        attendanceSessions: {
          where: { deletedAt: null },
          select: ATTENDANCE_SESSION_SAFE_SELECT,
        },
        _count: { select: { eventRegistrations: { where: { deletedAt: null, registrationStatus: 'REGISTERED' } } } },
        eventAudienceBatches: true,
      },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    const geo = await tx.$queryRaw<{ geojson: string }[]>`
      SELECT ST_AsGeoJSON(location_geofence) as geojson FROM events WHERE id = ${eventId}::uuid
    `;
    
    const attentionResult = await tx.$queryRaw<{ below_minimum_team_count: number }[]>`
      SELECT
        COUNT(t.id)::int as below_minimum_team_count
      FROM events e
      JOIN teams t ON t.event_id = e.id
      WHERE e.id = ${eventId}::uuid
        AND t.status = 'REGISTERED'
        AND t.deleted_at IS NULL
        AND e.deleted_at IS NULL
        AND e.registration_type = 'TEAM'
        AND e.metadata->>'minimum_team_size' IS NOT NULL
        AND (
          SELECT COUNT(*) FROM event_registrations er
          WHERE er.team_id = t.id AND er.deleted_at IS NULL
        ) < (e.metadata->>'minimum_team_size')::int
      GROUP BY e.id
    `;
    
    const timeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = timeResult[0].now;

    const { eventAudienceBatches, ...eventRest } = event;
    const countResult = await tx.$queryRaw<{ count: number }[]>`
      SELECT get_event_participant_count(${eventId}::uuid) as count
    `;
    const participantCount = countResult[0]?.count ?? 0;
    const lockDeadlineToISO = new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
    
    return {
      ...eventRest,
      participantCount,
      participant_count: participantCount,
      registeredParticipantCount: participantCount,
      registrationCount: eventRest.registrationCount,
      registeredTeamCount: event.registrationType === 'TEAM' ? eventRest.registrationCount : null,
      audienceBatchIds: eventAudienceBatches.map(b => b.batchId),
      location_geofence: geo[0]?.geojson ? JSON.parse(geo[0].geojson) : null,
      lock_deadline: lockDeadlineToISO,
      lockDeadline: lockDeadlineToISO,
      lock_state: calculateLockState(event.isLocked, event.endTime, dbNow),
      registrationStatus: calculateRegistrationStatus(dbNow, event.registrationStartTime, event.registrationEndTime),
      registration_mode: eventRest.registrationMode,
      registrationMode: eventRest.registrationMode,
      below_minimum_team_count: attentionResult[0]?.below_minimum_team_count || 0,
    };
  });
};

/**
 * Validates whether a user has read authorization for a specific event
 * using the canonical RLS policies (same semantics as getEventById).
 */
export const checkEventReadAuthorization = async (callerId: string, eventId: string): Promise<void> => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, deletedAt: true },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }
  });
};

export const updateEvent = async (callerId: string, eventId: string, data: UpdateEventInput): Promise<any> => {
  return withUserContext(callerId, async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: { state: true, deletedAt: true, startTime: true, endTime: true, registrationStartTime: true, registrationEndTime: true, slug: true, registrationMode: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    if (existing.state !== 'DRAFT' && existing.state !== 'PUBLISHED') {
      throw new UnprocessableEntityError('Event can only be updated in DRAFT or PUBLISHED state');
    }

    if (existing.state === 'PUBLISHED' && data.end_time) {
      if (new Date(data.end_time).getTime() < existing.endTime.getTime()) {
        throw new UnprocessableEntityError('Event end time can only be extended once published');
      }
    }

    if (data.registration_mode === 'NOT_REQUIRED' && existing.registrationMode !== 'NOT_REQUIRED') {
      const activeRegCount = await tx.eventRegistration.count({
        where: { eventId, deletedAt: null },
      });
      const activeTeamCount = await tx.team.count({
        where: { eventId, deletedAt: null },
      });
      if (activeRegCount > 0 || activeTeamCount > 0) {
        throw new UnprocessableEntityError('Cannot change registration mode to NOT_REQUIRED when registrations or teams already exist');
      }
    }

    const effectiveRegMode = data.registration_mode || existing.registrationMode;

    const mergedStart = data.start_time !== undefined ? new Date(data.start_time).getTime() : existing.startTime.getTime();
    const mergedEnd = data.end_time !== undefined ? new Date(data.end_time).getTime() : existing.endTime.getTime();
    
    // Explicit undefined check because null is a valid value for registration times
    let mergedRegStart: number | undefined;
    if (data.registration_start_time !== undefined) {
      mergedRegStart = data.registration_start_time ? new Date(data.registration_start_time).getTime() : undefined;
    } else {
      mergedRegStart = existing.registrationStartTime ? existing.registrationStartTime.getTime() : undefined;
    }

    let mergedRegEnd: number | undefined;
    if (data.registration_end_time !== undefined) {
      mergedRegEnd = data.registration_end_time ? new Date(data.registration_end_time).getTime() : undefined;
    } else {
      mergedRegEnd = existing.registrationEndTime ? existing.registrationEndTime.getTime() : undefined;
    }

    if (mergedStart >= mergedEnd) throw new UnprocessableEntityError('start_time must be before end_time');
    if (effectiveRegMode === 'REQUIRED') {
      if (existing.state === 'PUBLISHED') {
        if (mergedRegStart === undefined || mergedRegEnd === undefined || isNaN(mergedRegStart) || isNaN(mergedRegEnd)) {
          throw new UnprocessableEntityError('Published events in REQUIRED registration mode must have a valid registration window');
        }
      }
      if (mergedRegStart !== undefined && mergedRegEnd !== undefined && mergedRegStart >= mergedRegEnd) {
        throw new UnprocessableEntityError('registration_start_time must be before registration_end_time');
      }
      if (mergedRegStart !== undefined && mergedRegStart >= mergedEnd) {
        throw new UnprocessableEntityError('registration_start_time must be before event end_time');
      }
      if (mergedRegEnd !== undefined && mergedRegEnd > mergedEnd) {
        throw new UnprocessableEntityError('registration_end_time must be less than or equal to event end_time');
      }
    }

    const user = await tx.user.findUnique({
      where: { id: callerId },
      select: { globalRole: true },
    });
    if (!user) throw new ForbiddenError('User not found');
    const isGlobalAdmin = ['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole);
    let isClubAdmin = false;
    if (!isGlobalAdmin) {
      const eventClubs = await tx.eventClub.findMany({
        where: { eventId },
        select: { clubId: true },
      });
      const clubIds = eventClubs.map((ec) => ec.clubId);
      const memberships = await tx.clubMembership.findMany({
        where: { clubId: { in: clubIds }, userId: callerId, deletedAt: null },
        select: { role: true },
      });
      isClubAdmin = memberships.some((m) => m.role === 'CLUB_ADMIN');
    }

    if (isClubAdmin && effectiveRegMode === 'REQUIRED') {
      if (mergedRegStart === undefined || mergedRegEnd === undefined || data.registration_start_time === null || data.registration_end_time === null) {
        throw new UnprocessableEntityError('Registration window (opening and closing date/time) is mandatory for Club Admins');
      }
      if (isNaN(mergedRegStart) || isNaN(mergedRegEnd)) {
        throw new UnprocessableEntityError('Invalid registration window timestamps');
      }
      if (mergedRegStart >= mergedRegEnd) {
        throw new UnprocessableEntityError('Registration closing time must be later than opening time');
      }
    }

    let slugToUpdate: string | undefined = undefined;
    if (data.slug !== undefined) {
      const normalizedDesired = generateSlug(data.slug);
      if (normalizedDesired !== existing.slug) {
        const slugCheck = await validateAndNormalizeSlug(tx, data.slug, eventId);
        if (!slugCheck.valid || !slugCheck.available) {
          throw new UnprocessableEntityError(slugCheck.reason || 'Invalid or unavailable slug');
        }
        slugToUpdate = slugCheck.normalizedSlug;

        // Archive previous slug into event_slug_history if it existed
        if (existing.slug) {
          await tx.eventSlugHistory.upsert({
            where: { slug: existing.slug },
            create: { eventId, slug: existing.slug },
            update: { eventId },
          });
        }

        // If new slug was previously in history for this event, remove it from history
        await tx.eventSlugHistory.deleteMany({
          where: { eventId, slug: slugToUpdate },
        });
      }
    }

    const event = await tx.event.update({
      where: { id: eventId },
      data: {
        title: data.title,
        slug: slugToUpdate !== undefined ? slugToUpdate : undefined,
        description: data.description,
        startTime: data.start_time,
        endTime: data.end_time,
        registrationMode: data.registration_mode !== undefined ? data.registration_mode : undefined,
        registrationStartTime: data.registration_mode === 'NOT_REQUIRED' ? null : data.registration_start_time,
        registrationEndTime: data.registration_mode === 'NOT_REQUIRED' ? null : data.registration_end_time,
        locationName: data.location_name,
        eventType: data.event_type,
        visibility: data.visibility !== undefined ? data.visibility : undefined,
        registrationType: data.registration_type,
        attendanceType: data.attendance_type,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
        maxCapacity: data.max_capacity,
        maxParticipants: data.max_participants,
        audience: data.audience,
      },
      include: {
        eventClubs: { include: { club: true } },
      },
    });

    if (data.audience) {
      if (data.audience === 'ALL_STUDENTS') {
        await tx.eventAudienceBatch.deleteMany({ where: { eventId } });
      } else if (data.audience === 'SPECIFIC_BATCHES' && data.audience_batch_ids?.length) {
        const batches = await tx.academicBatch.findMany({
          where: { id: { in: data.audience_batch_ids } }
        });
        if (batches.length !== data.audience_batch_ids.length) {
          throw new BadRequestError('One or more audience batch IDs are invalid');
        }

        await tx.eventAudienceBatch.deleteMany({ where: { eventId } });
        await tx.eventAudienceBatch.createMany({
          data: data.audience_batch_ids.map((batchId: string) => ({
            eventId,
            batchId
          }))
        });
      }
    }

    if (data.location_lat !== undefined && data.location_lng !== undefined) {
      await tx.$executeRaw`
        UPDATE events 
        SET location_geofence = ST_SetSRID(ST_MakePoint(${data.location_lng}, ${data.location_lat}), 4326) 
        WHERE id = ${eventId}::uuid
      `;
    }

    const geo = await tx.$queryRaw<{ geojson: string }[]>`
      SELECT ST_AsGeoJSON(location_geofence) as geojson FROM events WHERE id = ${eventId}::uuid
    `;
    (event as any).location_geofence = geo[0]?.geojson ? JSON.parse(geo[0].geojson) : null;

    return event;
  });
};

export const deleteEvent = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    try {
      const rows: any[] = await tx.$queryRaw`
        SELECT id, state, deleted_at FROM delete_event(${eventId}::uuid)
      `;
      return rows[0];
    } catch (err: any) {
      mapDatabaseError(err);
    }
  });
};

export const cancelEvent = async (callerId: string, eventId: string, reason: string) => {
  return withUserContext(callerId, async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, state: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    if (existing.state === 'CANCELLED') {
      return {
        id: existing.id,
        state: existing.state,
        message: 'Event is already cancelled',
      };
    }

    if (existing.state === 'DRAFT') {
      throw new UnprocessableEntityError('Draft events cannot be cancelled; delete the draft instead.');
    }

    if (existing.state === 'ARCHIVED') {
      throw new UnprocessableEntityError('Archived events cannot be cancelled.');
    }

    const previousState = existing.state;

    let updatedEvent: any;
    try {
      const rows: any[] = await tx.$queryRaw`
        SELECT id, state, metadata FROM cancel_event(${eventId}::uuid, ${reason}::text)
      `;
      updatedEvent = rows[0];
    } catch (err: any) {
      mapDatabaseError(err);
    }

    // If event was published, notify registered/waitlisted attendees
    if (previousState === 'PUBLISHED') {
      const attendees = await tx.eventRegistration.findMany({
        where: {
          eventId,
          deletedAt: null,
          registrationStatus: { in: ['REGISTERED', 'WAITLISTED'] },
        },
        select: { userId: true },
      });

      const uniqueUserIds = Array.from(new Set(attendees.map((a: any) => a.userId)));

      for (const uid of uniqueUserIds) {
        try {
          await enqueueNotification({
            tx,
            userId: uid,
            type: 'EVENT_CANCELLED',
            title: `Event Cancelled: ${existing.title}`,
            body: reason || `The event "${existing.title}" has been cancelled.`,
            metadata: {
              schema_version: 1,
              routing: {
                target: 'event_details',
                fallback: `/student/events/${eventId}`,
                params: { eventId },
              },
              entity_ids: {
                event_id: eventId,
              },
            },
            preferenceGate: 'event_reminders',
            priority: 'HIGH',
            idempotencyString: `event-cancelled-${eventId}`,
          });
        } catch (notifErr) {
          logger.error({ err: notifErr, userId: uid, eventId }, 'Failed to enqueue cancellation notification for recipient');
        }
      }
    }

    return updatedEvent;
  });
};

export const archiveEvent = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, state: true, endTime: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    if (existing.state === 'ARCHIVED') {
      return {
        id: existing.id,
        state: existing.state,
        message: 'Event is already archived',
      };
    }

    if (existing.state === 'DRAFT' || existing.state === 'PENDING_APPROVAL') {
      throw new UnprocessableEntityError('Only completed or cancelled events can be archived.');
    }

    const dbNowRes = await tx.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
    const dbNow = dbNowRes[0]?.now || new Date();

    if (existing.state === 'PUBLISHED' && dbNow < new Date(existing.endTime)) {
      throw new UnprocessableEntityError('Cannot archive an event before its scheduled end time.');
    }

    let updatedEvent: any;
    try {
      const rows: any[] = await tx.$queryRaw`
        SELECT id, state, metadata FROM archive_event(${eventId}::uuid)
      `;
      updatedEvent = rows[0];
    } catch (err: any) {
      mapDatabaseError(err);
    }

    return updatedEvent;
  });
};


export const submitForApproval = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { eventClubs: { include: { club: true } } },
    });
    if (!event) throw new NotFoundError('Event not found');

    try {
      await tx.$queryRaw`SELECT id FROM submit_event_for_approval(${eventId}::uuid)`;
    } catch (err: any) {
      mapDatabaseError(err);
    }

    // Notify Faculty Mentor and Platform Admins
    const clubName = event.eventClubs.find(c => c.isPrimary)?.club.name || 'A club';
    const mentors = await tx.clubMembership.findMany({
      where: { clubId: { in: event.eventClubs.map(c => c.clubId) }, role: 'FACULTY_MENTOR', deletedAt: null },
      select: { userId: true },
    });
    const platformAdmins = await tx.publicProfile.findMany({
      where: { globalRole: 'PLATFORM_ADMIN', deletedAt: null },
      select: { id: true },
    });
    
    const recipients = new Set([...mentors.map(m => m.userId), ...platformAdmins.map(a => a.id)]);
    
    for (const userId of recipients) {
      await enqueueNotification({
        tx,
        userId,
        type: 'APPROVAL_REQUEST',
        title: 'Action Required: Event Approval',
        body: `${clubName} has requested approval for ${event.title}.`,
        metadata: {
          schema_version: 1,
          routing: { target: `/approvals/${eventId}`, fallback: '/approvals', params: { event_id: eventId } },
          entity_ids: { event_id: eventId, club_id: event.eventClubs[0]?.clubId },
          action_payload: { status: 'PENDING_APPROVAL' },
        },
        preferenceGate: 'push_enabled',
        priority: 'HIGH',
        idempotencyString: `APPROVAL_REQUEST${userId}${eventId}pending_approval`,
      });
    }

    return { state: 'PENDING_APPROVAL' };
  });
};

export const approveEvent = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { eventClubs: { include: { club: true } } },
    });
    if (!event) throw new NotFoundError('Event not found');

    if (!event.visibility || !['PUBLIC', 'UNLISTED', 'RESTRICTED'].includes(event.visibility)) {
      throw new UnprocessableEntityError('Event visibility must be selected before publication');
    }

    if (event.registrationMode === 'REQUIRED') {
      if (!event.registrationStartTime || !event.registrationEndTime || event.registrationStartTime >= event.registrationEndTime) {
        throw new UnprocessableEntityError('Registration window must be configured before publication for registration-required events');
      }
    }

    try {
      await tx.$queryRaw`SELECT id FROM approve_event(${eventId}::uuid)`;
    } catch (err: any) {
      mapDatabaseError(err);
    }

    const clubName = event.eventClubs.find(c => c.isPrimary)?.club.name || 'A club';
    
    // Notify Club Members (as eligible students)
    const members = await tx.clubMembership.findMany({
      where: { clubId: { in: event.eventClubs.map(c => c.clubId) }, deletedAt: null },
      select: { userId: true },
    });

    const recipients = new Set(members.map(m => m.userId));

    for (const userId of recipients) {
      await enqueueNotification({
        tx,
        userId,
        type: 'EVENT_APPROVED',
        title: `New Event: ${event.title}`,
        body: `${clubName} just published a new event!`,
        metadata: {
          schema_version: 1,
          routing: { target: `/events/${eventId}`, fallback: '/events', params: { event_id: eventId } },
          entity_ids: { event_id: eventId, club_id: event.eventClubs[0]?.clubId },
          action_payload: { status: 'PUBLISHED' },
        },
        preferenceGate: 'club_announcements',
        idempotencyString: `EVENT_APPROVED${userId}${eventId}published`,
      });
    }

    return { state: 'PUBLISHED' };
  });
};

export const rejectEvent = async (callerId: string, eventId: string, reason: string) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: { eventClubs: true },
    });
    if (!event) throw new NotFoundError('Event not found');

    try {
      await tx.$queryRaw`SELECT id FROM reject_event(${eventId}::uuid, ${reason})`;
    } catch (err: any) {
      mapDatabaseError(err);
    }

    const admins = await tx.clubMembership.findMany({
      where: { clubId: { in: event.eventClubs.map(c => c.clubId) }, role: 'CLUB_ADMIN', deletedAt: null },
      select: { userId: true },
    });

    const recipients = new Set([...admins.map(a => a.userId), event.createdBy]);

    for (const userId of recipients) {
      await enqueueNotification({
        tx,
        userId,
        type: 'EVENT_REJECTED',
        title: `Event Rejected: ${event.title}`,
        body: `Your event was rejected. Feedback: ${reason}`,
        metadata: {
          schema_version: 1,
          routing: { target: `/events/${eventId}/edit`, fallback: '/dashboard', params: { event_id: eventId } },
          entity_ids: { event_id: eventId },
          action_payload: { status: 'REJECTED' },
        },
        preferenceGate: 'push_enabled',
        priority: 'HIGH',
        idempotencyString: `EVENT_REJECTED${userId}${eventId}rejected`,
      });
    }

    return { state: 'DRAFT' };
  });
};

export const lockEvent = async (callerId: string, eventId: string) => {
  try {
    return await withUserContext(callerId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM lock_event(${eventId}::uuid)`;
      return { is_locked: true };
    });
  } catch (error: any) {
    mapDatabaseError(error);
  }
};

export const unlockEvent = async (callerId: string, eventId: string) => {
  try {
    return await withUserContext(callerId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM unlock_event(${eventId}::uuid)`;
      return { is_locked: false };
    });
  } catch (error: any) {
    mapDatabaseError(error);
  }
};

export const createSession = async (
  callerId: string,
  eventId: string,
  data: CreateSessionInput
) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { 
        state: true, 
        deletedAt: true,
        attendanceType: true,
        isLocked: true,
        endTime: true,
        _count: { select: { attendanceSessions: true } }
      },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    if (event.state !== 'PUBLISHED') {
      throw new UnprocessableEntityError('Cannot add sessions to non-published events');
    }

    if (event.attendanceType === 'SINGLE' && event._count.attendanceSessions > 0) {
      throw new UnprocessableEntityError('Event is configured for a single attendance session only.');
    }

    const dbTimeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = dbTimeResult[0].now;
    const finalDeadline = new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000);
    
    if (event.isLocked || dbNow >= finalDeadline) {
      throw new UnprocessableEntityError('EVENT_LOCKED');
    }

    const qrSecret = crypto.randomBytes(32).toString('hex');

    return tx.attendanceSession.create({
      data: {
        eventId,
        title: data.title,
        startTime: data.start_time,
        endTime: data.end_time,
        openAt: data.open_at,
        closeAt: data.close_at,
        geofenceRadius: data.geofence_radius,
        venueLatitude: data.venue_latitude,
        venueLongitude: data.venue_longitude,
        locationAccuracy: data.location_accuracy,
        createdBy: callerId,
        qrSecret,
      },
      select: ATTENDANCE_SESSION_SAFE_SELECT,
    });
  });
};

export const listSessions = async (callerId: string, eventId: string) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { deletedAt: true },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    return tx.attendanceSession.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { startTime: 'asc' },
      select: ATTENDANCE_SESSION_SAFE_SELECT,
    });
  });
};

export const updateSession = async (
  callerId: string,
  eventId: string,
  sessionId: string,
  data: UpdateSessionInput
) => {
  return withUserContext(callerId, async (tx) => {
    const session = await tx.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { eventId: true, deletedAt: true, startTime: true, endTime: true, openAt: true, closeAt: true },
    });

    if (!session || session.deletedAt || session.eventId !== eventId) {
      throw new NotFoundError('Session not found');
    }

    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { state: true, isLocked: true, endTime: true },
    });

    if (event) {
      if (event.state !== 'PUBLISHED') {
        throw new UnprocessableEntityError('EVENT_LOCKED');
      }

      const dbTimeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
      const dbNow = dbTimeResult[0].now;
      const finalDeadline = new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000);
      
      if (event.isLocked || dbNow >= finalDeadline) {
        throw new UnprocessableEntityError('EVENT_LOCKED');
      }
    }

    const mergedStart = data.start_time !== undefined ? new Date(data.start_time).getTime() : session.startTime.getTime();
    const mergedEnd = data.end_time !== undefined ? new Date(data.end_time).getTime() : session.endTime.getTime();
    const mergedOpen = data.open_at !== undefined ? new Date(data.open_at).getTime() : session.openAt.getTime();
    const mergedClose = data.close_at !== undefined ? new Date(data.close_at).getTime() : session.closeAt.getTime();

    if (mergedStart >= mergedEnd) throw new UnprocessableEntityError('start_time must be before end_time');
    if (mergedOpen >= mergedClose) throw new UnprocessableEntityError('open_at must be before close_at');

    return tx.attendanceSession.update({
      where: { id: sessionId },
      data: {
        title: data.title,
        startTime: data.start_time,
        endTime: data.end_time,
        openAt: data.open_at,
        closeAt: data.close_at,
        geofenceRadius: data.geofence_radius,
      },
      select: ATTENDANCE_SESSION_SAFE_SELECT,
    });
  });
};

export const getEventFormFields = async (eventId: string, callerId?: string) => {
  if (callerId) {
    return withUserContext(callerId, async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          state: true,
          visibility: true,
          audience: true,
          deletedAt: true,
          eventClubs: {
            where: { isPrimary: true },
            select: { clubId: true },
          },
        },
      });

      if (!event || event.deletedAt) {
        throw new NotFoundError('Event not found');
      }

      const user = await tx.user.findUnique({
        where: { id: callerId },
        select: { globalRole: true },
      });
      const isPlatformAdmin = user && ['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole);

      let isOrganizer = isPlatformAdmin;
      if (!isOrganizer && event.eventClubs.length > 0) {
        const primaryClubId = event.eventClubs[0].clubId;
        const membership = await tx.clubMembership.findFirst({
          where: {
            clubId: primaryClubId,
            userId: callerId,
            deletedAt: null,
            role: { in: ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'] },
          },
        });
        if (membership) {
          isOrganizer = true;
        }
      }

      if (!isOrganizer) {
        if (event.state !== 'PUBLISHED' || event.visibility !== 'PUBLIC') {
          throw new NotFoundError('Event not found');
        }
        await checkAudienceEligibility(eventId, callerId, tx);
      }

      return tx.eventFormField.findMany({
        where: { eventId, formId: null },
        include: { fieldDefinition: true },
        orderBy: { order: 'asc' },
      });
    });
  }

  return withUserContext(undefined, async (tx) => {
    return tx.eventFormField.findMany({
      where: { eventId, formId: null },
      include: { fieldDefinition: true },
      orderBy: { order: 'asc' },
    });
  });
};

export const updateEventFormFields = async (
  callerId: string,
  eventId: string,
  data: UpdateEventFormFieldsInput
) => {
  return withUserContext(callerId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        eventClubs: {
          select: { clubId: true },
        },
      },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    // Determine caller's club authorization for custom definitions
    const caller = await tx.user.findUnique({
      where: { id: callerId },
      select: { globalRole: true },
    });

    let derivedClubId: string | null = null;
    if (caller && !['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(caller.globalRole)) {
      derivedClubId = event.eventClubs[0]?.clubId || null;
      if (!derivedClubId) {
        const membership = await tx.clubMembership.findFirst({
          where: {
            userId: callerId,
            role: { in: ['CLUB_ADMIN', 'CORE_MEMBER'] },
            deletedAt: null,
          },
          select: { clubId: true },
        });
        derivedClubId = membership?.clubId || null;
      }
    }

    // Track keys within this batch to prevent duplicate creation
    const resolvedKeys = new Map<string, string>();
    const resolvedFields: Array<{ fieldDefinitionId: string; isRequired: boolean; order: number }> = [];

    for (const f of data.fields) {
      let resolvedId = f.fieldDefinitionId;

      if (!resolvedId && f.definition) {
        const cachedId = resolvedKeys.get(f.definition.key);
        if (cachedId) {
          resolvedId = cachedId;
        } else {
          // Check if field definition exists in database
          const existingDef = await tx.fieldDefinition.findUnique({
            where: { key: f.definition.key },
          });

          if (existingDef) {
            resolvedId = existingDef.id;
          } else {
            // Create new field definition atomically inside the transaction under caller context
            const created = await tx.fieldDefinition.create({
              data: {
                key: f.definition.key,
                label: f.definition.label,
                fieldType: f.definition.fieldType,
                options: f.definition.options ? (f.definition.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                isReusable: f.definition.isReusable ?? true,
                createdByClubId: derivedClubId,
              },
            });
            resolvedId = created.id;
          }
          resolvedKeys.set(f.definition.key, resolvedId);
        }
      }

      if (!resolvedId) {
        throw new BadRequestError('Each question must have a valid field definition ID or definition payload');
      }

      resolvedFields.push({
        fieldDefinitionId: resolvedId,
        isRequired: f.isRequired,
        order: f.order,
      });
    }

    // Delete existing registration form fields only (where formId is null)
    await tx.eventFormField.deleteMany({
      where: { eventId, formId: null },
    });

    // Create new form fields with explicit formId: null
    if (resolvedFields.length > 0) {
      await tx.eventFormField.createMany({
        data: resolvedFields.map((f) => ({
          eventId,
          formId: null,
          fieldDefinitionId: f.fieldDefinitionId,
          isRequired: f.isRequired,
          order: f.order,
        })),
      });
    }

    return tx.eventFormField.findMany({
      where: { eventId, formId: null },
      include: { fieldDefinition: true },
      orderBy: { order: 'asc' },
    });
  });
};

export const listPublicEvents = async (query: PublicEventsQuery) => {
  return withUserContext(null, async (tx) => {
    const timeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = timeResult[0].now;

    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      visibility: 'PUBLIC',
      state: query.time_filter === 'past' ? { in: ['PUBLISHED', 'ARCHIVED'] } : 'PUBLISHED',
    };

    const eventType = query.filter_event_type || (query as any).event_type;
    if (eventType) where.eventType = eventType;
    const clubId = query.filter_club_id || (query as any).club_id;
    if (clubId) {
      where.eventClubs = { some: { clubId } };
    }

    if (query.time_filter === 'past') {
      where.endTime = { lt: dbNow };
    } else {
      // Default: upcoming
      where.endTime = { gte: dbNow };
    }

    if (query.q) {
      const fts = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM events 
        WHERE deleted_at IS NULL
          AND state IN ('PUBLISHED', 'ARCHIVED')
          AND visibility = 'PUBLIC'
          AND search_vector @@ plainto_tsquery('english', ${query.q})
        LIMIT 1000
      `;
      where.id = { in: fts.map((f) => f.id) };
    }

    let orderBy: Prisma.EventOrderByWithRelationInput[];
    if (query.sort === 'created_at') {
      orderBy = [{ createdAt: query.order }, { id: 'asc' }];
    } else if (query.time_filter === 'past') {
      orderBy = [{ startTime: 'desc' }, { id: 'asc' }];
    } else {
      orderBy = [{ startTime: 'asc' }, { id: 'asc' }];
    }

    const limit = query.limit || 20;
    const items = await tx.event.findMany({
      where,
      take: limit + 1,
      skip: query.cursor ? 1 : undefined,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy,
      include: {
        eventClubs: { include: { club: true } },
      },
    });

    const has_more = items.length > limit;
    if (has_more) items.pop();
    const next_cursor = has_more ? items[items.length - 1].id : undefined;

    const finalItems = items.map((item) => {
      const primaryClub = item.eventClubs.find((c) => c.isPrimary) || item.eventClubs[0];
      const metadata = (item.metadata || {}) as Record<string, any>;
      const regStatus = calculateRegistrationStatus(dbNow, item.registrationStartTime, item.registrationEndTime);

      return {
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        banner_url: metadata.banner_url || null,
        start_time: item.startTime,
        end_time: item.endTime,
        registration_start_time: item.registrationStartTime,
        registration_end_time: item.registrationEndTime,
        location_name: item.locationName,
        event_type: item.eventType,
        registration_type: item.registrationType,
        visibility: item.visibility,
        state: item.state,
        clubs: item.eventClubs.map((ec) => ({
          id: ec.club.id,
          name: ec.club.name,
          banner_url: ec.club.bannerUrl,
          is_primary: ec.isPrimary,
        })),
        primary_club: primaryClub ? {
          id: primaryClub.club.id,
          name: primaryClub.club.name,
          banner_url: primaryClub.club.bannerUrl,
        } : null,
        registration_status: regStatus,
        registration_mode: item.registrationMode,
        registrationMode: item.registrationMode,
      };
    });

    return { data: finalItems, pagination: { next_cursor, has_more } };
  });
};

export const getPublicEventBySlug = async (slugParam: string, callerId?: string) => {
  return withUserContext(callerId || null, async (tx) => {
    const timeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
    const dbNow = timeResult[0].now;

    const normalizedSlug = generateSlug(slugParam);

    // 1. Check active event by slug
    let event = await tx.event.findFirst({
      where: {
        slug: normalizedSlug,
        deletedAt: null,
      },
      include: {
        eventClubs: { include: { club: true } },
      },
    });

    // 2. If not found by active slug, check legacy UUID and historical slugs
    if (!event) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slugParam);
      if (isUuid) {
        const legacyEvent = await tx.event.findFirst({
          where: { id: slugParam, deletedAt: null },
          select: { id: true, slug: true, state: true, visibility: true },
        });

        if (legacyEvent) {
          if (legacyEvent.state !== 'PUBLISHED') {
            throw new NotFoundError('Event not found');
          }
          if (legacyEvent.visibility === 'RESTRICTED') {
            if (!callerId) {
              throw new UnauthorizedError('Authentication required to access restricted event');
            }
            const user = await tx.user.findUnique({
              where: { id: callerId },
              select: { email: true },
            });
            if (!isInstitutionalEmail(user?.email)) {
              throw new ForbiddenError('Only verified institutional accounts may access restricted events');
            }
          }
          return {
            redirect: true,
            canonical_slug: legacyEvent.slug,
            permanent: true,
          };
        }
      }

      // Check event_slug_history
      const history = await tx.eventSlugHistory.findUnique({
        where: { slug: normalizedSlug },
        include: {
          event: {
            select: { id: true, slug: true, state: true, visibility: true, deletedAt: true },
          },
        },
      });

      if (history && !history.event.deletedAt) {
        if (!['PUBLISHED', 'ARCHIVED', 'CANCELLED'].includes(history.event.state)) {
          throw new NotFoundError('Event not found');
        }
        if (history.event.visibility === 'RESTRICTED') {
          if (!callerId) {
            throw new UnauthorizedError('Authentication required to access restricted event');
          }
          const user = await tx.user.findUnique({
            where: { id: callerId },
            select: { email: true },
          });
          if (!isInstitutionalEmail(user?.email)) {
            throw new ForbiddenError('Only verified institutional accounts may access restricted events');
          }
        }
        return {
          redirect: true,
          canonical_slug: history.event.slug,
          permanent: true,
        };
      }

      throw new NotFoundError('Event not found');
    }

    // Active event matched
    if (!['PUBLISHED', 'ARCHIVED', 'CANCELLED'].includes(event.state)) {
      throw new NotFoundError('Event not found');
    }

    if (event.visibility === 'RESTRICTED') {
      if (!callerId) {
        throw new UnauthorizedError('Authentication required to access restricted event');
      }
      const user = await tx.user.findUnique({
        where: { id: callerId },
        select: { email: true },
      });
      if (!isInstitutionalEmail(user?.email)) {
        throw new ForbiddenError('Only verified institutional accounts may access restricted events');
      }
    }

    const metadata = (event.metadata || {}) as Record<string, any>;
    const regStatus = (event.state === 'CANCELLED' || event.state === 'ARCHIVED')
      ? 'CLOSED'
      : calculateRegistrationStatus(dbNow, event.registrationStartTime, event.registrationEndTime);
    const primaryClub = event.eventClubs.find((c) => c.isPrimary) || event.eventClubs[0];

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      banner_url: metadata.banner_url || null,
      start_time: event.startTime,
      end_time: event.endTime,
      registration_start_time: event.registrationStartTime,
      registration_end_time: event.registrationEndTime,
      location_name: event.locationName,
      event_type: event.eventType,
      registration_type: event.registrationType,
      visibility: event.visibility,
      state: event.state,
      cancellation_reason: event.state === 'CANCELLED' ? (metadata.cancellation_reason || null) : null,
      clubs: event.eventClubs.map((ec) => ({
        id: ec.club.id,
        name: ec.club.name,
        banner_url: ec.club.bannerUrl,
        is_primary: ec.isPrimary,
      })),
      primary_club: primaryClub ? {
        id: primaryClub.club.id,
        name: primaryClub.club.name,
        banner_url: primaryClub.club.bannerUrl,
      } : null,
      registration_status: regStatus,
      registration_mode: event.registrationMode,
      registrationMode: event.registrationMode,
    };
  });
};


