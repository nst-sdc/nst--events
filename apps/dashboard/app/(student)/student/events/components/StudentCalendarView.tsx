'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import clsx from 'clsx';
import { useEvents, Event } from '../../../../../hooks/useEvents';
import { useMyRegistrations, MyRegistration } from '../../../../../hooks/useMyRegistrations';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  Clock3, 
  X,
  Sparkles
} from 'lucide-react';

dayjs.extend(isBetween);

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  eventType: string;
  bannerUrl?: string;
  primaryClubName?: string;
  registrationStatus: 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'NOT_REGISTERED';
  isRegistered: boolean;
  isWaitlisted: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  isLiveNow: boolean;
}

type ScopeFilter = 'ALL' | 'MY_REGISTRATIONS';
type TimelineFilter = 'ALL' | 'UPCOMING' | 'PAST';

export function StudentCalendarView() {
  const [currentMonth, setCurrentMonth] = useState(() => dayjs().startOf('month'));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('ALL');
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');

  // 1. Data Fetching (Reusing cached React Query data)
  const { 
    data: eventsResponse, 
    isLoading: isEventsLoading 
  } = useEvents({ 
    filter_state: 'PUBLISHED', 
    limit: 100 
  });

  const { 
    data: myRegistrations, 
    isLoading: isRegsLoading 
  } = useMyRegistrations();

  const now = dayjs();

  // 2. Cross-reference Events & Registrations
  const unifiedEvents: UnifiedCalendarEvent[] = useMemo(() => {
    const rawEvents: Event[] = eventsResponse?.data || [];
    const regs: MyRegistration[] = myRegistrations || [];

    // Map registrations by eventId for O(1) correlation
    const regMap = new Map<string, MyRegistration>();
    regs.forEach(r => {
      regMap.set(r.eventId, r);
    });

    // Also include any events that the student is registered for but might not be in the general list (e.g. unlisted/private)
    const allEventsMap = new Map<string, UnifiedCalendarEvent>();

    // Process general campus events
    rawEvents.forEach(ev => {
      const reg = regMap.get(ev.id);
      const regStatus = reg ? reg.registrationStatus : 'NOT_REGISTERED';
      const isPast = dayjs(ev.endTime).isBefore(now);
      const isUpcoming = dayjs(ev.endTime).isAfter(now);
      const isLiveNow = now.isBetween(dayjs(ev.startTime), dayjs(ev.endTime), null, '[]');
      const bannerUrl = (ev.metadata as Record<string, unknown> | null | undefined)?.banner_url as string | undefined;
      const primaryClub = ev.eventClubs?.find(c => c.isPrimary)?.club?.name;

      allEventsMap.set(ev.id, {
        id: ev.id,
        title: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
        locationName: ev.locationName,
        eventType: ev.eventType || 'OTHER',
        bannerUrl,
        primaryClubName: primaryClub,
        registrationStatus: regStatus,
        isRegistered: regStatus === 'REGISTERED',
        isWaitlisted: regStatus === 'WAITLISTED',
        isPast,
        isUpcoming,
        isLiveNow,
      });
    });

    // Process user registrations that weren't in the rawEvents query
    regs.forEach(reg => {
      if (!allEventsMap.has(reg.eventId) && reg.event) {
        const ev = reg.event;
        const isPast = dayjs(ev.endTime).isBefore(now);
        const isUpcoming = dayjs(ev.endTime).isAfter(now);
        const isLiveNow = now.isBetween(dayjs(ev.startTime), dayjs(ev.endTime), null, '[]');
        const bannerUrl = (ev.metadata as Record<string, unknown> | null | undefined)?.banner_url as string | undefined;

        allEventsMap.set(reg.eventId, {
          id: reg.eventId,
          title: ev.title || 'Registered Event',
          startTime: ev.startTime,
          endTime: ev.endTime,
          locationName: ev.locationName || null,
          eventType: ev.eventType || 'OTHER',
          bannerUrl,
          primaryClubName: undefined,
          registrationStatus: reg.registrationStatus,
          isRegistered: reg.registrationStatus === 'REGISTERED',
          isWaitlisted: reg.registrationStatus === 'WAITLISTED',
          isPast,
          isUpcoming,
          isLiveNow,
        });
      }
    });

    return Array.from(allEventsMap.values());
  }, [eventsResponse, myRegistrations, now]);

  // 3. Filter and O(1) Pre-indexing by Date ("YYYY-MM-DD")
  const { dateMap, eventTypes, myRegisteredCount } = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>();
    const typesSet = new Set<string>();
    let registeredCount = 0;

    unifiedEvents.forEach(ev => {
      typesSet.add(ev.eventType);
      if (ev.isRegistered) registeredCount++;

      // Apply Scope filter
      if (scopeFilter === 'MY_REGISTRATIONS' && !ev.isRegistered && !ev.isWaitlisted) {
        return;
      }

      // Apply Timeline filter
      if (timelineFilter === 'UPCOMING' && !ev.isUpcoming) {
        return;
      }
      if (timelineFilter === 'PAST' && !ev.isPast) {
        return;
      }

      // Apply Event Type filter
      if (selectedEventType !== 'ALL' && ev.eventType !== selectedEventType) {
        return;
      }

      const dateKey = dayjs(ev.startTime).format('YYYY-MM-DD');
      const existing = map.get(dateKey) || [];
      existing.push(ev);
      // Sort within the day chronologically
      existing.sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf());
      map.set(dateKey, existing);
    });

    return {
      dateMap: map,
      eventTypes: Array.from(typesSet).sort(),
      myRegisteredCount: registeredCount,
    };
  }, [unifiedEvents, scopeFilter, timelineFilter, selectedEventType]);

  // 4. Generate Days for the Current Month Grid (including padding days)
  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    
    // Day of week for start of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    // We adjust to Monday start: (day + 6) % 7
    const startDayIndex = (startOfMonth.day() + 6) % 7; 
    const daysInMonth = currentMonth.daysInMonth();

    const days: { date: dayjs.Dayjs; isCurrentMonth: boolean; dateKey: string }[] = [];

    // Preceding padding days from previous month
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = startOfMonth.subtract(i + 1, 'day');
      days.push({ date: d, isCurrentMonth: false, dateKey: d.format('YYYY-MM-DD') });
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = currentMonth.date(i);
      days.push({ date: d, isCurrentMonth: true, dateKey: d.format('YYYY-MM-DD') });
    }

    // Trailing padding days to complete the 7-column grid
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      const d = endOfMonth.add(i, 'day');
      days.push({ date: d, isCurrentMonth: false, dateKey: d.format('YYYY-MM-DD') });
    }

    return days;
  }, [currentMonth]);

  // Navigation handlers
  const handlePrevMonth = () => setCurrentMonth(prev => prev.subtract(1, 'month'));
  const handleNextMonth = () => setCurrentMonth(prev => prev.add(1, 'month'));
  const handleToday = () => {
    const today = dayjs();
    setCurrentMonth(today.startOf('month'));
    setSelectedDate(today.format('YYYY-MM-DD'));
  };

  const selectedDayEvents = selectedDate ? (dateMap.get(selectedDate) || []) : [];

  const isLoading = isEventsLoading || isRegsLoading;

  // Global Escape key handler for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedDate) {
        setSelectedDate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* TOOLBAR & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stitch-outline-variant pb-6">
        
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-stitch-outline-variant bg-stitch-surface-container-lowest">
            <button 
              onClick={handlePrevMonth}
              className="p-2.5 text-stitch-on-background hover:bg-stitch-surface-variant transition-colors"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-2 text-center min-w-[170px] border-x border-stitch-outline-variant">
              <span className="stitch-text-headline-sm uppercase tracking-wider font-bold text-stitch-on-background">
                {currentMonth.format('MMMM YYYY')}
              </span>
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-2.5 text-stitch-on-background hover:bg-stitch-surface-variant transition-colors"
              aria-label="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3 py-2 border border-stitch-outline-variant text-stitch-secondary hover:text-stitch-on-background hover:bg-stitch-surface-variant stitch-text-label-mono uppercase text-[11px] tracking-wider transition-colors"
          >
            Today
          </button>
        </div>

        {/* Status / Metric Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Toggle */}
          <div className="inline-flex border border-stitch-outline-variant bg-stitch-surface-container-lowest p-0.5">
            <button
              onClick={() => setScopeFilter('ALL')}
              className={clsx(
                "px-3 py-1.5 stitch-text-label-mono text-[11px] uppercase tracking-wider transition-colors",
                scopeFilter === 'ALL' 
                  ? "bg-stitch-surface-variant text-stitch-on-background font-bold" 
                  : "text-stitch-secondary hover:text-stitch-on-background"
              )}
            >
              All Events ({unifiedEvents.length})
            </button>
            <button
              onClick={() => setScopeFilter('MY_REGISTRATIONS')}
              className={clsx(
                "px-3 py-1.5 stitch-text-label-mono text-[11px] uppercase tracking-wider transition-colors flex items-center gap-1.5",
                scopeFilter === 'MY_REGISTRATIONS' 
                  ? "bg-stitch-primary text-stitch-on-primary font-bold" 
                  : "text-stitch-secondary hover:text-stitch-on-background"
              )}
            >
              <Sparkles className="w-3 h-3" /> My Registrations ({myRegisteredCount})
            </button>
          </div>

          {/* Timeline Filter */}
          <div className="inline-flex border border-stitch-outline-variant bg-stitch-surface-container-lowest p-0.5">
            <button
              onClick={() => setTimelineFilter('ALL')}
              className={clsx(
                "px-2.5 py-1.5 stitch-text-label-mono text-[11px] uppercase transition-colors",
                timelineFilter === 'ALL' ? "bg-stitch-surface-variant text-stitch-on-background font-bold" : "text-stitch-secondary hover:text-stitch-on-background"
              )}
            >
              All
            </button>
            <button
              onClick={() => setTimelineFilter('UPCOMING')}
              className={clsx(
                "px-2.5 py-1.5 stitch-text-label-mono text-[11px] uppercase transition-colors",
                timelineFilter === 'UPCOMING' ? "bg-stitch-surface-variant text-stitch-on-background font-bold" : "text-stitch-secondary hover:text-stitch-on-background"
              )}
            >
              Upcoming
            </button>
            <button
              onClick={() => setTimelineFilter('PAST')}
              className={clsx(
                "px-2.5 py-1.5 stitch-text-label-mono text-[11px] uppercase transition-colors",
                timelineFilter === 'PAST' ? "bg-stitch-surface-variant text-stitch-on-background font-bold" : "text-stitch-secondary hover:text-stitch-on-background"
              )}
            >
              Past
            </button>
          </div>

          {/* Event Type Dropdown */}
          {eventTypes.length > 0 && (
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="border border-stitch-outline-variant bg-stitch-surface-container-lowest text-stitch-on-background px-3 py-1.5 stitch-text-label-mono text-[11px] uppercase tracking-wider focus:outline-none focus:border-stitch-primary"
            >
              <option value="ALL">All Types</option>
              {eventTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>

      </div>

      {/* LEGEND BAR */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono uppercase tracking-widest text-stitch-secondary">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-stitch-primary inline-block"></span>
          <span>Registered by You</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border border-amber-500 bg-amber-500/20 inline-block"></span>
          <span>Waitlisted</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-stitch-surface-variant inline-block"></span>
          <span>Open Campus Event</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-stitch-outline opacity-40 inline-block"></span>
          <span>Past Event</span>
        </span>
      </div>

      {/* LOADING STATE */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-px bg-stitch-outline-variant border border-stitch-outline-variant animate-pulse">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[110px] bg-stitch-surface-container-lowest p-2">
              <div className="w-5 h-4 bg-stitch-surface-variant mb-2"></div>
              <div className="w-full h-4 bg-stitch-surface-variant"></div>
            </div>
          ))}
        </div>
      ) : (
        /* CALENDAR GRID */
        <div className="w-full border border-stitch-outline-variant bg-stitch-outline-variant">
          
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 bg-stitch-surface-variant text-center border-b border-stitch-outline-variant">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((dayName, idx) => (
              <div 
                key={dayName} 
                className={clsx(
                  "py-2.5 stitch-text-label-mono text-[11px] font-bold tracking-widest uppercase",
                  idx >= 5 ? "text-stitch-primary" : "text-stitch-secondary"
                )}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Day Cells (7-column grid) */}
          <div className="grid grid-cols-7 gap-px bg-stitch-outline-variant">
            {calendarDays.map(({ date, isCurrentMonth, dateKey }) => {
              const dayEvents = dateMap.get(dateKey) || [];
              const isToday = date.isSame(now, 'day');
              const isSelected = selectedDate === dateKey;
              const hasRegisteredEvent = dayEvents.some(e => e.isRegistered);
              const hasWaitlistedEvent = dayEvents.some(e => e.isWaitlisted);

              return (
                <div
                  key={dateKey}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDate(dateKey);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (dayEvents.length > 0) {
                        setSelectedDate(dateKey);
                      }
                    }
                  }}
                  role={dayEvents.length > 0 ? "button" : "gridcell"}
                  tabIndex={dayEvents.length > 0 ? 0 : undefined}
                  aria-label={dayEvents.length > 0 ? `${date.format('MMMM D, YYYY')}, ${dayEvents.length} events` : date.format('MMMM D, YYYY')}
                  className={clsx(
                    "min-h-[105px] md:min-h-[125px] p-2 flex flex-col justify-between transition-all select-none relative group",
                    isCurrentMonth ? "bg-stitch-surface-container-lowest" : "bg-stitch-surface/60 opacity-50",
                    dayEvents.length > 0 ? "cursor-pointer hover:bg-stitch-surface-variant/40" : "cursor-default",
                    isSelected && "ring-2 ring-stitch-primary z-10",
                    hasRegisteredEvent && isCurrentMonth 
                      ? "border-l-2 border-l-stitch-primary" 
                      : hasWaitlistedEvent && isCurrentMonth 
                        ? "border-l-2 border-l-amber-500" 
                        : undefined
                  )}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between">
                    <span 
                      className={clsx(
                        "stitch-text-label-mono text-[12px] font-bold inline-flex items-center justify-center w-6 h-6",
                        isToday 
                          ? "bg-stitch-primary text-stitch-on-primary font-black" 
                          : isCurrentMonth 
                            ? "text-stitch-on-background" 
                            : "text-stitch-secondary"
                      )}
                    >
                      {date.date()}
                    </span>

                    {/* Quick Count Badge if multiple */}
                    {dayEvents.length > 1 && (
                      <span className="text-[10px] font-mono text-stitch-secondary">
                        {dayEvents.length} events
                      </span>
                    )}
                  </div>

                  {/* Day Event Preview Pills */}
                  <div className="flex flex-col gap-1 my-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map(ev => {
                      if (ev.isRegistered) {
                        return (
                          <div 
                            key={ev.id}
                            title={`${ev.title} (Registered)`}
                            className="bg-stitch-primary text-stitch-on-primary text-[10px] font-mono px-1.5 py-0.5 truncate uppercase font-bold tracking-tight"
                          >
                            ⚡ {ev.title}
                          </div>
                        );
                      }

                      if (ev.isWaitlisted) {
                        return (
                          <div 
                            key={ev.id}
                            title={`${ev.title} (Waitlist)`}
                            className="border border-amber-500 bg-amber-500/10 text-amber-300 text-[10px] font-mono px-1.5 py-0.5 truncate uppercase"
                          >
                            ⏳ {ev.title}
                          </div>
                        );
                      }

                      if (ev.isPast) {
                        return (
                          <div 
                            key={ev.id}
                            title={`${ev.title} (Past)`}
                            className="bg-stitch-surface-variant text-stitch-secondary text-[10px] font-mono px-1.5 py-0.5 truncate uppercase opacity-60"
                          >
                            • {ev.title}
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={ev.id}
                          title={`${ev.title} (Open)`}
                          className="bg-stitch-surface-variant text-stitch-on-surface text-[10px] font-mono px-1.5 py-0.5 truncate uppercase"
                        >
                          {ev.title}
                        </div>
                      );
                    })}

                    {dayEvents.length > 2 && (
                      <span className="text-[9px] font-mono text-stitch-secondary tracking-widest pl-0.5">
                        +{dayEvents.length - 2} MORE
                      </span>
                    )}
                  </div>

                  {/* Bottom Indicator for Live / Registered status */}
                  <div className="h-1 flex gap-1">
                    {dayEvents.some(e => e.isLiveNow) && (
                      <span className="h-1 w-full bg-red-500 animate-pulse" title="Live Event Today"></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* DAY AGENDA MODAL / SLIDE-OUT DRAWER */}
      {selectedDate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedDate(null)}
        >
          <div 
            className="bg-stitch-surface-container-lowest border border-stitch-outline-variant w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-stitch-outline-variant flex items-center justify-between bg-stitch-surface-variant">
              <div>
                <span className="stitch-text-label-mono text-stitch-secondary text-[11px] uppercase tracking-widest block">
                  Campus Schedule
                </span>
                <h3 className="stitch-text-headline-lg uppercase text-stitch-on-background font-bold tracking-tight">
                  {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-stitch-secondary hover:text-stitch-on-background p-1.5 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Event List */}
            <div className="p-5 overflow-y-auto flex flex-col gap-4 divide-y divide-stitch-outline-variant">
              {selectedDayEvents.length === 0 ? (
                <div className="py-8 text-center text-stitch-secondary font-mono text-sm">
                  No events found for this day.
                </div>
              ) : (
                selectedDayEvents.map(ev => {
                  const startTimeStr = dayjs(ev.startTime).format('h:mm A');
                  const endTimeStr = dayjs(ev.endTime).format('h:mm A');

                  return (
                    <div key={ev.id} className="pt-4 first:pt-0 flex flex-col gap-3">
                      
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-stitch-surface-variant text-stitch-secondary stitch-text-label-mono uppercase text-[10px] px-2 py-0.5">
                            {ev.eventType}
                          </span>
                          {ev.primaryClubName && (
                            <span className="stitch-text-label-mono text-[10px] text-stitch-secondary uppercase">
                              by {ev.primaryClubName}
                            </span>
                          )}
                        </div>

                        {/* Registration Status Pill */}
                        {ev.isRegistered ? (
                          <span className="bg-stitch-primary text-stitch-on-primary stitch-text-label-mono uppercase text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> REGISTERED
                          </span>
                        ) : ev.isWaitlisted ? (
                          <span className="border border-amber-500 bg-amber-500/20 text-amber-300 stitch-text-label-mono uppercase text-[10px] px-2 py-0.5 flex items-center gap-1">
                            <Clock3 className="w-3 h-3" /> WAITLISTED
                          </span>
                        ) : ev.isPast ? (
                          <span className="bg-stitch-surface-variant text-stitch-secondary stitch-text-label-mono uppercase text-[10px] px-2 py-0.5">
                            PAST EVENT
                          </span>
                        ) : (
                          <span className="border border-stitch-outline text-stitch-on-surface stitch-text-label-mono uppercase text-[10px] px-2 py-0.5">
                            OPEN TO REGISTER
                          </span>
                        )}
                      </div>

                      {/* Event Title */}
                      <Link 
                        href={`/student/events/${ev.id}`}
                        className="stitch-text-headline-md text-stitch-on-background hover:text-stitch-primary transition-colors font-bold"
                      >
                        {ev.title}
                      </Link>

                      {/* Time & Venue */}
                      <div className="stitch-text-label-mono text-stitch-secondary text-[11px] uppercase tracking-wider flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stitch-primary" /> {startTimeStr} – {endTimeStr}
                        </span>
                        {ev.locationName && (
                          <>
                            <span className="text-stitch-outline-variant">|</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-stitch-primary" /> {ev.locationName}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Action CTA */}
                      <div className="pt-2 flex justify-end">
                        <Link
                          href={`/student/events/${ev.id}`}
                          className={clsx(
                            "inline-flex items-center gap-2 stitch-text-label-mono uppercase text-[11px] tracking-widest px-4 py-2 transition-colors",
                            ev.isRegistered 
                              ? "bg-stitch-primary text-stitch-on-primary hover:bg-stitch-surface-tint font-bold" 
                              : "border border-stitch-outline text-stitch-on-background hover:bg-stitch-surface-variant"
                          )}
                        >
                          {ev.isRegistered ? "View Event Details" : "Event Details"} <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stitch-outline-variant bg-stitch-surface flex justify-end">
              <button
                onClick={() => setSelectedDate(null)}
                className="border border-stitch-outline-variant text-stitch-secondary hover:text-stitch-on-background px-4 py-2 stitch-text-label-mono uppercase text-[11px] tracking-wider transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
