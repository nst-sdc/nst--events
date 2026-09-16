'use client';
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotifications, useReadNotification, Notification } from '../../../../hooks/useNotifications';
import { resolveStudentNotificationTarget } from '../../../../lib/student-notification-utils';

const notificationsStyles = `
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

  .nt-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .nt-inner {
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
  .nt-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .nt-micro-blue { color: var(--electric-blue); }
  .nt-micro-green { color: var(--acid-green); }

  /* ── Display Typography ── */
  .nt-hero-title {
    font-family: var(--font-display);
    font-size: clamp(36px, 5.5vw, 76px);
    font-weight: 900;
    line-height: 0.92;
    letter-spacing: -1.5px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
    word-break: break-word;
    margin-top: 8px;
  }

  .nt-header {
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 32px;
    margin-bottom: 40px;
    position: relative;
  }

  .nt-watermark {
    position: absolute;
    top: -20px;
    right: 0;
    font-family: var(--font-display);
    font-size: clamp(60px, 12vw, 150px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.03);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
  }

  /* ── Notification Ledger Card ── */
  .nt-card {
    background: var(--bg-dark-card);
    border: 2px solid rgba(255, 255, 255, 0.15);
    padding: 24px 28px;
    margin-bottom: 16px;
    box-shadow: 6px 6px 0px #000000;
    transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
    position: relative;
    border-radius: 0 !important;
  }

  .nt-card:hover {
    border-color: #ffffff;
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0px var(--electric-blue);
  }

  .nt-card.is-unread {
    border-color: var(--electric-blue);
    border-left: 5px solid var(--electric-blue);
    background: rgba(0, 87, 255, 0.06);
  }

  .nt-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px dashed rgba(245, 245, 242, 0.18);
    padding-bottom: 10px;
    margin-bottom: 12px;
  }

  .nt-card-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.5px;
    color: #ffffff;
    margin-bottom: 6px;
  }

  .nt-card-body {
    font-family: var(--font-body);
    font-size: 14px;
    color: #a0a4b8;
    line-height: 1.5;
  }

  .nt-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    padding-top: 10px;
  }

  /* ── Load More & Action Buttons ── */
  .nt-action-btn {
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
  .nt-action-btn:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }
  .nt-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Empty State Poster ── */
  .nt-empty-poster {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 60px 40px;
    position: relative;
    overflow: hidden;
    box-shadow: 12px 12px 0px var(--electric-blue);
    border-radius: 0 !important;
    text-align: left;
  }

  .nt-empty-watermark {
    position: absolute;
    bottom: -20px;
    right: -20px;
    font-family: var(--font-display);
    font-size: clamp(80px, 14vw, 150px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.03);
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
  }

  @media (max-width: 768px) {
    .nt-inner { padding: 40px 16px 80px 16px; }
  }
`;

export default function StudentNotificationsPage() {
  const router = useRouter();
  
  const { 
    data, 
    isLoading, 
    isError, 
    hasNextPage, 
    fetchNextPage, 
    isFetchingNextPage 
  } = useNotifications();
  
  const { mutate: markAsRead } = useReadNotification();

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleNotificationClick = (notif: Notification, targetHref: string | null) => {
    if (!notif.readAt) {
      markAsRead(notif.id);
    }
    if (targetHref) {
      router.push(targetHref);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    if (!now) return '';
    const date = new Date(isoString);
    const diffMs = now - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}M AGO`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}H AGO`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}D AGO`;
    return date.toLocaleDateString();
  };

  const isEmpty = !isLoading && !isError && data?.pages[0]?.data.length === 0;

  return (
    <>
      <style href="student-notifications-styles" precedence="high">
        {notificationsStyles}
      </style>
      <div className="collage-noise-overlay" />

      <div className="nt-page">
        <div className="nt-inner">

          {/* Header Section */}
          <section className="nt-header">
            <div className="nt-watermark">INBOX</div>
            <div className="nt-micro nt-micro-blue" style={{ marginBottom: '8px' }}>
              COMMUNICATIONS // SYSTEM DISPATCHES &amp; ALERTS
            </div>
            <h1 className="nt-hero-title">NOTIFICATIONS</h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginTop: '12px', maxWidth: '640px', lineHeight: 1.6 }}>
              Institutional dispatches, session reminders, registration milestones, and verified campus announcements.
            </p>
          </section>

          {/* Loading Skeletons */}
          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="nt-card" style={{ opacity: 0.5 }}>
                  <div style={{ height: '14px', background: 'rgba(255,255,255,0.1)', width: '30%', marginBottom: '16px' }} />
                  <div style={{ height: '24px', background: 'rgba(255,255,255,0.15)', width: '65%', marginBottom: '10px' }} />
                  <div style={{ height: '14px', background: 'rgba(255,255,255,0.06)', width: '85%' }} />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="nt-empty-poster">
              <div className="nt-empty-watermark">ERROR</div>
              <div className="nt-micro" style={{ color: 'var(--warm-red)', marginBottom: '12px' }}>
                FAULT // DISPATCH SYNC ERROR
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '16px' }}>
                FAILED TO LOAD<br />COMMUNICATIONS.
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', lineHeight: 1.6 }}>
                Could not establish synchronization with the campus dispatch gateway.
              </p>
              <button onClick={() => window.location.reload()} className="nt-action-btn">
                RETRY CONNECTION ↺
              </button>
            </div>
          )}

          {/* Empty State */}
          {isEmpty && (
            <div className="nt-empty-poster">
              <div className="nt-empty-watermark">INBOX</div>
              <div className="nt-micro nt-micro-blue" style={{ marginBottom: '12px' }}>
                INBOX STATUS // SYNCED
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '16px' }}>
                YOU'RE ALL<br />CAUGHT UP.
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.6 }}>
                No new alerts or campus notices right now. You will receive updates about event registrations, waitlist shifts, and club activity here.
              </p>
              <Link href="/student/campus/discover" className="nt-action-btn">
                EXPLORE CAMPUS EVENTS ↗
              </Link>
            </div>
          )}

          {/* Populated List */}
          {!isLoading && !isError && !isEmpty && data && (
            <div>
              {data.pages.map((page, pageIdx) => (
                <Fragment key={pageIdx}>
                  {page.data.map((notif) => {
                    const isUnread = !notif.readAt;
                    const targetHref = resolveStudentNotificationTarget(notif);

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif, targetHref)}
                        className={`nt-card ${isUnread ? 'is-unread' : ''}`}
                        style={{ cursor: targetHref ? 'pointer' : 'default' }}
                      >
                        <div className="nt-card-top">
                          <span className={`nt-micro ${isUnread ? 'nt-micro-blue' : ''}`}>
                            {isUnread ? 'DISPATCH // UNREAD' : 'DISPATCH // ARCHIVED'}
                          </span>
                          <span className="nt-micro">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <h3 className="nt-card-title">
                          {notif.title || notif.body}
                        </h3>

                        {notif.title && (
                          <p className="nt-card-body">
                            {notif.body}
                          </p>
                        )}

                        <div className="nt-card-footer">
                          <span className="nt-micro" style={{ color: '#666' }}>
                            NST-NET PROTOCOL
                          </span>
                          {targetHref && (
                            <span className="nt-micro nt-micro-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              OPEN RECORD ↗
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              ))}

              {/* Load More Pagination */}
              {hasNextPage && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="nt-action-btn"
                  >
                    {isFetchingNextPage ? 'FETCHING ARCHIVE...' : 'LOAD MORE DISPATCHES ↗'}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
