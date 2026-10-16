'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { projectsApi } from '../../lib/projects-api';
import { getWebAuthStore } from '../../lib/auth-store';

interface ProjectLikeButtonProps {
  projectId: string;
  initialLikeCount: number;
  initialHasLiked?: boolean;
  isOwner?: boolean;
}

export function ProjectLikeButton({
  projectId,
  initialLikeCount,
  initialHasLiked = false,
  isOwner = false,
}: ProjectLikeButtonProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleToggleLike = async () => {
    const authStore = getWebAuthStore();
    if (!authStore.accessToken) {
      setAuthError('Sign in with your verified NST account to like this project.');
      setTimeout(() => setAuthError(null), 4000);
      return;
    }

    if (isOwner) {
      setAuthError('Creators cannot like their own project.');
      setTimeout(() => setAuthError(null), 4000);
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    // Optimistic update
    const nextHasLiked = !hasLiked;
    const nextCount = nextHasLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    setHasLiked(nextHasLiked);
    setLikeCount(nextCount);

    try {
      if (nextHasLiked) {
        const res = await projectsApi.like(projectId);
        setLikeCount(res.like_count);
        setHasLiked(true);
      } else {
        const res = await projectsApi.unlike(projectId);
        setLikeCount(res.like_count);
        setHasLiked(false);
      }
    } catch (err: any) {
      // Revert on error
      setHasLiked(!nextHasLiked);
      setLikeCount(likeCount);
      setAuthError(err.message || 'Failed to update like status');
      setTimeout(() => setAuthError(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        onClick={handleToggleLike}
        disabled={isLoading || isOwner}
        aria-label={hasLiked ? 'Unlike project' : 'Like project'}
        className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors border ${
          isOwner
            ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500 cursor-not-allowed'
            : hasLiked
            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-white'
        }`}
        title={isOwner ? 'You cannot like your own project' : undefined}
      >
        <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current text-rose-400' : ''}`} />
        <span>{hasLiked ? 'Liked' : 'Like'}</span>
        <span className="font-mono bg-black/40 px-2 py-0.5 rounded text-[11px]">
          {likeCount}
        </span>
      </button>

      {authError && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-2.5 rounded-lg bg-zinc-950 border border-red-500/40 text-xs font-mono text-red-300 text-center shadow-xl z-50">
          {authError}
        </div>
      )}
    </div>
  );
}
