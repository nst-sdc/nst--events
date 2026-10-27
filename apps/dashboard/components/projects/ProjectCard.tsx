'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Eye, ArrowRight, ExternalLink, GitBranch, Video, BookOpen } from 'lucide-react';
import { ProjectCardItem } from '../../lib/projects-api';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  LIVE: {
    label: 'LIVE NOW',
    bg: '#0057FF',
    color: '#ffffff',
  },
  PROTOTYPE: {
    label: 'PROTOTYPE',
    bg: '#0057FF',
    color: '#ffffff',
  },
  IN_PROGRESS: {
    label: 'IN PROGRESS',
    bg: '#FF9500',
    color: '#000000',
  },
  COMPLETED: {
    label: 'COMPLETED',
    bg: '#000000',
    color: '#ffffff',
  },
  IDEA: {
    label: 'CONCEPT',
    bg: '#e0e0e0',
    color: '#000000',
  },
  ARCHIVED: {
    label: 'ARCHIVED',
    bg: '#e0e0e0',
    color: '#666666',
  },
};

import { isWatermarkedStockImage } from './ProjectCoverBanner';

export function ProjectCard({ project }: { project: ProjectCardItem }) {
  const [imageError, setImageError] = React.useState(false);
  const isStock = isWatermarkedStockImage(project.cover_image_url);
  const hasValidImage = project.cover_image_url && !isStock && !imageError;

  const status = STATUS_CONFIG[project.development_status] || {
    label: project.development_status,
    bg: '#000000',
    color: '#ffffff',
  };

  const hasDemo = project.links?.some((l) => l.type === 'DEMO');
  const hasRepo = project.links?.some((l) => l.type === 'REPOSITORY');
  const hasVideo = project.links?.some((l) => l.type === 'VIDEO');
  const hasDocs = project.links?.some((l) => l.type === 'DOCUMENTATION');

  const monogram = (project.title || 'PR')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="me-poster-card"
    >
      <div>
        {/* Card Header: Category Badge & Status Pill */}
        <div className="me-card-header">
          <span className="me-date-badge">
            {project.category}
          </span>
          <span
            className="me-status-pill"
            style={{ background: status.bg, color: status.color }}
          >
            {status.label}
          </span>
        </div>

        {/* Photo Frame */}
        <div className="me-photo-frame">
          {hasValidImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={project.cover_image_url}
              alt={project.title}
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="me-photo-placeholder" style={{ background: 'linear-gradient(135deg, #0d1117, #161b22)' }}>
              <span className="me-photo-watermark">{project.category?.toUpperCase() || 'PROJECT'}</span>
              <div style={{ textAlign: 'center', zIndex: 2, padding: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    background: '#0057FF',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontFamily: 'var(--font-display, "Syne", sans-serif)',
                    fontSize: '18px',
                    boxShadow: '0 4px 12px rgba(0,87,255,0.4)',
                  }}
                >
                  {monogram}
                </div>
              </div>
            </div>
          )}

          {/* Quick Artifact Badges Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              display: 'flex',
              gap: '6px',
              background: '#000000',
              padding: '4px 8px',
              border: '1px solid #ffffff',
              color: '#ffffff',
            }}
          >
            {hasDemo && <span title="Live Demo"><ExternalLink size={12} style={{ color: '#C8FF00' }} /></span>}
            {hasRepo && <span title="Source Code"><GitBranch size={12} style={{ color: '#ffffff' }} /></span>}
            {hasVideo && <span title="Video Showcase"><Video size={12} style={{ color: '#FF3B30' }} /></span>}
            {hasDocs && <span title="Documentation"><BookOpen size={12} style={{ color: '#0057FF' }} /></span>}
          </div>
        </div>

        {/* Project Title */}
        <h2 className="me-card-title">
          {project.title}
        </h2>

        {/* Creator Attribution */}
        <div className="me-card-meta">
          <span style={{ color: '#666' }}>BY</span>
          <span style={{ color: '#000', fontWeight: 800 }}>
            {project.author?.name?.toUpperCase() || 'NST STUDENT'}
          </span>
        </div>

        {/* Tagline / Excerpt */}
        <p style={{ fontFamily: 'var(--font-body, Inter, sans-serif)', fontSize: '13px', color: '#333333', lineHeight: 1.5, marginBottom: '14px' }}>
          {project.tagline}
        </p>

        {/* Technology Tags */}
        {project.tags && project.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {project.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  background: '#000000',
                  color: '#ffffff',
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                #{tag}
              </span>
            ))}
            {project.tags.length > 3 && (
              <span
                style={{
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#666666',
                  alignSelf: 'center',
                }}
              >
                +{project.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Likes, Views, and Action */}
      <div className="me-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FF3B30' }}>
            <Heart size={13} fill="#FF3B30" />
            <span>{project.like_count}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#555555' }}>
            <Eye size={13} />
            <span>{project.view_count || 0}</span>
          </span>
        </div>

        <span className="me-pass-btn">
          VIEW PROJECT <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}
