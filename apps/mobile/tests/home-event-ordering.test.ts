import { describe, it, expect } from 'vitest';
import { 
  getDerivedEventState, 
  classifyAndSortHomeEvents, 
  isSameCalendarDay,
  findActiveAttendanceSession,
  isSessionAttendancePresent,
  isEventCurrentlyLive
} from '../src/lib/home-events';
import { EventResponse } from '../src/hooks/use-events';

describe('Home/Attendance Event Classification and Ordering', () => {
  const mockNow = new Date('2026-09-07T14:30:00.000Z'); // Sep 7, 2026 20:00 IST

  const makeEvent = (overrides: Partial<EventResponse>): EventResponse => ({
    id: overrides.id || 'mock-id',
    title: overrides.title || 'Mock Event',
    description: 'Mock Description',
    startTime: overrides.startTime || '2026-09-07T00:00:00.000Z',
    endTime: overrides.endTime || '2026-09-07T23:59:59.000Z',
    locationName: 'Campus Venue',
    eventType: 'MEETUP',
    visibility: 'PUBLIC',
    registrationType: 'INDIVIDUAL',
    attendanceType: 'SINGLE',
    state: 'PUBLISHED',
    maxCapacity: null,
    registrationCount: 0,
    audience: 'ALL_STUDENTS',
    metadata: {},
    ...overrides,
  });

  it('correctly classifies events into ONGOING, UPCOMING, and PAST', () => {
    // 1. Live event starting today
    const liveToday = makeEvent({
      id: 'live-today',
      title: 'Fuck Prabhav',
      startTime: '2026-09-06T18:30:00.000Z', // Sep 7 00:00 IST
      endTime: '2026-09-08T18:30:00.000Z',
    });
    expect(getDerivedEventState(liveToday, mockNow)).toBe('ONGOING');

    // 2. Future upcoming event
    const upcomingEvent = makeEvent({
      id: 'upcoming-future',
      title: 'AI Hackathon: Future Tech',
      startTime: '2026-09-20T21:30:00.000Z',
      endTime: '2026-09-21T21:30:00.000Z',
    });
    expect(getDerivedEventState(upcomingEvent, mockNow)).toBe('UPCOMING');

    // 3. Past ended event
    const pastEvent = makeEvent({
      id: 'past-ended',
      title: 'Tech Symposium 2026',
      startTime: '2026-08-06T21:30:00.000Z',
      endTime: '2026-08-07T21:30:00.000Z',
    });
    expect(getDerivedEventState(pastEvent, mockNow)).toBe('PAST');

    // 4. Older available event from yesterday with no active session
    const olderAvailable = makeEvent({
      id: 'older-available',
      title: 'teststs',
      startTime: '2026-09-05T18:30:00.000Z', // Sep 6 00:00 IST
      endTime: '2026-09-16T18:30:00.000Z',
    });
    expect(getDerivedEventState(olderAvailable, mockNow, false)).toBe('UPCOMING');

    // 5. Event with active attendance session must surface in ONGOING
    expect(getDerivedEventState(olderAvailable, mockNow, true)).toBe('ONGOING');
  });

  it('guarantees currently live event moves to the top before older available events', () => {
    const liveToday = makeEvent({
      id: '051fd8e1-b310-4655-ac0c-d0c2c78eb328',
      title: 'Fuck Prabhav',
      startTime: '2026-09-06T18:30:00.000Z', // Sep 7, 2026 (today)
      endTime: '2026-09-08T18:30:00.000Z',
    });

    const older1 = makeEvent({
      id: '3bfb8062-39d5-477b-ba7a-df4b292959d0',
      title: 'teststs',
      startTime: '2026-09-05T18:30:00.000Z', // Sep 6, 2026 (yesterday)
      endTime: '2026-09-16T18:30:00.000Z',
    });

    const older2 = makeEvent({
      id: 'd68bbcdc-4593-4850-9ebd-2dd278d1d2e5',
      title: 'fuck injora',
      startTime: '2026-09-05T18:30:00.000Z', // Sep 6, 2026 (yesterday)
      endTime: '2026-09-08T18:30:00.000Z',
    });

    const older3 = makeEvent({
      id: '54d82380-0e6b-4071-9cb8-6e96390f9e1a',
      title: 'dfvgbhnjk',
      startTime: '2026-09-05T20:30:00.000Z', // Sep 6, 2026 (yesterday)
      endTime: '2026-09-16T18:30:00.000Z',
    });

    const futureEvent = makeEvent({
      id: '29213219-8bfa-4dee-81f8-e44caead7b9b',
      title: 'AI Hackathon: Future Tech',
      startTime: '2026-09-20T21:30:00.000Z',
      endTime: '2026-09-21T21:30:00.000Z',
    });

    const pastEvent = makeEvent({
      id: '043ba341-a6ad-4581-8545-d569a262d7ba',
      title: 'Tech Symposium 2026',
      startTime: '2026-08-06T21:30:00.000Z',
      endTime: '2026-08-07T21:30:00.000Z',
    });

    // Input in arbitrary order
    const published = [older1, older2, older3, liveToday, futureEvent, pastEvent];

    const result = classifyAndSortHomeEvents(published, mockNow);

    // 1. Live event must be in ongoing events
    expect(result.ongoingEvents).toHaveLength(1);
    expect(result.ongoingEvents[0].id).toBe(liveToday.id);
    expect(result.ongoingEvents[0].title).toBe('Fuck Prabhav');

    // 2. Past event must NOT be in either list
    expect(result.finalOrderedEvents.find(e => e.id === pastEvent.id)).toBeUndefined();

    // 3. Final ordered list must have live event AT THE VERY TOP
    expect(result.finalOrderedEvents[0].id).toBe(liveToday.id);
    expect(result.finalOrderedEvents[0].title).toBe('Fuck Prabhav');

    // 4. Upcoming events must be chronologically ordered
    expect(result.upcomingEvents.map(e => e.id)).toEqual([
      older1.id,
      older2.id,
      older3.id,
      futureEvent.id,
    ]);
  });

  it('preserves deterministic chronological ordering within ongoing group', () => {
    const eventA = makeEvent({
      id: 'event-a',
      title: 'Morning Session',
      startTime: '2026-09-07T04:00:00.000Z', // 9:30 AM IST
      endTime: '2026-09-07T06:00:00.000Z',
    });

    const eventB = makeEvent({
      id: 'event-b',
      title: 'Afternoon Session',
      startTime: '2026-09-07T08:00:00.000Z', // 1:30 PM IST
      endTime: '2026-09-07T10:00:00.000Z',
    });

    const now = new Date('2026-09-07T09:00:00.000Z');
    const result = classifyAndSortHomeEvents([eventB, eventA], now, new Set(['event-a', 'event-b']));

    expect(result.ongoingEvents).toHaveLength(2);
    expect(result.ongoingEvents[0].id).toBe('event-a');
    expect(result.ongoingEvents[1].id).toBe('event-b');
  });

  it('ensures active attendance session surfaces an event in ongoing even if future startTime', () => {
    // Session opens 15 mins early before startTime
    const earlySessionEvent = makeEvent({
      id: 'early-session',
      title: 'Opens Before Start',
      startTime: '2026-09-07T15:00:00.000Z',
      endTime: '2026-09-07T18:00:00.000Z',
    });

    const liveIds = new Set(['early-session']);
    const result = classifyAndSortHomeEvents([earlySessionEvent], mockNow, liveIds);

    expect(result.ongoingEvents).toHaveLength(1);
    expect(result.ongoingEvents[0].id).toBe('early-session');
    expect(result.upcomingEvents).toHaveLength(0);
  });
});

describe('Attendance Session and Live Detection Helpers', () => {
  const mockNow = new Date('2026-09-07T14:30:00.000Z');

  describe('findActiveAttendanceSession', () => {
    it('finds active session with camelCase openAt and closeAt', () => {
      const sessions = [
        {
          id: 'sess-1',
          openAt: '2026-09-07T14:00:00.000Z',
          closeAt: '2026-09-07T15:00:00.000Z',
        },
      ];
      const active = findActiveAttendanceSession(sessions, undefined, mockNow);
      expect(active?.id).toBe('sess-1');
    });

    it('finds active session with snake_case open_at and close_at', () => {
      const sessions = [
        {
          id: 'sess-snake',
          open_at: '2026-09-07T14:00:00.000Z',
          close_at: '2026-09-07T15:00:00.000Z',
        },
      ];
      const active = findActiveAttendanceSession(sessions, undefined, mockNow);
      expect(active?.id).toBe('sess-snake');
    });

    it('falls back to startTime and endTime if openAt/closeAt omitted', () => {
      const sessions = [
        {
          id: 'sess-fallback',
          startTime: '2026-09-07T14:00:00.000Z',
          endTime: '2026-09-07T15:00:00.000Z',
        },
      ];
      const active = findActiveAttendanceSession(sessions, undefined, mockNow);
      expect(active?.id).toBe('sess-fallback');
    });

    it('finds active session from event-embedded sessions if query sessions empty', () => {
      const eventSessions = [
        {
          id: 'sess-embedded',
          openAt: '2026-09-07T14:00:00.000Z',
          closeAt: '2026-09-07T15:00:00.000Z',
        },
      ];
      const active = findActiveAttendanceSession([], eventSessions, mockNow);
      expect(active?.id).toBe('sess-embedded');
    });

    it('returns undefined if session is outside active window', () => {
      const pastSessions = [
        {
          id: 'sess-past',
          openAt: '2026-09-07T12:00:00.000Z',
          closeAt: '2026-09-07T13:00:00.000Z',
        },
      ];
      expect(findActiveAttendanceSession(pastSessions, undefined, mockNow)).toBeUndefined();

      const futureSessions = [
        {
          id: 'sess-future',
          openAt: '2026-09-07T16:00:00.000Z',
          closeAt: '2026-09-07T17:00:00.000Z',
        },
      ];
      expect(findActiveAttendanceSession(futureSessions, undefined, mockNow)).toBeUndefined();
    });
  });

  describe('isSessionAttendancePresent', () => {
    it('returns true when record status is PRESENT for target session', () => {
      const pages = [
        {
          data: [
            {
              sessionId: 'sess-target',
              status: 'PRESENT',
            },
          ],
        },
      ];
      expect(isSessionAttendancePresent('sess-target', pages)).toBe(true);
    });

    it('returns true when record status is EXCUSED', () => {
      const pages = [
        {
          data: [
            {
              sessionId: 'sess-target',
              status: 'EXCUSED',
            },
          ],
        },
      ];
      expect(isSessionAttendancePresent('sess-target', pages)).toBe(true);
    });

    it('returns false when record status is ABSENT', () => {
      const pages = [
        {
          data: [
            {
              sessionId: 'sess-target',
              status: 'ABSENT',
            },
          ],
        },
      ];
      expect(isSessionAttendancePresent('sess-target', pages)).toBe(false);
    });

    it('returns false when sessionId does not match', () => {
      const pages = [
        {
          data: [
            {
              sessionId: 'other-session',
              status: 'PRESENT',
            },
          ],
        },
      ];
      expect(isSessionAttendancePresent('sess-target', pages)).toBe(false);
    });
  });

  describe('isEventCurrentlyLive', () => {
    it('returns true when current time is between startTime and endTime', () => {
      const event = {
        startTime: '2026-09-07T14:00:00.000Z',
        endTime: '2026-09-07T15:00:00.000Z',
      };
      expect(isEventCurrentlyLive(event, mockNow)).toBe(true);
    });

    it('returns false when event has ended', () => {
      const event = {
        startTime: '2026-09-07T12:00:00.000Z',
        endTime: '2026-09-07T13:00:00.000Z',
      };
      expect(isEventCurrentlyLive(event, mockNow)).toBe(false);
    });

    it('returns false when event has not started', () => {
      const event = {
        startTime: '2026-09-07T16:00:00.000Z',
        endTime: '2026-09-07T17:00:00.000Z',
      };
      expect(isEventCurrentlyLive(event, mockNow)).toBe(false);
    });
  });
});

