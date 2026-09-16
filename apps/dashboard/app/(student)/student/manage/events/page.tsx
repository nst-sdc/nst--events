'use client';

import React, { useEffect } from 'react';
import { useClubAdmin } from '../../../../../components/layout/ClubAdminProvider';
import { useEvents } from '../../../../../hooks/useEvents';
import { Plus, Calendar as CalendarIcon, MapPin, Users, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const manageEventsStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .me-page {
    width: 100%;
    min-height: 100vh;
    background: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
  }

  .me-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: 60px 32px 100px 32px;
  }

  .me-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .me-micro-blue { color: var(--electric-blue); }

  /* ── Header ── */
  .me-header {
    border-bottom: 3px solid #fff;
    padding-bottom: 28px;
    margin-bottom: 40px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
  }

  /* ── Create Button ── */
  .me-create-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--electric-blue);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 12px 24px;
    border: 2px solid var(--bg-paper-white);
    text-decoration: none;
    box-shadow: 4px 4px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .me-create-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }

  /* ── Events Grid ── */
  .me-events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 32px;
  }

  /* ── Event Card ── */
  .me-event-card {
    background: var(--bg-dark-card);
    border: 3px solid rgba(245,245,242,0.2);
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-shadow: 6px 6px 0px #000;
  }
  .me-event-card:hover {
    border-color: var(--electric-blue);
    box-shadow: 6px 6px 0px var(--electric-blue);
  }

  .me-event-card-body { padding: 20px; flex-grow: 1; }

  .me-event-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .me-status-pill {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .me-status-published { color: var(--acid-green); }
  .me-status-draft     { color: #f5c518; }
  .me-status-other     { color: #a0a4b8; }

  .me-team-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 3px 8px;
    border: 1px solid rgba(245,245,242,0.25);
    color: #a0a4b8;
  }

  .me-event-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 900;
    text-transform: uppercase;
    color: #fff;
    line-height: 1.05;
    margin-bottom: 14px;
    letter-spacing: -0.3px;
  }

  .me-event-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .me-event-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-body);
    font-size: 12px;
    color: #a0a4b8;
  }

  /* ── Card Footer ── */
  .me-event-card-footer {
    border-top: 2px solid rgba(245,245,242,0.1);
    display: flex;
  }
  .me-card-action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .me-card-action-view {
    color: #a0a4b8;
    border-right: 1px solid rgba(245,245,242,0.1);
  }
  .me-card-action-view:hover {
    background: rgba(245,245,242,0.05);
    color: #fff;
  }
  .me-card-action-manage {
    color: var(--electric-blue);
  }
  .me-card-action-manage:hover {
    background: rgba(0,87,255,0.1);
    color: #fff;
  }

  /* ── Empty State ── */
  .me-empty-state {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 64px 48px;
    text-align: center;
    box-shadow: 10px 10px 0px var(--electric-blue);
    position: relative;
    overflow: hidden;
    max-width: 600px;
    margin: 0 auto;
  }
  .me-empty-watermark {
    position: absolute;
    bottom: -20px;
    right: -10px;
    font-family: var(--font-display);
    font-size: 100px;
    font-weight: 900;
    color: rgba(245,245,242,0.03);
    pointer-events: none;
    text-transform: uppercase;
  }
  .me-empty-title {
    font-family: var(--font-display);
    font-size: clamp(32px, 5vw, 48px);
    font-weight: 900;
    text-transform: uppercase;
    color: #fff;
    line-height: 0.92;
    margin-bottom: 16px;
    letter-spacing: -1px;
  }
  .me-empty-sub {
    font-family: var(--font-body);
    font-size: 14px;
    color: #a0a4b8;
    line-height: 1.65;
    margin-bottom: 32px;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  @media (max-width: 768px) {
    .me-inner { padding: 40px 16px 80px 16px; }
    .me-events-grid { grid-template-columns: 1fr; }
    .me-header { align-items: flex-start; }
  }
`;

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function ClubEventsPage() {
  const { activeClubId, managedClubs, isHydrated } = useClubAdmin();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !activeClubId && managedClubs.length === 0) {
      router.push('/student/home');
    }
  }, [isHydrated, activeClubId, managedClubs.length, router]);

  const { data: eventsData, isLoading } = useEvents({ filter_club_id: activeClubId || undefined, limit: 100 });

  if (!isHydrated || isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: '3px solid #0057FF',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#a0a4b8' }}>
            LOADING EVENTS...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const events = eventsData?.data || [];

  const getStatusClass = (state: string) => {
    if (state === 'PUBLISHED') return 'me-status-pill me-status-published';
    if (state === 'DRAFT') return 'me-status-pill me-status-draft';
    return 'me-status-pill me-status-other';
  };

  return (
    <>
      <style href="student-manage-events-styles" precedence="high">
        {manageEventsStyles}
      </style>
      <div className="me-page">
        <div className="me-inner">

          {/* Header */}
          <div className="me-header">
            <div>
              <div className="me-micro me-micro-blue" style={{ marginBottom: 8 }}>CLUB MANAGEMENT // EVENTS</div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: -1, lineHeight: 0.92, color: '#fff' }}>
                EVENTS
              </h1>
            </div>
            <Link href="/student/manage/events/create" className="me-create-btn">
              <Plus size={14} /> CREATE EVENT
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="me-empty-state">
              <div className="me-empty-watermark">EVENTS</div>
              <div className="me-micro me-micro-blue" style={{ marginBottom: 12 }}>CLUB EVENTS // EMPTY</div>
              <h2 className="me-empty-title">NO EVENTS<br />YET.</h2>
              <p className="me-empty-sub">
                Get started by creating your first event. Manage registrations, teams, and attendance from here.
              </p>
              <Link href="/student/manage/events/create" className="me-create-btn">
                <Plus size={14} /> CREATE FIRST EVENT
              </Link>
            </div>
          ) : (
            <div className="me-events-grid">
              {events.map((event) => (
                <div key={event.id} className="me-event-card">
                  <div className="me-event-card-body">
                    <div className="me-event-status-row">
                      <span className={getStatusClass(event.state)}>{event.state}</span>
                      {event.registrationType === 'TEAM' && (
                        <span className="me-team-badge">TEAM</span>
                      )}
                    </div>

                    <h3 className="me-event-title">{event.title}</h3>

                    <div className="me-event-meta">
                      <div className="me-event-meta-row">
                        <CalendarIcon size={12} style={{ flexShrink: 0 }} />
                        <span>{dateFormatter.format(new Date(event.startTime))}</span>
                      </div>
                      {event.locationName && (
                        <div className="me-event-meta-row">
                          <MapPin size={12} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.locationName}</span>
                        </div>
                      )}
                      <div className="me-event-meta-row">
                        <Users size={12} style={{ flexShrink: 0 }} />
                        <span>
                          {event.registrationCount}{event.maxCapacity ? ` / ${event.maxCapacity}` : ''} registered
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="me-event-card-footer">
                    <Link href={`/student/events/${event.id}`} className="me-card-action me-card-action-view">
                      VIEW
                    </Link>
                    <Link href={`/student/events/${event.id}/manage`} className="me-card-action me-card-action-manage">
                      <Settings size={11} /> MANAGE
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
