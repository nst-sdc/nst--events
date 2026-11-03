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

const modalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  .dcm-overlay {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.82);
    padding: 24px;
    animation: dcm-fadein 0.15s ease;
  }
  @keyframes dcm-fadein { from { opacity: 0 } to { opacity: 1 } }

  /* Shell with blue offset */
  .dcm-shell {
    position: relative;
    width: 100%; max-width: 560px;
    animation: dcm-zoomin 0.18s ease;
  }
  @keyframes dcm-zoomin { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  .dcm-offset {
    position: absolute; inset: 0;
    background: #0047FF;
    transform: translate(16px, 16px);
    z-index: 0;
  }

  /* Main panel */
  .dcm-panel {
    position: relative; z-index: 1;
    background: #F5F5F1;
    border: 4px solid #000;
    overflow: hidden;
  }

  /* Header bar */
  .dcm-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 2px solid #000;
    background: #ede8df;
  }

  .dcm-header-left {
    display: flex; align-items: center; gap: 8px;
  }

  .dcm-header-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #0047FF; flex-shrink: 0;
  }

  .dcm-header-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #333;
  }

  .dcm-close-btn {
    background: transparent;
    border: 1.5px solid #000;
    color: #333;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
  }
  .dcm-close-btn:hover { background: #000; color: #fff; }

  /* Body */
  .dcm-body { padding: 24px 24px 0 24px; }

  /* Logo + title row */
  .dcm-brand-row {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 20px;
  }

  .dcm-logo-wrap {
    width: 56px; height: 56px;
    border: 2px solid #000;
    background: #0047FF;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .dcm-title {
    font-family: 'Syne', sans-serif;
    font-weight: 900;
    font-size: 24px;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: #000;
    margin: 0 0 4px 0;
    text-transform: uppercase;
  }

  .dcm-subtitle {
    font-family: 'Outfit', sans-serif;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #0047FF;
  }

  /* Mission block */
  .dcm-mission {
    border: 2px solid #000;
    background: #ede8df;
    padding: 12px 14px;
    margin-bottom: 14px;
  }
  .dcm-section-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #475467; margin-bottom: 6px;
  }
  .dcm-mission-text {
    font-family: 'Inter', sans-serif;
    font-size: 12px; color: #222; line-height: 1.6;
  }

  /* Metadata table */
  .dcm-meta {
    border: 2px solid #000;
    margin-bottom: 14px;
  }
  .dcm-meta-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 14px;
    border-bottom: 1px solid #c8c3ba;
  }
  .dcm-meta-row:last-child { border-bottom: none; }
  .dcm-meta-key {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; color: #475467;
  }
  .dcm-meta-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 700;
    color: #000; letter-spacing: 0.06em;
  }

  /* Links section */
  .dcm-links-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #475467; margin-bottom: 8px;
  }

  .dcm-link-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px;
    border: 2px solid #000;
    margin-bottom: 6px;
    text-decoration: none;
    background: #ede8df;
    transition: background 0.12s, transform 0.1s;
  }
  .dcm-link-row:last-child { margin-bottom: 0; }
  .dcm-link-row:hover {
    background: #0047FF;
  }
  .dcm-link-row:hover .dcm-link-label { color: #fff; }
  .dcm-link-row:hover .dcm-link-icon { color: #fff; }
  .dcm-link-row:hover .dcm-link-ext { color: #fff; }

  .dcm-link-left {
    display: flex; align-items: center; gap: 10px;
  }
  .dcm-link-icon { color: #333; flex-shrink: 0; transition: color 0.12s; }
  .dcm-link-label {
    font-family: 'Outfit', sans-serif;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #000; transition: color 0.12s;
  }
  .dcm-link-ext { color: #666; transition: color 0.12s; }

  /* Footer bar */
  .dcm-footer {
    display: flex; justify-content: flex-end;
    padding: 14px 24px;
    margin-top: 20px;
    border-top: 2px solid #000;
    background: #ede8df;
  }

  .dcm-footer-btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #000; background: transparent;
    border: 2px solid #000;
    padding: 8px 18px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    box-shadow: 2px 2px 0px #000;
  }
  .dcm-footer-btn:hover { background: #000; color: #fff; }
`;

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
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
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
    <>
      <style href="dev-club-credits-modal-styles" precedence="high">
        {modalStyles}
      </style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-club-credits-title"
        className="dcm-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="dcm-shell">
          {/* Blue offset shadow */}
          <div className="dcm-offset" aria-hidden="true" />

          {/* Main panel */}
          <div className="dcm-panel">
            {/* Header */}
            <div className="dcm-header">
              <div className="dcm-header-left">
                <div className="dcm-header-dot" />
                <span className="dcm-header-label">ABOUT // {DEV_CLUB_NAME}</span>
              </div>
              <button onClick={onClose} aria-label="Close dialog" className="dcm-close-btn">
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="dcm-body">
              {/* Brand row */}
              <div className="dcm-brand-row">
                <div className="dcm-logo-wrap">
                  <NstLogoMark size={32} color="#fff" />
                </div>
                <div>
                  <h2 id="dev-club-credits-title" className="dcm-title">{DEV_CLUB_NAME}</h2>
                  <div className="dcm-subtitle">Newton School of Technology</div>
                </div>
              </div>

              {/* Mission */}
              <div className="dcm-mission">
                <div className="dcm-section-label">MISSION</div>
                <p className="dcm-mission-text">{DEV_CLUB_MISSION}</p>
              </div>

              {/* Build metadata */}
              <div className="dcm-meta">
                <div className="dcm-meta-row">
                  <span className="dcm-meta-key">APPLICATION</span>
                  <span className="dcm-meta-val">NST Events Platform</span>
                </div>
                <div className="dcm-meta-row">
                  <span className="dcm-meta-key">DASHBOARD VERSION</span>
                  <span className="dcm-meta-val">v{DASHBOARD_APP_VERSION}</span>
                </div>
                <div className="dcm-meta-row">
                  <span className="dcm-meta-key">ORGANIZATION</span>
                  <span className="dcm-meta-val">NST-SDC</span>
                </div>
              </div>

              {/* Official links */}
              <div className="dcm-links-label">OFFICIAL LINKS</div>

              <a href={DEV_CLUB_GITHUB_URL} target="_blank" rel="noopener noreferrer" className="dcm-link-row">
                <span className="dcm-link-left">
                  <GithubIcon className="w-4 h-4 dcm-link-icon" />
                  <span className="dcm-link-label">NST-SDC ORG</span>
                </span>
                <ExternalLink size={13} className="dcm-link-ext" />
              </a>

              <a href={DEV_CLUB_CONTRIBUTORS_URL} target="_blank" rel="noopener noreferrer" className="dcm-link-row">
                <span className="dcm-link-left">
                  <Users size={16} className="dcm-link-icon" />
                  <span className="dcm-link-label">PROJECT CONTRIBUTORS</span>
                </span>
                <ExternalLink size={13} className="dcm-link-ext" />
              </a>

              <a href={DEV_CLUB_PROJECT_LEAD_URL} target="_blank" rel="noopener noreferrer" className="dcm-link-row">
                <span className="dcm-link-left">
                  <Code size={16} className="dcm-link-icon" />
                  <span className="dcm-link-label">PROJECT LEAD</span>
                </span>
                <ExternalLink size={13} className="dcm-link-ext" />
              </a>
            </div>

            {/* Footer */}
            <div className="dcm-footer">
              <button type="button" className="dcm-footer-btn" onClick={onClose}>
                [ CLOSE ]
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
