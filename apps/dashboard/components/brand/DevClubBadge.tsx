'use client';

import React from 'react';
import { cn } from '../../lib/utils';
import { DEV_CLUB_NAME } from '../../lib/brand-config';

interface DevClubBadgeProps {
  variant?: 'terminal' | 'signature' | 'compact' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  showPrefix?: boolean;
}

export function DevClubBadge({
  variant = 'terminal',
  size = 'md',
  className = '',
  onClick,
  showPrefix = true,
}: DevClubBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] py-0.5 px-2 tracking-wider',
    md: 'text-xs py-1 px-2.5 tracking-widest',
    lg: 'text-sm py-1.5 px-3 tracking-widest',
  };

  const Component = onClick ? 'button' : 'div';

  if (variant === 'signature') {
    return (
      <Component
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1.5 font-stitch-label text-stitch-secondary transition-colors',
          onClick && 'hover:text-stitch-primary cursor-pointer',
          size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-sm' : 'text-xs',
          className
        )}
      >
        <span>{showPrefix ? 'Crafted by' : ''}</span>
        <span className="font-semibold text-stitch-on-surface hover:underline">{DEV_CLUB_NAME}</span>
      </Component>
    );
  }

  if (variant === 'compact') {
    return (
      <Component
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'inline-flex items-center justify-center font-stitch-label font-bold uppercase border border-stitch-outline-variant bg-stitch-surface-container-lowest text-stitch-on-surface hover:border-stitch-primary hover:text-stitch-primary transition-all',
          sizeClasses[size],
          onClick && 'cursor-pointer',
          className
        )}
      >
        [ NST/DEV ]
      </Component>
    );
  }

  if (variant === 'pill') {
    return (
      <Component
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-2 font-stitch-label uppercase rounded-full border border-[#242530] bg-[#111113] text-[#9a9db0] hover:border-[#0047FF] hover:text-white transition-all',
          sizeClasses[size],
          onClick && 'cursor-pointer shadow-[0_0_10px_rgba(0,71,255,0.1)]',
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#0047FF] animate-pulse" />
        <span>{DEV_CLUB_NAME}</span>
      </Component>
    );
  }

  // Default 'terminal'
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 font-stitch-label uppercase font-bold text-[#9a9db0] hover:text-white border border-[#242530] bg-[#0c0d12] hover:border-[#0047FF] transition-all',
        sizeClasses[size],
        onClick && 'cursor-pointer hover:shadow-[0_0_12px_rgba(0,71,255,0.2)]',
        className
      )}
    >
      <span className="text-[#0047FF]">[</span>
      <span>{DEV_CLUB_NAME}</span>
      <span className="text-[#0047FF]">]</span>
    </Component>
  );
}
