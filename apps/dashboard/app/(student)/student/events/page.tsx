'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { useMyRegistrations, MyRegistration } from '../../../../hooks/useMyRegistrations';
import { CalendarIcon, MapPin, List, ArrowRight } from 'lucide-react';
import { StudentCalendarView } from './components/StudentCalendarView';

type MyEventsTab = 'upcoming' | 'past';

const myEventsStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --electric-blue-dark: #0042c7;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --warm-amber: #FF9500;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .me-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .me-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: 60px 32px 100px 32px;
  }

  /* ── Texture & Noise ── */
  .collage-noise-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.35;
    background-image: radial-gradient(rgba(245, 245, 242, 0.08) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  /* ── Micro Annotations ── */
  .me-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .me-micro-blue { color: var(--electric-blue); }
  .me-micro-green { color: var(--acid-green); }

  /* ── Display Typography ── */
  .me-hero-title {
    font-family: var(--font-display);
    font-size: clamp(52px, 8.5vw, 120px);
    font-weight: 900;
    line-height: 0.88;
    letter-spacing: -2px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
  }

  .me-header {
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 32px;
    margin-bottom: 40px;
    position: relative;
  }

  .me-watermark {
    position: absolute;
    top: -20px;
    right: 0;
    font-family: var(--font-display);
    font-size: clamp(70px, 12vw, 160px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.03);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
  }

  /* ── Controls & Tabs Row ── */
  .me-controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    border-bottom: 1px solid rgba(245,245,242,0.2);
    padding-bottom: 20px;
    margin-bottom: 48px;
  }

  .me-tabs-group {
    display: flex;
    gap: 12px;
  }

  .me-tab-btn {
    background: transparent;
    color: #a0a4b8;
    border: 2px solid rgba(245,245,242,0.25);
    padding: 10px 20px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    cursor: pointer;
    transition: all 0.15s;
    border-radius: 0 !important;
  }
  .me-tab-btn:hover {
    border-color: var(--bg-paper-white);
    color: var(--bg-paper-white);
  }
  .me-tab-btn.active {
    background: var(--electric-blue);
    color: #ffffff;
    border-color: var(--electric-blue);
    box-shadow: 4px 4px 0px rgba(255,255,255,0.3);
  }

  .me-view-toggle {
    display: inline-flex;
    border: 2px solid rgba(245,245,242,0.25);
    background: var(--bg-dark-card);
    padding: 2px;
    border-radius: 0 !important;
  }

  .me-view-btn {
    background: transparent;
    color: #a0a4b8;
    border: none;
    padding: 8px 16px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s;
    border-radius: 0 !important;
  }
  .me-view-btn.active {
    background: var(--bg-paper-white);
    color: #000;
    font-weight: 800;
  }

  /* ── Poster Wall Cards Grid ── */
  .me-poster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 40px;
  }

  .me-poster-card {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 3px solid #000000;
    padding: 20px;
    box-shadow: 10px 10px 0px #000000;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    position: relative;
    text-decoration: none;
    border-radius: 0 !important;
    transform: translateZ(0);
    backface-visibility: hidden;
    contain: content;
    content-visibility: auto;
  }

  .me-poster-card:hover {
    transform: translate3d(-4px, -4px, 0) rotate(-1deg);
    box-shadow: 14px 14px 0px #000000;
  }

  .me-poster-card:nth-child(even) {
    transform: rotate(1.5deg) translateZ(0);
  }

  .me-poster-card:nth-child(even):hover {
    transform: translate3d(-4px, -4px, 0) rotate(0.5deg);
  }

  .me-poster-card.is-past {
    filter: grayscale(40%);
    opacity: 0.9;
  }

  .me-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  .me-date-badge {
    background: #000;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .me-status-pill {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 800;
    padding: 3px 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: 1px solid #000;
  }

  .me-status-confirmed {
    background: var(--electric-blue);
    color: #fff;
  }

  .me-status-waitlisted {
    background: var(--warm-amber);
    color: #000;
  }

  .me-status-cancelled {
    background: #e0e0e0;
    color: #666;
    text-decoration: line-through;
  }

  .me-photo-frame {
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

  .me-photo-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(125%) grayscale(80%);
    transform: translateZ(0);
    backface-visibility: hidden;
    will-change: transform, filter;
    transition: filter 0.3s ease;
  }

  .me-poster-card:hover .me-photo-frame img {
    filter: contrast(100%) grayscale(0%);
  }

  .me-photo-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #0d0e12 0%, #161b26 50%, #002570 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .me-photo-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(0,87,255,0.2) 1px, transparent 1px);
    background-size: 16px 16px;
  }

  .me-photo-watermark {
    font-family: var(--font-display);
    font-size: 48px;
    font-weight: 900;
    color: rgba(255,255,255,0.08);
    text-transform: uppercase;
    letter-spacing: -2px;
    z-index: 1;
  }

  .me-card-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 900;
    line-height: 1.05;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 10px;
    letter-spacing: -0.5px;
    word-break: break-word;
  }

  .me-card-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: #333;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .me-team-box {
    background: #000;
    color: #fff;
    padding: 6px 10px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .me-card-footer {
    border-top: 2px dashed #000;
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
  }

  .me-pass-btn {
    background: var(--electric-blue);
    color: #ffffff;
    border: 2px solid #000;
    padding: 7px 16px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    box-shadow: 2px 2px 0px #000;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  /* ── Calendar Wrapper ── */
  .me-calendar-container {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 32px 24px;
    box-shadow: 12px 12px 0px var(--electric-blue);
    border-radius: 0 !important;
  }

  /* ── Editorial Empty State Poster ── */
  .me-empty-poster {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 60px 40px;
    position: relative;
    overflow: hidden;
    box-shadow: 12px 12px 0px var(--electric-blue);
    border-radius: 0 !important;
  }

  .me-empty-watermark {
    position: absolute;
    bottom: -20px;
    right: -20px;
    font-family: var(--font-display);
    font-size: 140px;
    font-weight: 900;
    color: rgba(245, 245, 242, 0.04);
    pointer-events: none;
    user-select: none;
  }

  .me-empty-btn {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: var(--electric-blue);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 28px;
    border: 2px solid var(--bg-paper-white);
    cursor: pointer;
    box-shadow: 4px 4px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
    text-decoration: none;
    border-radius: 0 !important;
  }
  .me-empty-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }

  /* ── Skeletons ── */
  .me-skeleton-card {
    background: var(--bg-dark-card);
    border: 3px solid rgba(255,255,255,0.15);
    padding: 20px;
    height: 380px;
    display: flex;
    flex-direction: column;
    box-shadow: 8px 8px 0px rgba(255,255,255,0.05);
    animation: mePulse 1.5s ease-in-out infinite;
  }
  @keyframes mePulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.85; }
  }

  @media (max-width: 768px) {
    .me-inner { padding: 40px 16px 80px 16px; }
    .me-poster-grid { grid-template-columns: 1fr; }
    .me-poster-card:nth-child(even) { transform: none; }
    .me-controls-row { flex-direction: column; align-items: stretch; }
    .me-tabs-group { width: 100%; }
    .me-tab-btn { flex: 1; text-align: center; }
  }
`;

export default function StudentEventsPage() {
  const router = useRouter();
  const [viewMode, setViewModeState] = useState<'list' | 'calendar'>('list');
  const [activeTab, setActiveTab] = useState<MyEventsTab>('upcoming');

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

  const now = dayjs();
  const upcoming: MyRegistration[] = [];
  const pastAndCancelled: MyRegistration[] = [];

  (registrations || []).forEach(reg => {
    const isCancelled = reg.registrationStatus === 'CANCELLED';
    const isPast = dayjs(reg.event?.endTime).isBefore(now) || dayjs(reg.event?.endTime).isSame(now);

    if (isCancelled || isPast) {
      pastAndCancelled.push(reg);
    } else {
      upcoming.push(reg);
    }
  });

  // Sort upcoming chronologically ascending
  upcoming.sort((a, b) => dayjs(a.event?.startTime).valueOf() - dayjs(b.event?.startTime).valueOf());
  // Sort past chronologically descending
  pastAndCancelled.sort((a, b) => dayjs(b.event?.startTime).valueOf() - dayjs(a.event?.startTime).valueOf());

  const displayedList = activeTab === 'upcoming' ? upcoming : pastAndCancelled;

  const renderLoadingState = () => (
    <div className="me-poster-grid">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="me-skeleton-card">
          <div style={{ height: '20px', background: 'rgba(255,255,255,0.1)', width: '50%', marginBottom: '14px' }} />
          <div style={{ height: '180px', background: 'rgba(255,255,255,0.08)', marginBottom: '16px' }} />
          <div style={{ height: '28px', background: 'rgba(255,255,255,0.12)', width: '80%', marginBottom: '10px' }} />
          <div style={{ height: '16px', background: 'rgba(255,255,255,0.06)', width: '100%', marginBottom: '6px' }} />
          <div style={{ height: '16px', background: 'rgba(255,255,255,0.06)', width: '70%', marginTop: 'auto' }} />
        </div>
      ))}
    </div>
  );

  const renderErrorState = () => (
    <div className="me-empty-poster">
      <div className="me-empty-watermark">ERROR</div>
      <div className="me-micro" style={{ color: 'var(--warm-red)', marginBottom: '12px' }}>
        LEDGER FAULT // RETRIEVAL INTERRUPTED
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '16px' }}>
        COULD NOT LOAD<br />YOUR REGISTRATIONS.
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.6 }}>
        We encountered an error synchronizing your event passes with the campus ledger.
      </p>
      <button onClick={() => refetch()} className="me-empty-btn">
        RETRY CONNECTION ↺
      </button>
    </div>
  );

  const renderEmptyState = () => {
    if (activeTab === 'upcoming') {
      return (
        <div className="me-empty-poster">
          <div className="me-empty-watermark">SCHEDULE</div>
          <div className="me-micro me-micro-blue" style={{ marginBottom: '12px' }}>
            SCHEDULE STATUS // 0 UPCOMING
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '16px' }}>
            NOTHING<br />SCHEDULED.<br />YET.
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.6 }}>
            You don&apos;t have anything coming up yet. Explore what&apos;s happening around campus, join upcoming hackathons, and connect with technical workshops.
          </p>
          <Link href="/student/campus/discover" className="me-empty-btn">
            EXPLORE EVENTS ↗
          </Link>
        </div>
      );
    }

    return (
      <div className="me-empty-poster">
        <div className="me-empty-watermark">ARCHIVE</div>
        <div className="me-micro" style={{ marginBottom: '12px' }}>
          ARCHIVE STATUS // 0 HISTORICAL
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '16px' }}>
          NO HISTORICAL<br />EVENTS RECORDED.
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.6 }}>
          You haven&apos;t attended or cancelled any campus events yet.
        </p>
        <Link href="/student/campus/discover" className="me-empty-btn">
          DISCOVER EVENTS ↗
        </Link>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WAITLISTED':
        return <span className="me-status-pill me-status-waitlisted">WAITLISTED</span>;
      case 'CANCELLED':
        return <span className="me-status-pill me-status-cancelled">CANCELLED</span>;
      case 'CONFIRMED':
      case 'REGISTERED':
      default:
        return <span className="me-status-pill me-status-confirmed">PASS CONFIRMED</span>;
    }
  };

  return (
    <>
      <style href="student-events-styles" precedence="high">
        {myEventsStyles}
      </style>
      <div className="collage-noise-overlay" />

      <div className="me-page">
        <div className="me-inner">

          {/* Header Section */}
          <section className="me-header">
            <div className="me-watermark">PASSES</div>
            <div className="me-micro me-micro-blue" style={{ marginBottom: '8px' }}>
              PERSONAL ARCHIVE // REGISTRATIONS &amp; SCHEDULE
            </div>
            <h1 className="me-hero-title">MY EVENTS</h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginTop: '12px', maxWidth: '640px', lineHeight: 1.6 }}>
              Access your verified event credentials, team collaborations, and personal campus timeline.
            </p>
          </section>

          {/* Controls Row: Tabs & View Mode */}
          <section className="me-controls-row">
            <div className="me-tabs-group">
              <button
                id="tab-myevents-upcoming"
                onClick={() => setActiveTab('upcoming')}
                className={`me-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
              >
                UPCOMING ({upcoming.length})
              </button>
              <button
                id="tab-myevents-past"
                onClick={() => setActiveTab('past')}
                className={`me-tab-btn ${activeTab === 'past' ? 'active' : ''}`}
              >
                PAST &amp; CANCELLED ({pastAndCancelled.length})
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="me-view-toggle">
              <button
                onClick={() => setViewMode('list')}
                className={`me-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                type="button"
              >
                <List size={14} /> LIST
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`me-view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                type="button"
              >
                <CalendarIcon size={14} /> CALENDAR
              </button>
            </div>
          </section>

          {/* Main Content Area */}
          <div>
            {isLoading ? (
              renderLoadingState()
            ) : isError ? (
              renderErrorState()
            ) : viewMode === 'calendar' ? (
              <div className="me-calendar-container">
                <StudentCalendarView />
              </div>
            ) : displayedList.length === 0 ? (
              renderEmptyState()
            ) : (
              <div className="me-poster-grid">
                {displayedList.map((reg) => {
                  const date = dayjs(reg.event?.startTime);
                  const dateLabel = date.format('MMM D');
                  const timeLabel = date.format('h:mm A');
                  const locationLabel = reg.event?.locationName || 'Campus';
                  const bannerUrl = (reg.event?.metadata as Record<string, unknown> | null | undefined)?.banner_url as string | undefined;
                  const isPast = activeTab === 'past';

                  return (
                    <div
                      key={reg.id}
                      className={`me-poster-card ${isPast ? 'is-past' : ''}`}
                      onClick={() => router.push(`/student/events/${reg.eventId}`)}
                    >
                      <div>
                        <div className="me-card-header">
                          <span className="me-date-badge">{dateLabel}</span>
                          {getStatusBadge(reg.registrationStatus)}
                        </div>

                        <div className="me-photo-frame">
                          {bannerUrl ? (
                            <img
                              src={bannerUrl}
                              alt={reg.event?.title || 'Event'}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="me-photo-placeholder">
                              <span className="me-photo-watermark">NST</span>
                              <div className="me-micro" style={{ color: 'rgba(255,255,255,0.4)', zIndex: 1, marginTop: '4px' }}>
                                VERIFIED ENTRY PASS
                              </div>
                            </div>
                          )}
                        </div>

                        <h3 className="me-card-title">
                          {reg.event?.title || 'Campus Event'}
                        </h3>

                        <div className="me-card-meta">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CalendarIcon size={12} /> {timeLabel}
                          </span>
                          <span>&bull;</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {locationLabel}
                          </span>
                        </div>

                        {reg.team && (
                          <div className="me-team-box">
                            <span>TEAM // {reg.team.name}</span>
                            <span style={{ color: 'var(--electric-blue)' }}>
                              [{(reg.team.status === 'FORMING' && (reg.registrationStatus === 'REGISTERED' || (typeof reg.event?.metadata?.minimum_team_size === 'number' && (reg.team.memberCount ?? 1) >= reg.event.metadata.minimum_team_size))) ? 'REGISTERED' : reg.team.status}]
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="me-card-footer">
                        {reg.team ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/student/events/${reg.eventId}/team`);
                            }}
                            className="me-micro"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#000',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                          >
                            TEAM HUB ↗
                          </button>
                        ) : (
                          <span className="me-micro" style={{ color: '#666' }}>
                            PASSPORT // NST-NET
                          </span>
                        )}

                        <button
                          type="button"
                          className="me-pass-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/student/events/${reg.eventId}`);
                          }}
                        >
                          EVENT PASS <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
