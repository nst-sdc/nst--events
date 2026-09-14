'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useEvents } from '../../../../../hooks/useEvents';

dayjs.extend(isBetween);

const EVENT_TYPES = [
  { label: 'ALL', value: '' },
  { label: 'WORKSHOPS', value: 'WORKSHOP' },
  { label: 'SEMINARS', value: 'SEMINAR' },
  { label: 'COMPETITIONS', value: 'COMPETITION' },
  { label: 'MEETUPS', value: 'MEETUP' },
  { label: 'HACKATHONS', value: 'HACKATHON' },
  { label: 'CULTURAL', value: 'CULTURAL' },
  { label: 'SPORTS', value: 'SPORTS' },
  { label: 'OTHER', value: 'OTHER' },
];

const discoverStyles = `
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

  .discover-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .discover-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: 60px 32px 100px 32px;
  }

  /* ── Micro Annotations ── */
  .d-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .d-micro-blue { color: var(--electric-blue); }
  .d-micro-green { color: var(--acid-green); }

  /* ── Display Type ── */
  .d-hero-title {
    font-family: var(--font-display);
    font-size: clamp(52px, 8.5vw, 120px);
    font-weight: 900;
    line-height: 0.88;
    letter-spacing: -2px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
  }

  /* ── Header Section ── */
  .discover-header {
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 32px;
    margin-bottom: 40px;
  }

  /* ── Search Bar ── */
  .discover-search {
    width: 100%;
    height: 60px;
    background: var(--bg-dark-card);
    border: 3px solid #fff;
    padding: 0 24px;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 16px;
    outline: none;
    display: block;
    border-radius: 0 !important;
  }
  .discover-search::placeholder {
    color: #a0a4b8;
  }

  /* ── Category Filters ── */
  .discover-filter-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    border-bottom: 1px solid rgba(245,245,242,0.2);
    padding-bottom: 20px;
    margin-bottom: 48px;
  }

  .filter-btn {
    background: transparent;
    color: #a0a4b8;
    border: 2px solid rgba(245,245,242,0.25);
    padding: 7px 14px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    cursor: pointer;
    transition: all 0.15s;
    border-radius: 0 !important;
  }
  .filter-btn:hover {
    border-color: var(--bg-paper-white);
    color: var(--bg-paper-white);
  }
  .filter-btn.active {
    background: var(--electric-blue);
    color: #ffffff;
    border-color: var(--electric-blue);
    box-shadow: 3px 3px 0px rgba(255,255,255,0.3);
  }

  /* ── Result Meta Row ── */
  .result-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
  }

  /* ── Poster Wall Grid ── */
  .d-poster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 40px;
  }

  /* ── Poster Card ── */
  .d-poster-card {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 3px solid #000000;
    padding: 20px;
    box-shadow: 10px 10px 0px #000000;
    display: flex;
    flex-direction: column;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
    position: relative;
    text-decoration: none;
  }
  .d-poster-card:hover {
    transform: translate(-4px, -4px) rotate(-0.5deg);
    box-shadow: 14px 14px 0px #000000;
  }

  .d-poster-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  .d-date-badge {
    background: #000;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .d-type-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #555;
  }

  .d-poster-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 900;
    line-height: 1.05;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
  }

  .d-poster-img-frame {
    width: 100%;
    height: 180px;
    background: #111;
    border: 2px solid #000;
    margin-bottom: 14px;
    overflow: hidden;
  }
  .d-poster-img-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(130%) grayscale(70%);
  }

  .d-poster-img-placeholder {
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
  }
  .d-poster-img-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(0,87,255,0.15) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .d-poster-img-placeholder-text {
    font-family: var(--font-display);
    font-size: 48px;
    font-weight: 900;
    color: rgba(255,255,255,0.06);
    text-transform: uppercase;
    letter-spacing: -2px;
    z-index: 1;
  }

  .d-poster-footer {
    margin-top: auto;
    padding-top: 12px;
    border-top: 2px dashed #000;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .d-location-text {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: #333;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .d-explore-btn {
    background: var(--electric-blue);
    color: #ffffff;
    border: 2px solid #000;
    padding: 7px 14px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.15s;
    border-radius: 0 !important;
  }
  .d-explore-btn:hover {
    background: var(--electric-blue-dark);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px #000;
  }

  /* ── Skeleton Loader ── */
  .d-skeleton-card {
    background: var(--bg-dark-card);
    border: 3px solid rgba(245,245,242,0.1);
    padding: 20px;
    animation: d-pulse 1.5s ease-in-out infinite;
  }
  .d-skel-bar {
    background: rgba(245,245,242,0.07);
    margin-bottom: 10px;
    border-radius: 0 !important;
  }
  @keyframes d-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* ── Empty / Error State ── */
  .d-empty-state {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 60px 40px;
    position: relative;
    overflow: hidden;
    box-shadow: 12px 12px 0px var(--electric-blue);
    text-align: center;
    max-width: 640px;
    margin: 0 auto;
  }
  .d-empty-watermark {
    position: absolute;
    bottom: -20px;
    right: -10px;
    font-family: var(--font-display);
    font-size: 100px;
    font-weight: 900;
    color: rgba(245,245,242,0.04);
    pointer-events: none;
    text-transform: uppercase;
  }
  .d-empty-title {
    font-family: var(--font-display);
    font-size: clamp(32px, 5vw, 56px);
    font-weight: 900;
    line-height: 0.92;
    text-transform: uppercase;
    color: var(--bg-paper-white);
    margin-bottom: 16px;
    letter-spacing: -1.5px;
  }
  .d-empty-sub {
    font-family: var(--font-body);
    font-size: 15px;
    color: #a0a4b8;
    margin-bottom: 32px;
    line-height: 1.6;
    max-width: 420px;
    margin-left: auto;
    margin-right: auto;
  }
  .d-clear-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    color: var(--bg-paper-white);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 28px;
    border: 2px solid var(--bg-paper-white);
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 0 !important;
    margin-right: 12px;
  }
  .d-clear-btn:hover {
    background: var(--bg-paper-white);
    color: var(--bg-black);
  }
  .d-retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--electric-blue);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 28px;
    border: 2px solid var(--bg-paper-white);
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 0 !important;
    box-shadow: 4px 4px 0px #ffffff;
  }
  .d-retry-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }

  /* ── Load More ── */
  .d-load-more-wrap {
    display: flex;
    justify-content: center;
    padding-top: 60px;
  }
  .d-load-more-btn {
    background: transparent;
    color: var(--bg-paper-white);
    border: 2px solid var(--bg-paper-white);
    padding: 14px 40px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 0 !important;
    box-shadow: 4px 4px 0px rgba(245,245,242,0.2);
  }
  .d-load-more-btn:hover {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px rgba(245,245,242,0.3);
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .discover-inner { padding: 40px 16px 80px 16px; }
    .d-poster-grid { grid-template-columns: 1fr; gap: 24px; }
    .d-hero-title { letter-spacing: -1px; }
    .discover-filter-row { gap: 8px; }
  }
`;

export default function DiscoverPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryQ = searchParams.get('q') || '';
  const queryType = searchParams.get('type') || '';

  const [searchInput, setSearchInput] = useState(queryQ);

  // Debounce search input to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (searchInput.trim()) {
        newParams.set('q', searchInput);
      } else {
        newParams.delete('q');
      }
      if (searchParams.get('q') !== (searchInput || null)) {
        router.replace(`${pathname}?${newParams.toString()}`);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, pathname, router, searchParams]);

  const { data: eventsData, isLoading, isError, refetch } = useEvents({
    q: queryQ || undefined,
    filter_state: 'PUBLISHED',
    filter_event_type: queryType || undefined,
    limit: 50,
  });

  const handleTypeClick = useCallback((typeVal: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (typeVal) {
      newParams.set('type', typeVal);
    } else {
      newParams.delete('type');
    }
    router.push(`${pathname}?${newParams.toString()}`);
  }, [pathname, router, searchParams]);

  const events = eventsData?.data || [];

  const renderSkeletons = () => (
    <div className="d-poster-grid">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="d-skeleton-card">
          <div className="d-skel-bar" style={{ height: 14, width: '40%', marginBottom: 10 }} />
          <div className="d-skel-bar" style={{ height: 28, width: '85%', marginBottom: 6 }} />
          <div className="d-skel-bar" style={{ height: 28, width: '60%', marginBottom: 18 }} />
          <div className="d-skel-bar" style={{ height: 160, width: '100%', marginBottom: 14 }} />
          <div className="d-skel-bar" style={{ height: 12, width: '50%' }} />
        </div>
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="d-empty-state">
      <div className="d-empty-watermark">EMPTY</div>
      <div className="d-micro d-micro-blue" style={{ marginBottom: 12 }}>
        DISCOVER // 0 RESULTS
      </div>
      <h3 className="d-empty-title">
        {isError ? 'CONNECTION\nFAILED.' : 'NO EVENTS\nFOUND.'}
      </h3>
      <p className="d-empty-sub">
        {isError
          ? 'We couldn\'t connect to the server. Check your connection and try again.'
          : 'Try a different search or clear your filters to explore more.'}
      </p>
      {isError ? (
        <button onClick={() => refetch()} className="d-retry-btn">RETRY ↗</button>
      ) : (
        <button onClick={() => { setSearchInput(''); router.push(pathname); }} className="d-clear-btn">
          CLEAR FILTERS
        </button>
      )}
    </div>
  );

  return (
    <>
      <style>{discoverStyles}</style>
      <div className="discover-page">
        <div className="discover-inner">

          {/* ── Header ── */}
          <div className="discover-header">
            <div className="d-micro d-micro-blue" style={{ marginBottom: 8 }}>
              CAMPUS ARCHIVE // LIVE EVENTS
            </div>
            <h1 className="d-hero-title">DISCOVER</h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: '#a0a4b8', marginTop: 12 }}>
              Find your next moment. Explore premium events across campus.
            </p>
          </div>

          {/* ── Search Bar ── */}
          <div style={{ marginBottom: 32 }}>
            <input
              type="text"
              className="discover-search"
              placeholder="Search events, clubs, topics..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {/* ── Category Filters ── */}
          <div className="discover-filter-row">
            {EVENT_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => handleTypeClick(type.value)}
                className={`filter-btn${queryType === type.value ? ' active' : ''}`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* ── Result Meta ── */}
          {!isLoading && events.length > 0 && (
            <div className="result-meta">
              <span className="d-micro">{events.length} RESULTS</span>
              <span className="d-micro" style={{ color: '#a0a4b8' }}>SORTED BY DATE ↓</span>
            </div>
          )}

          {/* ── Content ── */}
          {isLoading ? (
            renderSkeletons()
          ) : events.length > 0 ? (
            <div className="d-poster-grid">
              {events.map((event) => {
                const date = dayjs(event.startTime);
                const dateBadge = date.format('DD MMM • YYYY').toUpperCase();
                const typeLabel = event.eventType
                  ? event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1).toLowerCase()
                  : 'Event';
                const locationLabel = event.locationName || 'Campus';
                const bannerUrl = (event.metadata as Record<string, unknown> | null | undefined)?.banner_url as string | undefined;

                return (
                  <Link
                    key={event.id}
                    href={`/student/events/${event.id}`}
                    className="d-poster-card"
                    style={{ textDecoration: 'none' }}
                  >
                    {/* Card Header */}
                    <div className="d-poster-card-header">
                      <span className="d-date-badge">{dateBadge}</span>
                      <span className="d-type-badge">{typeLabel.toUpperCase()}</span>
                    </div>

                    {/* Title */}
                    <div className="d-poster-title">{event.title}</div>

                    {/* Image or Placeholder */}
                    {bannerUrl ? (
                      <div className="d-poster-img-frame">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bannerUrl} alt={event.title} />
                      </div>
                    ) : (
                      <div className="d-poster-img-placeholder">
                        <span className="d-poster-img-placeholder-text">
                          {event.eventType?.slice(0, 4) || 'NST'}
                        </span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="d-poster-footer">
                      <span className="d-location-text">
                        {locationLabel.length > 22 ? locationLabel.slice(0, 22) + '…' : locationLabel}
                      </span>
                      <span className="d-explore-btn">EXPLORE ↗</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            renderEmpty()
          )}

          {/* ── Load More ── */}
          {!isLoading && eventsData?.pagination?.has_more && (
            <div className="d-load-more-wrap">
              <button className="d-load-more-btn">LOAD MORE ↓</button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
