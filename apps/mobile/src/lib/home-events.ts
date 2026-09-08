import { EventResponse } from '../hooks/use-events';

export type EventDerivedState = 'ONGOING' | 'UPCOMING' | 'PAST';

export interface ClassifiedHomeEvents {
  ongoingEvents: EventResponse[];
  upcomingEvents: EventResponse[];
  finalOrderedEvents: EventResponse[];
}

export const isSameCalendarDay = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

/**
 * Derives whether an event is ONGOING, UPCOMING, or PAST.
 * 
 * Rules:
 * 1. If an event has an active attendance session, it MUST be surfaced in ongoing/active.
 * 2. If the event's endTime has already passed (and no active session), it is PAST.
 * 3. If the current time is within the event window [startTime, endTime]:
 *    - If the event started today (same calendar day) or is actively ongoing today, it is ONGOING.
 *    - Older events that started on a prior calendar day with no active attendance session remain available as UPCOMING.
 * 4. Otherwise (startTime is in the future and no active session), it is UPCOMING.
 */
export function getDerivedEventState(
  event: EventResponse,
  now: Date,
  hasActiveAttendanceSession: boolean = false
): EventDerivedState {
  const startAt = new Date(event.startTime);
  const endAt = new Date(event.endTime);

  // 1. Explicit active attendance session always surfaces in ongoing/active
  if (hasActiveAttendanceSession) {
    return 'ONGOING';
  }

  // 2. Past/ended: event end time has passed
  if (now.getTime() > endAt.getTime()) {
    return 'PAST';
  }

  // 3. Ongoing/active: currently within event timing window
  if (now.getTime() >= startAt.getTime() && now.getTime() <= endAt.getTime()) {
    if (isSameCalendarDay(startAt, now)) {
      return 'ONGOING';
    }
    // Started on a prior day without an active attendance session
    return 'UPCOMING';
  }

  // 4. Future event: hasn't started yet
  return 'UPCOMING';
}

/**
 * Classifies published events into ONGOING and UPCOMING, filters out PAST events,
 * sorts ongoing and upcoming groups deterministically, and produces the combined ordered list.
 */
export function classifyAndSortHomeEvents(
  publishedEvents: EventResponse[],
  now: Date,
  liveEventIds: Set<string> = new Set()
): ClassifiedHomeEvents {
  // Derive state and log for each event
  publishedEvents.forEach((event) => {
    const hasActiveSession = liveEventIds.has(event.id);
    const derivedState = getDerivedEventState(event, now, hasActiveSession);
    console.log(`[Home][EventState] ${event.id}, ${event.title}, ${event.startTime}, ${event.endTime}, ${derivedState}`);
  });

  // Filter into ongoing and upcoming, excluding PAST
  const ongoingEvents = publishedEvents.filter((event) => {
    const hasActiveSession = liveEventIds.has(event.id);
    return getDerivedEventState(event, now, hasActiveSession) === 'ONGOING';
  });

  const upcomingEvents = publishedEvents.filter((event) => {
    const hasActiveSession = liveEventIds.has(event.id);
    return getDerivedEventState(event, now, hasActiveSession) === 'UPCOMING';
  });

  // Preserve deterministic chronological ordering within ongoing group
  // (events active today prioritized, then chronological start time with deterministic ID tie-breaker)
  ongoingEvents.sort((a, b) => {
    const aToday = isSameCalendarDay(new Date(a.startTime), now) ? 1 : 0;
    const bToday = isSameCalendarDay(new Date(b.startTime), now) ? 1 : 0;
    if (aToday !== bToday) return bToday - aToday;

    const diff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  // Upcoming events remain chronologically ordered with deterministic tie-breaker
  upcomingEvents.sort((a, b) => {
    const diff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  // Ongoing events ALWAYS appear before upcoming events
  const finalOrderedEvents = [...ongoingEvents, ...upcomingEvents];
  console.log(`[Home][Order] ${finalOrderedEvents.map((e) => `${e.id}: ${e.title}`).join(' | ')}`);

  return {
    ongoingEvents,
    upcomingEvents,
    finalOrderedEvents,
  };
}

/**
 * Finds an active attendance session from direct session query results or event-embedded sessions.
 * Checks both camelCase (openAt/closeAt) and snake_case (open_at/close_at),
 * falling back to session startTime/endTime if window fields are absent.
 */
export function findActiveAttendanceSession(
  sessions?: any[],
  eventSessions?: any[],
  now: Date = new Date()
) {
  const combined = [
    ...(Array.isArray(sessions) ? sessions : []),
    ...(Array.isArray(eventSessions) ? eventSessions : []),
  ];

  if (combined.length === 0) return undefined;

  const seenIds = new Set<string>();
  const uniqueSessions = combined.filter((s) => {
    if (!s || typeof s !== 'object') return false;
    const id = s.id;
    if (id) {
      if (seenIds.has(id)) return false;
      seenIds.add(id);
    }
    return true;
  });

  return uniqueSessions.find((s: any) => {
    const openRaw = s.openAt ?? s.open_at ?? s.startTime ?? s.start_time;
    const closeRaw = s.closeAt ?? s.close_at ?? s.endTime ?? s.end_time;

    if (!openRaw) return false;

    const openTime = new Date(openRaw);
    if (isNaN(openTime.getTime())) return false;

    if (now.getTime() < openTime.getTime()) return false;

    if (closeRaw) {
      const closeTime = new Date(closeRaw);
      if (!isNaN(closeTime.getTime()) && now.getTime() > closeTime.getTime()) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks whether attendance has already been recorded as PRESENT or EXCUSED
 * for a specific session or event across paginated attendance records.
 */
export function isSessionAttendancePresent(
  sessionId?: string,
  attendancePages?: any[],
  eventId?: string
): boolean {
  if (!attendancePages || !Array.isArray(attendancePages)) return false;

  return attendancePages.some((page: any) => {
    if (!page?.data || !Array.isArray(page.data)) return false;
    return page.data.some((record: any) => {
      const recSessionId = record.sessionId ?? record.session_id;
      const recEventId = record.session?.eventId ?? record.session?.event_id;
      const isPresent = record.status === 'PRESENT' || record.status === 'EXCUSED';
      if (!isPresent) return false;

      if (sessionId) {
        return recSessionId === sessionId;
      }
      if (eventId) {
        return recEventId === eventId;
      }
      return false;
    });
  });
}

/**
 * Checks if the current time falls within the event's overall start and end window.
 */
export function isEventCurrentlyLive(event: EventResponse | any, now: Date = new Date()): boolean {
  if (!event) return false;
  const startRaw = event.startTime ?? event.start_time;
  const endRaw = event.endTime ?? event.end_time;

  if (!startRaw) return false;
  const startAt = new Date(startRaw);
  if (isNaN(startAt.getTime())) return false;

  if (now.getTime() < startAt.getTime()) return false;

  if (endRaw) {
    const endAt = new Date(endRaw);
    if (!isNaN(endAt.getTime()) && now.getTime() > endAt.getTime()) {
      return false;
    }
  }

  return true;
}

