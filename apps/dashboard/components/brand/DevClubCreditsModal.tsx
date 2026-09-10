'use client';

import React, { useEffect } from 'react';
import { X, ExternalLink, Users, Code } from 'lucide-react';
import {
  DEV_CLUB_NAME,
  DEV_CLUB_MISSION,
  DEV_CLUB_GITHUB_URL,
  DEV_CLUB_CONTRIBUTORS_URL,
  DEV_CLUB_PROJECT_LEAD_URL,
  DASHBOARD_APP_VERSION,
} from '../../lib/brand-config';
import { NstLogoMark } from './NstLogo';

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

interface DevClubCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DevClubCreditsModal({ isOpen, onClose }: DevClubCreditsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-club-credits-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg border border-[#242530] bg-[#0c0d12] text-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#242530] bg-[#12131a]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#0047FF]" />
            <span className="font-stitch-label text-[11px] font-bold tracking-widest text-[#9a9db0] uppercase">
              ABOUT // {DEV_CLUB_NAME}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-[#9a9db0] hover:text-white transition-colors cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Logo & Headline */}
          <div className="flex items-center gap-4">
            <div className="p-3 border border-[#242530] bg-[#151620]">
              <NstLogoMark size={36} color="#0047FF" />
            </div>
            <div>
              <h2
                id="dev-club-credits-title"
                className="font-stitch-headline text-2xl font-bold tracking-tight text-white leading-tight"
              >
                {DEV_CLUB_NAME}
              </h2>
              <p className="font-stitch-label text-[10px] tracking-widest text-[#0047FF] uppercase mt-0.5">
                Newton School of Technology
              </p>
            </div>
          </div>

          {/* Mission */}
          <div className="border border-[#242530] bg-[#111218] p-4">
            <div className="font-stitch-label text-[10px] text-[#717487] tracking-widest uppercase mb-1">
              MISSION
            </div>
            <p className="font-stitch-body text-sm text-[#e0e3e5] leading-relaxed">
              {DEV_CLUB_MISSION}
            </p>
          </div>

          {/* Build Metadata */}
          <div className="border border-[#242530] bg-[#111218] p-4 font-stitch-label text-xs space-y-2">
            <div className="flex justify-between items-center py-1 border-b border-[#1b1c26]">
              <span className="text-[#717487]">APPLICATION</span>
              <span className="text-white font-mono font-semibold">NST Events Platform</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#1b1c26]">
              <span className="text-[#717487]">DASHBOARD VERSION</span>
              <span className="text-white font-mono font-semibold">v{DASHBOARD_APP_VERSION}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[#717487]">ORGANIZATION</span>
              <span className="text-white font-mono font-semibold">NST-SDC</span>
            </div>
          </div>

          {/* Official External Links */}
          <div className="space-y-2 pt-1">
            <div className="font-stitch-label text-[10px] text-[#717487] tracking-widest uppercase">
              OFFICIAL LINKS
            </div>
            <div className="flex flex-col gap-2.5">
              <a
                href={DEV_CLUB_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 border border-[#242530] bg-[#111218] hover:border-[#0047FF] hover:bg-[#151724] text-xs font-stitch-label font-bold text-white uppercase tracking-wider transition-colors group"
              >
                <span className="flex items-center gap-2.5">
                  <GithubIcon className="w-4 h-4 text-[#9a9db0] group-hover:text-white" />
                  <span>NST-SDC ORG</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-[#717487] group-hover:text-white" />
              </a>

              <a
                href={DEV_CLUB_CONTRIBUTORS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 border border-[#242530] bg-[#111218] hover:border-[#0047FF] hover:bg-[#151724] text-xs font-stitch-label font-bold text-white uppercase tracking-wider transition-colors group"
              >
                <span className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-[#9a9db0] group-hover:text-white" />
                  <span>PROJECT CONTRIBUTORS</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-[#717487] group-hover:text-white" />
              </a>

              <a
                href={DEV_CLUB_PROJECT_LEAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 border border-[#242530] bg-[#111218] hover:border-[#0047FF] hover:bg-[#151724] text-xs font-stitch-label font-bold text-white uppercase tracking-wider transition-colors group"
              >
                <span className="flex items-center gap-2.5">
                  <Code className="w-4 h-4 text-[#9a9db0] group-hover:text-white" />
                  <span>PROJECT LEAD</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-[#717487] group-hover:text-white" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="px-6 py-4 border-t border-[#242530] bg-[#12131a] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1b1c26] hover:bg-[#252636] text-white font-stitch-label text-xs uppercase tracking-widest border border-[#2e3040] transition-colors cursor-pointer"
          >
            [ CLOSE ]
          </button>
        </div>
      </div>
    </div>
  );
}
