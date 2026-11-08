import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import {
  studentsApi,
  StudentDirectoryResponse,
  PublicStudentCard,
  PublicStudentProfile,
} from '../../../lib/students-api';
import { StudentAppShell } from '../../../components/layout/StudentAppShell';
import { ClubAdminProvider } from '../../../components/layout/ClubAdminProvider';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    program?: string;
    batch?: string;
    skill?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  const filterStr = params.skill ? ` Skilled in ${params.skill}` : params.program ? ` in ${params.program}` : '';

  return {
    title: `Student Directory — Newton School of Technology${filterStr}`,
    description:
      'Explore verified student portfolios, technical skills, projects, and official event achievements from Newton School of Technology.',
    alternates: {
      canonical: `${siteUrl}/students`,
    },
    openGraph: {
      title: 'NST Student Directory — Portfolios & Campus Talent',
      description: 'Discover software engineers, researchers, and campus innovators from NST.',
      url: `${siteUrl}/students`,
      siteName: 'NST Events',
      type: 'website',
      images: [
        {
          url: `${siteUrl}/icon.png`,
          width: 512,
          height: 512,
          alt: 'NST Student Directory',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'NST Student Directory — Newton School of Technology',
      description: 'Browse verified student engineering portfolios, competition honors, and tech projects.',
    },
  };
}

const directoryStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --warm-amber: #FF9500;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .dir-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .dir-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: 60px 32px 100px 32px;
  }

  .collage-noise-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.35;
    background-image: radial-gradient(rgba(245, 245, 242, 0.08) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .dir-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .dir-micro-blue { color: var(--electric-blue); }
  .dir-micro-green { color: var(--acid-green); }

  .dir-hero-title {
    font-family: var(--font-display);
    font-size: clamp(52px, 8.5vw, 110px);
    font-weight: 900;
    line-height: 0.88;
    letter-spacing: -2px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
  }

  .dir-header {
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 32px;
    margin-bottom: 40px;
    position: relative;
  }

  .dir-watermark {
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

  /* Filter bar */
  .dir-filter-bar {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.2);
    padding: 24px;
    margin-bottom: 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .dir-search-input {
    background: #050505;
    border: 2px solid rgba(245, 245, 242, 0.3);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 14px;
    padding: 12px 18px;
    outline: none;
    width: 100%;
    transition: border-color 0.15s;
  }
  .dir-search-input:focus {
    border-color: var(--electric-blue);
  }

  .dir-filter-select {
    background: #050505;
    border: 2px solid rgba(245, 245, 242, 0.3);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 10px 14px;
    outline: none;
    cursor: pointer;
  }
  .dir-filter-select:focus {
    border-color: var(--electric-blue);
  }

  /* Grid of cards */
  .dir-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 28px;
  }

  .dir-student-card {
    background: #0d0e12;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    text-decoration: none;
    border-radius: 0 !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    overflow: hidden;
  }
  .dir-student-card:hover {
    border-color: #0057FF;
    box-shadow: 0 0 24px -4px rgba(0, 87, 255, 0.35);
    transform: translateY(-2px);
  }
  .dir-student-card::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
    transition: background 0.2s ease;
  }
  .dir-student-card:hover::after {
    background: #0057FF;
  }

  /* Top Row: Club & Designation */
  .dir-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 10px;
    margin-bottom: 14px;
    gap: 8px;
  }

  .dir-card-club {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: #a0a4b8;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }
  .dir-card-club-diamond {
    color: #0057FF;
    font-size: 10px;
    flex-shrink: 0;
  }

  .dir-card-role-badge {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 8px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    flex-shrink: 0;
    border-radius: 0 !important;
  }
  .dir-role-admin {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #f59e0b;
  }
  .dir-role-core {
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.4);
    color: #38bdf8;
  }
  .dir-role-member {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
  }
  .dir-role-scholar {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #a0a4b8;
  }

  /* Identity Row */
  .dir-card-identity {
    display: flex;
    gap: 14px;
    align-items: center;
    margin-bottom: 12px;
  }

  .dir-avatar {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #0038A8 0%, #0057FF 100%);
    border: 1px solid rgba(0, 87, 255, 0.6);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 900;
    overflow: visible;
    flex-shrink: 0;
    position: relative;
    border-radius: 0 !important;
    box-shadow: 2px 2px 0px #000000;
  }

  .dir-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .dir-student-name {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 900;
    line-height: 1.2;
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: -0.3px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .dir-student-handle {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    color: #0057FF;
    margin-top: 2px;
  }

  /* Intro sentence - clamped strictly to 1 line */
  .dir-student-intro {
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.45;
    color: #cbd5e1;
    margin-bottom: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Skills Chips */
  .dir-skills-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
    align-items: center;
  }

  .dir-skill-chip {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    color: #e2e8f0;
    border-radius: 0 !important;
  }

  /* Card Footer */
  .dir-card-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
  }

  .dir-stats-group {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
  }

  .dir-stat-projects {
    color: #f59e0b;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .dir-stat-awards {
    color: #38bdf8;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .dir-stat-awards-zero {
    color: #64748b;
  }

  .dir-dossier-btn {
    color: #0057FF;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: color 0.15s, transform 0.15s;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .dir-student-card:hover .dir-dossier-btn {
    color: #ffffff;
    transform: translateX(2px);
  }

  /* Pagination */
  .dir-pagination {
    margin-top: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .dir-page-btn {
    background: transparent;
    color: #ffffff;
    border: 2px solid rgba(245, 245, 242, 0.3);
    padding: 8px 18px;
    text-decoration: none;
    font-weight: 700;
    transition: all 0.15s;
  }
  .dir-page-btn:hover {
    border-color: var(--electric-blue);
    background: var(--electric-blue);
  }

  @media (max-width: 768px) {
    .dir-inner { padding: 40px 16px 80px 16px; }
    .dir-grid { grid-template-columns: 1fr; }
  }

  /* ==========================================================================
     LIGHT THEME OVERRIDES (Scoped to html.light)
     ========================================================================== */
  html.light .dir-page {
    background-color: #F8F9FA;
    color: #0A0D14;
  }

  html.light .collage-noise-overlay {
    opacity: 0.15;
    background-image: radial-gradient(rgba(10, 13, 20, 0.12) 1px, transparent 1px);
  }

  html.light .dir-micro {
    color: #475467;
  }

  html.light .dir-hero-title {
    color: #0A0D14;
  }

  html.light .dir-header {
    border-bottom: 3px solid #000000;
  }

  html.light .dir-watermark {
    color: rgba(0, 0, 0, 0.03);
  }

  html.light .dir-filter-bar {
    background: #FFFFFF;
    border: 2px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .dir-search-input {
    background: #F8F9FA;
    border: 2px solid rgba(0, 0, 0, 0.2);
    color: #0A0D14;
  }

  html.light .dir-search-input:focus {
    border-color: #000000;
  }

  html.light .dir-filter-select {
    background: #F8F9FA;
    border: 2px solid rgba(0, 0, 0, 0.2);
    color: #0A0D14;
  }

  html.light .dir-filter-select:focus {
    border-color: #000000;
  }

  html.light .dir-page-btn {
    color: #0A0D14;
    border: 2px solid #000000;
  }

  html.light .dir-page-btn:hover {
    background: var(--electric-blue);
    color: #ffffff;
    border-color: #000000;
  }
`;

const ROLE_PRIORITY: Record<string, number> = {
  CLUB_ADMIN: 4,
  CORE_MEMBER: 3,
  MEMBER: 2,
  FACULTY_MENTOR: 1,
};

function getStudentClubMeta(profile: PublicStudentProfile | undefined): { clubName: string; role: string } {
  if (profile?.clubs && profile.clubs.length > 0) {
    const sorted = [...profile.clubs].sort((a, b) => {
      const pA = ROLE_PRIORITY[a.role] || 0;
      const pB = ROLE_PRIORITY[b.role] || 0;
      return pB - pA;
    });
    const primary = sorted[0];
    return {
      clubName: (primary.club_name || primary.clubName || 'CAMPUS CLUB').toUpperCase(),
      role: primary.role || 'MEMBER',
    };
  }

  return {
    clubName: 'NEWTON SCHOOL OF TECHNOLOGY',
    role: 'STUDENT',
  };
}

function getRoleBadgeClass(role: string): string {
  if (role === 'CLUB_ADMIN') return 'dir-role-admin';
  if (role === 'CORE_MEMBER') return 'dir-role-core';
  if (role === 'MEMBER') return 'dir-role-member';
  return 'dir-role-scholar';
}

export default async function StudentDirectoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || '';
  const program = params.program || '';
  const batch = params.batch || '';
  const skill = params.skill || '';
  const page = Number(params.page) || 1;
  const limit = 12;

  let directoryData: StudentDirectoryResponse = {
    items: [],
    pagination: { total: 0, page: 1, limit: 12, totalPages: 1 },
    facets: { programs: [], batches: [], skills: [] },
  };

  try {
    directoryData = await studentsApi.getDirectory({
      search,
      program,
      batch,
      skill,
      page,
      limit,
    });
  } catch (err) {
    console.error('Failed to load student directory:', err);
  }

  const items = directoryData?.items ?? [];
  const pagination = directoryData?.pagination ?? { total: 0, page: 1, limit: 12, totalPages: 1 };
  const facets = directoryData?.facets ?? { programs: [], batches: [], skills: [] };

  // Fetch individual student public profiles in parallel to resolve real club affiliations, projects, and bios dynamically without hardcoding
  const profileResults = await Promise.allSettled(
    items.map((item) => studentsApi.getPublicProfile(item.slug))
  );

  const profileMap = new Map<string, PublicStudentProfile>();
  profileResults.forEach((res) => {
    if (res.status === 'fulfilled' && res.value?.slug) {
      profileMap.set(res.value.slug, res.value);
    }
  });

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <style href="nst-student-directory-styles" precedence="high">
          {directoryStyles}
        </style>
        <div className="collage-noise-overlay" />

        <div className="dir-page">
          <div className="dir-inner">
            {/* Header */}
            <section className="dir-header">
              <div className="dir-watermark">STUDENTS</div>
              <div className="dir-micro dir-micro-blue" style={{ marginBottom: '8px' }}>
                NST STUDENTS // VERIFIED TALENT & PORTFOLIOS
              </div>
              <h1 className="dir-hero-title">STUDENT DIRECTORY</h1>
              <p style={{ fontSize: '16px', color: '#a0a4b8', marginTop: '16px', maxWidth: '640px', lineHeight: 1.6 }}>
                Discover verified engineers, creators, researchers, and campus club leaders from Newton School of Technology. Browse public portfolios, published software, and official competition recognition.
              </p>
              <div style={{ marginTop: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <Link href="/projects" className="dir-micro dir-micro-blue hover:underline">
                  [ EXPLORE NST PROJECTS ↗ ]
                </Link>
                <Link href="/my/profile" className="dir-micro dir-micro-green hover:underline">
                  [ MANAGE MY PROFILE & VISIBILITY ⚙ ]
                </Link>
              </div>
            </section>

            {/* Filter & Search Bar */}
            <form method="GET" action="/students" className="dir-filter-bar">
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 280px' }}>
                  <input
                    type="text"
                    name="search"
                    defaultValue={search}
                    placeholder="Search by name, handle (@slug), or headline..."
                    className="dir-search-input"
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {facets?.programs && facets.programs.length > 0 && (
                    <select name="program" defaultValue={program} className="dir-filter-select">
                      <option value="">All Programs</option>
                      {facets.programs.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  )}
                  {facets?.batches && facets.batches.length > 0 && (
                    <select name="batch" defaultValue={batch} className="dir-filter-select">
                      <option value="">All Batches</option>
                      {facets.batches.map((b) => (
                        <option key={b} value={b}>
                          Batch {b}
                        </option>
                      ))}
                    </select>
                  )}
                  {facets?.skills && facets.skills.length > 0 && (
                    <select name="skill" defaultValue={skill} className="dir-filter-select">
                      <option value="">All Skills</option>
                      {facets.skills.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="submit" className="dir-dossier-btn" style={{ padding: '0 20px', height: '42px' }}>
                    FILTER ⌕
                  </button>
                </div>
              </div>
            </form>

            {/* Filter summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(245,245,242,0.15)', paddingBottom: '16px', marginBottom: '32px' }}>
              <div className="dir-micro">
                SHOWING <span style={{ color: '#ffffff', fontWeight: 900 }}>{items.length}</span> OF <span style={{ color: '#ffffff', fontWeight: 900 }}>{pagination.total}</span> VERIFIED STUDENTS
                {search && <span> {'//'} QUERY &ldquo;<strong style={{ color: '#ffffff' }}>{search.toUpperCase()}</strong>&rdquo;</span>}
                {program && <span> {'//'} PROGRAM <strong style={{ color: '#0057FF' }}>{program.toUpperCase()}</strong></span>}
                {batch && <span> {'//'} BATCH <strong style={{ color: '#0057FF' }}>{batch}</strong></span>}
                {skill && <span> {'//'} SKILL <strong style={{ color: '#C8FF00' }}>#{skill.toUpperCase()}</strong></span>}
              </div>
              {(search || program || batch || skill) && (
                <Link href="/students" className="dir-micro dir-micro-blue hover:underline">
                  [ CLEAR ALL FILTERS ↺ ]
                </Link>
              )}
            </div>

            {/* Cards Grid */}
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', border: '2px dashed rgba(245,245,242,0.2)' }}>
                <div className="dir-micro dir-micro-blue" style={{ marginBottom: '12px' }}>
                  ZERO MATCHES FOUND
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#ffffff', marginBottom: '16px' }}>
                  No students matched your search criteria
                </h3>
                <p style={{ color: '#a0a4b8', fontSize: '14px', maxWidth: '440px', margin: '0 auto 24px auto' }}>
                  Try adjusting your filters, clearing your search query, or checking back as more students make their portfolios public.
                </p>
                <Link href="/students" className="dir-page-btn">
                  RESET FILTERS
                </Link>
              </div>
            ) : (
              <div className="dir-grid">
                {items.map((student: PublicStudentCard) => {
                  const profile = profileMap.get(student.slug);
                  const clubMeta = getStudentClubMeta(profile);
                  const initials = student.fullName
                    ? student.fullName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : student.slug.slice(0, 2).toUpperCase();

                  const intro =
                    profile?.headline?.trim() ||
                    student.headline?.trim() ||
                    profile?.bio?.trim() ||
                    student.bio?.trim() ||
                    null;

                  const skills =
                    profile?.skills && profile.skills.length > 0
                      ? profile.skills
                      : student.skills || [];

                  const projectsCount =
                    profile?.projects !== undefined
                      ? profile.projects.length
                      : student.projectsCount;

                  const achievementsCount =
                    profile?.achievements !== undefined
                      ? profile.achievements.length
                      : student.achievementsCount;

                  return (
                    <Link
                      key={student.id}
                      href={`/students/${student.slug}`}
                      className="dir-student-card"
                    >
                      {/* Top Row: Club Name (Left) & Designation (Right) */}
                      <div className="dir-card-top">
                        <div className="dir-card-club" title={clubMeta.clubName}>
                          <span className="dir-card-club-diamond">◆</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {clubMeta.clubName}
                          </span>
                        </div>
                        <span className={`dir-card-role-badge ${getRoleBadgeClass(clubMeta.role)}`}>
                          [{clubMeta.role}]
                        </span>
                      </div>

                      {/* Identity Row: Avatar + Name + Slug */}
                      <div className="dir-card-identity">
                        <div className="dir-avatar">
                          {student.avatarUrl ? (
                            <img src={student.avatarUrl} alt={student.fullName} />
                          ) : (
                            initials
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="dir-student-name" title={student.fullName}>
                            {student.fullName}
                          </div>
                          <div className="dir-student-handle">@{student.slug}</div>
                        </div>
                      </div>

                      {/* One-Sentence Intro (Strictly 1 Line, only when provided) */}
                      {intro && (
                        <div className="dir-student-intro" title={intro}>
                          {intro}
                        </div>
                      )}

                      {/* Skills Chips */}
                      {skills && skills.length > 0 ? (
                        <div className="dir-skills-container">
                          {skills.slice(0, 4).map((sk: string) => (
                            <span key={sk} className="dir-skill-chip">
                              #{sk}
                            </span>
                          ))}
                          {skills.length > 4 && (
                            <span className="dir-skill-chip" style={{ opacity: 0.6 }}>
                              +{skills.length - 4}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="dir-skills-container">
                          <span className="dir-skill-chip" style={{ opacity: 0.6 }}>
                            #Developer
                          </span>
                          <span className="dir-skill-chip" style={{ opacity: 0.6 }}>
                            #Engineering
                          </span>
                        </div>
                      )}

                      {/* Footer: Projects / Awards Metrics & Dossier Link */}
                      <div className="dir-card-footer">
                        <div className="dir-stats-group">
                          <span className="dir-stat-projects">
                            ⚡ {projectsCount} {projectsCount === 1 ? 'PROJECT' : 'PROJECTS'}
                          </span>
                          <span style={{ color: '#475467' }}>·</span>
                          <span className={achievementsCount > 0 ? 'dir-stat-awards' : 'dir-stat-awards-zero'}>
                            🏆 {achievementsCount} {achievementsCount === 1 ? 'AWARD' : 'AWARDS'}
                          </span>
                        </div>
                        <span className="dir-dossier-btn">
                          DOSSIER ↗
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="dir-pagination">
                {page > 1 ? (
                  <Link
                    href={`/students?${new URLSearchParams({
                      ...(search && { search }),
                      ...(program && { program }),
                      ...(batch && { batch }),
                      ...(skill && { skill }),
                      page: String(page - 1),
                    }).toString()}`}
                    className="dir-page-btn"
                  >
                    ← PREVIOUS
                  </Link>
                ) : (
                  <span className="dir-page-btn" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                    ← PREVIOUS
                  </span>
                )}
                <span>
                  PAGE <strong>{page}</strong> OF <strong>{pagination.totalPages}</strong>
                </span>
                {page < pagination.totalPages ? (
                  <Link
                    href={`/students?${new URLSearchParams({
                      ...(search && { search }),
                      ...(program && { program }),
                      ...(batch && { batch }),
                      ...(skill && { skill }),
                      page: String(page + 1),
                    }).toString()}`}
                    className="dir-page-btn"
                  >
                    NEXT →
                  </Link>
                ) : (
                  <span className="dir-page-btn" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                    NEXT →
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
