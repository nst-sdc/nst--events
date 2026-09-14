'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useClubDetail, ClubMember } from '../../../../../../hooks/useClubDetail';
import { useEvents } from '../../../../../../hooks/useEvents';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';

const clubDetailStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --electric-blue-dark: #0042c7;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .cd-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .cd-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: 40px 32px 100px 32px;
  }

  .cd-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .cd-micro-blue { color: var(--electric-blue); }
  .cd-micro-green { color: var(--acid-green); }

  /* ── Hero Banner ── */
  .cd-banner-container {
    width: 100%;
    height: 320px;
    background: #111;
    border-bottom: 3px solid #fff;
    position: relative;
    overflow: hidden;
  }

  .cd-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(120%) grayscale(40%);
  }

  .cd-banner-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #050505 0%, #0d1322 50%, #002e8a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .cd-banner-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(0,87,255,0.2) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .cd-banner-watermark {
    font-family: var(--font-display);
    font-size: clamp(60px, 12vw, 160px);
    font-weight: 900;
    color: rgba(255,255,255,0.06);
    letter-spacing: -3px;
    text-transform: uppercase;
    user-select: none;
  }

  .cd-back-btn {
    position: absolute;
    top: 24px;
    left: 32px;
    background: rgba(5, 5, 5, 0.9);
    color: #fff;
    border: 2px solid #fff;
    padding: 8px 18px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 4px 4px 0px #000;
    z-index: 10;
    transition: transform 0.15s;
    border-radius: 0 !important;
  }
  .cd-back-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #000;
  }

  /* ── Dossier Headline & Stats ── */
  .cd-headline-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 32px;
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 36px;
    margin-bottom: 48px;
  }

  .cd-club-title {
    font-family: var(--font-display);
    font-size: clamp(40px, 6.5vw, 84px);
    font-weight: 900;
    line-height: 0.92;
    letter-spacing: -2px;
    text-transform: uppercase;
    color: #fff;
    margin-top: 8px;
    max-width: 800px;
    word-break: break-word;
  }

  .cd-stats-offset {
    display: flex;
    gap: 20px;
  }

  .cd-stat-card {
    background: var(--bg-dark-card);
    border: 2px solid var(--bg-paper-white);
    padding: 16px 24px;
    box-shadow: 6px 6px 0px var(--electric-blue);
    min-width: 140px;
    border-radius: 0 !important;
  }

  .cd-stat-num {
    font-family: var(--font-display);
    font-size: 38px;
    font-weight: 900;
    line-height: 1;
    color: #fff;
  }

  /* ── Admin Alert Strip ── */
  .cd-admin-banner {
    border: 2px solid var(--electric-blue);
    background: rgba(0, 87, 255, 0.1);
    padding: 20px 24px;
    margin-bottom: 48px;
    box-shadow: 6px 6px 0px var(--electric-blue);
    border-radius: 0 !important;
  }

  /* ── Content Columns ── */
  .cd-columns-grid {
    display: grid;
    grid-template-columns: 360px 1fr;
    gap: 48px;
  }

  .cd-section-box {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 32px 28px;
    box-shadow: 10px 10px 0px #000;
    border-radius: 0 !important;
  }

  .cd-section-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 900;
    text-transform: uppercase;
    border-bottom: 2px solid #fff;
    padding-bottom: 12px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cd-member-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px dashed rgba(245,245,242,0.18);
  }

  .cd-event-card {
    display: block;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.15);
    padding: 20px;
    margin-bottom: 16px;
    text-decoration: none;
    color: inherit;
    transition: all 0.15s;
    border-radius: 0 !important;
  }
  .cd-event-card:hover {
    border-color: #fff;
    background: rgba(0, 87, 255, 0.1);
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px var(--electric-blue);
  }

  @media (max-width: 992px) {
    .cd-columns-grid { grid-template-columns: 1fr; }
    .cd-inner { padding: 32px 16px 80px 16px; }
  }
`;

export default function ClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;

  const { data: club, isLoading: isClubLoading, isError: isClubError } = useClubDetail(clubId);
  
  const { data: eventsData, isLoading: isEventsLoading } = useEvents({
    filter_club_id: clubId,
    limit: 50,
  });

  const { data: currentUser } = useCurrentUser();
  const isClubAdmin = currentUser?.club_memberships?.some(
    (m) => m.club_id === clubId && m.role === 'CLUB_ADMIN'
  );

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: "compact",
      compactDisplay: "short"
    }).format(num);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'CLUB_ADMIN': return 'Admin';
      case 'CORE_MEMBER': return 'Core';
      case 'FACULTY_MENTOR': return 'Mentor';
      case 'MEMBER': return 'Member';
      default: return role;
    }
  };

  if (isClubLoading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: clubDetailStyles }} />
        <div className="cd-page">
          <div className="cd-banner-container" style={{ animation: 'cPulse 1.5s infinite' }} />
          <div className="cd-inner">
            <div style={{ height: '60px', background: 'rgba(255,255,255,0.1)', width: '60%', marginBottom: '24px' }} />
            <div style={{ height: '24px', background: 'rgba(255,255,255,0.06)', width: '90%', marginBottom: '12px' }} />
            <div style={{ height: '24px', background: 'rgba(255,255,255,0.06)', width: '70%' }} />
          </div>
        </div>
      </>
    );
  }

  if (isClubError || !club) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: clubDetailStyles }} />
        <div className="cd-page">
          <div className="cd-inner" style={{ paddingTop: '100px', textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
            <div className="cd-micro" style={{ color: 'var(--warm-red)', marginBottom: '16px' }}>
              ERROR // RECORD NOT FOUND
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '16px' }}>
              CLUB DOSSIER UNAVAILABLE
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', lineHeight: 1.6 }}>
              This collective may have migrated or is not currently open to public viewing.
            </p>
            <button 
              onClick={() => router.push('/student/campus/clubs')} 
              style={{
                background: 'var(--electric-blue)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '14px 28px',
                border: '2px solid #fff',
                cursor: 'pointer',
                boxShadow: '4px 4px 0px #fff'
              }}
            >
              ← RETURN TO CLUBS DIRECTORY
            </button>
          </div>
        </div>
      </>
    );
  }

  const events = eventsData?.data || [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: clubDetailStyles }} />
      <div className="collage-noise-overlay" />

      <div className="cd-page">
        {/* Banner Frame */}
        <div className="cd-banner-container">
          {club.banner_url ? (
            <img 
              src={club.banner_url} 
              alt={`${club.name} banner`} 
              className="cd-banner-img"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="cd-banner-placeholder">
              <span className="cd-banner-watermark">{club.name}</span>
            </div>
          )}

          <Link href="/student/campus/clubs" className="cd-back-btn">
            &larr; BACK TO CLUBS
          </Link>
        </div>

        <div className="cd-inner">
          {/* Header & Meta Row */}
          <section className="cd-headline-row">
            <div>
              <div className="cd-micro cd-micro-blue">
                OFFICIAL CHAPTER DOSSIER // NST-SDC
              </div>
              <h1 className="cd-club-title">{club.name}</h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginTop: '16px', maxWidth: '720px', lineHeight: 1.6 }}>
                {club.description || 'No public manifesto or description provided for this campus collective.'}
              </p>
            </div>

            <div className="cd-stats-offset">
              <div className="cd-stat-card">
                <div className="cd-stat-num">{formatNumber(club.members?.length || 0)}</div>
                <div className="cd-micro" style={{ marginTop: '4px' }}>MEMBERS</div>
              </div>
              <div className="cd-stat-card">
                <div className="cd-stat-num" style={{ color: 'var(--electric-blue)' }}>{formatNumber(club.event_count || 0)}</div>
                <div className="cd-micro cd-micro-blue" style={{ marginTop: '4px' }}>EVENTS HOSTED</div>
              </div>
            </div>
          </section>

          {/* Admin Notice */}
          {isClubAdmin && (
            <div className="cd-admin-banner">
              <div className="cd-micro cd-micro-blue" style={{ marginBottom: '6px' }}>
                SECURITY CLEARANCE: CLUB ADMIN PRIVILEGES ACTIVE
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#fff', margin: 0 }}>
                Administrative access enabled. Event authoring, session attendance management, and member dispatch controls are authorized.
              </p>
            </div>
          )}

          {/* 2 Column Layout: Roster & Upcoming Events */}
          <div className="cd-columns-grid">
            {/* Left: Roster Dossier */}
            <div className="cd-section-box">
              <div className="cd-section-title">
                <span>ROSTER</span>
                <span className="cd-micro">{club.members?.length || 0} PROFILES</span>
              </div>

              {club.members && club.members.length > 0 ? (
                <div>
                  {club.members.map((member: ClubMember) => (
                    <div key={member.user_id} className="cd-member-item">
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                        {member.full_name}
                      </span>
                      <span 
                        className="cd-micro"
                        style={{ 
                          color: ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'].includes(member.role)
                            ? 'var(--electric-blue)'
                            : '#888'
                        }}
                      >
                        {getRoleLabel(member.role)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#a0a4b8' }}>
                  No public roster entries recorded.
                </p>
              )}
            </div>

            {/* Right: Upcoming Sessions / Events */}
            <div className="cd-section-box">
              <div className="cd-section-title">
                <span>SCHEDULED SESSIONS</span>
                <span className="cd-micro cd-micro-green">{events.length} ACTIVE</span>
              </div>

              {isEventsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '80px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <div style={{ height: '80px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
              ) : events.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <div className="cd-micro" style={{ marginBottom: '8px' }}>ARCHIVE EMPTY</div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: '#a0a4b8' }}>
                    No sessions or workshops currently scheduled by this club.
                  </p>
                </div>
              ) : (
                <div>
                  {events.map(event => {
                    const date = dayjs(event.startTime);
                    const dateLabel = date.format('ddd, MMM D');
                    const locationLabel = event.locationName || 'Campus';

                    return (
                      <Link 
                        key={event.id}
                        href={`/student/events/${event.id}`}
                        className="cd-event-card"
                      >
                        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                          {event.title}
                        </h4>
                        <div className="cd-micro cd-micro-blue" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span>{dateLabel}</span>
                          <span>&bull;</span>
                          <span>{date.format('h:mm A')}</span>
                          <span>&bull;</span>
                          <span style={{ color: '#fff' }}>{locationLabel}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
