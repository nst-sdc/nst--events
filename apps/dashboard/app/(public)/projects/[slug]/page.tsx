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

const projectDetailStyles = `
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

  .proj-detail-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  html.light .proj-detail-page, .light .proj-detail-page {
    background-color: #fbfbfb;
    color: #131313;
  }

  .proj-dot-grid {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.25;
    background-image: radial-gradient(rgba(245, 245, 242, 0.12) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  html.light .proj-dot-grid, .light .proj-dot-grid {
    opacity: 0.15;
    background-image: radial-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px);
  }

  .proj-watermark {
    position: absolute;
    top: 40px;
    right: 20px;
    font-family: var(--font-display);
    font-size: clamp(70px, 12vw, 160px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.02);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
    z-index: 0;
  }

  html.light .proj-watermark, .light .proj-watermark {
    color: rgba(0, 0, 0, 0.03);
  }

  .neo-panel-card {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.15);
    box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.7);
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
    box-shadow: 6px 6px 0px #000000;
  }

  html.light .neo-panel-card:hover, .light .neo-panel-card:hover {
    border-color: #000000;
    box-shadow: 8px 8px 0px #000000;
  }

  .neo-tag-pill {
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
    border: 1px solid rgba(245, 245, 242, 0.2);
    background: rgba(245, 245, 242, 0.05);
  }

  html.light .neo-tag-pill, .light .neo-tag-pill {
    border: 1px solid #000000;
    background: #f0f0f0;
    color: #000000;
  }
`;

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
        <style dangerouslySetInnerHTML={{ __html: projectDetailStyles }} />
        <div className="proj-detail-page relative selection:bg-[#0057FF] selection:text-white">
          {/* Subtle Background Cyber Dot Texture */}
          <div className="proj-dot-grid" />

          {/* Background Watermark */}
          <div className="proj-watermark">
            PROJECT
          </div>

          {/* Inject Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Main Case Study Layout */}
          <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            {/* Top Navigation & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black/15 dark:border-white/15 pb-4 mb-8">
              <Link
                href="/projects"
                className="inline-flex items-center space-x-2 text-zinc-600 dark:text-zinc-400 hover:text-[#0057FF] dark:hover:text-[#0057FF] font-mono text-xs font-bold uppercase tracking-wider transition-colors"
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
            <div className="border-b-2 border-black/15 dark:border-white/15 pb-8 mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="neo-tag-pill font-mono font-bold">
                  {project.category}
                </span>
                <span className="neo-tag-pill font-mono font-bold text-zinc-700 dark:text-zinc-300">
                  {project.development_status.replace('_', ' ')}
                </span>
                <span className="neo-tag-pill font-mono text-zinc-600 dark:text-zinc-400">
                  {project.project_type.replace('_', ' ')}
                </span>
                {project.published_at && (
                  <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 font-mono text-xs ml-auto font-bold uppercase">
                    <Calendar className="w-3.5 h-3.5 text-[#0057FF]" />
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

              {/* Single authoritative Title in bold Syne */}
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-zinc-950 dark:text-[#F5F5F2] leading-tight font-['Syne',sans-serif]">
                {project.title}
              </h1>

              {/* Strong One-Line Summary */}
              {project.tagline && (
                <p className="mt-4 text-base sm:text-lg text-zinc-800 dark:text-zinc-300 max-w-3xl leading-relaxed font-sans">
                  {project.tagline}
                </p>
              )}

              {/* Quick Header Identity Row */}
              <div className="flex flex-wrap items-center gap-6 mt-6 pt-5 border-t-2 border-black/10 dark:border-white/10">
                {project.author?.slug ? (
                  <Link
                    href={`/students/${project.author.slug}`}
                    className="inline-flex items-center space-x-3 group hover:opacity-95 transition-opacity"
                  >
                    <div className="w-10 h-10 rounded-none bg-black dark:bg-[#12131a] border-2 border-black/30 dark:border-white/30 flex items-center justify-center text-white font-black font-['Syne',sans-serif] text-sm overflow-hidden shrink-0 shadow-[2px_2px_0px_#0057FF]">
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
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">PROJECT LEAD</p>
                      <p className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-[#0057FF] transition-colors flex items-center gap-1 font-['Syne',sans-serif]">
                        <span>{project.author?.name || 'NST Student'}</span>
                        <span className="text-xs text-[#0057FF] font-mono">@{project.author.slug} ↗</span>
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-none bg-black dark:bg-[#12131a] border-2 border-black/30 dark:border-white/30 flex items-center justify-center text-white font-black font-['Syne',sans-serif] text-sm overflow-hidden shrink-0 shadow-[2px_2px_0px_#0057FF]">
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
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">PROJECT LEAD</p>
                      <p className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-200 font-['Syne',sans-serif]">{project.author?.name || 'NST Student'}</p>
                    </div>
                  </div>
                )}

                <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 border-l-2 border-black/15 dark:border-white/15 pl-6">
                  <Users className="w-4 h-4 text-[#0057FF] shrink-0" />
                  <span>{acceptedContributors.length} accepted collaborator{acceptedContributors.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 border-l-2 border-black/15 dark:border-white/15 pl-6">
                  <Eye className="w-4 h-4 text-cyan-500 shrink-0" />
                  <span>{project.view_count || 0} views</span>
                </div>
              </div>
            </div>

            {/* Showcase Action Bar (Live Demo, Repository, Docs, Video) - Rendered only when valid links exist */}
            {(demoLink || repoLink || videoLink || docLink || otherLinks.length > 0) && (
              <div className="mb-8 p-4 sm:p-5 rounded-none bg-white dark:bg-[#0d0e12] border-2 border-black/15 dark:border-white/15 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_rgba(0,0,0,0.8)] flex flex-wrap items-center gap-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mr-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0057FF]" />
                  <span>Showcase Artifacts:</span>
                </span>

                {demoLink && (
                  <a
                    href={demoLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-black uppercase tracking-wider rounded-none bg-[#C8FF00] hover:bg-[#b8eb00] text-black border-2 border-black transition-all shadow-[3px_3px_0px_#000000]"
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
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-none bg-black/5 dark:bg-white/5 hover:bg-[#0057FF] hover:text-white text-zinc-900 dark:text-white border-2 border-black/20 dark:border-white/20 transition-all shadow-[3px_3px_0px_rgba(0,0,0,0.3)]"
                  >
                    <GitBranch className="w-4 h-4 text-[#0057FF]" />
                    <span>{repoLink.label || 'View Source Code'}</span>
                  </a>
                )}

                {videoLink && (
                  <a
                    href={videoLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-none bg-black/5 dark:bg-white/5 hover:bg-rose-600 hover:text-white text-zinc-900 dark:text-white border-2 border-black/20 dark:border-white/20 transition-all shadow-[3px_3px_0px_rgba(0,0,0,0.3)]"
                  >
                    <Video className="w-4 h-4 text-rose-500" />
                    <span>{videoLink.label || 'Watch Video Demo'}</span>
                  </a>
                )}

                {docLink && (
                  <a
                    href={docLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-none bg-black/5 dark:bg-white/5 hover:bg-cyan-600 hover:text-white text-zinc-900 dark:text-white border-2 border-black/20 dark:border-white/20 transition-all shadow-[3px_3px_0px_rgba(0,0,0,0.3)]"
                  >
                    <BookOpen className="w-4 h-4 text-cyan-500" />
                    <span>{docLink.label || 'Documentation'}</span>
                  </a>
                )}

                {otherLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-none text-zinc-800 dark:text-zinc-300 hover:text-white hover:bg-[#0057FF] border-2 border-black/20 dark:border-white/20 transition-all shadow-[3px_3px_0px_rgba(0,0,0,0.3)]"
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
              <div className="lg:col-span-2 space-y-8 order-1">
                {/* Long-Form Markdown Documentation */}
                <section className="rounded-none border-2 border-black/15 dark:border-white/15 bg-white dark:bg-[#0d0e12] p-6 sm:p-8 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_rgba(0,0,0,0.8)]">
                  <div className="flex items-center justify-between border-b-2 border-black/10 dark:border-white/10 pb-4 mb-6">
                    <div className="flex items-center gap-2.5 text-xs font-mono font-bold uppercase tracking-wider text-[#0057FF]">
                      <FileText className="w-4 h-4" />
                      <span>Case Study & Technical Documentation</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 uppercase font-bold tracking-wider px-2 py-0.5 border border-black/10 dark:border-white/10">
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
                <div className="neo-panel-card p-6 relative overflow-hidden">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#0057FF] font-bold mb-4 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>Project Lead & Creator</span>
                  </div>

                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-none bg-black dark:bg-[#12131a] border-2 border-black/30 dark:border-white/30 flex items-center justify-center text-white font-black font-['Syne',sans-serif] text-xl overflow-hidden shrink-0 shadow-[4px_4px_0px_#0057FF]">
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
                      <h4 className="text-base font-black uppercase tracking-tight text-zinc-950 dark:text-white truncate font-['Syne',sans-serif]">
                        {project.author?.name || 'NST Student'}
                      </h4>
                      {project.author?.slug && (
                        <p className="text-xs font-mono text-[#0057FF] font-bold">
                          @{project.author.slug}
                        </p>
                      )}
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-[#C8FF00]/10 text-emerald-800 dark:text-[#C8FF00] border border-[#C8FF00]/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified Student</span>
                      </div>
                    </div>
                  </div>

                  {project.author?.slug ? (
                    <Link
                      href={`/students/${project.author.slug}`}
                      className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-none text-xs font-mono font-bold uppercase tracking-wider bg-[#0057FF] hover:bg-blue-600 text-white transition-all shadow-[4px_4px_0px_#000000]"
                    >
                      <span>View Student Portfolio</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  ) : null}
                </div>

                {/* Team & Accepted Collaborators - Strict Privacy (No emails exposed) */}
                <div className="neo-panel-card p-6">
                  <div className="flex items-center justify-between border-b-2 border-black/10 dark:border-white/10 pb-3 mb-4">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-900 dark:text-zinc-200 font-bold flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0057FF]" />
                      <span>Project Contributors</span>
                    </h3>
                    <span className="text-[11px] font-mono text-zinc-500 font-bold uppercase">
                      [{acceptedContributors.length + 1} total]
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Owner attribution row */}
                    {project.author?.slug ? (
                      <Link
                        href={`/students/${project.author.slug}`}
                        className="p-3 rounded-none bg-black/5 dark:bg-white/5 border-2 border-black/15 dark:border-white/10 hover:border-[#0057FF] transition-all flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-none bg-[#0057FF] flex items-center justify-center text-white font-black font-['Syne',sans-serif] text-xs overflow-hidden shrink-0 border border-black/20">
                          {project.author?.avatar_url ? (
                            <img src={project.author.avatar_url} alt={project.author.name} className="w-full h-full object-cover" />
                          ) : (
                            creatorInitial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:text-[#0057FF] transition-colors">
                            {project.author?.name || 'NST Student'}
                          </div>
                          <div className="text-[10px] text-[#0057FF] font-mono font-bold uppercase">Lead & Creator ↗</div>
                        </div>
                      </Link>
                    ) : (
                      <div className="p-3 rounded-none bg-black/5 dark:bg-white/5 border-2 border-black/15 dark:border-white/10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-[#0057FF] flex items-center justify-center text-white font-black font-['Syne',sans-serif] text-xs overflow-hidden shrink-0">
                          {creatorInitial}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{project.author?.name || 'NST Student'}</div>
                          <div className="text-[10px] text-[#0057FF] font-mono font-bold uppercase">Lead & Creator</div>
                        </div>
                      </div>
                    )}

                    {/* Accepted Contributors list */}
                    {acceptedContributors.length > 0 ? (
                      acceptedContributors.map((c) => {
                        const contributorCard = (
                          <>
                            <div className="w-8 h-8 rounded-none bg-zinc-200 dark:bg-zinc-800 border border-black/20 dark:border-white/20 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-black font-['Syne',sans-serif] text-xs overflow-hidden shrink-0">
                              {c.avatar_url ? (
                                <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                c.name ? c.name.charAt(0).toUpperCase() : 'C'
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-[#0057FF] transition-colors">
                                {c.name}
                              </div>
                              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono font-bold truncate">
                                {c.role} {c.slug ? '↗' : ''}
                              </div>
                            </div>
                          </>
                        );

                        return c.slug ? (
                          <Link
                            key={c.id}
                            href={`/students/${c.slug}`}
                            className="p-3 rounded-none bg-black/5 dark:bg-white/5 border-2 border-black/15 dark:border-white/10 hover:border-[#0057FF] transition-all flex items-center gap-3 group"
                          >
                            {contributorCard}
                          </Link>
                        ) : (
                          <div key={c.id} className="p-3 rounded-none bg-black/5 dark:bg-white/5 border-2 border-black/15 dark:border-white/10 flex items-center gap-3">
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
                  <section className="neo-panel-card p-6">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-900 dark:text-zinc-300 mb-3 flex items-center gap-2 font-bold border-b-2 border-black/10 dark:border-white/10 pb-2">
                      <Code2 className="w-4 h-4 text-[#0057FF]" />
                      <span>Technologies & Tools</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <Link
                          key={tag}
                          href={`/projects?tag=${encodeURIComponent(tag)}`}
                          className="px-3 py-1 text-xs font-mono font-bold bg-black/5 dark:bg-white/5 hover:bg-[#0057FF] hover:text-white text-zinc-800 dark:text-zinc-300 border-2 border-black/15 dark:border-white/15 transition-all shadow-[2px_2px_0px_rgba(0,0,0,0.3)]"
                        >
                          #{tag}
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Project Specifications & Verification Ledger */}
                <div className="neo-panel-card p-6 space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-900 dark:text-zinc-300 font-bold mb-3 border-b-2 border-black/10 dark:border-white/10 pb-2">
                    Project Verification
                  </h3>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-black/10 dark:border-white/10">
                    <span className="font-mono text-zinc-500 uppercase font-bold">Category</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-200">[{project.category}]</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-black/10 dark:border-white/10">
                    <span className="font-mono text-zinc-500 uppercase font-bold">Type</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-200">[{project.project_type.replace('_', ' ')}]</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-black/10 dark:border-white/10">
                    <span className="font-mono text-zinc-500 uppercase font-bold">Status</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-200">[{project.development_status.replace('_', ' ')}]</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <span className="font-mono text-zinc-500 uppercase font-bold">Visibility</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-[#C8FF00]">[{project.visibility}]</span>
                  </div>
                </div>

                {/* Secondary Actions & Report Link */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 hover:text-[#0057FF] transition-colors"
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
