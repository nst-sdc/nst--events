import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import {
  projectsApi,
  ProjectsListResponse,
  ProjectCategoryItem,
  ProjectCardItem,
} from '../../../lib/projects-api';
import { ProjectCard } from '../../../components/projects/ProjectCard';
import { ProjectsDiscoveryBar } from '../../../components/projects/ProjectsDiscoveryBar';
import { StudentAppShell } from '../../../components/layout/StudentAppShell';
import { ClubAdminProvider } from '../../../components/layout/ClubAdminProvider';

interface PageProps {
  searchParams: Promise<{
    view?: 'explore' | 'trending' | 'most_liked' | 'recent';
    category?: string;
    tag?: string;
    status?: string;
    search?: string;
    page?: string;
    timeRange?: 'all' | 'week' | 'month';
  }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  const categoryStr = params.category ? ` in ${params.category}` : '';

  return {
    title: `NST Projects — Built at NST. Shared with the world.${categoryStr}`,
    description:
      'Discover cutting-edge student software, open-source repositories, machine learning models, and engineering prototypes built by verified students at Newton School of Technology.',
    alternates: {
      canonical: `${siteUrl}/projects`,
    },
    openGraph: {
      title: 'NST Projects — Student Showcase & Innovation Directory',
      description: 'Explore student-built software, web apps, mobile tools, and research from NST.',
      url: `${siteUrl}/projects`,
      siteName: 'NST Projects',
      type: 'website',
      images: [
        {
          url: `${siteUrl}/icon.png`,
          width: 512,
          height: 512,
          alt: 'NST Projects Logo',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'NST Projects — Built at NST. Shared with the world.',
      description: 'Discover student innovations, open-source repositories, and technical case studies.',
    },
  };
}

const projectsStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --electric-blue-dark: #0042c7;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --warm-amber: #FF9500;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .me-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .me-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: 60px 32px 100px 32px;
  }

  @media (max-width: 900px) {
    .me-inner {
      padding: 40px 16px 80px 16px;
    }
  }

  @media (max-width: 640px) {
    .me-inner {
      padding: 24px 16px 80px 16px;
    }
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
  .me-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .me-micro-blue { color: var(--electric-blue); }

  /* ── Display Typography ── */
  .me-hero-title {
    font-family: var(--font-display);
    font-size: clamp(32px, 7.5vw, 110px);
    font-weight: 900;
    line-height: 0.92;
    letter-spacing: -1.5px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .me-header {
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 28px;
    margin-bottom: 36px;
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .me-header {
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
  }

  .me-watermark {
    position: absolute;
    top: -20px;
    right: 0;
    font-family: var(--font-display);
    font-size: clamp(60px, 12vw, 160px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.03);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
  }

  /* ── Controls & Tabs Row ── */
  .me-controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    border-bottom: 1px solid rgba(245,245,242,0.2);
    padding-bottom: 20px;
    margin-bottom: 32px;
  }

  @media (max-width: 768px) {
    .me-controls-row {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
  }

  .me-tabs-group {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 2px;
    max-width: 100%;
  }

  .me-tabs-group::-webkit-scrollbar {
    display: none;
  }

  .me-tab-btn {
    background: transparent;
    color: #a0a4b8;
    border: 2px solid rgba(245,245,242,0.25);
    padding: 10px 18px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    cursor: pointer;
    transition: all 0.15s;
    border-radius: 0 !important;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    flex-shrink: 0;
    min-height: 42px;
    touch-action: manipulation;
  }

  @media (max-width: 480px) {
    .me-tab-btn {
      padding: 8px 14px;
      font-size: 10px;
      letter-spacing: 1px;
    }
  }

  .me-tab-btn:hover {
    border-color: var(--bg-paper-white);
    color: var(--bg-paper-white);
  }
  .me-tab-btn.active {
    background: var(--electric-blue);
    color: #ffffff;
    border-color: var(--electric-blue);
    box-shadow: 4px 4px 0px rgba(255,255,255,0.3);
  }

  /* ── Poster Wall Cards Grid ── */
  .me-poster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 40px;
  }

  @media (max-width: 900px) {
    .me-poster-grid {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }

  .me-poster-card {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 3px solid #000000;
    padding: 20px;
    box-shadow: 10px 10px 0px #000000;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    position: relative;
    text-decoration: none;
    border-radius: 0 !important;
    min-width: 0;
    transform: translateZ(0);
    backface-visibility: hidden;
    contain: content;
    content-visibility: auto;
    contain-intrinsic-size: 380px 480px;
  }

  .me-poster-card:hover {
    transform: translate3d(-4px, -4px, 0) rotate(-1deg);
    box-shadow: 14px 14px 0px #000000;
  }

  .me-poster-card:nth-child(even) {
    transform: rotate(1.5deg) translateZ(0);
  }

  .me-poster-card:nth-child(even):hover {
    transform: translate3d(-4px, -4px, 0) rotate(0.5deg);
  }

  @media (max-width: 900px) {
    .me-poster-card:nth-child(even) {
      transform: none;
    }
  }

  @media (max-width: 640px) {
    .me-poster-card {
      box-shadow: 6px 6px 0px #000000;
      padding: 16px;
    }
    .me-poster-card:hover {
      transform: none;
      box-shadow: 6px 6px 0px #000000;
    }
  }

  .me-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  .me-date-badge {
    background: #000;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .me-status-pill {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 800;
    padding: 3px 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: 1px solid #000;
  }

  .me-status-confirmed {
    background: var(--electric-blue);
    color: #fff;
  }

  .me-photo-frame {
    width: 100%;
    height: 180px;
    background: #111;
    border: 2px solid #000;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
  }
  .me-photo-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(125%) grayscale(80%);
    transition: filter 0.3s ease;
  }
  .me-poster-card:hover .me-photo-frame img {
    filter: contrast(100%) grayscale(0%);
  }

  .me-photo-placeholder {
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
  .me-photo-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(0,87,255,0.2) 1px, transparent 1px);
    background-size: 16px 16px;
  }

  .me-photo-watermark {
    font-family: var(--font-display);
    font-size: 48px;
    font-weight: 900;
    color: rgba(255,255,255,0.08);
    text-transform: uppercase;
    letter-spacing: -2px;
    z-index: 1;
  }

  .me-card-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 900;
    line-height: 1.1;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 52px;
  }

  .me-card-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: #333;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

  .me-card-tagline {
    font-family: var(--font-body, Inter, sans-serif);
    font-size: 13.5px;
    color: #333333;
    line-height: 1.5;
    margin-bottom: 14px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 40px;
  }

  .me-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
    min-height: 22px;
    align-items: center;
  }

  .me-tag-pill {
    background: #000000;
    color: #ffffff;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .me-tag-more {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 10px;
    font-weight: 700;
    color: #666666;
    align-self: center;
  }

  .me-card-footer {
    border-top: 2px dashed #000;
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
  }

  .me-pass-btn {
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
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 0 !important;
  }

  /* ── Editorial Empty State Poster ── */
  .me-empty-poster {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: clamp(32px, 6vw, 60px) clamp(20px, 4vw, 40px);
    position: relative;
    overflow: hidden;
    box-shadow: 10px 10px 0px var(--electric-blue);
    border-radius: 0 !important;
  }

  @media (max-width: 640px) {
    .me-empty-poster {
      box-shadow: 6px 6px 0px var(--electric-blue);
    }
  }

  .me-empty-watermark {
    position: absolute;
    bottom: -20px;
    right: -20px;
    font-family: var(--font-display);
    font-size: clamp(80px, 14vw, 140px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.04);
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
  }

  .me-empty-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--electric-blue);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 12px 24px;
    border: 2px solid var(--bg-paper-white);
    cursor: pointer;
    box-shadow: 4px 4px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
    text-decoration: none;
    border-radius: 0 !important;
    min-height: 44px;
    touch-action: manipulation;
  }
  .me-empty-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }

  /* ==========================================================================
     LIGHT THEME OVERRIDES (Scoped to html.light)
     ========================================================================== */
  html.light .me-page {
    background-color: #F8F9FA;
    color: #0A0D14;
  }

  html.light .collage-noise-overlay {
    opacity: 0.15;
    background-image: radial-gradient(rgba(10, 13, 20, 0.12) 1px, transparent 1px);
  }

  html.light .me-micro {
    color: #475467;
  }

  html.light .me-hero-title {
    color: #0A0D14;
  }

  html.light .me-header {
    border-bottom: 3px solid #000000;
  }

  html.light .me-watermark {
    color: rgba(0, 0, 0, 0.03);
  }

  html.light .me-controls-row {
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }

  html.light .me-tab-btn {
    color: #475467;
    border-color: rgba(0, 0, 0, 0.2);
  }

  html.light .me-tab-btn:hover {
    border-color: #000000;
    color: #000000;
  }

  html.light .me-tab-btn.active {
    background: var(--electric-blue);
    color: #ffffff;
    border-color: #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .me-empty-poster {
    border: 3px solid #000000;
    background: #FFFFFF;
    color: #0A0D14;
    box-shadow: 10px 10px 0px var(--electric-blue);
  }

  @media (max-width: 640px) {
    html.light .me-empty-poster {
      box-shadow: 6px 6px 0px var(--electric-blue);
    }
  }

  html.light .me-empty-poster h2,
  html.light .me-empty-poster h3,
  html.light .me-empty-poster p {
    color: #0A0D14;
  }

  html.light .me-empty-watermark {
    color: rgba(0, 0, 0, 0.03);
  }

  html.light .me-empty-btn {
    border: 2px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .me-empty-btn:hover {
    box-shadow: 6px 6px 0px #000000;
  }
`;

export default async function ProjectsDirectoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = params.view || 'explore';
  const category = params.category;
  const tag = params.tag;
  const status = params.status;
  const search = params.search;
  const page = Number(params.page) || 1;
  const timeRange = params.timeRange || 'all';

  let projectsData: ProjectsListResponse = { items: [], pagination: { total: 0, totalPages: 1, page: 1, limit: 12 } };
  let categories: ProjectCategoryItem[] = [];

  try {
    const [projRes, catRes] = await Promise.all([
      projectsApi.listPublic({
        view,
        category,
        tag,
        status,
        search,
        page,
        limit: 12,
        timeRange,
      }),
      projectsApi.getCategories(),
    ]);
    projectsData = projRes;
    categories = catRes;
  } catch (err) {
    console.error('Failed to load projects on server:', err);
  }

  const items = projectsData.items || projectsData.data || [];
  const { total, totalPages } = projectsData.pagination;

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <style href="nst-projects-styles" precedence="high">
          {projectsStyles}
        </style>
        <div className="collage-noise-overlay" />

        <div className="me-page">
          <div className="me-inner">
            {/* Hero Header Section */}
            <section className="me-header">
              <div className="me-watermark">PROJECTS</div>
              <div className="me-micro me-micro-blue" style={{ marginBottom: '8px' }}>
                NST PROJECTS // BUILT AT NST. SHARED WITH THE WORLD.
              </div>
              <h1 className="me-hero-title">NST PROJECTS</h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginTop: '16px', maxWidth: '640px', lineHeight: 1.6 }}>
                Discover student software, mobile applications, AI systems, open-source developer tools, and engineering prototypes created by verified students across Newton School of Technology.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 sm:gap-4 w-full sm:w-auto">
                <Link href="/projects/submit" className="me-empty-btn w-full sm:w-auto text-center justify-center">
                  SUBMIT A PROJECT ↗
                </Link>
                <Link href="/my/projects" className="me-tab-btn w-full sm:w-auto text-center justify-center">
                  MY PROJECTS
                </Link>
              </div>
            </section>

            {/* Discovery Controls Bar */}
            <ProjectsDiscoveryBar
              currentView={view}
              currentCategory={category}
              currentTag={tag}
              currentStatus={status}
              currentSearch={search}
              currentTimeRange={timeRange}
              categories={categories}
            />

            {/* Results Count & Clear Filter Indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/15 dark:border-[#F5F5F2]/15 pb-4 mb-8">
              <div className="me-micro leading-relaxed">
                SHOWING <span className="text-zinc-950 dark:text-white font-black">{items.length}</span> OF <span className="text-zinc-950 dark:text-white font-black">{total}</span> VERIFIED PROJECTS
                {category && <span> {'//'} IN <strong style={{ color: '#0057FF' }}>{category.toUpperCase()}</strong></span>}
                {tag && <span> {'//'} TAGGED <strong style={{ color: '#0057FF' }}>#{tag.toUpperCase()}</strong></span>}
                {search && <span> {'//'} QUERY &ldquo;<strong className="text-zinc-950 dark:text-white font-black">{search.toUpperCase()}</strong>&rdquo;</span>}
              </div>
              {(category || tag || search || status) && (
                <Link href="/projects" scroll={false} className="me-micro me-micro-blue hover:underline shrink-0">
                  [ CLEAR ALL FILTERS ↺ ]
                </Link>
              )}
            </div>

            {/* Projects Poster Grid */}
            {items.length > 0 ? (
              <div className="me-poster-grid">
                {items.map((project: ProjectCardItem) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="me-empty-poster">
                <div className="me-empty-watermark">PROJECTS</div>
                <div className="me-micro me-micro-blue" style={{ marginBottom: '12px' }}>
                  DIRECTORY STATUS // 0 MATCHES
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 6vw, 60px)', fontWeight: 900, textTransform: 'uppercase', lineHeight: 0.95, marginBottom: '16px' }}>
                  NO PROJECTS<br />FOUND.<br />YET.
                </h2>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.6 }}>
                  No published projects match your current filter criteria. Try adjusting your search query, selecting another category, or submitting your own project.
                </p>
                <div className="flex flex-wrap gap-3 sm:gap-4 w-full sm:w-auto">
                  <Link href="/projects" scroll={false} className="me-empty-btn w-full sm:w-auto text-center justify-center">
                    RESET FILTERS ↺
                  </Link>
                  <Link href="/projects/submit" className="me-empty-btn w-full sm:w-auto text-center justify-center">
                    SUBMIT A PROJECT ↗
                  </Link>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-12 flex justify-center items-center gap-3 flex-wrap">
                {page > 1 && (
                  <Link
                    href={`/projects?page=${page - 1}${view ? `&view=${view}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                    scroll={false}
                    className="me-tab-btn"
                  >
                    PREVIOUS
                  </Link>
                )}
                <span className="me-micro text-zinc-950 dark:text-[#a0a4b8] px-2">
                  PAGE {page} OF {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/projects?page=${page + 1}${view ? `&view=${view}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                    scroll={false}
                    className="me-tab-btn"
                  >
                    NEXT
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
