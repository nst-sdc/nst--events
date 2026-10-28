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
  Sparkles,
  Calendar as CalendarIcon,
  Radio
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
    <div className="w-full flex flex-col gap-6 font-sans student-calendar-view">
      <style href="student-calendar-styles" precedence="high">{`
        /* Scoped Light Theme for Calendar */
        html.light .student-calendar-view {
          color: #050505;
        }
        html.light .student-calendar-view .calendar-controls-box {
          background: #FFFFFF !important;
          border-color: #000000 !important;
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-controls-box span {
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-controls-box button {
          color: #555566 !important;
        }
        html.light .student-calendar-view .calendar-controls-box button:hover {
          color: #000000 !important;
          background: #F5F5F2 !important;
        }
        html.light .student-calendar-view .calendar-today-btn {
          background: #FFFFFF !important;
          border-color: #000000 !important;
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-today-btn:hover {
          background: #F5F5F2 !important;
          color: #000000 !important;
        }
        html.light .student-calendar-view select {
          background: #FFFFFF !important;
          border-color: #000000 !important;
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-legend-bar {
          background: #F5F5F2 !important;
          border-color: rgba(0, 0, 0, 0.15) !important;
          color: #555566 !important;
        }
        html.light .student-calendar-view .calendar-legend-bar span {
          color: #050505;
        }
        html.light .student-calendar-view .calendar-grid-border {
          border-color: #000000 !important;
          background: #E5E5E0 !important;
          box-shadow: 8px 8px 0px #000000 !important;
        }
        html.light .student-calendar-view .calendar-day-header {
          background: #F5F5F2 !important;
          border-bottom-color: #000000 !important;
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-day-cell {
          background: #FFFFFF !important;
        }
        html.light .student-calendar-view .calendar-day-cell.inactive-month {
          background: #F8F8F6 !important;
        }
        html.light .student-calendar-view .calendar-day-cell:hover {
          background: #F0F4FF !important;
        }
        html.light .student-calendar-view .calendar-day-num {
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-drawer {
          background: #FFFFFF !important;
          border-color: #000000 !important;
          box-shadow: 12px 12px 0px #000000 !important;
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-drawer-header {
          background: #F5F5F2 !important;
          border-bottom-color: #000000 !important;
        }
        html.light .student-calendar-view .calendar-drawer-header * {
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-drawer-item {
          background: #F9F9F8 !important;
          border-color: #000000 !important;
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-drawer-item h4 {
          color: #050505 !important;
        }
        html.light .student-calendar-view .calendar-drawer-item p {
          color: #555566 !important;
        }
      `}</style>
      {/* TOOLBAR & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-white/15 pb-6">
        
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border-2 border-white/20 bg-[#090a0f] shadow-[3px_3px_0px_#000] calendar-controls-box">
            <button 
              onClick={handlePrevMonth}
              className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-5 py-2 text-center min-w-[180px] border-x-2 border-white/20">
              <span 
                style={{ fontFamily: "'Syne', 'Outfit', sans-serif" }} 
                className="text-base uppercase tracking-wider font-extrabold text-[#F5F5F2]"
              >
                {currentMonth.format('MMMM YYYY')}
              </span>
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white hover:bg-white/10 font-mono uppercase text-xs tracking-wider transition-all shadow-[2px_2px_0px_#000] calendar-today-btn"
          >
            Today
          </button>
        </div>

        {/* Status / Scope / Timeline Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Scope Toggle */}
          <div className="inline-flex border-2 border-white/20 bg-[#090a0f] p-1 shadow-[3px_3px_0px_#000] calendar-controls-box">
            <button
              onClick={() => setScopeFilter('ALL')}
              className={clsx(
                "px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all",
                scopeFilter === 'ALL' 
                  ? "bg-[#0057FF] text-white font-bold shadow-[2px_2px_0px_#000] active-btn" 
                  : "text-[#a0a4b8] hover:text-white"
              )}
            >
              All Events ({unifiedEvents.length})
            </button>
            <button
              onClick={() => setScopeFilter('MY_REGISTRATIONS')}
              className={clsx(
                "px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5",
                scopeFilter === 'MY_REGISTRATIONS' 
                  ? "bg-[#C8FF00] text-black font-black shadow-[2px_2px_0px_#000] active-btn" 
                  : "text-[#a0a4b8] hover:text-white"
              )}
            >
              <Sparkles className="w-3 h-3" /> My Registrations ({myRegisteredCount})
            </button>
          </div>

          {/* Timeline Filter */}
          <div className="inline-flex border-2 border-white/20 bg-[#090a0f] p-1 shadow-[3px_3px_0px_#000] calendar-controls-box">
            <button
              onClick={() => setTimelineFilter('ALL')}
              className={clsx(
                "px-2.5 py-1.5 font-mono text-[11px] uppercase transition-all",
                timelineFilter === 'ALL' ? "bg-white text-black font-extrabold shadow-[2px_2px_0px_#000] active-btn" : "text-[#a0a4b8] hover:text-white"
              )}
            >
              All
            </button>
            <button
              onClick={() => setTimelineFilter('UPCOMING')}
              className={clsx(
                "px-2.5 py-1.5 font-mono text-[11px] uppercase transition-all",
                timelineFilter === 'UPCOMING' ? "bg-white text-black font-extrabold shadow-[2px_2px_0px_#000]" : "text-[#a0a4b8] hover:text-white"
              )}
            >
              Upcoming
            </button>
            <button
              onClick={() => setTimelineFilter('PAST')}
              className={clsx(
                "px-2.5 py-1.5 font-mono text-[11px] uppercase transition-all",
                timelineFilter === 'PAST' ? "bg-white text-black font-extrabold shadow-[2px_2px_0px_#000]" : "text-[#a0a4b8] hover:text-white"
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
              className="border-2 border-white/20 bg-[#090a0f] text-[#F5F5F2] px-3 py-2 font-mono text-[11px] uppercase tracking-wider focus:outline-none focus:border-[#0057FF] shadow-[3px_3px_0px_#000]"
            >
              <option value="ALL">All Event Types</option>
              {eventTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>

      </div>

      {/* LEGEND BAR */}
      <div className="flex flex-wrap items-center gap-5 text-[11px] font-mono uppercase tracking-widest text-[#a0a4b8] bg-[#0c0e14] border border-white/10 p-3 calendar-legend-bar">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-[#C8FF00] border border-black inline-block"></span>
          <span className="text-white/90">Registered by You</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-[#FF9500] bg-[#FF9500]/20 inline-block"></span>
          <span>Waitlisted</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-[#0057FF] inline-block"></span>
          <span>Open Campus Event</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-white/20 inline-block"></span>
          <span>Past Event</span>
        </span>
        <span className="flex items-center gap-2 ml-auto text-[#0057FF] font-bold">
          Click any date or event to open Day Agenda
        </span>
      </div>

      {/* LOADING STATE */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-px bg-white/10 border-2 border-white/20 animate-pulse">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[110px] bg-[#090a0f] p-2">
              <div className="w-6 h-4 bg-white/10 mb-2"></div>
              <div className="w-full h-4 bg-white/10"></div>
            </div>
          ))}
        </div>
      ) : (
        /* CALENDAR GRID */
        <div className="w-full border-2 border-white/20 bg-white/10 shadow-[8px_8px_0px_#000] calendar-grid-border">
          
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 bg-[#0c0e14] text-center border-b-2 border-white/20 calendar-day-header">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((dayName, idx) => (
              <div 
                key={dayName} 
                className={clsx(
                  "py-3 font-mono text-xs font-bold tracking-widest uppercase",
                  idx >= 5 ? "text-[#0057FF]" : "text-[#a0a4b8]"
                )}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Day Cells (7-column grid) */}
          <div className="grid grid-cols-7 gap-px bg-white/10">
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
                    "min-h-[110px] md:min-h-[135px] p-2 flex flex-col justify-between transition-all select-none relative group calendar-day-cell",
                    isCurrentMonth ? "bg-[#090a0f]" : "bg-[#050608] opacity-35 inactive-month",
                    dayEvents.length > 0 ? "cursor-pointer hover:bg-[#12141d]" : "cursor-default",
                    isSelected && "ring-2 ring-[#0057FF] z-10 bg-[#12141d]",
                    hasRegisteredEvent && isCurrentMonth 
                      ? "border-l-4 border-l-[#C8FF00]" 
                      : hasWaitlistedEvent && isCurrentMonth 
                        ? "border-l-4 border-l-[#FF9500]" 
                        : undefined
                  )}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between">
                    <span 
                      className={clsx(
                        "font-mono text-[12px] font-bold inline-flex items-center justify-center w-6 h-6",
                        isToday 
                          ? "bg-[#0057FF] text-white font-black shadow-[2px_2px_0px_#000]" 
                          : isCurrentMonth 
                            ? "text-[#F5F5F2] calendar-day-num" 
                            : "text-[#a0a4b8]"
                      )}
                    >
                      {date.date()}
                    </span>

                    {/* Quick Count Badge if multiple */}
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-mono text-[#a0a4b8] group-hover:text-white transition-colors">
                        {dayEvents.length} {dayEvents.length === 1 ? 'evt' : 'evts'}
                      </span>
                    )}
                  </div>

                  {/* Day Event Preview Pills */}
                  <div className="flex flex-col gap-1.5 my-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map(ev => {
                      if (ev.isRegistered) {
                        return (
                          <div 
                            key={ev.id}
                            title={`${ev.title} (Registered)`}
                            className="bg-[#C8FF00] text-black text-[10px] font-mono px-2 py-0.5 truncate uppercase font-extrabold tracking-tight border border-black shadow-[1px_1px_0px_#000]"
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
                            className="border border-[#FF9500] bg-[#FF9500]/20 text-[#FF9500] text-[10px] font-mono px-1.5 py-0.5 truncate uppercase font-bold"
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
                            className="bg-white/5 border border-white/10 text-[#a0a4b8]/70 text-[10px] font-mono px-1.5 py-0.5 truncate uppercase"
                          >
                            • {ev.title}
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={ev.id}
                          title={`${ev.title} (Open)`}
                          className="bg-[#0057FF]/15 border border-[#0057FF]/50 text-[#93c5fd] text-[10px] font-mono px-1.5 py-0.5 truncate uppercase font-semibold hover:border-[#0057FF]"
                        >
                          {ev.title}
                        </div>
                      );
                    })}

                    {dayEvents.length > 2 && (
                      <span className="text-[9px] font-mono text-[#0057FF] font-bold tracking-widest pl-0.5">
                        +{dayEvents.length - 2} MORE
                      </span>
                    )}
                  </div>

                  {/* Bottom Indicator for Live status */}
                  <div className="h-1 flex gap-1">
                    {dayEvents.some(e => e.isLiveNow) && (
                      <span className="h-1 w-full bg-[#FF3B30] animate-pulse" title="Live Event Today"></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          EDITORIAL BRUTALIST DAY AGENDA MODAL
          ───────────────────────────────────────────────────────────── */}
      {selectedDate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setSelectedDate(null)}
        >
          <div 
            className="bg-[#090a0f] border-2 sm:border-3 border-[#F5F5F2] w-full max-w-2xl max-h-[88vh] flex flex-col shadow-[12px_12px_0px_#0057FF] relative overflow-hidden animate-in zoom-in-95 duration-150 calendar-drawer"
            onClick={e => e.stopPropagation()}
          >
            {/* Top decorative gradient stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#0057FF] via-[#C8FF00] to-[#0057FF] shrink-0" />

            {/* Modal Header */}
            <div className="p-6 border-b-2 border-white/15 bg-[#0e1017] shrink-0 calendar-drawer-header">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#0057FF] inline-block animate-pulse"></span>
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[2px] text-[#0057FF]">
                      CAMPUS SCHEDULE // DAY AGENDA
                    </span>
                  </div>
                  <h3 
                    style={{ fontFamily: "'Syne', 'Outfit', sans-serif" }} 
                    className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#F5F5F2] leading-none mt-1"
                  >
                    {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2.5 mt-2 font-mono text-[11px] text-[#a0a4b8]">
                    <span>
                      {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'EVENT' : 'EVENTS'} SCHEDULED
                    </span>
                    {selectedDayEvents.some(e => e.isRegistered) && (
                      <>
                        <span className="text-white/30">•</span>
                        <span className="text-[#C8FF00] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {selectedDayEvents.filter(e => e.isRegistered).length} REGISTERED BY YOU
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <button 
                  onClick={() => setSelectedDate(null)}
                  className="border-2 border-white/20 bg-white/5 hover:bg-[#FF3B30] hover:text-white hover:border-[#FF3B30] text-[#a0a4b8] p-2 transition-colors shadow-[2px_2px_0px_#000] shrink-0"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Event List */}
            <div className="p-6 overflow-y-auto flex flex-col gap-4 bg-[#07080b]">
              {selectedDayEvents.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/15 p-8 bg-[#090a0f]">
                  <CalendarIcon className="w-10 h-10 text-white/30" />
                  <div className="font-mono text-sm uppercase text-white/80 tracking-wider font-bold">
                    No Events Scheduled
                  </div>
                  <p className="text-xs text-[#a0a4b8] font-mono max-w-sm">
                    There are no campus sessions or registered activities scheduled for this date.
                  </p>
                </div>
              ) : (
                selectedDayEvents.map(ev => {
                  const startTimeStr = dayjs(ev.startTime).format('h:mm A');
                  const endTimeStr = dayjs(ev.endTime).format('h:mm A');

                  return (
                    <div 
                      key={ev.id} 
                      className={clsx(
                        "bg-[#0e1017] border-2 transition-all p-5 flex flex-col gap-3.5 relative shadow-[4px_4px_0px_#000] calendar-drawer-item",
                        ev.isRegistered 
                          ? "border-[#C8FF00]/40 hover:border-[#C8FF00]" 
                          : "border-white/15 hover:border-[#0057FF]"
                      )}
                    >
                      {/* Top Badges Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-[#0057FF]/15 text-[#60a5fa] border border-[#0057FF]/40 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                            {ev.eventType}
                          </span>
                          {ev.primaryClubName && (
                            <span className="font-mono text-[11px] text-[#a0a4b8] uppercase tracking-wider">
                              BY <strong className="text-white font-semibold">{ev.primaryClubName}</strong>
                            </span>
                          )}
                        </div>

                        {/* Registration Status Pill */}
                        <div>
                          {ev.isRegistered ? (
                            <span className="bg-[#C8FF00] text-black font-mono font-black uppercase text-[10px] tracking-wider px-2.5 py-1 flex items-center gap-1.5 shadow-[2px_2px_0px_#000]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> REGISTERED
                            </span>
                          ) : ev.isWaitlisted ? (
                            <span className="border-2 border-[#FF9500] bg-[#FF9500]/20 text-[#FF9500] font-mono font-bold uppercase text-[10px] tracking-wider px-2.5 py-1 flex items-center gap-1.5">
                              <Clock3 className="w-3.5 h-3.5" /> WAITLISTED
                            </span>
                          ) : ev.isPast ? (
                            <span className="bg-white/10 text-white/40 font-mono font-bold uppercase text-[10px] tracking-wider px-2.5 py-1">
                              PAST EVENT
                            </span>
                          ) : (
                            <span className="bg-[#0057FF] text-white font-mono font-bold uppercase text-[10px] tracking-wider px-2.5 py-1 shadow-[2px_2px_0px_#000]">
                              OPEN TO REGISTER
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Event Title */}
                      <Link 
                        href={`/student/events/${ev.id}`}
                        style={{ fontFamily: "'Syne', 'Outfit', sans-serif" }}
                        className="text-xl sm:text-2xl font-black text-[#F5F5F2] hover:text-[#0057FF] transition-colors leading-tight"
                      >
                        {ev.title}
                      </Link>

                      {/* Time, Venue & Live Indicator */}
                      <div className="font-mono text-xs text-[#a0a4b8] tracking-wider flex flex-wrap items-center gap-3.5">
                        <span className="flex items-center gap-1.5 text-white/90">
                          <Clock className="w-3.5 h-3.5 text-[#0057FF]" /> {startTimeStr} – {endTimeStr}
                        </span>
                        {ev.locationName && (
                          <>
                            <span className="text-white/20">|</span>
                            <span className="flex items-center gap-1.5 text-white/90">
                              <MapPin className="w-3.5 h-3.5 text-[#0057FF]" /> {ev.locationName}
                            </span>
                          </>
                        )}
                        {ev.isLiveNow && (
                          <>
                            <span className="text-white/20">|</span>
                            <span className="flex items-center gap-1 text-[#FF3B30] font-bold animate-pulse">
                              <Radio className="w-3.5 h-3.5" /> LIVE NOW
                            </span>
                          </>
                        )}
                      </div>

                      {/* Action CTA */}
                      <div className="pt-2 flex justify-end border-t border-white/10 mt-1">
                        <Link
                          href={`/student/events/${ev.id}`}
                          className={clsx(
                            "inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-widest px-5 py-2.5 transition-all",
                            ev.isRegistered 
                              ? "bg-[#C8FF00] text-black font-black hover:bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]" 
                              : "bg-[#0057FF] text-white font-bold hover:bg-[#0042c7] border-2 border-[#0057FF] shadow-[4px_4px_0px_rgba(0,0,0,0.8)] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                          )}
                        >
                          {ev.isRegistered ? "View Event Pass" : "Event Details"} <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-white/15 bg-[#0e1017] flex items-center justify-between shrink-0">
              <span className="font-mono text-[10px] text-[#a0a4b8]/70 uppercase tracking-widest">
                Press <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 text-white">ESC</kbd> or click outside to dismiss
              </span>
              <button
                onClick={() => setSelectedDate(null)}
                className="border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white px-5 py-2 font-mono uppercase text-xs tracking-wider transition-all bg-transparent hover:bg-white/5 shadow-[2px_2px_0px_#000]"
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
