'use client';

import React, { useState } from 'react';
import { Share2, Copy, Check, X } from 'lucide-react';

interface ProjectShareModalProps {
  title: string;
  tagline: string;
  url: string;
}

export function ProjectShareModal({ title, tagline, url }: ProjectShareModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  const shareText = encodeURIComponent(`${title} — ${tagline} on NST Projects`);
  const encodedUrl = encodeURIComponent(url);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
        aria-label="Share Project"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span>Share</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 rounded-2xl shadow-2xl relative text-left">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-900 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white tracking-tight">
              Share Project
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Share this project with peers, teammates, recruiters, and the community.
            </p>

            {/* Copy Link Input */}
            <div className="mt-5 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-300 select-all focus:outline-none focus:border-[#0057FF]"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-[#0057FF] hover:bg-blue-600 text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Social Share Buttons */}
            <div className="mt-6 pt-5 border-t border-zinc-800/80 grid grid-cols-3 gap-2">
              <a
                href={`https://wa.me/?text=${shareText}%20${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center py-2.5 px-3 text-xs font-mono font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center py-2.5 px-3 text-xs font-mono font-medium rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
              >
                X / Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center py-2.5 px-3 text-xs font-mono font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
