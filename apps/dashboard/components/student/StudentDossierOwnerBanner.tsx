'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { Share2, Check, Settings } from 'lucide-react';

interface StudentDossierOwnerBannerProps {
  slug: string;
}

export function StudentDossierOwnerBanner({ slug }: StudentDossierOwnerBannerProps) {
  const { data: user } = useCurrentUser();
  const [copied, setCopied] = useState(false);

  // Check if current user is logged in
  const isOwner = user?.global_role === 'STUDENT'; // Client can navigate to profile anytime if student

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex justify-between items-center flex-wrap gap-3 bg-white dark:bg-[#0a0b0e] border border-[#0057FF]/30 shadow-[0_0_15px_rgba(0,87,255,0.08)] px-5 py-3 mb-7">
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-[#C8FF00] shadow-[0_0_8px_rgba(5,150,105,0.5)] dark:shadow-[0_0_8px_#C8FF00] inline-block" />
        <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-zinc-900 dark:text-[#F5F5F2]">
          NST VERIFIED PORTFOLIO // @{slug}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={handleCopyLink}
          className="bg-transparent border border-black/20 dark:border-white/25 text-zinc-800 dark:text-[#F5F5F2] font-mono text-[11px] font-bold px-3 py-1.5 cursor-pointer inline-flex items-center gap-1.5 uppercase hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-600 dark:text-[#C8FF00]" /> : <Share2 size={12} />}
          <span>{copied ? 'LINK COPIED' : 'SHARE DOSSIER'}</span>
        </button>

        {isOwner && (
          <Link
            href="/my/profile"
            className="bg-[#0057FF] border border-[#0057FF] text-white font-mono text-[11px] font-bold px-3.5 py-1.5 no-underline inline-flex items-center gap-1.5 uppercase hover:bg-[#0047d4] transition-colors"
          >
            <Settings size={12} />
            <span>PORTFOLIO SETTINGS ↗</span>
          </Link>
        )}
      </div>
    </div>
  );
}
