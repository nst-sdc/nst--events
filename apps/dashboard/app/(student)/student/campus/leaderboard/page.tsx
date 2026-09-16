'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  useGlobalStudentLeaderboard, 
  useGlobalClubLeaderboard
} from '../../../../../hooks/useLeaderboard';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';

type Tab = 'students' | 'clubs';

const leaderboardStyles = `
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

  .lb-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .lb-inner {
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
  .lb-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .lb-micro-blue { color: var(--electric-blue); }
  .lb-micro-green { color: var(--acid-green); }

  /* ── Display Typography ── */
  .lb-hero-title {
    font-family: var(--font-display);
    font-size: clamp(44px, 7.2vw, 98px);
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: -2px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
    word-break: break-word;
  }

  .lb-header {
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 32px;
    margin-bottom: 40px;
    position: relative;
  }

  .lb-watermark {
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

  /* ── Tabs Row ── */
  .lb-tabs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    border-bottom: 1px solid rgba(245,245,242,0.2);
    padding-bottom: 20px;
    margin-bottom: 48px;
  }

  .lb-tabs-group {
    display: flex;
    gap: 12px;
  }

  .lb-tab-btn {
    background: transparent;
    color: #a0a4b8;
    border: 2px solid rgba(245,245,242,0.25);
    padding: 10px 24px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    cursor: pointer;
    transition: all 0.15s;
    border-radius: 0 !important;
  }
  .lb-tab-btn:hover {
    border-color: var(--bg-paper-white);
    color: var(--bg-paper-white);
  }
  .lb-tab-btn.active {
    background: var(--electric-blue);
    color: #ffffff;
    border-color: var(--electric-blue);
    box-shadow: 4px 4px 0px rgba(255,255,255,0.3);
  }

  /* ── Top 3 Podium Poster Cards ── */
  .lb-podium-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 36px;
    margin-bottom: 64px;
  }

  .lb-podium-card {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 3px solid #000000;
    padding: 24px 24px 28px 24px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 260px;
    box-shadow: 10px 10px 0px #000000;
    transition: transform 0.2s, box-shadow 0.2s;
    border-radius: 0 !important;
  }

  .lb-podium-card:hover {
    transform: translate(-3px, -3px);
    box-shadow: 14px 14px 0px #000000;
  }

  .lb-podium-card.rank-1 {
    transform: translateY(-8px);
    box-shadow: 12px 12px 0px var(--electric-blue);
    border: 3px solid #000000;
  }

  .lb-podium-card.rank-1:hover {
    transform: translateY(-12px);
    box-shadow: 16px 16px 0px var(--electric-blue);
  }

  .lb-podium-card.rank-2 {
    transform: rotate(-1deg);
  }

  .lb-podium-card.rank-3 {
    transform: rotate(1deg);
  }

  .lb-podium-tape {
    position: absolute;
    top: -12px;
    left: 28px;
    background: rgba(245, 245, 242, 0.85);
    color: #000;
    border: 1px dashed rgba(0, 0, 0, 0.4);
    padding: 2px 14px;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    transform: rotate(-3deg);
    z-index: 5;
  }

  .lb-card-watermark-rank {
    position: absolute;
    top: 8px;
    right: 16px;
    font-family: var(--font-display);
    font-size: 110px;
    font-weight: 900;
    line-height: 0.8;
    color: rgba(0, 0, 0, 0.07);
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }

  .lb-card-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }

  .lb-rank-badge {
    background: #000;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    letter-spacing: 1px;
  }

  .lb-rank-badge.rank-1-badge {
    background: var(--electric-blue);
  }

  .lb-card-content {
    position: relative;
    z-index: 1;
    margin-bottom: 20px;
  }

  .lb-card-title {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 900;
    line-height: 1.1;
    text-transform: uppercase;
    color: #000;
    letter-spacing: -0.5px;
    word-break: break-word;
  }

  .lb-you-pill {
    display: inline-block;
    background: var(--electric-blue);
    color: #fff;
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    margin-left: 8px;
    vertical-align: middle;
    letter-spacing: 1px;
  }

  .lb-card-points-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 14px;
  }

  .lb-card-points-val {
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: -1.5px;
    color: #000;
  }

  .lb-card-points-val.rank-1-pts {
    color: var(--electric-blue);
  }

  .lb-card-footer {
    border-top: 2px dashed #000;
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  /* ── Brutalist Ledger Table (Rank > 3) ── */
  .lb-ledger-container {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 28px 24px;
    box-shadow: 12px 12px 0px var(--electric-blue);
    border-radius: 0 !important;
  }

  .lb-ledger-header {
    display: grid;
    grid-template-columns: 80px 1fr 140px;
    padding: 12px 16px;
    border-bottom: 2px solid #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }

  .lb-ledger-row {
    display: grid;
    grid-template-columns: 80px 1fr 140px;
    align-items: center;
    padding: 16px 16px;
    border-bottom: 1px dashed rgba(245, 245, 242, 0.18);
    transition: all 0.15s;
  }

  .lb-ledger-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .lb-ledger-row.is-me-row {
    background: rgba(0, 87, 255, 0.12);
    border-left: 4px solid var(--electric-blue);
  }

  .lb-ledger-rank {
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 900;
    color: var(--bg-paper-white);
  }

  .lb-ledger-name {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.3px;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 16px;
  }

  .lb-ledger-points {
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 700;
    color: var(--electric-blue);
    text-align: right;
    letter-spacing: 0.5px;
  }

  /* ── Load More Button ── */
  .lb-load-more-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: var(--electric-blue);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 32px;
    border: 2px solid var(--bg-paper-white);
    cursor: pointer;
    box-shadow: 4px 4px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
    border-radius: 0 !important;
  }
  .lb-load-more-btn:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }
  .lb-load-more-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Empty State Poster ── */
  .lb-empty-poster {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 60px 40px;
    position: relative;
    overflow: hidden;
    box-shadow: 12px 12px 0px var(--electric-blue);
    border-radius: 0 !important;
  }

  .lb-empty-watermark {
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

  /* ── Pulse Skeleton ── */
  .lb-skeleton {
    animation: lbPulse 1.5s ease-in-out infinite;
  }
  @keyframes lbPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.9; }
  }

  @media (max-width: 768px) {
    .lb-inner { padding: 40px 16px 80px 16px; }
    .lb-podium-card.rank-1 { transform: none; }
    .lb-podium-card.rank-2, .lb-podium-card.rank-3 { transform: none; }
    .lb-ledger-header, .lb-ledger-row {
      grid-template-columns: 50px 1fr 90px;
      padding: 12px 8px;
    }
    .lb-ledger-name { font-size: 14px; }
    .lb-ledger-points { font-size: 14px; }
  }
`;

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('students');
  const { data: currentUser } = useCurrentUser();

  const {
    data: studentsData,
    isLoading: isStudentsLoading,
    fetchNextPage: fetchNextStudents,
    hasNextPage: hasNextStudents,
    isFetchingNextPage: isFetchingNextStudents
  } = useGlobalStudentLeaderboard();

  const {
    data: clubsData,
    isLoading: isClubsLoading,
    fetchNextPage: fetchNextClubs,
    hasNextPage: hasNextClubs,
    isFetchingNextPage: isFetchingNextClubs
  } = useGlobalClubLeaderboard();

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const padRank = (rank: number) => {
    return rank.toString().padStart(2, '0');
  };

  const students = studentsData?.pages.flatMap(p => p.data) || [];
  const top3Students = students.filter(s => s.rank <= 3);
  const restStudents = students.filter(s => s.rank > 3);

  const clubs = clubsData?.pages.flatMap(p => p.data) || [];
  const top3Clubs = clubs.filter(c => c.rank <= 3);
  const restClubs = clubs.filter(c => c.rank > 3);

  const renderLoadingState = () => (
    <div>
      <div className="lb-podium-grid">
        {[1, 2, 3].map(i => (
          <div 
            key={i} 
            className="lb-skeleton"
            style={{ 
              background: 'var(--bg-dark-card)', 
              border: '3px solid rgba(255,255,255,0.2)', 
              height: '240px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              boxShadow: '8px 8px 0px rgba(255,255,255,0.05)'
            }}
          >
            <div style={{ height: '24px', background: 'rgba(255,255,255,0.1)', width: '40%', marginBottom: '16px' }} />
            <div style={{ height: '36px', background: 'rgba(255,255,255,0.15)', width: '70%', marginBottom: '12px' }} />
            <div style={{ height: '20px', background: 'rgba(255,255,255,0.08)', width: '50%' }} />
          </div>
        ))}
      </div>
      <div className="lb-ledger-container lb-skeleton">
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '54px', borderBottom: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
            <div style={{ height: '18px', background: 'rgba(255,255,255,0.1)', width: '30%' }} />
          </div>
        ))}
      </div>
    </div>
  );

  const renderEmptyState = (label: string) => (
    <div className="lb-empty-poster">
      <div className="lb-empty-watermark">LEADERBOARD</div>
      <div className="lb-micro lb-micro-blue" style={{ marginBottom: '12px' }}>
        STATUS // NO DATA RECORDED
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '16px' }}>
        NO {label.toUpperCase()}<br />RANKED YET.
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.6 }}>
        Check back soon as event check-ins, hackathons, and campus activities synchronize merit points.
      </p>
      <Link href="/student/campus/discover" className="lb-load-more-btn" style={{ textDecoration: 'none' }}>
        EXPLORE CAMPUS EVENTS ↗
      </Link>
    </div>
  );

  return (
    <>
      <style href="student-leaderboard-styles" precedence="high">
        {leaderboardStyles}
      </style>
      <div className="collage-noise-overlay" />

      <div className="lb-page">
        <div className="lb-inner">
          
          {/* Header Section */}
          <section className="lb-header">
            <div className="lb-watermark">RANKINGS</div>
            <div className="lb-micro lb-micro-blue" style={{ marginBottom: '8px' }}>
              CAMPUS ARCHIVE // STANDINGS &amp; MERIT
            </div>
            <h1 className="lb-hero-title">LEADERBOARD</h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginTop: '12px', maxWidth: '640px', lineHeight: 1.6 }}>
              Recognizing the top student contributors and high-performing clubs across the campus ecosystem.
            </p>
          </section>

          {/* Tab Selection */}
          <section className="lb-tabs-row">
            <div className="lb-tabs-group">
              <button
                id="lb-tab-students"
                onClick={() => setActiveTab('students')}
                className={`lb-tab-btn ${activeTab === 'students' ? 'active' : ''}`}
              >
                STUDENTS
              </button>
              <button
                id="lb-tab-clubs"
                onClick={() => setActiveTab('clubs')}
                className={`lb-tab-btn ${activeTab === 'clubs' ? 'active' : ''}`}
              >
                CLUBS
              </button>
            </div>

            <div className="lb-micro">
              ACTIVE PROTOCOL // {activeTab === 'students' ? 'INDIVIDUAL MERIT' : 'ORGANIZATIONAL INDEX'}
            </div>
          </section>

          {/* STUDENTS TAB */}
          {activeTab === 'students' && (
            <div>
              {isStudentsLoading ? (
                renderLoadingState()
              ) : students.length === 0 ? (
                renderEmptyState('students')
              ) : (
                <>
                  {/* TOP 3 STUDENTS PODIUM */}
                  {top3Students.length > 0 && (
                    <section style={{ marginBottom: '48px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <span className="lb-micro lb-micro-green">PODIUM MATRIX // TOP 3 PERFORMERS</span>
                        <span className="lb-micro">VERIFIED POINTS</span>
                      </div>

                      <div className="lb-podium-grid">
                        {top3Students.map(student => {
                          const isMe = student.user_id === currentUser?.id;
                          const isFirst = student.rank === 1;
                          const rankClass = isFirst ? 'rank-1' : student.rank === 2 ? 'rank-2' : 'rank-3';

                          return (
                            <div key={student.user_id} className={`lb-podium-card ${rankClass}`}>
                              {isFirst && (
                                <div className="lb-podium-tape">
                                  ★ GOLD MERIT // #01
                                </div>
                              )}
                              
                              <div className="lb-card-watermark-rank">
                                {padRank(student.rank)}
                              </div>

                              <div className="lb-card-top-bar">
                                <span className={`lb-rank-badge ${isFirst ? 'rank-1-badge' : ''}`}>
                                  RANK #{padRank(student.rank)}
                                </span>
                                <span className="lb-micro" style={{ color: '#555' }}>
                                  STUDENT DOSSIER
                                </span>
                              </div>

                              <div className="lb-card-content">
                                <h3 className="lb-card-title">
                                  {student.display_name}
                                  {isMe && <span className="lb-you-pill">YOU</span>}
                                </h3>

                                <div className="lb-card-points-row">
                                  <span className={`lb-card-points-val ${isFirst ? 'rank-1-pts' : ''}`}>
                                    {formatNumber(student.total_points)}
                                  </span>
                                  <span className="lb-micro" style={{ color: '#000', fontWeight: 800 }}>
                                    PTS
                                  </span>
                                </div>
                              </div>

                              <div className="lb-card-footer">
                                <span className="lb-micro" style={{ color: '#222' }}>
                                  CAMPUS VERIFIED
                                </span>
                                <span className="lb-micro lb-micro-blue">
                                  {isFirst ? 'INDEX LEADER' : 'HONOR ROLL'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* REST OF STUDENTS TABLE */}
                  {restStudents.length > 0 && (
                    <section style={{ marginBottom: '40px' }}>
                      <div className="lb-ledger-container">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <span className="lb-micro lb-micro-blue">FIELD ROSTER // POSITIONS 04+</span>
                          <span className="lb-micro">{restStudents.length} ACTIVE PROFILES</span>
                        </div>

                        <div className="lb-ledger-header">
                          <div>RANK</div>
                          <div>STUDENT IDENTIFIER</div>
                          <div style={{ textAlign: 'right' }}>POINTS</div>
                        </div>

                        <div>
                          {restStudents.map(student => {
                            const isMe = student.user_id === currentUser?.id;
                            return (
                              <div 
                                key={student.user_id} 
                                className={`lb-ledger-row ${isMe ? 'is-me-row' : ''}`}
                              >
                                <div className="lb-ledger-rank">
                                  {padRank(student.rank)}
                                </div>
                                <div className="lb-ledger-name">
                                  <span>{student.display_name}</span>
                                  {isMe && <span className="lb-you-pill">YOU</span>}
                                </div>
                                <div className="lb-ledger-points">
                                  {formatNumber(student.total_points)}
                                  <span style={{ fontSize: '11px', color: '#a0a4b8', marginLeft: '4px' }}>PTS</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* LOAD MORE */}
                  {hasNextStudents && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                      <button 
                        onClick={() => fetchNextStudents()} 
                        disabled={isFetchingNextStudents}
                        className="lb-load-more-btn"
                      >
                        {isFetchingNextStudents ? 'FETCHING MATRIX...' : 'LOAD MORE STUDENTS ↗'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* CLUBS TAB */}
          {activeTab === 'clubs' && (
            <div>
              {isClubsLoading ? (
                renderLoadingState()
              ) : clubs.length === 0 ? (
                renderEmptyState('clubs')
              ) : (
                <>
                  {/* TOP 3 CLUBS PODIUM */}
                  {top3Clubs.length > 0 && (
                    <section style={{ marginBottom: '48px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <span className="lb-micro lb-micro-green">TOP COLLECTIVES // TOP 3 CLUBS</span>
                        <span className="lb-micro">ACCUMULATED POINTS</span>
                      </div>

                      <div className="lb-podium-grid">
                        {top3Clubs.map(club => {
                          const isFirst = club.rank === 1;
                          const rankClass = isFirst ? 'rank-1' : club.rank === 2 ? 'rank-2' : 'rank-3';

                          return (
                            <div key={club.club_id} className={`lb-podium-card ${rankClass}`}>
                              {isFirst && (
                                <div className="lb-podium-tape">
                                  ★ PREMIER CLUB // #01
                                </div>
                              )}

                              <div className="lb-card-watermark-rank">
                                {padRank(club.rank)}
                              </div>

                              <div className="lb-card-top-bar">
                                <span className={`lb-rank-badge ${isFirst ? 'rank-1-badge' : ''}`}>
                                  RANK #{padRank(club.rank)}
                                </span>
                                <span className="lb-micro" style={{ color: '#555' }}>
                                  ORGANIZATION
                                </span>
                              </div>

                              <div className="lb-card-content">
                                <h3 className="lb-card-title">
                                  {club.club_name}
                                </h3>

                                <div className="lb-card-points-row">
                                  <span className={`lb-card-points-val ${isFirst ? 'rank-1-pts' : ''}`}>
                                    {formatNumber(club.total_points)}
                                  </span>
                                  <span className="lb-micro" style={{ color: '#000', fontWeight: 800 }}>
                                    PTS
                                  </span>
                                </div>
                              </div>

                              <div className="lb-card-footer">
                                <span className="lb-micro" style={{ color: '#222' }}>
                                  CAMPUS AFFILIATED
                                </span>
                                <span className="lb-micro lb-micro-blue">
                                  {isFirst ? 'HIGHEST IMPACT' : 'ACTIVE CHAPTER'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* REST OF CLUBS TABLE */}
                  {restClubs.length > 0 && (
                    <section style={{ marginBottom: '40px' }}>
                      <div className="lb-ledger-container">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <span className="lb-micro lb-micro-blue">ORGANIZATION DIRECTORY // POSITIONS 04+</span>
                          <span className="lb-micro">{restClubs.length} RECORDED CLUBS</span>
                        </div>

                        <div className="lb-ledger-header">
                          <div>RANK</div>
                          <div>CLUB ORGANIZATION</div>
                          <div style={{ textAlign: 'right' }}>POINTS</div>
                        </div>

                        <div>
                          {restClubs.map(club => {
                            return (
                              <div key={club.club_id} className="lb-ledger-row">
                                <div className="lb-ledger-rank">
                                  {padRank(club.rank)}
                                </div>
                                <div className="lb-ledger-name">
                                  <span>{club.club_name}</span>
                                </div>
                                <div className="lb-ledger-points">
                                  {formatNumber(club.total_points)}
                                  <span style={{ fontSize: '11px', color: '#a0a4b8', marginLeft: '4px' }}>PTS</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* LOAD MORE CLUBS */}
                  {hasNextClubs && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                      <button 
                        onClick={() => fetchNextClubs()} 
                        disabled={isFetchingNextClubs}
                        className="lb-load-more-btn"
                      >
                        {isFetchingNextClubs ? 'FETCHING MATRIX...' : 'LOAD MORE CLUBS ↗'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
