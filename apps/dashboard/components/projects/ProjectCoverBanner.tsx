'use client';

import React, { useState } from 'react';
import { Layers, Sparkles, Code2, Cpu, Globe, Terminal, Box, Shield } from 'lucide-react';

/**
 * Checks whether a given image URL points to a known stock-watermarked source
 * or an invalid/unrenderable image path.
 */
export function isWatermarkedStockImage(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();

  // Known stock watermarked domains and keywords
  const stockPatterns = [
    'shutterstock.com',
    'istockphoto.com',
    'gettyimages.com',
    'stock.adobe.com',
    'dreamstime.com',
    'depositphotos.com',
    '123rf.com',
    'alamy.com',
    'vectorstock.com',
    'freepik.com/premium',
    'watermark',
    'stock-vector',
    'stock-photo',
  ];

  if (stockPatterns.some((pattern) => lower.includes(pattern))) {
    return true;
  }

  // Check for invalid schemes
  if (!lower.startsWith('http://') && !lower.startsWith('https://') && !lower.startsWith('/')) {
    return true;
  }

  return false;
}

/**
 * Category-specific styling tokens for designed fallback covers.
 */
const CATEGORY_THEMES: Record<
  string,
  {
    gradient: string;
    glowColor: string;
    accentBorder: string;
    textColor: string;
    badgeBg: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  'AI / Machine Learning': {
    gradient: 'from-blue-600/30 via-indigo-950/80 to-[#07080d]',
    glowColor: 'rgba(0, 87, 255, 0.25)',
    accentBorder: 'rgba(0, 87, 255, 0.4)',
    textColor: '#60A5FA',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: Cpu,
  },
  'Web / Fullstack': {
    gradient: 'from-emerald-600/30 via-teal-950/80 to-[#07080d]',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    accentBorder: 'rgba(16, 185, 129, 0.4)',
    textColor: '#34D399',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icon: Globe,
  },
  'Mobile Application': {
    gradient: 'from-purple-600/30 via-violet-950/80 to-[#07080d]',
    glowColor: 'rgba(139, 92, 246, 0.25)',
    accentBorder: 'rgba(139, 92, 246, 0.4)',
    textColor: '#A78BFA',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: Sparkles,
  },
  'Systems & Infrastructure': {
    gradient: 'from-amber-600/30 via-orange-950/80 to-[#07080d]',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    accentBorder: 'rgba(245, 158, 11, 0.4)',
    textColor: '#FBBF24',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: Terminal,
  },
  'Cybersecurity & Tools': {
    gradient: 'from-rose-600/30 via-red-950/80 to-[#07080d]',
    glowColor: 'rgba(244, 63, 94, 0.25)',
    accentBorder: 'rgba(244, 63, 94, 0.4)',
    textColor: '#FB7185',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    icon: Shield,
  },
  default: {
    gradient: 'from-sky-600/25 via-slate-900/90 to-[#07080d]',
    glowColor: 'rgba(14, 165, 233, 0.2)',
    accentBorder: 'rgba(14, 165, 233, 0.35)',
    textColor: '#38BDF8',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    icon: Box,
  },
};

interface ProjectCoverBannerProps {
  coverImageUrl?: string | null;
  title: string;
  category?: string;
  tagline?: string | null;
  tags?: string[];
  developmentStatus?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  hideTitleOverlay?: boolean;
}

export function ProjectCoverBanner({
  coverImageUrl,
  title,
  category = 'Engineering',
  tagline,
  tags = [],
  developmentStatus,
  className = '',
  size = 'lg',
  hideTitleOverlay = false,
}: ProjectCoverBannerProps) {
  const [imageError, setImageError] = useState(false);

  const isStock = isWatermarkedStockImage(coverImageUrl);
  const shouldRenderFallback = !coverImageUrl || isStock || imageError;

  const theme = CATEGORY_THEMES[category] || CATEGORY_THEMES.default;
  const CategoryIcon = theme.icon;

  const monogram = (title || 'PR')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const heightClasses =
    size === 'sm'
      ? 'h-36 sm:h-44'
      : size === 'md'
      ? 'h-52 sm:h-64'
      : 'h-64 sm:h-80 md:h-96';

  if (!shouldRenderFallback) {
    return (
      <div
        className={`w-full ${heightClasses} rounded-2xl overflow-hidden border border-zinc-800/80 relative bg-zinc-950 group ${className}`}
      >
        <img
          src={coverImageUrl!}
          alt={title}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent opacity-90" />
      </div>
    );
  }

  // Designed Fallback Banner
  return (
    <div
      className={`w-full ${heightClasses} rounded-2xl overflow-hidden border relative flex flex-col justify-between p-6 sm:p-8 select-none transition-all duration-300 ${className}`}
      style={{
        background: `radial-gradient(circle at 80% 20%, ${theme.glowColor}, transparent 60%), #07080d`,
        borderColor: theme.accentBorder,
        boxShadow: `0 0 40px -10px ${theme.glowColor}`,
      }}
    >
      {/* Background Dot Texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.2) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Decorative Gradient Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-50 pointer-events-none`}
      />

      {/* Top Bar: Category Pill & Institutional Stamp */}
      <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider border backdrop-blur-sm ${theme.badgeBg}`}
          >
            <CategoryIcon className="w-3.5 h-3.5" />
            <span>{category}</span>
          </span>

          {developmentStatus && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold uppercase tracking-wider bg-zinc-900/80 text-zinc-400 border border-zinc-800 backdrop-blur-sm">
              {developmentStatus.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-zinc-950/70 border border-zinc-800/80 px-2.5 py-1 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>NST PROJECT SHOWCASE</span>
        </div>
      </div>

      {/* Center Artwork: Monogram Shield & Title */}
      <div className="relative z-10 my-auto py-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-['Syne',sans-serif] font-black text-2xl sm:text-3xl text-white shadow-xl border shrink-0"
            style={{
              background: `linear-gradient(135deg, rgba(255,255,255,0.12), rgba(0,0,0,0.8))`,
              borderColor: theme.accentBorder,
              color: '#ffffff',
            }}
          >
            {monogram}
          </div>

          {!hideTitleOverlay ? (
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white line-clamp-2">
                {title}
              </h2>
              {tagline && (
                <p className="mt-1 text-xs sm:text-sm text-zinc-300 font-medium line-clamp-2 max-w-2xl leading-relaxed">
                  {tagline}
                </p>
              )}
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 font-bold block">
                ENGINEERING SPECIFICATION & CASE STUDY
              </span>
              <p className="text-xs sm:text-sm text-zinc-300 font-mono mt-0.5">
                Authored by Newton School of Technology Students
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar: Tags */}
      {tags && tags.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-1.5 pt-2">
          {tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-zinc-300 bg-black/50 border border-zinc-800/80 backdrop-blur-sm"
            >
              #{tag}
            </span>
          ))}
          {tags.length > 5 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 bg-black/50 border border-zinc-800/80">
              +{tags.length - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
