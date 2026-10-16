import React from 'react';
import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Video,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  Users,
  Code2,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Cpu,
  Compass,
} from 'lucide-react';
import { projectsApi } from '@/lib/projects-api';
import { ProjectLikeButton } from '@/components/projects/ProjectLikeButton';
import { ProjectShareModal } from '@/components/projects/ProjectShareModal';
import { ProjectReportModal } from '@/components/projects/ProjectReportModal';
import { NstLogoMark } from '@/components/brand/NstLogo';
import { StudentAppShell } from '@/components/layout/StudentAppShell';
import { ClubAdminProvider } from '@/components/layout/ClubAdminProvider';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  const project = await projectsApi.getPublicBySlug(slug);

  if (!project || project.redirect || project.visibility !== 'PUBLISHED') {
    return {
      title: 'Project Not Found — NST Projects',
      robots: { index: false, follow: false },
    };
  }

  const canonicalUrl = `${siteUrl}/projects/${project.slug}`;
  const banner = project.cover_image_url || `${siteUrl}/icon.png`;

  return {
    title: `${project.title} — NST Projects`,
    description: project.tagline,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${project.title} — NST Projects`,
      description: project.tagline,
      url: canonicalUrl,
      siteName: 'NST Projects',
      type: 'article',
      publishedTime: project.published_at || undefined,
      authors: [project.author?.name || 'NST Student'],
      images: [
        {
          url: banner,
          width: 1200,
          height: 630,
          alt: project.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${project.title} — NST Projects`,
      description: project.tagline,
      images: [banner],
    },
  };
}

export default async function PublicProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  const project = await projectsApi.getPublicBySlug(slug);

  if (!project) {
    notFound();
  }

  // Handle historical slug redirection permanently (301)
  if (project.redirect && project.canonical_slug) {
    permanentRedirect(`/projects/${project.canonical_slug}`);
  }

  const canonicalUrl = `${siteUrl}/projects/${project.slug}`;

  // JSON-LD Structured Data for Search & AI Crawlers (GEO foundation)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    headline: project.title,
    description: project.tagline,
    image: project.cover_image_url,
    datePublished: project.published_at,
    author: {
      '@type': 'Person',
      name: project.author?.name || 'Student Creator',
    },
    keywords: project.tags?.join(', '),
    url: canonicalUrl,
  };

  const demoLink = project.links?.find((l) => l.type === 'DEMO');
  const repoLink = project.links?.find((l) => l.type === 'REPOSITORY');
  const videoLink = project.links?.find((l) => l.type === 'VIDEO');
  const docLink = project.links?.find((l) => l.type === 'DOCUMENTATION');
  const otherLinks = project.links?.filter((l) => l.type === 'OTHER') || [];

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <div className="min-h-screen bg-[#050505] text-[#F5F5F2] font-sans relative selection:bg-[#0057FF] selection:text-white">
          {/* Background Dot Texture */}
          <div
            className="fixed inset-0 pointer-events-none z-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.15) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Inject Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Main Content Layout */}
          <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
            {/* Navigation Breadcrumbs & Top Actions */}
            <div className="flex items-center justify-between border-b border-[#F5F5F2]/20 pb-4 mb-8">
              <Link
                href="/projects"
                className="flex items-center space-x-2 text-[#a0a4b8] hover:text-[#0057FF] font-['JetBrains_Mono',monospace] text-xs uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ALL PROJECTS</span>
              </Link>

              <div className="flex items-center space-x-3">
                <ProjectLikeButton
                  projectId={project.id}
                  initialLikeCount={project.like_count}
                  initialHasLiked={project.has_liked}
                  isOwner={project.is_owner}
                />
                <ProjectShareModal
                  title={project.title}
                  tagline={project.tagline}
                  url={canonicalUrl}
                />
              </div>
            </div>
        {/* Banner Section */}
        {project.cover_image_url && (
          <div className="w-full h-64 sm:h-96 rounded-2xl overflow-hidden border border-zinc-800 mb-8 relative">
            <img
              src={project.cover_image_url}
              alt={project.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80" />
          </div>
        )}

        {/* Header Details */}
        <div className="border-b border-zinc-800/80 pb-8 mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-md">
              {project.category}
            </span>
            <span className="px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-md">
              {project.development_status}
            </span>
            <span className="px-3 py-1 text-xs font-mono text-zinc-500 border border-zinc-800/60 bg-zinc-950 rounded-md">
              {project.project_type}
            </span>
            {project.published_at && (
              <span className="inline-flex items-center gap-1.5 text-zinc-500 font-mono text-xs ml-auto">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {new Date(project.published_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#F5F5F2] leading-tight">
            {project.title}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-zinc-400 max-w-3xl leading-relaxed">
            {project.tagline}
          </p>

          {/* Quick Info & Creator Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-900">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0057FF] to-cyan-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0 mt-0.5">
                {project.author?.avatar_url ? (
                  <img
                    src={project.author.avatar_url}
                    alt={project.author.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  project.author?.name ? project.author.name.charAt(0).toUpperCase() : 'U'
                )}
              </div>
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase">CREATOR</p>
                <p className="text-sm font-semibold text-zinc-200">{project.author?.name || 'NST Student'}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Layers className="w-5 h-5 text-[#0057FF] shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase">CATEGORY</p>
                <p className="text-sm font-semibold text-zinc-200">{project.category}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Users className="w-5 h-5 text-[#0057FF] shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase">COLLABORATORS</p>
                <p className="text-sm font-semibold text-zinc-200">
                  {project.contributors?.length || 0} accepted
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Showcase Public Artifacts Action Bar */}
        {(demoLink || repoLink || videoLink || docLink || otherLinks.length > 0) && (
          <div className="mb-10 p-5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 mr-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Showcase Links:</span>
            </span>

            {demoLink && (
              <a
                href={demoLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black transition-colors shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{demoLink.label || 'Live Demo'}</span>
              </a>
            )}

            {repoLink && (
              <a
                href={repoLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 transition-colors"
              >
                <GitBranch className="w-4 h-4" />
                <span>{repoLink.label || 'Repository'}</span>
              </a>
            )}

            {videoLink && (
              <a
                href={videoLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 transition-colors"
              >
                <Video className="w-4 h-4 text-rose-400" />
                <span>{videoLink.label || 'Watch Video'}</span>
              </a>
            )}

            {docLink && (
              <a
                href={docLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 transition-colors"
              >
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span>{docLink.label || 'Documentation'}</span>
              </a>
            )}

            {otherLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-medium rounded-lg text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{link.label || 'Link'}</span>
              </a>
            ))}
          </div>
        )}

        {/* Structured Story & Details */}
        <div className="space-y-8">
          {/* Overview Description */}
          <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6 sm:p-8">
            <h2 className="text-xl font-bold uppercase tracking-tight text-white border-b border-zinc-800 pb-3 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <span>Project Overview</span>
            </h2>
            <div className="mt-4 text-zinc-300 leading-relaxed text-sm whitespace-pre-line">
              {project.description}
            </div>
          </section>

          {/* Problem & Solution Grid */}
          {(project.problem_statement || project.solution) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {project.problem_statement && (
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6">
                  <div className="flex items-center gap-2 text-rose-400 mb-3">
                    <HelpCircle className="w-4 h-4" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                      The Problem
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                    {project.problem_statement}
                  </p>
                </div>
              )}

              {project.solution && (
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6">
                  <div className="flex items-center gap-2 text-emerald-400 mb-3">
                    <Lightbulb className="w-4 h-4" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                      The Solution
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                    {project.solution}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Technical Architecture & Implementation */}
          {project.implementation_details && (
            <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-cyan-400 mb-3">
                <Cpu className="w-5 h-5" />
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                  Technical Architecture & Key Decisions
                </h3>
              </div>
              <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                {project.implementation_details}
              </div>
            </section>
          )}

          {/* Personal Contribution & What's Next */}
          {(project.personal_contribution || project.whats_next) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {project.personal_contribution && (
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6">
                  <div className="flex items-center gap-2 text-amber-400 mb-3">
                    <Code2 className="w-4 h-4" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                      Key Contribution
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                    {project.personal_contribution}
                  </p>
                </div>
              )}

              {project.whats_next && (
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6">
                  <div className="flex items-center gap-2 text-purple-400 mb-3">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                      Future Roadmap
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                    {project.whats_next}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Technology & Topics Tags */}
          {project.tags && project.tags.length > 0 && (
            <section className="pt-4 border-t border-zinc-800/80">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                Technologies & Tools Used:
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/projects?tag=${encodeURIComponent(tag)}`}
                    className="px-3 py-1 text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Contributor Attribution Section */}
          <section className="pt-6 border-t border-zinc-800/80">
            <h3 className="text-base font-bold uppercase tracking-tight text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Project Team & Permitted Attribution</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Owner */}
              {project.author?.slug ? (
                <Link
                  href={`/students/${project.author.slug}`}
                  className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-[#0057FF] transition-all flex items-center gap-3 group"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0057FF] to-cyan-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                    {project.author?.avatar_url ? (
                      <img
                        src={project.author.avatar_url}
                        alt={project.author.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      project.author?.name ? project.author.name.charAt(0).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white text-xs truncate group-hover:text-blue-400 transition-colors">
                      {project.author?.name || 'NST Student'}
                    </div>
                    <div className="text-[10px] text-blue-400 font-mono">Project Creator & Owner ↗</div>
                  </div>
                </Link>
              ) : (
                <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0057FF] to-cyan-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                    {project.author?.avatar_url ? (
                      <img
                        src={project.author.avatar_url}
                        alt={project.author.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      project.author?.name ? project.author.name.charAt(0).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-xs truncate">
                      {project.author?.name || 'NST Student'}
                    </div>
                    <div className="text-[10px] text-blue-400 font-mono">Project Creator & Owner</div>
                  </div>
                </div>
              )}

              {/* Accepted Contributors */}
              {project.contributors &&
                project.contributors.map((c) => {
                  const cardContent = (
                    <>
                      <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs overflow-hidden shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          c.name ? c.name.charAt(0).toUpperCase() : 'C'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white text-xs truncate">{c.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono truncate">{c.role} {c.slug ? '↗' : ''}</div>
                      </div>
                    </>
                  );

                  return c.slug ? (
                    <Link
                      key={c.id}
                      href={`/students/${c.slug}`}
                      className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-blue-500 transition-all flex items-center gap-3 group"
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    <div key={c.id} className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center gap-3">
                      {cardContent}
                    </div>
                  );
                })}
            </div>
          </section>

          {/* Footer Actions & Reporting */}
          <div className="pt-8 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-xs font-mono uppercase text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to discovery</span>
            </Link>

            <ProjectReportModal projectId={project.id} projectTitle={project.title} />
          </div>
        </div>
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
