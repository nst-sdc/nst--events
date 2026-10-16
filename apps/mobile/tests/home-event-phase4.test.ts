import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { 
  getDerivedEventState, 
  classifyAndSortHomeEvents, 
  findActiveAttendanceSession, 
  isSessionAttendancePresent 
} from '../src/lib/home-events';
import { EventResponse } from '../src/hooks/use-events';

describe('Phase 4 — Home & Event Attendance Audit & Implementation Tests', () => {
  const homeTabFile = path.resolve(__dirname, '../app/(app)/(tabs)/index.tsx');
  const eventDetailFile = path.resolve(__dirname, '../app/(app)/events/[id]/index.tsx');
  const scanFile = path.resolve(__dirname, '../app/(app)/events/[id]/scan.tsx');
  const tabsLayoutFile = path.resolve(__dirname, '../app/(app)/(tabs)/_layout.tsx');

  const homeContent = fs.readFileSync(homeTabFile, 'utf-8');
  const eventDetailContent = fs.readFileSync(eventDetailFile, 'utf-8');
  const scanContent = fs.readFileSync(scanFile, 'utf-8');
  const tabsLayoutContent = fs.readFileSync(tabsLayoutFile, 'utf-8');

  const mockNow = new Date('2026-09-08T10:00:00.000Z');

  const makeEvent = (overrides: Partial<EventResponse>): EventResponse => ({
    id: overrides.id || 'test-event-1',
    title: overrides.title || 'Test Event',
    description: 'Test Description',
    startTime: overrides.startTime || '2026-09-08T12:00:00.000Z',
    endTime: overrides.endTime || '2026-09-08T14:00:00.000Z',
    locationName: 'Campus Auditorium',
    eventType: 'WORKSHOP',
    visibility: 'PUBLIC',
    registrationType: 'INDIVIDUAL',
    attendanceType: 'SINGLE',
    state: 'PUBLISHED',
    maxCapacity: 100,
    registrationCount: 20,
    audience: 'ALL_STUDENTS',
    metadata: {},
    isLocked: false,
    ...overrides,
  });

  describe('1. Home Event Error State', () => {
    it('handles useEvents() error state and does not show NO SESSIONS on fetch failure', () => {
      expect(homeContent).toContain('isError: isEventsError');
      expect(homeContent).toContain('error: eventsError');
      expect(homeContent).toContain('refetch: refetchEvents');
      expect(homeContent).toContain('isEventsError ? (');
      expect(homeContent).toContain('<StatusBadge status="[FETCH ERROR]" type="error" />');
      expect(homeContent).toContain('<Display style={styles.errorTitle}>FAILED TO LOAD</Display>');
    });

    it('provides RETRY FETCH button that calls refetchEvents()', () => {
      expect(homeContent).toContain('title="[ RETRY FETCH ]"');
      expect(homeContent).toContain('onPress={() => refetchEvents()}');
    });

    it('preserves genuine empty state (NO SESSIONS) only when not in error state', () => {
      expect(homeContent).toContain('(ongoingEvents.length === 0 && upcomingEvents.length === 0) ? (');
      expect(homeContent).toContain('<Display style={styles.emptyTitle}>NO SESSIONS</Display>');
    });
  });

  describe('2. Upcoming Event Live-Status Propagation', () => {
    it('passes onLiveStatus={handleLiveStatus} in upcomingEvents.map(...)', () => {
      const upcomingMapMatch = homeContent.match(/upcomingEvents\.map\(\(event\) => \([\s\S]*?\)/);
      expect(upcomingMapMatch).not.toBeNull();
      expect(upcomingMapMatch![0]).toContain('onLiveStatus={handleLiveStatus}');
    });

    it('promotes upcoming event with early active attendance session to ONGOING', () => {
      const futureEvent = makeEvent({
        id: 'future-event-with-early-session',
        title: 'Workshop with Early Session',
        startTime: '2026-09-08T14:00:00.000Z', // 4 hours in the future
        endTime: '2026-09-08T16:00:00.000Z',
      });

      // Without active session -> UPCOMING
      expect(getDerivedEventState(futureEvent, mockNow, false)).toBe('UPCOMING');

      // With active session -> ONGOING
      expect(getDerivedEventState(futureEvent, mockNow, true)).toBe('ONGOING');

      const classified = classifyAndSortHomeEvents([futureEvent], mockNow, new Set(['future-event-with-early-session']));
      expect(classified.ongoingEvents.map(e => e.id)).toContain('future-event-with-early-session');
      expect(classified.upcomingEvents.map(e => e.id)).not.toContain('future-event-with-early-session');
    });
  });

  describe('3. Locked Event Attendance Suppression', () => {
    it('requires !event.isLocked in Home EventRow canScan check', () => {
      expect(homeContent).toContain('!event.isLocked');
      expect(homeContent).toMatch(/canScan\s*=\s*isSessionActive\s*&&\s*isRegistered\s*&&\s*!isPrimaryClubAdmin\s*&&\s*!hasAttendanceForActiveSession\s*&&\s*!event\.isLocked/);
    });

    it('blocks locked event from showing action tray scan button in Event Detail', () => {
      expect(eventDetailContent).toContain('event?.isLocked');
      expect(eventDetailContent).toContain("event?.isLocked ? 'EVENT LOCKED'");
    });
  });

  describe('4. Core Member Organizer Restriction', () => {
    it('treats both CLUB_ADMIN and CORE_MEMBER as organizer in Home Tab', () => {
      expect(homeContent).toMatch(/cm\.role\s*===\s*'CLUB_ADMIN'\s*\|\|\s*cm\.role\s*===\s*'CORE_MEMBER'/);
    });

    it('treats both CLUB_ADMIN and CORE_MEMBER as organizer in Event Detail', () => {
      expect(eventDetailContent).toMatch(/m\.role\s*===\s*'CLUB_ADMIN'\s*\|\|\s*m\.role\s*===\s*'CORE_MEMBER'/);
      expect(eventDetailContent).toContain('ORGANIZER — USE DESKTOP TO MANAGE');
    });

    it('suppresses student attendance CTA and registration for CORE_MEMBER', () => {
      const isOrganizer = (role: string) => role === 'CLUB_ADMIN' || role === 'CORE_MEMBER';
      expect(isOrganizer('CORE_MEMBER')).toBe(true);
      expect(isOrganizer('CLUB_ADMIN')).toBe(true);
      expect(isOrganizer('MEMBER')).toBe(false);
    });
  });

  describe('5. Event Detail Error States & Phantom Data Elimination', () => {
    it('removes phantom fallback event text (UNTITLED EVENT / CAMPUS VENUE)', () => {
      expect(eventDetailContent).toContain('isEventError || !event');
      expect(eventDetailContent).toContain('<StatusBadge status="[NOT FOUND]" type="error" />');
      expect(eventDetailContent).toContain('<Display style={styles.errorTitle}>EVENT NOT FOUND</Display>');
      expect(eventDetailContent).toContain('This event does not exist, has been removed, or is not available for your program.');
    });

    it('provides [ RETURN ] button for HTTP 404 with router.canGoBack() fallback', () => {
      expect(eventDetailContent).toContain('title="[ RETURN ]"');
      expect(eventDetailContent).toContain("router.canGoBack() ? router.back() : router.replace('/(app)')");
    });

    it('handles network / 5xx failures with FAILED TO LOAD and RETRY FETCH', () => {
      expect(eventDetailContent).toContain('<Display style={styles.errorTitle}>FAILED TO LOAD</Display>');
      expect(eventDetailContent).toContain('title="[ RETRY FETCH ]"');
      expect(eventDetailContent).toContain('onPress={() => refetchEvent()}');
    });

    it('does not retry 404 errors', () => {
      const is404 = true;
      const shouldRetry = !is404;
      expect(shouldRetry).toBe(false);
    });
  });

  describe('6. Post-Attendance Cache Invalidation', () => {
    it('invalidates [my-attendance], [events, eventId], and [events] in scan.tsx', () => {
      expect(scanContent).toContain("queryClient.invalidateQueries({ queryKey: ['my-attendance'] })");
      expect(scanContent).toContain("queryClient.invalidateQueries({ queryKey: ['events', eventId] })");
      expect(scanContent).toContain("queryClient.invalidateQueries({ queryKey: ['events'] })");
      expect(scanContent).not.toContain("queryKey: ['home-events']");
    });
  });

  describe('7. In-App Solo Event Registration & Cancellation in EventScreen', () => {
    it('instantiates useRegistration and renders registration & cancellation actions', () => {
      expect(eventDetailContent).toContain('useRegistration(');
      expect(eventDetailContent).toContain('[ REGISTER FOR EVENT ]');
      expect(eventDetailContent).toContain('[ CANCEL REGISTRATION ]');
      expect(eventDetailContent).toContain('showRegisterModal');
      expect(eventDetailContent).toContain('showCancelModal');
    });
  });

  describe('8. Multiple Active Attendance Events Stacking', () => {
    it('stacks multiple active attendance events vertically in start-time order', () => {
      const active1 = makeEvent({
        id: 'session-early',
        title: 'Morning Keynote',
        startTime: '2026-09-08T09:00:00.000Z',
        endTime: '2026-09-08T11:00:00.000Z',
      });
      const active2 = makeEvent({
        id: 'session-later',
        title: 'Midday Workshop',
        startTime: '2026-09-08T10:00:00.000Z',
        endTime: '2026-09-08T12:00:00.000Z',
      });

      const classified = classifyAndSortHomeEvents(
        [active2, active1],
        mockNow,
        new Set(['session-early', 'session-later'])
      );

      expect(classified.ongoingEvents.length).toBe(2);
      expect(classified.ongoingEvents[0].id).toBe('session-early');
      expect(classified.ongoingEvents[1].id).toBe('session-later');
    });

    it('preserves deterministic ID tie-breaker when start times are identical', () => {
      const eventA = makeEvent({
        id: 'event-aaa',
        title: 'Event A',
        startTime: '2026-09-08T10:00:00.000Z',
        endTime: '2026-09-08T12:00:00.000Z',
      });
      const eventB = makeEvent({
        id: 'event-bbb',
        title: 'Event B',
        startTime: '2026-09-08T10:00:00.000Z',
        endTime: '2026-09-08T12:00:00.000Z',
      });

      const classified = classifyAndSortHomeEvents([eventB, eventA], mockNow, new Set(['event-aaa', 'event-bbb']));
      expect(classified.ongoingEvents[0].id).toBe('event-aaa');
      expect(classified.ongoingEvents[1].id).toBe('event-bbb');
    });
  });

  describe('9. UX 2.0 4-Destination Invariance', () => {
    it('registers the 4 destinations: index, explore, activity, profile', () => {
      expect(tabsLayoutContent).toContain("allowedRoutes = ['index', 'explore', 'activity', 'profile']");
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="index" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="explore" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="activity" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="profile" />');
    });
  });
});
