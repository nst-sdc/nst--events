'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClubs } from '../../../../../hooks/useClubs';
import { useDebounce } from '../../../../../hooks/useDebounce';

const clubsStyles = `
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

  .clubs-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .clubs-inner {
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
  .c-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .c-micro-blue { color: var(--electric-blue); }
  .c-micro-green { color: var(--acid-green); }

  /* ── Display Typography ── */
  .c-hero-title {
    font-family: var(--font-display);
    font-size: clamp(52px, 8.5vw, 120px);
    font-weight: 900;
    line-height: 0.88;
    letter-spacing: -2px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
  }

  .c-header {
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 32px;
    margin-bottom: 40px;
    position: relative;
  }

  .c-watermark {
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

  /* ── Search Bar ── */
  .c-search-bar {
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
    margin-bottom: 36px;
    border-radius: 0 !important;
  }
  .c-search-bar::placeholder {
    color: #a0a4b8;
  }

  /* ── Meta Row ── */
  .c-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(245,245,242,0.2);
    padding-bottom: 16px;
    margin-bottom: 44px;
  }

  /* ── Clubs Poster Grid ── */
  .c-poster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 40px;
  }

  .c-poster-card {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 3px solid #000000;
    padding: 20px;
    box-shadow: 10px 10px 0px #000000;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
    position: relative;
    text-decoration: none;
    border-radius: 0 !important;
  }

  .c-poster-card:hover {
    transform: translate(-4px, -4px) rotate(-0.5deg);
    box-shadow: 14px 14px 0px #000000;
  }

  .c-poster-card:nth-child(even) {
    transform: rotate(1deg);
  }

  .c-poster-card:nth-child(even):hover {
    transform: translate(-4px, -4px) rotate(0.5deg);
  }

  .c-poster-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  .c-member-badge {
    background: #000;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .c-banner-frame {
    width: 100%;
    height: 180px;
    background: #111;
    border: 2px solid #000;
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
  }

  .c-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(125%) grayscale(60%);
    transition: filter 0.3s;
  }

  .c-poster-card:hover .c-banner-img {
    filter: contrast(110%) grayscale(0%);
  }

  .c-banner-placeholder {
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

  .c-banner-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(0,87,255,0.2) 1px, transparent 1px);
    background-size: 16px 16px;
  }

  .c-banner-initials {
    font-family: var(--font-display);
    font-size: 64px;
    font-weight: 900;
    color: rgba(255,255,255,0.1);
    text-transform: uppercase;
    letter-spacing: -2px;
    z-index: 1;
    line-height: 1;
  }

  .c-poster-title {
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

  .c-poster-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: #333;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 20px;
    min-height: 38px;
  }

  .c-poster-footer {
    border-top: 2px dashed #000;
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
  }

  .c-poster-btn {
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
  }

  /* ── Empty & Error States ── */
  .c-empty-poster {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 60px 40px;
    position: relative;
    overflow: hidden;
    box-shadow: 12px 12px 0px var(--electric-blue);
    border-radius: 0 !important;
  }

  .c-empty-watermark {
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

  .c-action-btn {
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
    border-radius: 0 !important;
  }
  .c-action-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }

  /* ── Skeletons ── */
  .c-skeleton-card {
    background: var(--bg-dark-card);
    border: 3px solid rgba(255,255,255,0.15);
    padding: 20px;
    height: 380px;
    display: flex;
    flex-direction: column;
    box-shadow: 8px 8px 0px rgba(255,255,255,0.05);
    animation: cPulse 1.5s ease-in-out infinite;
  }
  @keyframes cPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.85; }
  }

  @media (max-width: 768px) {
    .clubs-inner { padding: 40px 16px 80px 16px; }
    .c-poster-grid { grid-template-columns: 1fr; }
    .c-poster-card:nth-child(even) { transform: none; }
  }

  /* ==========================================================================
     LIGHT THEME OVERRIDES (Scoped to html.light)
     ========================================================================== */
  html.light .clubs-page {
    background-color: #FFFFFF;
    color: #050505;
  }

  html.light .collage-noise-overlay {
    opacity: 0.12;
    background-image: radial-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px);
  }

  html.light .c-hero-title {
    color: #050505;
  }

  html.light .c-header {
    border-bottom: 3px solid #000000;
  }

  html.light .c-watermark {
    color: rgba(0, 0, 0, 0.04);
  }

  html.light .c-header p {
    color: #555566 !important;
  }

  html.light .c-search-bar {
    background: #FFFFFF;
    border: 3px solid #000000;
    color: #050505;
    box-shadow: 6px 6px 0px #000000;
  }

  html.light .c-search-bar::placeholder {
    color: #777788;
  }

  html.light .c-meta-row {
    border-bottom-color: rgba(0, 0, 0, 0.15);
  }

  html.light .c-empty-poster {
    background: #FFFFFF;
    border: 3px solid #000000;
    box-shadow: 12px 12px 0px var(--electric-blue);
  }

  html.light .c-empty-poster h2 {
    color: #050505 !important;
  }

  html.light .c-empty-poster p {
    color: #555566 !important;
  }

  html.light .c-empty-watermark {
    color: rgba(0, 0, 0, 0.04);
  }

  html.light .c-action-btn {
    border: 2px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .c-action-btn:hover {
    box-shadow: 6px 6px 0px #000000;
  }

  html.light .c-skeleton-card {
    background: #F5F5F2;
    border-color: rgba(0, 0, 0, 0.15);
  }
`;

export default function CampusClubsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 300);

  const { data: clubsResponse, isLoading, isError, refetch } = useClubs(debouncedSearch);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 3)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const renderLoadingState = () => (
    <div className="c-poster-grid">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="c-skeleton-card">
          <div style={{ height: '20px', background: 'rgba(255,255,255,0.1)', width: '50%', marginBottom: '14px' }} />
          <div style={{ height: '180px', background: 'rgba(255,255,255,0.08)', marginBottom: '16px' }} />
          <div style={{ height: '28px', background: 'rgba(255,255,255,0.12)', width: '80%', marginBottom: '10px' }} />
          <div style={{ height: '16px', background: 'rgba(255,255,255,0.06)', width: '100%', marginBottom: '6px' }} />
          <div style={{ height: '16px', background: 'rgba(255,255,255,0.06)', width: '70%', marginTop: 'auto' }} />
        </div>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="c-empty-poster">
      <div className="c-empty-watermark">CLUBS</div>
      <div className="c-micro c-micro-blue" style={{ marginBottom: '12px' }}>
        DIRECTORY QUERY // ZERO MATCHES
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '16px' }}>
        NO CLUBS<br />FOUND.
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.6 }}>
        Try searching with different keywords, tech stacks, or explore upcoming campus sessions.
      </p>
      {searchTerm && (
        <button onClick={() => setSearchTerm('')} className="c-action-btn">
          RESET SEARCH FILTER ↺
        </button>
      )}
    </div>
  );

  const renderErrorState = () => (
    <div className="c-empty-poster">
      <div className="c-empty-watermark">ERROR</div>
      <div className="c-micro" style={{ color: 'var(--warm-red)', marginBottom: '12px' }}>
        SYSTEM FAULT // CONNECTION INTERRUPTED
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '16px' }}>
        COULDN&apos;T LOAD<br />CAMPUS CLUBS.
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.6 }}>
        Something interrupted synchronization with the campus directory ledger.
      </p>
      <button onClick={() => refetch()} className="c-action-btn">
        RETRY CONNECTION ↺
      </button>
    </div>
  );

  return (
    <>
      <style href="student-clubs-styles" precedence="high">
        {clubsStyles}
      </style>
      <div className="collage-noise-overlay" />

      <div className="clubs-page">
        <div className="clubs-inner">

          {/* Header Section */}
          <section className="c-header">
            <div className="c-watermark">COMMUNITY</div>
            <div className="c-micro c-micro-blue" style={{ marginBottom: '8px' }}>
              CAMPUS DIRECTORY // STUDENT COLLECTIVES &amp; CHAPTERS
            </div>
            <h1 className="c-hero-title">CLUBS</h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginTop: '12px', maxWidth: '640px', lineHeight: 1.6 }}>
              Discover student developer groups, technical societies, and creative collectives shaping campus culture at NST.
            </p>
          </section>

          {/* Search Bar */}
          <section>
            <input
              type="text"
              id="clubs-search-input"
              placeholder="Search clubs by name, domain, keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="c-search-bar"
            />
          </section>

          {/* Meta Information Row */}
          <section className="c-meta-row">
            <div className="c-micro c-micro-blue">
              CLUBS DIRECTORY // {clubsResponse?.data ? `${clubsResponse.data.length} REGISTERED COMMUNITIES` : 'SEARCHING...'}
            </div>
            <div className="c-micro">
              GATEWAY // NST SDC
            </div>
          </section>

          {/* Main Content Area */}
          <div>
            {isLoading ? (
              renderLoadingState()
            ) : isError ? (
              renderErrorState()
            ) : clubsResponse?.data.length === 0 ? (
              renderEmptyState()
            ) : (
              <div className="c-poster-grid">
                {clubsResponse?.data.map((club) => {
                  return (
                    <div
                      key={club.id}
                      className="c-poster-card"
                      onClick={() => router.push(`/student/campus/clubs/${club.id}`)}
                    >
                      <div>
                        <div className="c-poster-header">
                          <span className="c-micro" style={{ color: '#000' }}>
                            CHAPTER // STUDENT ORG
                          </span>
                          <span className="c-member-badge">
                            {formatNumber(club.member_count)} MEMBERS
                          </span>
                        </div>

                        <div className="c-banner-frame">
                          {club.banner_url ? (
                            <img
                              src={club.banner_url}
                              alt={`${club.name} banner`}
                              className="c-banner-img"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="c-banner-placeholder">
                              <span className="c-banner-initials">
                                {getInitials(club.name)}
                              </span>
                              <div className="c-micro" style={{ color: 'rgba(255,255,255,0.4)', position: 'relative', zIndex: 1, marginTop: '4px' }}>
                                NST CHAPTER DOSSIER
                              </div>
                            </div>
                          )}
                        </div>

                        <h3 className="c-poster-title">
                          {club.name}
                        </h3>

                        <p className="c-poster-desc">
                          {club.description || 'No public manifesto or description provided for this campus collective.'}
                        </p>
                      </div>

                      <div className="c-poster-footer">
                        <span className="c-micro" style={{ color: '#555' }}>
                          STATUS: ACTIVE
                        </span>
                        <button className="c-poster-btn" type="button">
                          VIEW DOSSIER ↗
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
