import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import {
  studentsApi,
  StudentDirectoryResponse,
  PublicStudentCard,
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
    gap: 32px;
  }

  .dir-student-card {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 3px solid #000000;
    padding: 24px;
    box-shadow: 8px 8px 0px #000000;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    text-decoration: none;
  }
  .dir-student-card:hover {
    transform: translate3d(-4px, -4px, 0);
    box-shadow: 12px 12px 0px #000000;
  }

  .dir-card-header {
    display: flex;
    gap: 16px;
    align-items: center;
    border-bottom: 2px solid #000000;
    padding-bottom: 16px;
    margin-bottom: 16px;
  }

  .dir-avatar {
    width: 56px;
    height: 56px;
    border: 2px solid #000000;
    background: var(--electric-blue);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 900;
    overflow: hidden;
    flex-shrink: 0;
  }

  .dir-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .dir-student-name {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    line-height: 1.1;
    color: #000000;
  }

  .dir-student-handle {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    color: #0057FF;
    margin-top: 2px;
  }

  .dir-academic-badge {
    background: #000000;
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-block;
    margin-top: 6px;
  }

  .dir-student-bio {
    font-size: 13px;
    line-height: 1.5;
    color: #4a4a4a;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .dir-skills-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 20px;
  }

  .dir-skill-chip {
    background: rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.2);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    color: #111111;
  }

  .dir-card-footer {
    border-top: 2px solid #000000;
    padding-top: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dir-stats-group {
    display: flex;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
  }

  .dir-stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dir-dossier-btn {
    background: #000000;
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 6px 14px;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }
  .dir-student-card:hover .dir-dossier-btn {
    background: var(--electric-blue);
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
`;

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

  const { items, pagination, facets } = directoryData;

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
                  {facets.programs && facets.programs.length > 0 && (
                    <select name="program" defaultValue={program} className="dir-filter-select">
                      <option value="">All Programs</option>
                      {facets.programs.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  )}
                  {facets.batches && facets.batches.length > 0 && (
                    <select name="batch" defaultValue={batch} className="dir-filter-select">
                      <option value="">All Batches</option>
                      {facets.batches.map((b) => (
                        <option key={b} value={b}>
                          Batch {b}
                        </option>
                      ))}
                    </select>
                  )}
                  {facets.skills && facets.skills.length > 0 && (
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
                  const initials = student.fullName
                    ? student.fullName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : student.slug.slice(0, 2).toUpperCase();

                  return (
                    <Link
                      key={student.id}
                      href={`/students/${student.slug}`}
                      className="dir-student-card"
                    >
                      <div>
                        <div className="dir-card-header">
                          <div className="dir-avatar">
                            {student.avatarUrl ? (
                              <img src={student.avatarUrl} alt={student.fullName} />
                            ) : (
                              initials
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="dir-student-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {student.fullName}
                            </div>
                            <div className="dir-student-handle">@{student.slug}</div>
                            {(student.program || student.batch) && (
                              <div className="dir-academic-badge">
                                {[student.program, student.batch ? `Batch ${student.batch}` : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>

                        {student.headline && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#0057FF', marginBottom: '8px' }}>
                            {student.headline}
                          </div>
                        )}

                        {student.bio && <p className="dir-student-bio">{student.bio}</p>}

                        {student.skills && student.skills.length > 0 && (
                          <div className="dir-skills-container">
                            {student.skills.slice(0, 4).map((sk: string) => (
                              <span key={sk} className="dir-skill-chip">
                                #{sk}
                              </span>
                            ))}
                            {student.skills.length > 4 && (
                              <span className="dir-skill-chip" style={{ opacity: 0.6 }}>
                                +{student.skills.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="dir-card-footer">
                        <div className="dir-stats-group">
                          {student.projectsCount > 0 && (
                            <span className="dir-stat-item" title="Selected Projects">
                              ⚡ {student.projectsCount} {student.projectsCount === 1 ? 'Project' : 'Projects'}
                            </span>
                          )}
                          {student.achievementsCount > 0 && (
                            <span className="dir-stat-item" title="Official Honors">
                              🏆 {student.achievementsCount} {student.achievementsCount === 1 ? 'Award' : 'Awards'}
                            </span>
                          )}
                        </div>
                        <span className="dir-dossier-btn">DOSSIER ↗</span>
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
