import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Award,
  GraduationCap,
  Calendar,
  Building2,
  Code2,
  Users,
  FolderGit2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { studentsApi, PublicStudentProfile } from '../../../../lib/students-api';
import { StudentAppShell } from '../../../../components/layout/StudentAppShell';
import { ClubAdminProvider } from '../../../../components/layout/ClubAdminProvider';
import { StudentDossierOwnerBanner } from '../../../../components/student/StudentDossierOwnerBanner';
import { ProjectCoverBanner } from '../../../../components/projects/ProjectCoverBanner';

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

const dossierStyles = `
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

  .dossier-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  html.light .dossier-page, .light .dossier-page {
    background-color: #fbfbfb;
    color: #131313;
  }

  .dossier-dot-grid {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.25;
    background-image: radial-gradient(rgba(245, 245, 242, 0.12) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  html.light .dossier-dot-grid, .light .dossier-dot-grid {
    opacity: 0.15;
    background-image: radial-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px);
  }

  .dossier-watermark {
    position: absolute;
    top: 40px;
    right: 20px;
    font-family: var(--font-display);
    font-size: clamp(80px, 14vw, 180px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.02);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
    z-index: 0;
  }

  html.light .dossier-watermark, .light .dossier-watermark {
    color: rgba(0, 0, 0, 0.03);
  }

  .neo-hero-card {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.2);
    box-shadow: 10px 10px 0px var(--electric-blue);
    position: relative;
    padding: 36px;
    margin-bottom: 40px;
  }

  html.light .neo-hero-card, .light .neo-hero-card {
    background: #ffffff;
    border: 3px solid #000000;
    box-shadow: 10px 10px 0px #000000;
  }

  .neo-panel-card {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.15);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .neo-panel-card:hover {
    border-color: var(--electric-blue);
    box-shadow: 6px 6px 0px var(--electric-blue);
    transform: translate3d(-2px, -2px, 0);
  }

  html.light .neo-panel-card, .light .neo-panel-card {
    background: #ffffff;
    border: 2px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .neo-panel-card:hover, .light .neo-panel-card:hover {
    border-color: #000000;
    box-shadow: 8px 8px 0px #000000;
  }

  .neo-status-pill {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 0;
  }

  .neo-btn-action {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 8px 14px;
    background: transparent;
    border: 2px solid rgba(245, 245, 242, 0.3);
    color: var(--bg-paper-white);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .neo-btn-action:hover {
    border-color: var(--electric-blue);
    background: var(--electric-blue);
    color: #ffffff;
    box-shadow: 4px 4px 0px rgba(0, 87, 255, 0.4);
    transform: translate3d(-1px, -1px, 0);
  }

  html.light .neo-btn-action, .light .neo-btn-action {
    border: 2px solid #000000;
    color: #000000;
  }

  html.light .neo-btn-action:hover, .light .neo-btn-action:hover {
    background: #000000;
    color: #ffffff;
    box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.4);
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

  // Handle canonical historical slug redirects (301)
  if (student.redirect && student.canonical_slug) {
    redirect(`/students/${student.canonical_slug}`);
  }

  const displayName = student.fullName || `@${student.slug}`;
  const initials = (
    student.fullName
      ? student.fullName
          .split(' ')
          .map((n) => n[0])
          .join('')
      : student.slug
  )
    .slice(0, 2)
    .toUpperCase();

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

  const hasExternalLinks =
    student.externalLinks && Object.values(student.externalLinks).some(Boolean);

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <style dangerouslySetInnerHTML={{ __html: dossierStyles }} />
        <div className="dossier-page relative selection:bg-[#0057FF] selection:text-white">
          {/* Subtle Cyber Dot Matrix */}
          <div className="dossier-dot-grid" />

          {/* Background Watermark */}
          <div className="dossier-watermark">
            DOSSIER
          </div>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            {/* Top Owner / Share Controls Banner */}
            <StudentDossierOwnerBanner slug={student.slug} />

            {/* Breadcrumb Navigation & System Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black/15 dark:border-white/15 pb-4 mb-8">
              <Link
                href="/students"
                className="inline-flex items-center gap-2 text-zinc-600 dark:text-[#a0a4b8] hover:text-[#0057FF] dark:hover:text-[#7bd0ff] font-['JetBrains_Mono',monospace] text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>[← STUDENT DIRECTORY]</span>
              </Link>

              <div className="flex items-center gap-2 font-['JetBrains_Mono',monospace] text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-[#a0a4b8]">
                <span>ARCHIVE // @{student.slug}</span>
                <span className="text-zinc-400 dark:text-zinc-600">/</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-[#C8FF00]">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-[#C8FF00] inline-block animate-pulse" />
                  [VERIFIED]
                </span>
              </div>
            </div>

            {/* =========================================================================
                 1. STUDENT IDENTITY HERO (Authoritative Neo-Brutalist Subject Card)
                 ========================================================================= */}
            <section className="neo-hero-card">
              {/* Corner Cyber Accents */}
              <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-600 select-none">
                + [DOSSIER_ID: 0x{student.slug.slice(0, 6).toUpperCase()}]
              </div>
              <div className="absolute top-2 right-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-600 select-none hidden sm:block">
                NST_SYSTEMS // SECURE_PORTFOLIO
              </div>

              <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start mt-2">
                {/* Square Technical Avatar with Status Badge */}
                <div className="relative shrink-0">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 border-2 border-black dark:border-white/30 bg-[#0057FF] flex items-center justify-center text-white font-['Syne',sans-serif] font-black text-4xl shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_rgba(0,87,255,0.4)] overflow-hidden">
                    {student.avatarUrl ? (
                      <img
                        src={student.avatarUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div
                    title="Verified Institutional Scholar"
                    className="absolute -bottom-2 -right-2 bg-emerald-500 dark:bg-[#C8FF00] text-black font-['JetBrains_Mono',monospace] text-[10px] font-black px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_#000000]"
                  >
                    [VERIFIED]
                  </div>
                </div>

                {/* Identity Information */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="neo-status-pill bg-blue-500/10 text-[#0057FF] dark:text-[#7bd0ff] border border-[#0057FF]/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>[INSTITUTIONAL SCHOLAR]</span>
                    </span>

                    <span className="font-['JetBrains_Mono',monospace] text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      @{student.slug}
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-black dark:text-[#F5F5F2] leading-tight font-['Syne',sans-serif]">
                    {displayName}
                  </h1>

                  {/* Academic Credentials Monospace Badges */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mt-3.5">
                    {student.program && (
                      <span className="neo-status-pill bg-black/5 dark:bg-white/5 text-black dark:text-[#F5F5F2] border border-black/20 dark:border-white/20">
                        <GraduationCap className="w-3.5 h-3.5 text-[#0057FF] dark:text-[#7bd0ff]" />
                        <span>[PROGRAM // {student.program}]</span>
                      </span>
                    )}
                    {student.batch && (
                      <span className="neo-status-pill bg-black/5 dark:bg-white/5 text-black dark:text-[#F5F5F2] border border-black/20 dark:border-white/20">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-[#C8FF00]" />
                        <span>[BATCH // {student.batch}]</span>
                      </span>
                    )}
                    {student.campus && (
                      <span className="neo-status-pill bg-black/5 dark:bg-white/5 text-black dark:text-[#F5F5F2] border border-black/20 dark:border-white/20">
                        <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-[#FF9500]" />
                        <span>[CAMPUS // {student.campus}]</span>
                      </span>
                    )}
                  </div>

                  {/* Headline */}
                  {student.headline && (
                    <p className="mt-4 text-sm sm:text-base font-['JetBrains_Mono',monospace] font-bold text-zinc-800 dark:text-zinc-200 leading-snug">
                      <span className="text-[#0057FF] dark:text-[#7bd0ff] mr-2">{'//'}</span>
                      <span>{student.headline}</span>
                    </p>
                  )}

                  {/* Biography */}
                  {student.bio && (
                    <div className="mt-3.5 border-l-2 border-[#0057FF] pl-4">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-3xl whitespace-pre-line font-sans">
                        {student.bio}
                      </p>
                    </div>
                  )}

                  {/* External Portfolio & Social Links */}
                  {hasExternalLinks && (
                    <div className="flex flex-wrap items-center gap-2.5 mt-5 pt-5 border-t border-black/10 dark:border-white/10">
                      {student.externalLinks.github && (
                        <a
                          href={student.externalLinks.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-btn-action"
                        >
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                          </svg>
                          <span>[GITHUB ↗]</span>
                        </a>
                      )}
                      {student.externalLinks.linkedin && (
                        <a
                          href={student.externalLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-btn-action"
                        >
                          <svg className="w-3.5 h-3.5 fill-current text-[#0057FF] dark:text-[#7bd0ff]" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                          </svg>
                          <span>[LINKEDIN ↗]</span>
                        </a>
                      )}
                      {student.externalLinks.portfolio && (
                        <a
                          href={student.externalLinks.portfolio}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-btn-action"
                        >
                          <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-[#C8FF00]" />
                          <span>[PORTFOLIO ↗]</span>
                        </a>
                      )}
                      {student.externalLinks.other && (
                        <a
                          href={student.externalLinks.other}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neo-btn-action"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-[#FF9500]" />
                          <span>[WEBSITE ↗]</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* =========================================================================
                 2. FEATURED PROJECTS (Deliberate Fallbacks, Watermark Filter, Sharp Brutalism)
                 ========================================================================= */}
            {!student.isMinimal && (
              <section className="mb-12">
                <div className="flex items-center justify-between border-b-2 border-black/15 dark:border-white/15 pb-3 mb-6">
                  <div className="flex items-center gap-2.5">
                    <span className="font-['JetBrains_Mono',monospace] text-xs font-bold text-[#0057FF] dark:text-[#7bd0ff]">
                      {'// 01'}
                    </span>
                    <FolderGit2 className="w-5 h-5 text-[#0057FF] dark:text-[#7bd0ff]" />
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black dark:text-[#F5F5F2] font-['Syne',sans-serif]">
                      Selected NST Projects
                    </h2>
                  </div>
                  <span className="font-['JetBrains_Mono',monospace] text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
                    [{student.projects?.length || 0} PUBLISHED]
                  </span>
                </div>

                {student.projects && student.projects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {student.projects.map((proj) => (
                      <Link
                        key={proj.id}
                        href={`/projects/${proj.slug}`}
                        className="group neo-panel-card flex flex-col justify-between overflow-hidden text-inherit no-underline"
                      >
                        <div>
                          {/* Mini Cover Banner with watermark protection */}
                          <div className="relative border-b-2 border-black/15 dark:border-white/10">
                            <ProjectCoverBanner
                              coverImageUrl={proj.cover_image_url}
                              title={proj.title}
                              category={proj.category}
                              tags={proj.tags}
                              size="sm"
                            />
                            {proj.featured && (
                              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 font-['JetBrains_Mono',monospace] text-[10px] font-black uppercase bg-[#FF9500] text-black border border-black shadow-[2px_2px_0px_#000000]">
                                ★ PINNED
                              </div>
                            )}
                          </div>

                          {/* Body */}
                          <div className="p-5">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase px-2 py-0.5 bg-black/5 dark:bg-white/5 text-black dark:text-[#F5F5F2] border border-black/15 dark:border-white/15">
                                [{proj.category}]
                              </span>
                              <span className="text-[11px] font-['JetBrains_Mono',monospace] text-[#0057FF] dark:text-[#7bd0ff] font-bold">
                                [{proj.is_owner ? 'PROJECT LEAD' : proj.role}]
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-black dark:text-white group-hover:text-[#0057FF] dark:group-hover:text-[#7bd0ff] transition-colors line-clamp-1 font-['Syne',sans-serif] uppercase">
                              {proj.title}
                            </h3>

                            {proj.tagline && (
                              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                                {proj.tagline}
                              </p>
                            )}

                            {/* Tags */}
                            {proj.tags && proj.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/10 dark:border-white/10">
                                {proj.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] font-['JetBrains_Mono',monospace] font-bold text-zinc-600 dark:text-zinc-400 bg-black/5 dark:bg-white/5 px-2 py-0.5 border border-black/10 dark:border-white/10"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 bg-black/5 dark:bg-white/[0.03] border-t-2 border-black/10 dark:border-white/10 flex items-center justify-between text-xs font-['JetBrains_Mono',monospace] font-bold text-zinc-600 dark:text-zinc-400">
                          <span>[VIEW CASE STUDY]</span>
                          <span className="group-hover:translate-x-1 transition-transform text-[#0057FF] dark:text-[#7bd0ff]">
                            →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-black/20 dark:border-white/20 p-8 sm:p-12 text-center bg-black/[0.02] dark:bg-white/[0.02]">
                    <Terminal className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-sm font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-black dark:text-[#F5F5F2] mb-1">
                      {'// ARCHIVE EMPTY: NO PUBLIC PROJECTS PUBLISHED'}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed font-sans">
                      This scholar has not yet linked any public projects to their campus dossier. Once published, technical artifacts will index here.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================================
                 3. VERIFIED HONORS & ACHIEVEMENTS (Authoritative Ledger)
                 ========================================================================= */}
            {!student.isMinimal && (
              <section className="mb-12">
                <div className="flex items-center justify-between border-b-2 border-black/15 dark:border-white/15 pb-3 mb-6">
                  <div className="flex items-center gap-2.5">
                    <span className="font-['JetBrains_Mono',monospace] text-xs font-bold text-amber-500">
                      {'// 02'}
                    </span>
                    <Award className="w-5 h-5 text-amber-500" />
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black dark:text-[#F5F5F2] font-['Syne',sans-serif]">
                      Official Event Honors
                    </h2>
                  </div>
                  <span className="font-['JetBrains_Mono',monospace] text-xs font-bold uppercase text-amber-600 dark:text-amber-400">
                    [AUTHORITATIVE LEDGER]
                  </span>
                </div>

                {student.achievements && student.achievements.length > 0 ? (
                  <div className="space-y-3">
                    {student.achievements.map((ach) => (
                      <div
                        key={ach.id}
                        className="border-2 border-amber-500/40 bg-amber-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-amber-500/70 shadow-[4px_4px_0px_rgba(255,149,0,0.15)]"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="p-2 bg-amber-500/20 text-amber-500 shrink-0 border border-amber-500/40 mt-0.5">
                            <Award className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-[10px] font-['JetBrains_Mono',monospace] font-black uppercase bg-amber-500 text-black">
                                [{ach.placement ? `${ach.placement.toUpperCase()} PLACE` : 'AWARD'}]
                              </span>
                              <h3 className="text-sm sm:text-base font-bold text-black dark:text-white font-['Syne',sans-serif] uppercase">
                                {ach.award_name}
                              </h3>
                            </div>
                            <div className="text-xs font-['JetBrains_Mono',monospace] text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center gap-2">
                              <span>EVENT:</span>
                              <Link
                                href={`/event/${ach.event.slug}/results`}
                                className="text-[#0057FF] dark:text-[#7bd0ff] hover:underline inline-flex items-center gap-1 font-bold"
                              >
                                <span>{ach.event.title}</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                              <span className="text-zinc-400 dark:text-zinc-600">·</span>
                              <span>DATE // {new Date(ach.awarded_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {ach.certificate_url && (
                          <a
                            href={ach.certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="neo-btn-action border-amber-500/40 text-amber-600 dark:text-amber-400 hover:border-amber-500 hover:bg-amber-500 hover:text-black shrink-0"
                          >
                            <span>[VERIFIED CREDENTIAL]</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-black/20 dark:border-white/20 p-8 sm:p-12 text-center bg-black/[0.02] dark:bg-white/[0.02]">
                    <Award className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-sm font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-black dark:text-[#F5F5F2] mb-1">
                      {'// LEDGER EMPTY: NO EVENT HONORS RECORDED'}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed font-sans">
                      Authoritative competition placements, certifications, and awards verified by campus faculty will publish here.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================================
                 4. TECHNICAL SKILLS & SPECIALIZATIONS
                 ========================================================================= */}
            {student.skills && student.skills.length > 0 && (
              <section className="mb-12 neo-panel-card p-6 sm:p-8">
                <div className="flex items-center justify-between border-b-2 border-black/15 dark:border-white/15 pb-3 mb-5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-['JetBrains_Mono',monospace] text-xs font-bold text-emerald-500 dark:text-[#C8FF00]">
                      {'// 03'}
                    </span>
                    <Code2 className="w-5 h-5 text-emerald-500 dark:text-[#C8FF00]" />
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black dark:text-[#F5F5F2] font-['Syne',sans-serif]">
                      Technical Skills & Specializations
                    </h2>
                  </div>
                  <span className="font-['JetBrains_Mono',monospace] text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
                    [{student.skills.length} VERIFIED TAGS]
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {student.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3.5 py-1.5 font-['JetBrains_Mono',monospace] text-xs font-bold bg-[#0057FF]/10 text-[#0057FF] dark:text-[#7bd0ff] border-2 border-[#0057FF]/30 hover:border-[#0057FF] hover:bg-[#0057FF] hover:text-white transition-all cursor-default"
                    >
                      [#{skill}]
                    </span>
                  ))}
                </div>

                {student.interests && student.interests.length > 0 && (
                  <div className="mt-6 pt-5 border-t-2 border-black/10 dark:border-white/10">
                    <p className="text-xs font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-3">
                      {'// RESEARCH & DOMAIN INTERESTS:'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {student.interests.map((interest) => (
                        <span
                          key={interest}
                          className="px-3 py-1 font-['JetBrains_Mono',monospace] text-xs font-bold text-black dark:text-[#F5F5F2] bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20"
                        >
                          [#{interest}]
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================================
                 5. CLUBS & CAMPUS LEADERSHIP
                 ========================================================================= */}
            {!student.isMinimal && (
              <section className="mb-12">
                <div className="flex items-center justify-between border-b-2 border-black/15 dark:border-white/15 pb-3 mb-6">
                  <div className="flex items-center gap-2.5">
                    <span className="font-['JetBrains_Mono',monospace] text-xs font-bold text-purple-500">
                      {'// 04'}
                    </span>
                    <Users className="w-5 h-5 text-purple-500" />
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black dark:text-[#F5F5F2] font-['Syne',sans-serif]">
                      Clubs & Campus Leadership
                    </h2>
                  </div>
                  <span className="font-['JetBrains_Mono',monospace] text-xs font-bold uppercase text-purple-600 dark:text-purple-400">
                    [CHAPTER ROLES]
                  </span>
                </div>

                {student.clubs && student.clubs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {student.clubs.map((c) => (
                      <div
                        key={c.id}
                        className="p-5 border-2 border-purple-500/30 bg-purple-500/5 hover:border-purple-500 transition-all shadow-[4px_4px_0px_rgba(168,85,247,0.15)]"
                      >
                        <div className="font-['JetBrains_Mono',monospace] text-[11px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-wider mb-1.5">
                          [ROLE // {c.role.replace('_', ' ')}]
                        </div>
                        <h3 className="text-lg font-bold text-black dark:text-white font-['Syne',sans-serif] uppercase">
                          {c.club_name}
                        </h3>
                        <p className="font-['JetBrains_Mono',monospace] text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                          ACTIVE SINCE {new Date(c.joined_at).getFullYear()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-black/20 dark:border-white/20 p-8 sm:p-12 text-center bg-black/[0.02] dark:bg-white/[0.02]">
                    <Users className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-sm font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-black dark:text-[#F5F5F2] mb-1">
                      {'// DIRECTORY EMPTY: NO CAMPUS ROLES LISTED'}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed font-sans">
                      Verified roles and memberships in accredited technical chapters and cultural societies will display here.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================================
                 6. MINIMAL STATE (When all optional sections are hidden by privacy)
                 ========================================================================= */}
            {student.isMinimal && (
              <div className="border-2 border-black/20 dark:border-white/20 p-8 sm:p-12 text-center bg-black/[0.03] dark:bg-white/[0.03] shadow-[6px_6px_0px_rgba(0,87,255,0.3)]">
                <ShieldCheck className="w-10 h-10 text-[#0057FF] dark:text-[#7bd0ff] mx-auto mb-3" />
                <h3 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#F5F5F2] mb-2 font-['Syne',sans-serif]">
                  [RESTRICTED DOSSIER // PRIVACY FILTER ACTIVE]
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed font-sans">
                  Detailed showcase sections, project registries, and competition records are currently masked in accordance with this scholar&apos;s privacy configuration.
                </p>
              </div>
            )}
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
