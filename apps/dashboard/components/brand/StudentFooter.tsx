'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { NstLogoMark } from './NstLogo';
import { DevClubCreditsModal } from './DevClubCreditsModal';
import {
  DEV_CLUB_GITHUB_URL,
  DEV_CLUB_CONTRIBUTORS_URL,
  DEV_CLUB_PROJECT_LEAD_URL,
  DASHBOARD_APP_VERSION,
} from '../../lib/brand-config';
import { ExternalLink } from 'lucide-react';

const footerStyles = `
  .sf-footer {
    width: 100%;
    background: #050505;
    border-top: 3px solid #F5F5F2;
    color: #F5F5F2;
    font-family: 'JetBrains Mono', monospace;
    margin-top: auto;
    /* extra bottom clearance for mobile bottom nav */
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .sf-footer-inner {
    max-width: 1360px;
    margin: 0 auto;
    padding: 40px 32px 40px 32px;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 32px;
  }

  /* ── Brand Col ── */
  .sf-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .sf-brand-logo {
    width: 36px;
    height: 36px;
    background: #0057FF;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 3px 3px 0px #ffffff;
    flex-shrink: 0;
  }
  .sf-brand-name {
    font-family: 'Syne', sans-serif;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.5px;
    text-transform: uppercase;
    color: #F5F5F2;
    line-height: 1;
  }
  .sf-brand-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #a0a4b8;
    margin-top: 3px;
  }

  /* ── Links Col ── */
  .sf-links {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
    align-items: center;
  }
  .sf-link {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
    text-decoration: none;
    transition: color 0.15s;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .sf-link:hover {
    color: #0057FF;
  }
  .sf-link-divider {
    color: rgba(245,245,242,0.2);
    font-size: 14px;
    user-select: none;
  }

  /* ── Bottom Bar ── */
  .sf-bottom-bar {
    border-top: 1px solid rgba(245,245,242,0.1);
    padding: 16px 32px;
    max-width: 1360px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .sf-version {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #555;
  }
  .sf-credits-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #555;
  }
  .sf-credits-tag span {
    color: #0057FF;
  }

  @media (max-width: 640px) {
    .sf-footer-inner {
      padding: 32px 16px 32px 16px;
      flex-direction: column;
      gap: 24px;
    }
    .sf-bottom-bar {
      padding: 14px 16px;
    }
    /* Extra clearance for mobile bottom nav */
    .sf-footer {
      padding-bottom: 72px;
    }
  }
`;

export function StudentFooter() {
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  return (
    <>
      <style href="student-footer-styles" precedence="high">
        {footerStyles}
      </style>

      <footer className="sf-footer">
        <div className="sf-footer-inner">

          {/* Brand */}
          <div className="sf-brand">
            <div className="sf-brand-logo">
              <NstLogoMark size={20} color="#ffffff" />
            </div>
            <div>
              <div className="sf-brand-name">NST EVENTS</div>
              <div className="sf-brand-sub">Newton School of Technology</div>
            </div>
          </div>

          {/* External Links */}
          <div className="sf-links">
            <a
              href={DEV_CLUB_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-link"
            >
              GitHub <ExternalLink size={10} />
            </a>
            <span className="sf-link-divider">·</span>
            <a
              href={DEV_CLUB_CONTRIBUTORS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-link"
            >
              Contributors <ExternalLink size={10} />
            </a>
            <span className="sf-link-divider">·</span>
            <a
              href={DEV_CLUB_PROJECT_LEAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-link"
            >
              Project Lead <ExternalLink size={10} />
            </a>
            <span className="sf-link-divider">·</span>
            <button
              type="button"
              onClick={() => setIsCreditsOpen(true)}
              className="sf-link"
            >
              [ VIEW CREDITS ]
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="sf-bottom-bar">
          <span className="sf-version">v{DASHBOARD_APP_VERSION}</span>
          <span className="sf-credits-tag">
            BUILT BY <span>NST SDC</span> // EDITORIAL RELEASE
          </span>
        </div>
      </footer>

      <DevClubCreditsModal
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />
    </>
  );
}
