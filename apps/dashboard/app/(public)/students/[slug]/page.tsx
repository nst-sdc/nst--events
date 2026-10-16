import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { studentsApi, PublicStudentProfile } from '../../../../lib/students-api';
import { StudentAppShell } from '../../../../components/layout/StudentAppShell';
import { ClubAdminProvider } from '../../../../components/layout/ClubAdminProvider';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';

  try {
    const student = await studentsApi.getPublicProfile(slug);
    if (student.redirect && student.canonical_slug) {
      return {
        title: `Redirecting to @${student.canonical_slug}`,
      };
    }

    const displayName = student.fullName || `@${student.slug}`;
    const title = `${displayName} — NST Student Portfolio`;
    const description =
      student.bio ||
      student.headline ||
      `Explore ${displayName}'s verified projects, technical skills, and official event honors at Newton School of Technology.`;

    return {
      title,
      description,
      alternates: {
        canonical: `${siteUrl}/students/${student.slug}`,
      },
      robots: student.isMinimal
        ? { index: false, follow: true }
        : { index: true, follow: true },
      openGraph: {
        title,
        description,
        url: `${siteUrl}/students/${student.slug}`,
        siteName: 'NST Events & Portfolios',
        type: 'profile',
        images: student.avatarUrl
          ? [{ url: student.avatarUrl, alt: displayName }]
          : [{ url: `${siteUrl}/icon.png`, width: 512, height: 512, alt: displayName }],
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    };
  } catch {
    return {
      title: 'Student Profile — NST Events',
    };
  }
}

const profileDetailStyles = `
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

  .sd-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .sd-inner {
    max-width: 1140px;
    margin: 0 auto;
    padding: 60px 24px 120px 24px;
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

  .sd-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .sd-micro-blue { color: var(--electric-blue); }
  .sd-micro-green { color: var(--acid-green); }
  .sd-micro-amber { color: var(--warm-amber); }

  /* Header dossier */
  .sd-dossier-card {
    background: #0d0e12;
    border: 3px solid var(--bg-paper-white);
    box-shadow: 10px 10px 0px var(--electric-blue);
    padding: 40px;
    margin-bottom: 40px;
    position: relative;
  }

  .sd-dossier-header {
    display: flex;
    gap: 28px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .sd-avatar {
    width: 100px;
    height: 100px;
    border: 3px solid var(--bg-paper-white);
    background: var(--electric-blue);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 38px;
    font-weight: 900;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 4px 4px 0px #000000;
  }

  .sd-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sd-title {
    font-family: var(--font-display);
    font-size: clamp(36px, 5vw, 64px);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -1.5px;
    text-transform: uppercase;
    color: #ffffff;
  }

  .sd-handle-pill {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 700;
    color: var(--electric-blue);
    display: inline-block;
    margin-top: 6px;
  }

  .sd-badge-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  .sd-verified-badge {
    background: #000000;
    border: 1px solid var(--electric-blue);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
  }

  .sd-headline {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--acid-green);
    margin-top: 20px;
    line-height: 1.4;
  }

  .sd-bio {
    font-size: 15px;
    line-height: 1.6;
    color: #d1d5db;
    margin-top: 14px;
    max-width: 800px;
    white-space: pre-line;
  }

  .sd-links-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(245, 245, 242, 0.15);
  }

  .sd-link-btn {
    background: #050505;
    border: 2px solid rgba(245, 245, 242, 0.3);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 8px 16px;
    text-decoration: none;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .sd-link-btn:hover {
    border-color: var(--electric-blue);
    background: var(--electric-blue);
  }

  /* Section cards */
  .sd-section-card {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.2);
    padding: 32px;
    margin-bottom: 32px;
  }

  .sd-section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 2px solid rgba(245, 245, 242, 0.2);
    padding-bottom: 12px;
    margin-bottom: 24px;
  }

  .sd-section-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.5px;
  }

  /* Project Grid */
  .sd-project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px;
  }

  .sd-project-card {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 2px solid #000000;
    box-shadow: 6px 6px 0px #000000;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-decoration: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .sd-project-card:hover {
    transform: translate(-3px, -3px);
    box-shadow: 9px 9px 0px #000000;
  }

  /* Achievement row */
  .sd-achievement-item {
    border-left: 4px solid var(--warm-amber);
    background: rgba(255, 149, 0, 0.05);
    padding: 16px 20px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .sd-placement-badge {
    background: var(--warm-amber);
    color: #000000;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 900;
    padding: 4px 10px;
    text-transform: uppercase;
  }

  /* Minimal Profile Box */
  .sd-minimal-box {
    border: 2px dashed rgba(245, 245, 242, 0.25);
    padding: 40px;
    text-align: center;
    background: rgba(255, 255, 255, 0.01);
  }

  @media (max-width: 768px) {
    .sd-inner { padding: 40px 16px 80px 16px; }
    .sd-dossier-card { padding: 24px; }
    .sd-section-card { padding: 20px; }
    .sd-project-grid { grid-template-columns: 1fr; }
  }
`;

export default async function StudentProfilePage({ params }: PageProps) {
  const { slug } = await params;

  let student: PublicStudentProfile;
  try {
    student = await studentsApi.getPublicProfile(slug);
  } catch {
    notFound();
  }

  // Handle canonical historical slug redirects
  if (student.redirect && student.canonical_slug) {
    redirect(`/students/${student.canonical_slug}`);
  }

  const displayName = student.fullName || `@${student.slug}`;
  const initials = (student.fullName
    ? student.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
    : student.slug
  ).slice(0, 2).toUpperCase();

  // Structured JSON-LD representation (Person)
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: displayName,
    identifier: student.slug,
    url: `${siteUrl}/students/${student.slug}`,
    ...(student.headline && { jobTitle: student.headline }),
    ...(student.bio && { description: student.bio }),
    ...(student.avatarUrl && { image: student.avatarUrl }),
    ...(student.externalLinks && {
      sameAs: Object.values(student.externalLinks).filter(Boolean),
    }),
  };

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <style href="nst-student-detail-styles" precedence="high">
          {profileDetailStyles}
        </style>
        <div className="collage-noise-overlay" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="sd-page">
          <div className="sd-inner">
            {/* Breadcrumb Navigation */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link href="/students" className="sd-micro sd-micro-blue hover:underline">
                ← BACK TO STUDENT DIRECTORY
              </Link>
              <div className="sd-micro">
                NST DOSSIER // <span style={{ color: '#ffffff' }}>@{student.slug}</span>
              </div>
            </div>

            {/* Dossier Header Card */}
            <section className="sd-dossier-card">
              <div className="sd-dossier-header">
                <div className="sd-avatar">
                  {student.avatarUrl ? (
                    <img src={student.avatarUrl} alt={displayName} />
                  ) : (
                    initials
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sd-micro sd-micro-blue" style={{ marginBottom: '4px' }}>
                    VERIFIED STUDENT PROFILE
                  </div>
                  <h1 className="sd-title">{displayName}</h1>
                  <div className="sd-handle-pill">@{student.slug}</div>

                  {/* Institutional Badges */}
                  <div className="sd-badge-row">
                    {student.program && (
                      <span className="sd-verified-badge">
                        🎓 {student.program}
                      </span>
                    )}
                    {student.batch && (
                      <span className="sd-verified-badge">
                        📅 Batch {student.batch}
                      </span>
                    )}
                    {student.campus && (
                      <span className="sd-verified-badge">
                        🏛 {student.campus}
                      </span>
                    )}
                  </div>

                  {/* Headline */}
                  {student.headline && (
                    <div className="sd-headline">{student.headline}</div>
                  )}

                  {/* Biography */}
                  {student.bio && <p className="sd-bio">{student.bio}</p>}

                  {/* External Links */}
                  {student.externalLinks && Object.values(student.externalLinks).some(Boolean) && (
                    <div className="sd-links-row">
                      {student.externalLinks.github && (
                        <a
                          href={student.externalLinks.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sd-link-btn"
                        >
                          GITHUB ↗
                        </a>
                      )}
                      {student.externalLinks.linkedin && (
                        <a
                          href={student.externalLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sd-link-btn"
                        >
                          LINKEDIN ↗
                        </a>
                      )}
                      {student.externalLinks.portfolio && (
                        <a
                          href={student.externalLinks.portfolio}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sd-link-btn"
                        >
                          PORTFOLIO ↗
                        </a>
                      )}
                      {student.externalLinks.other && (
                        <a
                          href={student.externalLinks.other}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sd-link-btn"
                        >
                          WEBSITE ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Skills & Interests Section */}
            {student.skills && student.skills.length > 0 && (
              <section className="sd-section-card">
                <div className="sd-section-header">
                  <h2 className="sd-section-title">SKILLS & SPECIALIZATIONS</h2>
                  <span className="sd-micro sd-micro-blue">{student.skills.length} TAGS</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {student.skills.map((skill) => (
                    <span
                      key={skill}
                      style={{
                        background: '#050505',
                        border: '1px solid rgba(245, 245, 242, 0.3)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        padding: '6px 12px',
                        color: '#C8FF00',
                      }}
                    >
                      #{skill}
                    </span>
                  ))}
                </div>

                {student.interests && student.interests.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <div className="sd-micro" style={{ marginBottom: '8px' }}>
                      RESEARCH & TECHNICAL INTERESTS:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {student.interests.map((interest) => (
                        <span
                          key={interest}
                          style={{
                            background: '#050505',
                            border: '1px dashed rgba(245, 245, 242, 0.2)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            padding: '4px 10px',
                            color: '#a0a4b8',
                          }}
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Selected Projects Section */}
            {student.projects && student.projects.length > 0 && (
              <section className="sd-section-card">
                <div className="sd-section-header">
                  <h2 className="sd-section-title">SELECTED NST PROJECTS</h2>
                  <span className="sd-micro sd-micro-blue">{student.projects.length} PROJECTS</span>
                </div>
                <div className="sd-project-grid">
                  {student.projects.map((proj) => (
                    <Link
                      key={proj.id}
                      href={`/projects/${proj.slug}`}
                      className="sd-project-card"
                    >
                      <div>
                        {proj.cover_image_url && (
                          <div style={{ height: '140px', background: '#000000', marginBottom: '14px', overflow: 'hidden' }}>
                            <img
                              src={proj.cover_image_url}
                              alt={proj.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, background: '#000', color: '#fff', padding: '2px 6px' }}>
                            {proj.category}
                          </span>
                          {proj.featured && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, background: '#FF9500', color: '#000', padding: '2px 6px' }}>
                              ★ PINNED
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, color: '#000000', lineHeight: 1.2 }}>
                          {proj.title}
                        </h3>
                        <p style={{ fontSize: '13px', color: '#444444', marginTop: '6px', lineHeight: 1.4 }}>
                          {proj.tagline}
                        </p>
                      </div>

                      <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#0057FF', fontWeight: 700 }}>
                          {proj.role} {proj.is_owner ? '(Lead)' : ''}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>
                          VIEW PROJECT ↗
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Official Honors & Achievements */}
            {student.achievements && student.achievements.length > 0 && (
              <section className="sd-section-card">
                <div className="sd-section-header">
                  <h2 className="sd-section-title">OFFICIAL EVENT HONORS</h2>
                  <span className="sd-micro sd-micro-amber">AUTHORITATIVE LEDGER</span>
                </div>
                <div>
                  {student.achievements.map((ach) => (
                    <div key={ach.id} className="sd-achievement-item">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="sd-placement-badge">
                            {ach.placement ? `${ach.placement.toUpperCase()} PLACE` : 'AWARD'}
                          </span>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                            {ach.award_name}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#a0a4b8' }}>
                          Event:{' '}
                          <Link
                            href={`/event/${ach.event.slug}/results`}
                            className="sd-micro-blue hover:underline"
                          >
                            {ach.event.title} ↗
                          </Link>{' '}
                          · {new Date(ach.awarded_at).toLocaleDateString()}
                        </div>
                      </div>
                      {ach.certificate_url && (
                        <a
                          href={ach.certificate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sd-link-btn"
                          style={{ padding: '6px 12px', fontSize: '10px' }}
                        >
                          VERIFIED CREDENTIAL ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Clubs & Leadership */}
            {student.clubs && student.clubs.length > 0 && (
              <section className="sd-section-card">
                <div className="sd-section-header">
                  <h2 className="sd-section-title">CLUBS & CAMPUS LEADERSHIP</h2>
                  <span className="sd-micro sd-micro-green">VERIFIED ROLES</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {student.clubs.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: '#050505',
                        border: '2px solid rgba(245, 245, 242, 0.2)',
                        padding: '16px',
                      }}
                    >
                      <div className="sd-micro sd-micro-green" style={{ marginBottom: '4px' }}>
                        {c.role.replace('_', ' ')}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                        {c.club_name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#a0a4b8', marginTop: '6px' }}>
                        Member since {new Date(c.joined_at).getFullYear()}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Minimal intentional state notice if all optional sections hidden */}
            {student.isMinimal && (
              <div className="sd-minimal-box">
                <div className="sd-micro sd-micro-blue" style={{ marginBottom: '8px' }}>
                  CAMPUS DIRECTORY IDENTITY
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#ffffff', marginBottom: '8px' }}>
                  Verified Newton School of Technology Student
                </h3>
                <p style={{ color: '#a0a4b8', fontSize: '13px', maxWidth: '480px', margin: '0 auto' }}>
                  Portfolio sections and project contributions are currently hidden in accordance with this student&apos;s privacy preferences.
                </p>
              </div>
            )}
          </div>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
