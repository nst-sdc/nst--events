'use client';
/* eslint-disable react/no-unescaped-entities */

import React from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useMyRegistrations } from '../../../../hooks/useMyRegistrations';
import { useDashboardSummary } from '../../../../hooks/useDashboardSummary';
import { useEvents } from '../../../../hooks/useEvents';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { ErrorState } from '../../../../components/ui/ErrorState';

dayjs.extend(isBetween);
dayjs.extend(relativeTime);

const homeStyles = `
  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --electric-blue-dark: #0042c7;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --font-display: var(--font-syne), 'Syne', sans-serif;
    --font-body: var(--font-inter), 'Inter', sans-serif;
    --font-mono: var(--font-jetbrains-mono), 'JetBrains Mono', monospace;
  }

  .home-editorial-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: clip;
  }

  /* Texture & Noise Background Overlays - Absolute positioned to avoid fixed composite repaint on scroll */
  .collage-noise-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.25;
    background-image: radial-gradient(rgba(245, 245, 242, 0.08) 1px, transparent 1px);
    background-size: 24px 24px;
    contain: strict;
  }

  /* Monospace & Micro Annotations */
  .micro-annotation {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }

  .annotation-blue { color: var(--electric-blue); }
  .annotation-green { color: var(--acid-green); }

  /* Typography Scale */
  .font-display-hero {
    font-family: var(--font-display);
    font-size: clamp(34px, 5.8vw, 92px);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -1.5px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
  }

  .font-display-section {
    font-family: var(--font-display);
    font-size: clamp(36px, 6vw, 76px);
    font-weight: 900;
    line-height: 0.92;
    letter-spacing: -1.5px;
    text-transform: uppercase;
  }

  /* ==========================================================================
     1. HERO COLLAGE COMPOSITION
     ========================================================================== */
  .hero-collage-wrapper {
    position: relative;
    padding: 70px 32px 90px 32px;
    max-width: 1320px;
    margin: 0 auto;
    min-height: 75vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    z-index: 1;
  }

  .hero-bg-text-watermark {
    position: absolute;
    bottom: 24px;
    right: -10px;
    font-family: var(--font-display);
    font-size: clamp(60px, 11vw, 160px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.025);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    z-index: 0;
    line-height: 0.8;
    transform: translateZ(0);
    contain: paint;
  }

  .hero-main-composition {
    position: relative;
    z-index: 2;
  }

  .blue-paper-strip {
    background: var(--electric-blue);
    color: #ffffff;
    padding: 8px 20px;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    display: inline-block;
    transform: rotate(-1.5deg);
    box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.5);
    margin-bottom: 24px;
  }

  .hero-headline-group {
    position: relative;
    z-index: 10;
    margin-bottom: 20px;
    max-width: 100%;
  }

  .hero-headline-group .name-highlight {
    color: var(--electric-blue);
    background: var(--bg-paper-white);
    padding: 4px clamp(8px, 1.5vw, 16px);
    display: inline-block;
    max-width: 100%;
    box-sizing: border-box;
    transform: rotate(0.8deg);
    transform-origin: left center;
    box-shadow: 6px 6px 0px var(--electric-blue);
    position: relative;
    z-index: 12;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .hero-headline-group .name-highlight.name-long {
    font-size: 0.85em;
  }

  .hero-headline-group .name-highlight.name-very-long {
    font-size: 0.72em;
  }

  /* ==========================================================================
     2. TORN PAPER MASK SECTION DIVIDERS
     ========================================================================== */
  .torn-section-divider {
    width: 100%;
    height: 48px;
    background-color: var(--electric-blue);
    clip-path: polygon(0% 0%, 15% 65%, 30% 20%, 45% 80%, 60% 30%, 75% 70%, 90% 15%, 100% 60%, 100% 100%, 0% 100%);
    margin: -1px 0;
    position: relative;
    z-index: 2;
    transform: translateZ(0);
    contain: paint;
    backface-visibility: hidden;
  }

  .torn-section-divider-black {
    width: 100%;
    height: 48px;
    background-color: var(--bg-black);
    clip-path: polygon(0% 40%, 12% 85%, 28% 25%, 42% 75%, 58% 15%, 72% 80%, 88% 30%, 100% 70%, 100% 100%, 0% 100%);
    margin: -1px 0;
    position: relative;
    z-index: 2;
    transform: translateZ(0);
    contain: paint;
    backface-visibility: hidden;
  }

  /* ==========================================================================
     3. POSTER WALL (UPCOMING EVENTS CARDS)
     ========================================================================== */
  .poster-wall-section {
    background: var(--electric-blue);
    color: #000000;
    padding: 80px 32px 100px 32px;
    position: relative;
    z-index: 1;
    width: 100%;
  }

  .poster-wall-container {
    max-width: 1320px;
    margin: 0 auto;
  }

  .poster-wall-header-row {
    border-bottom: 3px solid #000;
    padding-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
  }

  .poster-wall-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 40px;
    margin-top: 48px;
  }

  .poster-card-item {
    background: var(--bg-paper-white);
    color: #000000;
    border: 3px solid #000000;
    padding: 20px;
    box-shadow: 10px 10px 0px #000000;
    display: flex;
    flex-direction: column;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    position: relative;
    transform: translateZ(0);
    backface-visibility: hidden;
    contain: content;
    content-visibility: auto;
    contain-intrinsic-size: 380px 480px;
  }

  .poster-card-item:hover {
    transform: translate3d(-4px, -4px, 0) rotate(-1deg);
    box-shadow: 14px 14px 0px #000000;
  }

  .poster-card-item:nth-child(even) {
    transform: rotate(1.5deg) translateZ(0);
  }

  .poster-card-item:nth-child(even):hover {
    transform: translate3d(-4px, -4px, 0) rotate(0.5deg);
  }

  .poster-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  .poster-date-badge {
    background: #000;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
  }

  .poster-title-text {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 900;
    line-height: 1.05;
    text-transform: uppercase;
    margin-bottom: 12px;
    color: #000;
  }

  .poster-photo-frame {
    width: 100%;
    height: 180px;
    background: #111;
    border: 2px solid #000;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
    transform: translateZ(0);
    contain: paint;
  }

  .poster-photo-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(125%) grayscale(80%);
    transform: translateZ(0);
    backface-visibility: hidden;
    will-change: transform, filter;
    transition: filter 0.3s ease;
  }

  .poster-card-item:hover .poster-photo-frame img {
    filter: contrast(100%) grayscale(0%);
  }

  .poster-desc-text {
    font-family: var(--font-body);
    font-size: 13.5px;
    color: #222;
    line-height: 1.5;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .poster-meta-footer {
    margin-top: auto;
    padding-top: 12px;
    border-top: 2px dashed #000;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
  }

  .poster-register-btn {
    background: var(--electric-blue);
    color: #ffffff;
    border: 2px solid #000;
    padding: 8px 16px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 2px 2px 0px #000;
    transition: transform 0.1s, box-shadow 0.1s;
  }

  .poster-register-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px #000;
  }

  /* ==========================================================================
     4. EDITORIAL SCHEDULE / EMPTY SECTION
     ========================================================================== */
  .empty-poster-container {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 60px 40px;
    position: relative;
    overflow: hidden;
    box-shadow: 12px 12px 0px var(--electric-blue);
  }

  .empty-poster-watermark {
    position: absolute;
    bottom: -20px;
    right: -20px;
    font-family: var(--font-display);
    font-size: clamp(90px, 15vw, 150px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.04);
    pointer-events: none;
    line-height: 0.8;
    transform: translateZ(0);
    contain: paint;
  }

  .empty-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: var(--electric-blue);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 16px 32px;
    border: 2px solid var(--bg-paper-white);
    cursor: pointer;
    text-decoration: none;
    box-shadow: 4px 4px 0px #ffffff;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .empty-cta-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }

  .poster-photo-placeholder {
    width: 100%;
    height: 180px;
    background: linear-gradient(135deg, #111 0%, #1a1a2e 50%, #0d0e12 100%);
    border: 2px solid #000;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    transform: translateZ(0);
    contain: paint;
  }

  .poster-photo-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(0, 87, 255, 0.15) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  .poster-photo-placeholder-text {
    font-family: var(--font-display);
    font-size: 42px;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.08);
    text-transform: uppercase;
    letter-spacing: -2px;
    z-index: 1;
    user-select: none;
  }

  .poster-wall-empty-box,
  .poster-wall-error-box {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 3px solid #000000;
    padding: 40px 32px;
    box-shadow: 10px 10px 0px #000000;
    margin-top: 16px;
    max-width: 680px;
  }

  /* Responsive Scaling */
  @media (max-width: 900px) {
    .font-display-hero {
      font-size: clamp(30px, 7vw, 54px);
      line-height: 1;
      letter-spacing: -1px;
    }
    .hero-headline-group .name-highlight {
      box-shadow: 4px 4px 0px var(--electric-blue);
    }
    .poster-wall-grid { grid-template-columns: 1fr; }
    .hero-collage-wrapper { padding: 40px 16px 60px 16px; }
    .poster-wall-section { padding: 60px 16px 80px 16px; }
  }

  /* ==========================================================================
     LIGHT THEME OVERRIDES (Scoped to html.light)
     ========================================================================== */
  html.light .home-editorial-page {
    background-color: #FFFFFF;
    color: #050505;
  }

  html.light .collage-noise-overlay {
    opacity: 0.12;
    background-image: radial-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px);
  }

  html.light .hero-bg-text-watermark {
    color: rgba(0, 0, 0, 0.025);
  }

  html.light .blue-paper-strip {
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .font-display-hero {
    color: #050505;
  }

  html.light .hero-headline-group .name-highlight {
    background: #000000;
    color: var(--electric-blue);
    box-shadow: 6px 6px 0px var(--electric-blue);
  }

  @media (max-width: 900px) {
    html.light .hero-headline-group .name-highlight {
      box-shadow: 4px 4px 0px var(--electric-blue);
    }
  }

  html.light .hero-description-text {
    color: #555566 !important;
  }

  html.light .empty-poster-container {
    background: #FFFFFF;
    border: 3px solid #000000;
    box-shadow: 12px 12px 0px var(--electric-blue);
  }

  html.light .empty-poster-watermark {
    color: rgba(0, 0, 0, 0.04);
  }

  html.light .empty-poster-container h2 {
    color: #050505 !important;
  }

  html.light .empty-poster-container p {
    color: #555566 !important;
  }

  html.light .empty-poster-container p strong {
    color: #050505 !important;
  }

  html.light .empty-cta-btn {
    border: 2px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .empty-cta-btn:hover {
    box-shadow: 6px 6px 0px #000000;
  }

  html.light .empty-cta-btn-secondary {
    color: #050505 !important;
    border: 2px solid #000000 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  html.light .torn-section-divider-black {
    background-color: #FFFFFF;
  }

  html.light .home-loading-screen {
    background-color: #FFFFFF !important;
  }
`;

export default function StudentHomePage() {
  const router = useRouter();
  const { data: user, isLoading: isUserLoading, isError: isUserError, refetch: refetchUser } = useCurrentUser();
  const { data: registrations, isLoading: isRegLoading, isError: isRegError, refetch: refetchReg } = useMyRegistrations();
  const { data: summary, isLoading: isSummaryLoading, isError: isSummaryError, refetch: refetchSummary } = useDashboardSummary();
  const {
    data: eventsResponse,
    isLoading: isEventsLoading,
    isError: isEventsError,
    refetch: refetchEvents
  } = useEvents({ limit: 6 });

  if (isUserLoading || isRegLoading || isSummaryLoading) {
    return (
      <div className="p-8 max-w-[1320px] mx-auto w-full flex flex-col gap-10 min-h-screen bg-[#050505] home-loading-screen">
        <Skeleton className="h-24 w-72 bg-neutral-900 rounded-none" />
        <Skeleton className="h-96 w-full bg-neutral-900 rounded-none" />
      </div>
    );
  }

  if (isUserError || isRegError || isSummaryError) {
    return (
      <div className="p-8 max-w-[1320px] mx-auto w-full min-h-screen bg-[#050505] home-loading-screen">
        <ErrorState 
          title="Could not load your home page"
          message="We could not retrieve your latest schedule and statistics."
          action={
            <button 
              className="border-2 border-white text-white font-mono uppercase px-6 py-3 bg-[#0057FF] hover:bg-[#0042c7] transition-colors"
              onClick={() => { refetchUser(); refetchReg(); refetchSummary(); }}
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  const hour = dayjs().hour();
  const greetingTime = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING';
  const rawFirstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'SHRAVANI';
  const firstNameUpper = rawFirstName.toUpperCase();
  const isLongName = firstNameUpper.length > 8;
  const isVeryLongName = firstNameUpper.length > 12;
  const nameModifier = isVeryLongName ? ' name-very-long' : isLongName ? ' name-long' : '';

  const now = dayjs();
  
  // Priority live registrations
  const liveRegistrations = (registrations || []).filter(reg => {
    if (reg.registrationStatus !== 'REGISTERED') return false;
    if (!reg.event?.startTime || !reg.event?.endTime) return false;
    try {
      const startTime = dayjs(reg.event.startTime);
      const endTime = dayjs(reg.event.endTime);
      const windowStart = startTime.subtract(15, 'minute');
      return now.isBetween(windowStart, endTime, null, '[]');
    } catch { return false; }
  });

  const activeEventReg = liveRegistrations.length > 0 ? liveRegistrations[0] : null;

  // Future registrations
  const upcomingRegistrations = (registrations || [])
    .filter(reg => {
      if (reg.registrationStatus !== 'REGISTERED' && reg.registrationStatus !== 'WAITLISTED') return false;
      if (activeEventReg && reg.id === activeEventReg.id) return false;
      if (!reg.event?.endTime) return false;
      return dayjs(reg.event.endTime).isAfter(now);
    })
    .sort((a, b) => dayjs(a.event?.startTime).valueOf() - dayjs(b.event?.startTime).valueOf());

  const nextEventReg = upcomingRegistrations.length > 0 ? upcomingRegistrations[0] : null;

  // Build list of upcoming poster wall events: genuine backend events only
  const backendEvents = eventsResponse?.data || [];
  const posterEvents = backendEvents.slice(0, 6).map((evt) => {
    const meta = (evt.metadata as Record<string, unknown> | null | undefined) || {};
    const bannerUrl = typeof meta.banner_url === 'string' && meta.banner_url.trim() ? meta.banner_url.trim() : null;
    return {
      id: evt.id,
      dateBadge: dayjs(evt.startTime).format('DD MMM • YYYY').toUpperCase(),
      category: evt.eventType || 'CAMPUS EVENT',
      title: evt.title,
      bannerUrl,
      description: evt.description || (typeof meta.description === 'string' ? meta.description : '') || 'Join this campus event and secure your pass.',
      venue: evt.locationName || 'Main Campus',
    };
  });

  return (
    <main className="home-editorial-page">
      <style href="student-home-styles" precedence="high">
        {homeStyles}
      </style>
      
      {/* Background Noise Overlay */}
      <div className="collage-noise-overlay" />

      {/* ==========================================================================
           HERO COLLAGE SPREAD
           ========================================================================== */}
      <div className="hero-collage-wrapper">
        <div className="hero-bg-text-watermark">NST COLLAGE 01</div>

        <div className="hero-main-composition">
          
          {/* Blue Paper Strip */}
          <div className="blue-paper-strip">
            NST EVENTS // STUDENT PORTAL &bull; SYSTEM STATUS: ACTIVE
          </div>

          {/* Headline */}
          <h1 className="hero-headline-group font-display-hero">
            <span className="hero-good-word">GOOD</span><br />
            <span className="hero-greeting-word">{greetingTime},</span><br />
            <span className={`name-highlight${nameModifier}`}>{firstNameUpper}.</span>
          </h1>

          <p className="hero-description-text" style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            color: '#a0a4b8',
            lineHeight: 1.6,
            maxWidth: '520px',
            marginTop: '24px',
          }}>
            Welcome back to campus. Access your event credentials, synchronized attendance passes, and student developer ecosystem.
          </p>

        </div>
      </div>

      {/* ==========================================================================
           SCHEDULE / PRIORITY SECTION
           ========================================================================== */}
      <div style={{ maxWidth: '1320px', margin: '0 auto 80px auto', padding: '0 32px' }}>
        
        {/* If user has active or upcoming event */}
        {activeEventReg || nextEventReg ? (
          <div className="empty-poster-container">
            <div className="empty-poster-watermark">SCHEDULE</div>
            
            <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
              {activeEventReg ? 'LIVE ATTENDANCE SESSION // CHECK-IN ACTIVE' : 'NEXT UPCOMING EVENT // REGISTERED'}
            </div>

            <h2 className="font-display-section" style={{ fontSize: 'clamp(32px, 5vw, 54px)', marginBottom: '16px', color: '#fff' }}>
              {(activeEventReg || nextEventReg)?.event?.title || 'SESSION READY'}
            </h2>

            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              color: '#a0a4b8',
              marginBottom: '28px',
              maxWidth: '620px',
              lineHeight: 1.6,
            }}>
              Location: <strong>{(activeEventReg || nextEventReg)?.event?.locationName || 'Main Campus'}</strong> &bull; Starts:{' '}
              {dayjs((activeEventReg || nextEventReg)?.event?.startTime).format('MMM D, YYYY · h:mm A')}
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => router.push(`/student/events/${(activeEventReg || nextEventReg)?.eventId}`)} 
                className="empty-cta-btn"
              >
                VIEW EVENT PASS & ATTENDANCE ↗
              </button>
              <button 
                onClick={() => router.push('/student/events')} 
                className="empty-cta-btn empty-cta-btn-secondary" 
                style={{ background: 'transparent', boxShadow: 'none' }}
              >
                ALL REGISTRATIONS &rarr;
              </button>
            </div>
          </div>
        ) : (
          /* Empty State as shown in Screenshot 4 */
          <div className="empty-poster-container">
            <div className="empty-poster-watermark">SCHEDULE</div>
            <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
              SCHEDULE STATUS // 0 UPCOMING
            </div>
            <h2 className="font-display-section" style={{ fontSize: '48px', marginBottom: '16px', color: '#fff' }}>
              NOTHING<br />
              SCHEDULED.<br />
              YET.
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              color: '#a0a4b8',
              marginBottom: '32px',
              maxWidth: '520px',
              lineHeight: 1.6,
            }}>
              You don't have anything coming up yet. Explore what's happening around campus, join upcoming hackathons, and connect with technical workshops.
            </p>
            <button onClick={() => router.push('/student/campus')} className="empty-cta-btn">
              EXPLORE EVENTS ↗
            </button>
          </div>
        )}

      </div>

      {/* Hand-Ripped Torn Paper Transition Edge */}
      <div className="torn-section-divider" />

      {/* ==========================================================================
           UPCOMING EVENTS POSTER WALL
           ========================================================================== */}
      <section className="poster-wall-section">
        <div className="poster-wall-container">
          
          <div className="poster-wall-header-row">
            <div>
              <span className="micro-annotation" style={{ color: '#000' }}>
                CAMPUS POSTER WALL // LIVE SESSIONS
              </span>
              <h2 className="font-display-section" style={{ color: '#000', marginTop: '6px' }}>
                UPCOMING EVENTS
              </h2>
            </div>
            <button 
              onClick={() => router.push('/student/campus')}
              className="poster-register-btn" 
              style={{ padding: '12px 24px', fontSize: '13px' }}
            >
              VIEW ALL CAMPUS EVENTS ↗
            </button>
          </div>

          {isEventsLoading ? (
            <div className="poster-wall-grid">
              {[1, 2, 3].map((n) => (
                <div key={n} className="poster-card-item" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                  <div className="poster-card-header">
                    <Skeleton className="h-5 w-24 bg-neutral-200 rounded-none" />
                    <Skeleton className="h-4 w-16 bg-neutral-200 rounded-none" />
                  </div>
                  <Skeleton className="h-8 w-3/4 bg-neutral-200 rounded-none mb-4" />
                  <div className="poster-photo-placeholder" style={{ background: '#e0e0dc' }} />
                  <Skeleton className="h-4 w-full bg-neutral-200 rounded-none mb-2" />
                  <Skeleton className="h-4 w-2/3 bg-neutral-200 rounded-none mb-4" />
                  <div className="poster-meta-footer">
                    <Skeleton className="h-4 w-20 bg-neutral-200 rounded-none" />
                    <Skeleton className="h-8 w-24 bg-neutral-200 rounded-none" />
                  </div>
                </div>
              ))}
            </div>
          ) : isEventsError ? (
            <div className="poster-wall-error-box">
              <div className="micro-annotation" style={{ color: '#0057FF', marginBottom: '8px' }}>
                CAMPUS FEED // SYSTEM NOTICE
              </div>
              <h3 className="font-display-section" style={{ color: '#000', fontSize: '28px', marginBottom: '10px' }}>
                FAILED TO LOAD UPCOMING EVENTS
              </h3>
              <p style={{ color: '#444', fontFamily: 'var(--font-body)', fontSize: '15px', maxWidth: '520px', marginBottom: '20px', lineHeight: 1.5 }}>
                We could not retrieve the latest campus event schedule. Please verify your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => refetchEvents()}
                className="poster-register-btn"
                style={{ padding: '10px 20px', fontSize: '12px' }}
              >
                RETRY CONNECTION ↻
              </button>
            </div>
          ) : posterEvents.length === 0 ? (
            <div className="poster-wall-empty-box">
              <div className="micro-annotation" style={{ color: '#0057FF', marginBottom: '8px' }}>
                CAMPUS POSTER WALL // 0 UPCOMING
              </div>
              <h3 className="font-display-section" style={{ color: '#000', fontSize: '28px', marginBottom: '10px' }}>
                NO UPCOMING EVENTS SCHEDULED
              </h3>
              <p style={{ color: '#444', fontFamily: 'var(--font-body)', fontSize: '15px', maxWidth: '520px', marginBottom: '20px', lineHeight: 1.5 }}>
                There are currently no upcoming events on the campus schedule. Check back soon for new hackathons, workshops, and tech meetups.
              </p>
              <button
                type="button"
                onClick={() => router.push('/student/campus/discover')}
                className="poster-register-btn"
                style={{ padding: '10px 20px', fontSize: '12px' }}
              >
                EXPLORE CAMPUS ↗
              </button>
            </div>
          ) : (
            <div className="poster-wall-grid">
              {posterEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="poster-card-item"
                  onClick={() => router.push(`/student/events/${evt.id}`)}
                >
                  <div className="poster-card-header">
                    <span className="poster-date-badge">{evt.dateBadge}</span>
                    <span className="micro-annotation" style={{ color: '#000' }}>{evt.category}</span>
                  </div>

                  <h3 className="poster-title-text">{evt.title}</h3>

                  <div className="poster-photo-frame">
                    {evt.bannerUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={evt.bannerUrl}
                          alt={evt.title}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                        <div className="poster-photo-placeholder" style={{ display: 'none', height: '100%', marginBottom: 0 }}>
                          <span className="poster-photo-placeholder-text">
                            {evt.category?.slice(0, 4) || 'NST'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="poster-photo-placeholder">
                        <span className="poster-photo-placeholder-text">
                          {evt.category?.slice(0, 4) || 'NST'}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="poster-desc-text">{evt.description}</p>

                  <div className="poster-meta-footer">
                    <span style={{ color: '#333' }}>{evt.venue}</span>
                    <button
                      type="button"
                      className="poster-register-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/student/events/${evt.id}`);
                      }}
                    >
                      REGISTER ↗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* Torn Paper Edge Back to Black */}
      <div className="torn-section-divider-black" />

    </main>
  );
}
