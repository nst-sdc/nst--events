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
  Sparkles,
  Users,
  Code2,
  CheckCircle2,
  UserCheck,
  Eye,
  FileText,
} from 'lucide-react';
import { projectsApi } from '@/lib/projects-api';
import { ProjectLikeButton } from '@/components/projects/ProjectLikeButton';
import { ProjectShareModal } from '@/components/projects/ProjectShareModal';
import { ProjectReportModal } from '@/components/projects/ProjectReportModal';
import { ProjectOwnerActions, ProjectOwnerStatusBanner } from '@/components/projects/ProjectOwnerActions';
import { ProjectMediaGallery } from '@/components/projects/ProjectMediaGallery';
import { MarkdownRenderer } from '@/components/projects/MarkdownRenderer';
import { ProjectCaseStudySections } from '@/components/projects/ProjectCaseStudySections';
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
    title: `${project.title} — NST Student Showcase`,
    description: project.tagline,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${project.title} — NST Student Showcase`,
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
      title: `${project.title} — NST Student Showcase`,
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
      ...(project.author?.slug ? { url: `${siteUrl}/students/${project.author.slug}` } : {}),
    },
    keywords: project.tags?.join(', '),
    url: canonicalUrl,
  };

  const demoLink = project.links?.find((l) => l.type === 'DEMO');
  const repoLink = project.links?.find((l) => l.type === 'REPOSITORY');
  const videoLink = project.links?.find((l) => l.type === 'VIDEO');
  const docLink = project.links?.find((l) => l.type === 'DOCUMENTATION');
  const otherLinks = project.links?.filter((l) => l.type === 'OTHER') || [];

  const creatorInitial = project.author?.name ? project.author.name.charAt(0).toUpperCase() : 'S';
  const acceptedContributors = (project.contributors || []).filter(
    (c) => c.status !== 'PENDING' && c.status !== 'DECLINED'
  );

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

          {/* Inject Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Main Case Study Layout */}
          <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            {/* Top Navigation & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4 mb-6">
              <Link
                href="/projects"
                className="inline-flex items-center space-x-2 text-zinc-400 hover:text-[#0057FF] font-mono text-xs uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>DISCOVER PROJECTS</span>
              </Link>

              <div className="flex items-center space-x-2.5">
                <ProjectOwnerActions
                  slug={project.slug}
                  ownerId={project.owner_id}
                  visibility={project.visibility || 'DRAFT'}
                />
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

            {/* Owner Preview Alert if Project is Draft or Unpublished */}
            <ProjectOwnerStatusBanner
              ownerId={project.owner_id}
              visibility={project.visibility || 'DRAFT'}
            />

            {/* Case Study Hero: Single Authoritative Title & Overview */}
            <div className="border-b border-zinc-800/80 pb-6 mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-md">
                  {project.category}
                </span>
                <span className="px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-md">
                  {project.development_status.replace('_', ' ')}
                </span>
                <span className="px-3 py-1 text-xs font-mono text-zinc-500 border border-zinc-800/60 bg-zinc-950 rounded-md">
                  {project.project_type.replace('_', ' ')}
                </span>
                {project.published_at && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-400 font-mono text-xs ml-auto">
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

              {/* Single authoritative Title */}
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#F5F5F2] leading-tight">
                {project.title}
              </h1>

              {/* Strong One-Line Summary */}
              {project.tagline && (
                <p className="mt-3 text-base sm:text-lg text-zinc-300 max-w-3xl leading-relaxed">
                  {project.tagline}
                </p>
              )}

              {/* Quick Header Identity Row */}
              <div className="flex flex-wrap items-center gap-6 mt-6 pt-5 border-t border-zinc-900">
                {project.author?.slug ? (
                  <Link
                    href={`/students/${project.author.slug}`}
                    className="inline-flex items-center space-x-3 group hover:opacity-90 transition-opacity"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0057FF] to-cyan-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0 ring-2 ring-blue-500/30">
                      {project.author?.avatar_url ? (
                        <img
                          src={project.author.avatar_url}
                          alt={project.author.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        creatorInitial
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">PROJECT LEAD</p>
                      <p className="text-sm font-bold text-zinc-100 group-hover:text-[#0057FF] group-hover:underline transition-colors flex items-center gap-1">
                        <span>{project.author?.name || 'NST Student'}</span>
                        <span className="text-xs text-blue-400">@{project.author.slug} ↗</span>
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0057FF] to-cyan-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                      {project.author?.avatar_url ? (
                        <img
                          src={project.author.avatar_url}
                          alt={project.author.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        creatorInitial
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">PROJECT LEAD</p>
                      <p className="text-sm font-semibold text-zinc-200">{project.author?.name || 'NST Student'}</p>
                    </div>
                  </div>
                )}

                <div className="inline-flex items-center space-x-2 text-xs font-mono text-zinc-400 border-l border-zinc-800 pl-6">
                  <Users className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{acceptedContributors.length} accepted collaborator{acceptedContributors.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="inline-flex items-center space-x-2 text-xs font-mono text-zinc-400 border-l border-zinc-800 pl-6">
                  <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{project.view_count || 0} views</span>
                </div>
              </div>
            </div>

            {/* Showcase Action Bar (Live Demo, Repository, Docs, Video) - Rendered only when valid links exist */}
            {(demoLink || repoLink || videoLink || docLink || otherLinks.length > 0) && (
              <div className="mb-8 p-4 sm:p-5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-wrap items-center gap-3 backdrop-blur-sm">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 mr-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Showcase Artifacts:</span>
                </span>

                {demoLink && (
                  <a
                    href={demoLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{demoLink.label || 'Launch Live Demo'}</span>
                  </a>
                )}

                {repoLink && (
                  <a
                    href={repoLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
                  >
                    <GitBranch className="w-4 h-4 text-blue-400" />
                    <span>{repoLink.label || 'View Source Code'}</span>
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
                    <span>{videoLink.label || 'Watch Video Demo'}</span>
                  </a>
                )}

                {docLink && (
                  <a
                    href={docLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-cyan-400" />
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
                    <span>{link.label || 'External Link'}</span>
                  </a>
                ))}
              </div>
            )}

            {/* Media Showcase: Cover, Multiple Screenshots, Captions & Optional Video */}
            <div className="mb-10">
              <ProjectMediaGallery
                coverImageUrl={project.cover_image_url}
                galleryImageUrls={project.gallery_image_urls}
                videoUrl={videoLink?.url}
                videoLabel={videoLink?.label}
                title={project.title}
                category={project.category}
                tagline={project.tagline}
                tags={project.tags}
                developmentStatus={project.development_status}
              />
            </div>

            {/* Main Content & Sidebar Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Long-Form Markdown Documentation & Technical Case Study (order-1 on mobile) */}
              <div className="lg:col-span-2 space-y-6 order-1">
                {/* Long-Form Markdown Documentation */}
                <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-6 sm:p-8 backdrop-blur-sm">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-6">
                    <div className="flex items-center gap-2.5 text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                      <FileText className="w-4 h-4" />
                      <span>Case Study & Technical Documentation</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 uppercase">
                      Comprehensive Specification
                    </span>
                  </div>
                  <div>
                    <MarkdownRenderer content={project.description} />
                  </div>
                </section>

                {/* Coherent Long-Form Supplementary Case Study Sections */}
                <ProjectCaseStudySections
                  problemStatement={project.problem_statement}
                  solution={project.solution}
                  implementationDetails={project.implementation_details}
                  personalContribution={project.personal_contribution}
                  whatsNext={project.whats_next}
                />
              </div>

              {/* Right Column: Student Creator Spotlight, Team Attribution, & Specs (order-2 on mobile) */}
              <div className="space-y-6 order-2 lg:order-none">
                {/* Creator Spotlight Card */}
                <div className="rounded-2xl border border-blue-500/30 bg-zinc-950/80 p-6 relative overflow-hidden shadow-[0_0_25px_-5px_rgba(0,87,255,0.15)]">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-bold mb-4 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>Project Lead & Creator</span>
                  </div>

                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0057FF] to-cyan-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden shrink-0 shadow-lg border border-blue-400/40">
                      {project.author?.avatar_url ? (
                        <img
                          src={project.author.avatar_url}
                          alt={project.author.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        creatorInitial
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold text-white truncate">
                        {project.author?.name || 'NST Student'}
                      </h4>
                      {project.author?.slug && (
                        <p className="text-xs font-mono text-blue-400">
                          @{project.author.slug}
                        </p>
                      )}
                      <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified Student</span>
                      </div>
                    </div>
                  </div>

                  {project.author?.slug ? (
                    <Link
                      href={`/students/${project.author.slug}`}
                      className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-[#0057FF] hover:bg-blue-600 text-white transition-all shadow-md"
                    >
                      <span>View Student Portfolio</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  ) : null}
                </div>

                {/* Team & Accepted Collaborators - Strict Privacy (No emails exposed) */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-bold flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>Project Contributors</span>
                    </h3>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {acceptedContributors.length + 1} total
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Owner attribution row */}
                    {project.author?.slug ? (
                      <Link
                        href={`/students/${project.author.slug}`}
                        className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-blue-500/60 transition-all flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                          {project.author?.avatar_url ? (
                            <img src={project.author.avatar_url} alt={project.author.name} className="w-full h-full object-cover" />
                          ) : (
                            creatorInitial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                            {project.author?.name || 'NST Student'}
                          </div>
                          <div className="text-[10px] text-blue-400 font-mono">Lead & Creator ↗</div>
                        </div>
                      </Link>
                    ) : (
                      <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                          {creatorInitial}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{project.author?.name || 'NST Student'}</div>
                          <div className="text-[10px] text-blue-400 font-mono">Lead & Creator</div>
                        </div>
                      </div>
                    )}

                    {/* Accepted Contributors list */}
                    {acceptedContributors.length > 0 ? (
                      acceptedContributors.map((c) => {
                        const contributorCard = (
                          <>
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs overflow-hidden shrink-0">
                              {c.avatar_url ? (
                                <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                c.name ? c.name.charAt(0).toUpperCase() : 'C'
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-zinc-200 truncate group-hover:text-blue-400 transition-colors">
                                {c.name}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono truncate">
                                {c.role} {c.slug ? '↗' : ''}
                              </div>
                            </div>
                          </>
                        );

                        return c.slug ? (
                          <Link
                            key={c.id}
                            href={`/students/${c.slug}`}
                            className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-blue-500/60 transition-all flex items-center gap-3 group"
                          >
                            {contributorCard}
                          </Link>
                        ) : (
                          <div key={c.id} className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-center gap-3">
                            {contributorCard}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[11px] text-zinc-500 font-mono italic px-1 pt-1">
                        Solo project submission
                      </p>
                    )}
                  </div>
                </div>

                {/* Technology & Tools Stack - Rendered only if tags exist */}
                {project.tags && project.tags.length > 0 && (
                  <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-6">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2 font-bold">
                      <Code2 className="w-4 h-4 text-blue-400" />
                      <span>Technologies & Tools</span>
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

                {/* Project Specifications & Verification Ledger */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-6 space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold mb-3">
                    Project Verification
                  </h3>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-zinc-900">
                    <span className="font-mono text-zinc-500 uppercase">Category</span>
                    <span className="font-semibold text-zinc-300">{project.category}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-zinc-900">
                    <span className="font-mono text-zinc-500 uppercase">Type</span>
                    <span className="font-semibold text-zinc-300">{project.project_type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-zinc-900">
                    <span className="font-mono text-zinc-500 uppercase">Status</span>
                    <span className="font-semibold text-zinc-300">{project.development_status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <span className="font-mono text-zinc-500 uppercase">Visibility</span>
                    <span className="font-semibold text-emerald-400">{project.visibility}</span>
                  </div>
                </div>

                {/* Secondary Actions & Report Link */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to all</span>
                  </Link>
                  <ProjectReportModal projectId={project.id} projectTitle={project.title} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
