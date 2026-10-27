import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Award,
  Layers,
  Sparkles,
  CheckCircle2,
  GraduationCap,
  Calendar,
  Building2,
  Code2,
  Users,
  Compass,
  FolderGit2,
  ShieldCheck,
  Share2,
  Check,
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
        <div className="min-h-screen bg-[#050505] text-[#F5F5F2] font-sans relative selection:bg-[#0057FF] selection:text-white">
          {/* Subtle Background Texture */}
          <div
            className="fixed inset-0 pointer-events-none z-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.15) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            {/* Owner banner & share controls */}
            <StudentDossierOwnerBanner slug={student.slug} />

            {/* Breadcrumb Navigation */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-8">
              <Link
                href="/students"
                className="inline-flex items-center space-x-2 text-zinc-400 hover:text-[#0057FF] font-mono text-xs uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>STUDENT DIRECTORY</span>
              </Link>

              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                CAMPUS PORTFOLIO // <span className="text-zinc-200">@{student.slug}</span>
              </div>
            </div>

            {/* =========================================================================
                 1. STUDENT IDENTITY HERO (The student is the central subject)
                 ========================================================================= */}
            <section className="mb-10 p-6 sm:p-10 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden shadow-[0_0_50px_-15px_rgba(0,87,255,0.1)]">
              {/* Subtle Ambient Gradient Glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
                {/* Avatar with Verified Status Ring */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-[#0057FF] to-cyan-500 flex items-center justify-center text-white font-['Syne',sans-serif] font-black text-3xl sm:text-4xl shadow-xl overflow-hidden border-2 border-zinc-700">
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
                    title="Verified Institutional Student"
                    className="absolute -bottom-2 -right-2 bg-emerald-500 text-black p-1.5 rounded-full border-2 border-[#050505] shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                {/* Identity Information */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verified NST Student</span>
                    </span>

                    <span className="text-xs font-mono text-zinc-400">
                      @{student.slug}
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight font-['Syne',sans-serif]">
                    {displayName}
                  </h1>

                  {/* Academic Credentials Pills */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3.5">
                    {student.program && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono bg-zinc-900 text-zinc-300 border border-zinc-800">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                        <span>{student.program}</span>
                      </span>
                    )}
                    {student.batch && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono bg-zinc-900 text-zinc-300 border border-zinc-800">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Batch {student.batch}</span>
                      </span>
                    )}
                    {student.campus && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono bg-zinc-900 text-zinc-300 border border-zinc-800">
                        <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{student.campus}</span>
                      </span>
                    )}
                  </div>

                  {/* Headline */}
                  {student.headline && (
                    <p className="mt-3.5 text-sm sm:text-base font-mono font-semibold text-zinc-300 leading-snug">
                      {student.headline}
                    </p>
                  )}

                  {/* Biography */}
                  {student.bio && (
                    <p className="mt-3 text-sm text-zinc-400 leading-relaxed max-w-3xl whitespace-pre-line">
                      {student.bio}
                    </p>
                  )}

                  {/* External Portfolio & Social Links */}
                  {hasExternalLinks && (
                    <div className="flex flex-wrap items-center gap-2.5 mt-5 pt-5 border-t border-zinc-900">
                      {student.externalLinks.github && (
                        <a
                          href={student.externalLinks.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 fill-current text-zinc-400" viewBox="0 0 24 24">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                          </svg>
                          <span>GitHub ↗</span>
                        </a>
                      )}
                      {student.externalLinks.linkedin && (
                        <a
                          href={student.externalLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 fill-current text-blue-400" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                          </svg>
                          <span>LinkedIn ↗</span>
                        </a>
                      )}
                      {student.externalLinks.portfolio && (
                        <a
                          href={student.externalLinks.portfolio}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Portfolio ↗</span>
                        </a>
                      )}
                      {student.externalLinks.other && (
                        <a
                          href={student.externalLinks.other}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                          <span>Website ↗</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* =========================================================================
                 2. FEATURED PROJECTS (Deliberate fallbacks, real covers, role attribution)
                 ========================================================================= */}
            {!student.isMinimal && (
              <section className="mb-10">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-6">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-5 h-5 text-blue-400" />
                    <h2 className="text-lg font-bold uppercase tracking-tight text-white font-['Syne',sans-serif]">
                      Selected NST Projects
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-zinc-500">
                    {student.projects?.length || 0} project{student.projects?.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {student.projects && student.projects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {student.projects.map((proj) => (
                      <Link
                        key={proj.id}
                        href={`/projects/${proj.slug}`}
                        className="group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/70 overflow-hidden hover:border-blue-500/60 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div>
                          {/* Mini Cover Banner with watermark protection */}
                          <div className="relative">
                            <ProjectCoverBanner
                              coverImageUrl={proj.cover_image_url}
                              title={proj.title}
                              category={proj.category}
                              tags={proj.tags}
                              size="sm"
                            />
                            {proj.featured && (
                              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500 text-black shadow-md">
                                ★ Pinned
                              </div>
                            )}
                          </div>

                          {/* Body */}
                          <div className="p-5">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                                {proj.category}
                              </span>
                              <span className="text-[11px] font-mono text-blue-400 font-semibold">
                                {proj.is_owner ? 'Project Lead' : proj.role}
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                              {proj.title}
                            </h3>

                            {proj.tagline && (
                              <p className="mt-1.5 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                {proj.tagline}
                              </p>
                            )}

                            {/* Tags */}
                            {proj.tags && proj.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-900">
                                {proj.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] font-mono text-zinc-400 bg-zinc-900/60 px-1.5 py-0.5 rounded"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 bg-zinc-900/30 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400">
                          <span>View Detail</span>
                          <span className="group-hover:translate-x-0.5 transition-transform text-blue-400">
                            →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-8 sm:p-12 text-center bg-zinc-950/40">
                    <FolderGit2 className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-zinc-300 mb-1">
                      NO PUBLIC PROJECTS PUBLISHED
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                      This student has not published any projects to their public portfolio yet. Projects will appear here as soon as they are made public.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================================
                 3. VERIFIED HONORS & ACHIEVEMENTS (Authoritative Ledger)
                 ========================================================================= */}
            {!student.isMinimal && (
              <section className="mb-10">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-6">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-bold uppercase tracking-tight text-white font-['Syne',sans-serif]">
                      Official Event Honors
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-amber-400/80 uppercase">
                    Authoritative Ledger
                  </span>
                </div>

                {student.achievements && student.achievements.length > 0 ? (
                  <div className="space-y-3">
                    {student.achievements.map((ach) => (
                      <div
                        key={ach.id}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-amber-500/40"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                            <Award className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-amber-500 text-black">
                                {ach.placement ? `${ach.placement.toUpperCase()} PLACE` : 'AWARD'}
                              </span>
                              <h3 className="text-sm sm:text-base font-bold text-white">
                                {ach.award_name}
                              </h3>
                            </div>
                            <div className="text-xs font-mono text-zinc-400 flex flex-wrap items-center gap-2">
                              <span>Event:</span>
                              <Link
                                href={`/event/${ach.event.slug}/results`}
                                className="text-blue-400 hover:underline inline-flex items-center gap-1"
                              >
                                <span>{ach.event.title}</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                              <span className="text-zinc-600">·</span>
                              <span>{new Date(ach.awarded_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {ach.certificate_url && (
                          <a
                            href={ach.certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition-colors shrink-0"
                          >
                            <span>Verified Credential</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-8 sm:p-12 text-center bg-zinc-950/40">
                    <Award className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-zinc-300 mb-1">
                      NO EVENT HONORS RECORDED
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                      Official recognitions, placements, and verified certificates from NST hackathons and competitions will appear here upon publication.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================================
                 4. TECHNICAL SKILLS & SPECIALIZATIONS
                 ========================================================================= */}
            {student.skills && student.skills.length > 0 && (
              <section className="mb-10 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6 sm:p-8">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-5">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-lg font-bold uppercase tracking-tight text-white font-['Syne',sans-serif]">
                      Skills & Technical Specializations
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-zinc-500">
                    {student.skills.length} skills
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {student.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border border-zinc-800 hover:border-emerald-500/40 transition-colors"
                    >
                      #{skill}
                    </span>
                  ))}
                </div>

                {student.interests && student.interests.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-zinc-900">
                    <p className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                      Research & Technical Interests:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {student.interests.map((interest) => (
                        <span
                          key={interest}
                          className="px-2.5 py-1 rounded-md text-xs font-mono text-zinc-300 bg-zinc-900/60 border border-zinc-800/80"
                        >
                          {interest}
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
              <section className="mb-10">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-6">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-bold uppercase tracking-tight text-white font-['Syne',sans-serif]">
                      Clubs & Campus Leadership
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-purple-400/80 uppercase">
                    Verified Roles
                  </span>
                </div>

                {student.clubs && student.clubs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {student.clubs.map((c) => (
                      <div
                        key={c.id}
                        className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 hover:border-purple-500/40 transition-colors"
                      >
                        <div className="text-[11px] font-mono text-purple-400 font-bold uppercase tracking-wider mb-1">
                          {c.role.replace('_', ' ')}
                        </div>
                        <h3 className="text-base font-bold text-white font-['Syne',sans-serif]">
                          {c.club_name}
                        </h3>
                        <p className="text-xs font-mono text-zinc-500 mt-2">
                          Active member since {new Date(c.joined_at).getFullYear()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-8 sm:p-12 text-center bg-zinc-950/40">
                    <Users className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-zinc-300 mb-1">
                      NO CAMPUS ROLES LISTED
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                      Official leadership and membership records in recognized student chapters and technical clubs will display here once verified.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* =========================================================================
                 6. MINIMAL STATE (When all optional sections are hidden by privacy)
                 ========================================================================= */}
            {student.isMinimal && (
              <div className="rounded-2xl border border-dashed border-zinc-800 p-8 sm:p-12 text-center bg-zinc-950/40">
                <ShieldCheck className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <h3 className="text-base font-bold uppercase tracking-wider text-white mb-2">
                  Verified Newton School of Technology Student
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Portfolio showcase sections, project records, and honors are currently hidden in accordance with this student&apos;s privacy preferences.
                </p>
              </div>
            )}
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
