'use client';

import React from 'react';
import Link from 'next/link';
import { Pencil, ShieldCheck, EyeOff } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface ProjectOwnerActionsProps {
  slug: string;
  ownerId?: string;
  visibility: string;
}

export function ProjectOwnerActions({ slug, ownerId, visibility }: ProjectOwnerActionsProps) {
  const { data: user } = useCurrentUser();

  const isOwner = Boolean(user && ownerId && user.id === ownerId);
  const isPlatformAdmin = user?.global_role === 'PLATFORM_ADMIN' || user?.global_role === 'FACULTY_ADMIN';

  if (!isOwner && !isPlatformAdmin) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/projects/${encodeURIComponent(slug)}/edit`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-[#0057FF]/10 hover:bg-[#0057FF]/20 text-[#0057FF] border border-[#0057FF]/30 hover:border-[#0057FF]/50 transition-all shadow-sm"
        title="Edit this project"
      >
        <Pencil className="w-3.5 h-3.5" />
        <span>EDIT PROJECT</span>
      </Link>
    </div>
  );
}

export function ProjectOwnerStatusBanner({ ownerId, visibility }: { ownerId?: string; visibility: string }) {
  const { data: user } = useCurrentUser();
  const isOwner = Boolean(user && ownerId && user.id === ownerId);
  const isPlatformAdmin = user?.global_role === 'PLATFORM_ADMIN' || user?.global_role === 'FACULTY_ADMIN';

  if (!isOwner && !isPlatformAdmin) {
    return null;
  }

  if (visibility === 'PUBLISHED') {
    return null;
  }

  return (
    <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start sm:items-center justify-between gap-3 text-amber-300">
      <div className="flex items-center gap-2.5">
        <EyeOff className="w-4 h-4 shrink-0 text-amber-400" />
        <span className="text-xs font-mono leading-relaxed">
          <strong className="uppercase font-bold text-amber-200">Owner Preview ({visibility}):</strong> This project is not published. Only you and platform administrators can view this page.
        </span>
      </div>
      <Link
        href="/my/projects"
        className="text-[11px] font-mono font-bold uppercase underline hover:text-white transition-colors shrink-0"
      >
        Manage in My Projects &rarr;
      </Link>
    </div>
  );
}
