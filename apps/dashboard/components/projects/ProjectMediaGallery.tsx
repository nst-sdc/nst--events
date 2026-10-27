'use client';

import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ProjectCoverBanner, isWatermarkedStockImage } from './ProjectCoverBanner';

interface MediaItem {
  id: string;
  type: 'cover' | 'screenshot' | 'video';
  url: string;
  title: string;
  caption?: string;
}

interface ProjectMediaGalleryProps {
  coverImageUrl?: string | null;
  galleryImageUrls?: string[];
  videoUrl?: string | null;
  videoLabel?: string | null;
  title: string;
  category: string;
  tagline?: string | null;
  tags?: string[];
  developmentStatus?: string;
  className?: string;
}

/**
 * Extracts a safe embed URL for common video providers like YouTube and Vimeo.
 */
function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const trimmed = url.trim();

    // YouTube: youtu.be/<id>
    const youtuBeMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
    if (youtuBeMatch) {
      return `https://www.youtube-nocookie.com/embed/${youtuBeMatch[1]}`;
    }

    // YouTube: youtube.com/watch?v=<id>
    const ytWatchMatch = trimmed.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i);
    if (ytWatchMatch) {
      return `https://www.youtube-nocookie.com/embed/${ytWatchMatch[1]}`;
    }

    // Vimeo: vimeo.com/<id>
    const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/i);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

export function ProjectMediaGallery({
  coverImageUrl,
  galleryImageUrls = [],
  videoUrl,
  videoLabel,
  title,
  category,
  tagline,
  tags = [],
  developmentStatus,
  className = '',
}: ProjectMediaGalleryProps) {
  // Filter valid screenshot URLs (non-stock, valid paths)
  const validScreenshots = (galleryImageUrls || []).filter(
    (url) => url && typeof url === 'string' && !isWatermarkedStockImage(url)
  );

  // Build media tabs list
  const mediaItems: MediaItem[] = [];

  // 1. Cover Image (or fallback)
  mediaItems.push({
    id: 'cover',
    type: 'cover',
    url: coverImageUrl || '',
    title: 'Cover Image',
    caption: 'Project Primary Artwork',
  });

  // 2. Additional Screenshots
  validScreenshots.forEach((sUrl, idx) => {
    mediaItems.push({
      id: `screenshot-${idx}`,
      type: 'screenshot',
      url: sUrl,
      title: `Screenshot ${idx + 1}`,
      caption: `Product Showcase Artifact #${idx + 1}`,
    });
  });

  // 3. Optional Video Demo
  if (videoUrl && typeof videoUrl === 'string' && /^https?:\/\//i.test(videoUrl.trim())) {
    mediaItems.push({
      id: 'video',
      type: 'video',
      url: videoUrl.trim(),
      title: videoLabel || 'Video Demo',
      caption: 'Live Demonstration & Walkthrough',
    });
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeMedia = mediaItems[activeIndex] || mediaItems[0];
  const hasMultipleMedia = mediaItems.length > 1;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
  };

  const videoEmbed = activeMedia?.type === 'video' ? getEmbedUrl(activeMedia.url) : null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Viewport */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-800/90 bg-zinc-950 shadow-2xl">
        {activeMedia.type === 'cover' ? (
          <div className="relative">
            <ProjectCoverBanner
              coverImageUrl={activeMedia.url}
              title={title}
              category={category}
              tagline={tagline}
              tags={tags}
              developmentStatus={developmentStatus}
              size="lg"
              hideTitleOverlay={true}
            />
            {/* Lightbox button if genuine image */}
            {activeMedia.url && !isWatermarkedStockImage(activeMedia.url) && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="View full size image"
                className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-black/60 hover:bg-black/90 text-white border border-zinc-700/60 backdrop-blur-sm transition-all"
                title="Expand image"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : activeMedia.type === 'screenshot' ? (
          <div className="relative h-64 sm:h-80 md:h-[420px] bg-black flex items-center justify-center group">
            <img
              src={activeMedia.url}
              alt={`${title} - ${activeMedia.title}`}
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

            {/* Caption & Controls */}
            <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between text-xs font-mono text-zinc-300">
              <span className="px-3 py-1 rounded bg-black/70 border border-zinc-800 backdrop-blur-sm">
                {activeMedia.caption}
              </span>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-black/70 hover:bg-black/90 border border-zinc-800 text-white backdrop-blur-sm transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand</span>
              </button>
            </div>
          </div>
        ) : (
          /* Video View */
          <div className="relative h-64 sm:h-80 md:h-[420px] bg-black flex items-center justify-center">
            {videoEmbed ? (
              <iframe
                src={videoEmbed}
                title={`${title} Video Demo`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : (
              <div className="text-center p-8 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
                  <VideoIcon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Video Demonstration</h3>
                <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                  The creator provided an external video demonstration artifact.
                </p>
                <a
                  href={activeMedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-lg"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Watch Video on External Player</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Carousel arrows if multiple media items */}
        {hasMultipleMedia && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous artifact"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-zinc-800 backdrop-blur-sm transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next artifact"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-zinc-800 backdrop-blur-sm transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Media Thumbnails & Selector Strip */}
      {hasMultipleMedia && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {mediaItems.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all shrink-0 border ${
                  isActive
                    ? 'bg-zinc-800 text-white border-blue-500 shadow-sm'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {item.type === 'video' ? (
                  <VideoIcon className={`w-3.5 h-3.5 ${isActive ? 'text-rose-400' : 'text-zinc-500'}`} />
                ) : (
                  <ImageIcon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                )}
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close modal"
            className="absolute top-6 right-6 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700 transition-colors z-50"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="relative max-w-5xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeMedia.url}
              alt={title}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-zinc-800"
            />
            {activeMedia.caption && (
              <p className="text-center text-xs font-mono text-zinc-400 mt-3">
                {activeMedia.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
