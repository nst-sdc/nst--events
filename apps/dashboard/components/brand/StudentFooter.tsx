'use client';

import React, { useState } from 'react';
import { NstLogoMark } from './NstLogo';
import { DevClubBadge } from './DevClubBadge';
import { DevClubCreditsModal } from './DevClubCreditsModal';
import {
  DEV_CLUB_NAME,
  DEV_CLUB_GITHUB_URL,
  DEV_CLUB_CONTRIBUTORS_URL,
  DEV_CLUB_PROJECT_LEAD_URL,
  DASHBOARD_APP_VERSION,
} from '../../lib/brand-config';
import { ExternalLink } from 'lucide-react';

export function StudentFooter() {
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  return (
    <>
      <footer className="w-full border-t border-stitch-outline-variant bg-stitch-surface-container-lowest mt-auto text-stitch-on-surface">
        <div className="max-w-[1440px] mx-auto px-stitch-margin-mobile md:px-stitch-margin-desktop py-8 pb-[88px] md:pb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Brand column */}
            <div className="flex items-center gap-3">
              <NstLogoMark size={28} />
              <div className="flex flex-col leading-none">
                <span className="font-stitch-headline text-base font-extrabold tracking-tight">
                  NST <span className="text-stitch-primary">EVENTS</span>
                </span>
                <span className="font-stitch-label text-[9px] tracking-widest text-stitch-secondary uppercase mt-0.5">
                  Newton School of Technology
                </span>
              </div>
            </div>

            {/* Center: Developers Club Branding */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <DevClubBadge
                variant="signature"
                size="md"
                onClick={() => setIsCreditsOpen(true)}
              />
              <button
                type="button"
                onClick={() => setIsCreditsOpen(true)}
                className="font-stitch-label text-[11px] font-bold text-stitch-primary hover:underline uppercase tracking-wider cursor-pointer"
              >
                [ VIEW CREDITS ]
              </button>
            </div>

            {/* Right: Version & Official Links */}
            <div className="flex flex-wrap items-center gap-4 font-stitch-label text-xs text-stitch-secondary">
              <span className="font-mono">v{DASHBOARD_APP_VERSION}</span>
              <span className="text-stitch-outline-variant">·</span>
              <a
                href={DEV_CLUB_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-stitch-primary transition-colors uppercase tracking-wider"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-stitch-outline-variant">·</span>
              <a
                href={DEV_CLUB_CONTRIBUTORS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-stitch-primary transition-colors uppercase tracking-wider"
              >
                <span>Contributors</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-stitch-outline-variant">·</span>
              <a
                href={DEV_CLUB_PROJECT_LEAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-stitch-primary transition-colors uppercase tracking-wider"
              >
                <span>Project Lead</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      <DevClubCreditsModal
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />
    </>
  );
}
