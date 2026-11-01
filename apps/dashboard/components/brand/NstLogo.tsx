'use client';

import React from 'react';
import Link from 'next/link';

interface NstLogoMarkProps {
  size?: number | string;
  className?: string;
  color?: string;
  withSquircle?: boolean;
}

/**
 * Concept C: The Momentum Chevrons
 * High-performance, resolution-independent SVG vector mark.
 */
export function NstLogoMark({
  size = 32,
  className = '',
  color = 'currentColor',
  withSquircle = false,
}: NstLogoMarkProps) {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      style={{ width: dimension, height: dimension }}
      className={`shrink-0 ${className}`}
      aria-label="NST Logo Mark"
    >
      {withSquircle ? <rect width="100" height="100" rx="22" fill="#08080A" /> : null}
      <g fill={color}>
        {/* Upper Arrow & Shaft */}
        <path d="M 76.80,19.80 L 76.20,32.40 L 71.50,30.10 L 57.40,45.70 L 53.10,41.80 L 66.80,26.60 L 63.70,23.10 Z" />
        {/* Upper Chevron, Arrow & Left Top Frame */}
        <path d="M 22.60,23.00 L 26.60,25.00 L 59.00,50.40 L 69.10,41.00 L 66.40,37.50 L 78.50,34.80 L 77.30,46.90 L 73.00,44.50 L 60.50,57.40 L 59.00,57.40 L 28.90,34.40 L 28.90,50.80 L 23.00,56.20 Z" />
        {/* Lower Chevron & Right Vertical Pillar */}
        <path d="M 36.30,46.10 L 39.10,47.30 L 70.30,70.30 L 70.70,50.40 L 73.40,47.70 L 77.00,50.00 L 77.00,81.25 L 75.80,81.25 L 37.90,53.50 L 22.30,69.10 L 21.10,69.10 L 21.50,60.90 Z" />
        {/* Center Lower Vertical Pillar */}
        <path d="M 38.30,57.40 L 43.40,60.50 L 40.20,64.10 L 40.20,79.00 L 34.00,79.00 L 34.00,61.70 Z" />
        {/* Left Lower Vertical Pillar */}
        <path d="M 28.10,66.00 L 28.90,66.00 L 28.90,79.00 L 23.00,79.00 L 22.70,71.50 Z" />
      </g>
    </svg>
  );
}

interface NstLogoProps {
  variant?: 'mark-only' | 'full' | 'compact' | 'stacked';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  href?: string;
  showSubtitle?: boolean;
  withSquircle?: boolean;
}

export function NstLogo({
  variant = 'full',
  size = 'md',
  className = '',
  href,
  showSubtitle = true,
  withSquircle = false,
}: NstLogoProps) {
  const sizeMap = {
    sm: { mark: 24, text: 'text-base', sub: 'text-[8px]', gap: 'gap-2' },
    md: { mark: 32, text: 'text-xl', sub: 'text-[9px]', gap: 'gap-2.5' },
    lg: { mark: 40, text: 'text-2xl', sub: 'text-[10px]', gap: 'gap-3' },
    xl: { mark: 48, text: 'text-3xl', sub: 'text-[11px]', gap: 'gap-3.5' },
  };

  const current = sizeMap[size];

  const content = (
    <div className={`inline-flex items-center ${current.gap} select-none ${className}`}>
      <NstLogoMark size={current.mark} withSquircle={withSquircle} />
      {variant !== 'mark-only' && (
        <div className="flex flex-col leading-none">
          <div className={`font-stitch-headline font-extrabold tracking-tight text-white ${current.text}`}>
            NST <span className="text-[#0047FF]">EVENTS</span>
          </div>
          {showSubtitle && variant !== 'compact' && (
            <div className={`font-stitch-label font-medium tracking-widest text-[#717487] uppercase mt-1 ${current.sub}`}>
              Newton School of Technology
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label="NST Events Home" className="transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
