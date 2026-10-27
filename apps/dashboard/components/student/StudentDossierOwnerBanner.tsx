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
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#0a0b0e',
        border: '1px solid rgba(0, 87, 255, 0.3)',
        boxShadow: '0 0 15px rgba(0, 87, 255, 0.08)',
        padding: '12px 20px',
        marginBottom: '28px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--acid-green, #C8FF00)',
            boxShadow: '0 0 8px var(--acid-green, #C8FF00)',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#F5F5F2',
          }}
        >
          NST VERIFIED PORTFOLIO // @{slug}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleCopyLink}
          style={{
            background: 'transparent',
            border: '1px solid rgba(245, 245, 242, 0.25)',
            color: '#F5F5F2',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            fontWeight: 700,
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textTransform: 'uppercase',
            transition: 'all 0.15s ease',
          }}
        >
          {copied ? <Check size={12} color="var(--acid-green, #C8FF00)" /> : <Share2 size={12} />}
          <span>{copied ? 'LINK COPIED' : 'SHARE DOSSIER'}</span>
        </button>

        {isOwner && (
          <Link
            href="/my/profile"
            style={{
              background: 'var(--electric-blue, #0057FF)',
              border: '1px solid var(--electric-blue, #0057FF)',
              color: '#ffffff',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 14px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textTransform: 'uppercase',
              transition: 'all 0.15s ease',
            }}
          >
            <Settings size={12} />
            <span>PORTFOLIO SETTINGS ↗</span>
          </Link>
        )}
      </div>
    </div>
  );
}
