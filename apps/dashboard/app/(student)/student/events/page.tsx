'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useMyRegistrations, MyRegistration } from '../../../../hooks/useMyRegistrations';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { MapPin, CalendarIcon, ArrowRight, List } from 'lucide-react';
import { StudentCalendarView } from './components/StudentCalendarView';

export default function StudentEventsPage() {
  const [viewMode, setViewModeState] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    const saved = sessionStorage.getItem('student-events-viewmode');
    if (saved === 'calendar' || saved === 'list') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewModeState(saved as 'list' | 'calendar');
    }
  }, []);

  const setViewMode = (mode: 'list' | 'calendar') => {
    sessionStorage.setItem('student-events-viewmode', mode);
    setViewModeState(mode);
  };

  const { data: registrations, isLoading, isError, refetch } = useMyRegistrations();
  
  if (isLoading) {
    return (
      <main className="flex-grow w-full px-stitch-margin-mobile md:px-stitch-margin-desktop pt-stitch-xl pb-stitch-xxl bg-stitch-background min-h-screen">
        <h1 className="stitch-text-display-lg text-stitch-on-background mb-stitch-xl tracking-tight">MY EVENTS</h1>
        <div className="animate-pulse space-y-4 max-w-4xl">
          <div className="h-24 bg-stitch-surface-variant w-full border-b border-stitch-outline-variant"></div>
          <div className="h-24 bg-stitch-surface-variant w-full border-b border-stitch-outline-variant"></div>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="flex-grow w-full px-stitch-margin-mobile md:px-stitch-margin-desktop pt-stitch-xl pb-stitch-xxl bg-stitch-background min-h-screen">
        <h1 className="stitch-text-display-lg text-stitch-on-background mb-stitch-xl tracking-tight">MY EVENTS</h1>
        <div className="max-w-4xl">
          <ErrorState 
            title="Could not load your events"
            message="We encountered a problem retrieving your registrations."
            action={<button className="border border-stitch-outline text-stitch-on-background stitch-text-label-mono uppercase px-stitch-lg py-stitch-md hover:bg-stitch-surface transition-colors" onClick={() => refetch()}>Retry</button>}
          />
        </div>
      </main>
    );
  }

  const now = dayjs();
  
  const upcoming: MyRegistration[] = [];
  const pastAndCancelled: MyRegistration[] = [];

  (registrations || []).forEach(reg => {
    const isCancelled = reg.registrationStatus === 'CANCELLED';
    const isPast = dayjs(reg.event?.endTime).isBefore(now) || dayjs(reg.event?.endTime).isSame(now); // event.endTime <= now

    if (isCancelled || isPast) {
      pastAndCancelled.push(reg);
    } else {
      upcoming.push(reg);
    }
  });

  // Sort upcoming chronologically ascending
  upcoming.sort((a, b) => dayjs(a.event?.startTime).valueOf() - dayjs(b.event?.startTime).valueOf());
  
  // Sort past chronologically descending (most recent first)
  pastAndCancelled.sort((a, b) => dayjs(b.event?.startTime).valueOf() - dayjs(a.event?.startTime).valueOf());

  const renderRow = (reg: MyRegistration, isPast: boolean) => {
    const date = dayjs(reg.event?.startTime);
    const dateLabel = date.format('MMM D');
    const timeLabel = date.format('h:mm A');
    const locationLabel = reg.event?.locationName;
    
    // Status text color based on status
    const statusColor = reg.registrationStatus === 'WAITLISTED' 
      ? 'text-stitch-on-surface' 
      : reg.registrationStatus === 'CANCELLED'
        ? 'text-stitch-secondary'
        : 'text-stitch-on-surface';

    const bannerUrl = (reg.event?.metadata as Record<string, unknown> | null | undefined)?.banner_url as string | undefined;

    return (
      <div key={reg.id} className={clsx(
        "border-b border-stitch-outline-variant py-5 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:bg-stitch-surface transition-colors group",
        isPast && "opacity-70 hover:opacity-100"
      )}>
        <div className="flex gap-4 flex-grow">
          {bannerUrl && (
            <div className="hidden sm:block w-32 h-24 shrink-0 bg-stitch-surface-container-highest overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerUrl} alt={reg.event?.title || ''} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-grow pr-4">
            <Link href={`/student/events/${reg.eventId}`} className="block">
              <h3 className="stitch-text-headline-lg text-stitch-on-background group-hover:text-stitch-primary transition-colors leading-tight mb-stitch-xs">
                {reg.event?.title || 'Unknown Event'}
              </h3>
            <div className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest flex items-center flex-wrap gap-2 mt-2">
              <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{dateLabel}</span>
              <span className="text-stitch-outline-variant">|</span>
              <span>{timeLabel}</span>
              {locationLabel && (
                <>
                  <span className="text-stitch-outline-variant">|</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{locationLabel}</span>
                </>
              )}
            </div>
          </Link>
        </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-3 shrink-0 mt-4 md:mt-0">
          <div className="flex flex-col gap-2 items-start md:items-end w-full">
            <span className={clsx("bg-stitch-surface-variant stitch-text-label-mono uppercase px-stitch-sm py-stitch-unit rounded-none inline-block", statusColor)}>
              {reg.registrationStatus}
            </span>
            {reg.team && (
              <div className="stitch-text-label-mono text-stitch-secondary uppercase flex items-center gap-2">
                <span>Team &middot; {reg.team.name}</span>
                <span className="bg-stitch-surface-variant px-2 py-0.5 rounded-none">{reg.team.status}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4 pt-1">
            <Link 
              href={`/student/events/${reg.eventId}`}
              className="text-[10px] font-mono text-stitch-primary uppercase hover:underline flex items-center gap-1 font-bold tracking-widest"
            >
              Event Details <ArrowRight className="w-3 h-3" />
            </Link>
            {reg.team && (
              <Link 
                href={`/student/events/${reg.eventId}/team`}
                className="text-[10px] font-mono text-stitch-secondary uppercase hover:text-stitch-on-surface hover:underline flex items-center gap-1 tracking-widest transition-colors"
              >
                Team Hub <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="flex-grow w-full px-stitch-margin-mobile md:px-stitch-margin-desktop pt-12 pb-16 bg-stitch-background min-h-screen">
      <div className="w-full transition-all">
        
        {/* HEADER & VIEW TOGGLE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-stitch-xl border-b border-stitch-outline-variant pb-6">
          <div>
            <h1 className="stitch-text-display-lg text-stitch-on-background tracking-tight uppercase">MY EVENTS</h1>
            <p className="text-stitch-secondary stitch-text-body-sm mt-1">
              Your registered commitments and interactive campus schedule.
            </p>
          </div>

          {/* View Toggle */}
          <div className="inline-flex border border-stitch-outline-variant bg-stitch-surface-container-lowest p-1 self-start sm:self-center">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 stitch-text-label-mono text-xs uppercase tracking-wider transition-colors",
                viewMode === 'list'
                  ? "bg-stitch-surface-variant text-stitch-on-background font-bold"
                  : "text-stitch-secondary hover:text-stitch-on-background"
              )}
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 stitch-text-label-mono text-xs uppercase tracking-wider transition-colors",
                viewMode === 'calendar'
                  ? "bg-stitch-primary text-stitch-on-primary font-bold"
                  : "text-stitch-secondary hover:text-stitch-on-background"
              )}
            >
              <CalendarIcon className="w-4 h-4" /> Calendar
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <StudentCalendarView />
        ) : (
          <>
            {/* UPCOMING */}
            <section className="mb-16">
              <h2 className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest mb-stitch-md border-b border-stitch-outline-variant pb-2 inline-block w-full">
                Upcoming
              </h2>
              {upcoming.length > 0 ? (
                <div className="flex flex-col">
                  {upcoming.map(reg => renderRow(reg, false))}
                </div>
              ) : (
                <div className="py-stitch-xl text-left">
                  <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-xs">No upcoming events</h3>
                  <p className="text-stitch-secondary stitch-text-body-lg mb-stitch-md">You don&apos;t have any upcoming event registrations.</p>
                  <Link 
                    href="/student/campus"
                    className="inline-flex items-center gap-2 bg-stitch-primary text-stitch-on-primary stitch-text-label-mono uppercase tracking-widest px-stitch-xl py-stitch-md hover:bg-stitch-surface-tint transition-colors"
                  >
                    Explore Events <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </section>

            {/* PAST & CANCELLED */}
            {(pastAndCancelled.length > 0 || (upcoming.length === 0 && registrations && registrations.length === 0)) && (
              <section className="mb-16">
                <h2 className="stitch-text-label-mono text-stitch-secondary uppercase tracking-widest mb-stitch-md border-b border-stitch-outline-variant pb-2 mt-stitch-xl inline-block w-full">
                  Past &amp; Cancelled
                </h2>
                {pastAndCancelled.length > 0 ? (
                  <div className="flex flex-col">
                    {pastAndCancelled.map(reg => renderRow(reg, true))}
                  </div>
                ) : (
                  <div className="py-stitch-xl text-left">
                    <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-xs">No historical events</h3>
                    <p className="text-stitch-secondary stitch-text-body-lg">You haven&apos;t attended or cancelled any events yet.</p>
                  </div>
                )}
              </section>
            )}
          </>
        )}

      </div>
    </main>
  );
}
