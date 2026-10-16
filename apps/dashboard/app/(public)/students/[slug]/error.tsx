'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function StudentDossierError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Student Dossier Error]:', error);
  }, [error]);

  return (
    <div
      style={{
        width: '100%',
        minHeight: '80vh',
        backgroundColor: '#050505',
        color: '#F5F5F2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '540px',
          width: '100%',
          backgroundColor: '#0d0e12',
          border: '2px solid rgba(255, 59, 48, 0.4)',
          boxShadow: '8px 8px 0px rgba(255, 59, 48, 0.3)',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            color: '#FF3B30',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          SYSTEM ALERT // DOSSIER ERROR
        </div>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: '16px',
            textTransform: 'uppercase',
          }}
        >
          Failed to Load Student Profile
        </h2>
        <p style={{ color: '#a0a4b8', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
          We could not retrieve this student dossier. The profile may be private, unlisted, or there may have been a temporary connection problem.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              background: '#0057FF',
              color: '#ffffff',
              border: '2px solid #000000',
              padding: '12px 24px',
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            TRY AGAIN ↺
          </button>
          <Link
            href="/students"
            style={{
              background: 'transparent',
              color: '#F5F5F2',
              border: '2px solid rgba(245,245,242,0.3)',
              padding: '12px 24px',
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            STUDENT DIRECTORY
          </Link>
        </div>
      </div>
    </div>
  );
}
