'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, ShieldCheck, Database, RefreshCw, ExternalLink, Activity } from 'lucide-react';

const responsiveStyles = `
  .lp-redirect-btn {
    background-color: #0057FF !important;
    color: #FFFFFF !important;
    border: 2px solid #000000 !important;
    box-shadow: 5px 5px 0px #C8FF00;
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }
  .lp-redirect-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 7px 7px 0px #C8FF00;
    filter: brightness(1.08);
  }
  .lp-redirect-btn:active {
    transform: translate(1px, 1px);
    box-shadow: 3px 3px 0px #C8FF00;
  }

  .lp-title-responsive {
    font-family: var(--font-syne), 'Syne', sans-serif;
    font-weight: 900;
    font-size: clamp(22px, 7vw, 42px);
    line-height: 1.05;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    color: #FFFFFF;
    word-break: keep-all;
    overflow-wrap: normal;
  }

  @media (max-width: 480px) {
    .lp-card-responsive {
      box-shadow: 7px 7px 0px #0057FF !important;
    }
  }
`;

export default function RedirectPage() {
  const [pulseTick, setPulseTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseTick((prev) => (prev + 1) % 100);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-[#F5F5F2] px-3 py-6 sm:p-6 md:p-8 overflow-x-hidden select-none">
      <style>{responsiveStyles}</style>

      {/* Dynamic Background Glow */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(0, 87, 255, 0.2) 0%, rgba(5, 5, 5, 0) 70%)',
        }}
      />

      {/* Cyber Grid Texture Overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Huge Background Brutalist Watermark */}
      <div 
        className="pointer-events-none absolute z-0 text-[22vw] sm:text-[18vw] font-black uppercase text-white/[0.02] tracking-tighter leading-none select-none"
        style={{ fontFamily: "var(--font-syne), 'Syne', sans-serif" }}
      >
        NST 503
      </div>

      {/* Top Branding / Environment Strip */}
      <div className="relative z-10 w-full max-w-xl mb-3 sm:mb-4 flex items-center justify-between font-mono text-[10px] sm:text-[11px] text-[#71768a] px-1 tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0057FF] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0057FF]"></span>
          </span>
          <span className="font-semibold text-[#a0a4b8]">NST EVENTS PLATFORM</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#5e6378]">
          <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0057FF]" />
          <span className="hidden xs:inline">STANDBY_ROUTING_ACTIVE</span>
          <span className="xs:hidden">STANDBY</span>
        </div>
      </div>

      {/* Main Brutalist Poster Card */}
      <div className="lp-card-responsive relative z-10 w-full max-w-xl bg-[#0c0d12]/95 border-2 border-white/20 p-4 sm:p-7 md:p-10 shadow-[12px_12px_0px_#0057FF] backdrop-blur-xl">
        {/* Tactical Corner Crosshairs */}
        <div className="absolute -top-1.5 -left-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 border-t-2 border-l-2 border-[#C8FF00]" />
        <div className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 border-t-2 border-r-2 border-[#C8FF00]" />
        <div className="absolute -bottom-1.5 -left-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 border-b-2 border-l-2 border-[#0057FF]" />
        <div className="absolute -bottom-1.5 -right-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 border-b-2 border-r-2 border-[#0057FF]" />

        {/* Card Header: System Status Bar */}
        <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 border-b border-white/10 pb-3 sm:pb-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#FF9500] inline-block animate-pulse shrink-0"></span>
            <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-[1.5px] sm:tracking-[2px] uppercase text-[#FF9500]">
              SYSTEM NOTICE // PROTOCOL 503
            </span>
          </div>
          <span className="font-mono text-[9px] sm:text-[10px] text-[#0057FF] uppercase tracking-widest bg-[#0057FF]/10 px-2 py-0.5 border border-[#0057FF]/30 font-semibold shrink-0">
            EVENTS.NSTSDC.ORG
          </span>
        </div>

        {/* Main Headline */}
        <div className="mb-4 sm:mb-6">
          <div className="font-mono text-[10px] sm:text-[11px] font-bold tracking-[0.16em] sm:tracking-[0.2em] text-[#0057FF] uppercase mb-1.5 flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 sm:w-2.5 h-0.5 bg-[#0057FF]" />
            CRITICAL INFRASTRUCTURE UPDATE
          </div>
          <h1 className="lp-title-responsive">
            UNDER<br className="block sm:hidden" /> MAINTENANCE
          </h1>
        </div>

        {/* Primary Explanation Box */}
        <div className="p-3.5 sm:p-4 bg-white/[0.03] border border-white/10 mb-4 sm:mb-6 font-mono text-[11px] sm:text-xs text-[#a0a4b8] leading-relaxed">
          <p className="mb-2.5 sm:mb-3 text-[#d0d4e4]">
            The primary NST Events cluster is temporarily undergoing emergency maintenance and database resynchronization.
          </p>
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-[#C8FF00]">
            <ShieldCheck className="w-4 h-4 text-[#C8FF00] shrink-0" />
            <span>Redundant backup portal is live & ready for all event activities.</span>
          </div>
        </div>

        {/* Status Telemetry Grid (Stacked on mobile, 2 columns on sm+) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-5 sm:mb-7 font-mono text-xs">
          <div className="p-2.5 sm:p-3 bg-black/40 border border-white/10 flex flex-col gap-1">
            <div className="text-[10px] text-[#6b7280] uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3 h-3 text-[#FF9500] shrink-0" />
              PRIMARY CLUSTER
            </div>
            <div className="text-[11px] font-semibold text-[#FF9500] flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-[#FF9500] shrink-0" />
              RESYNC IN PROGRESS
            </div>
          </div>

          <div className="p-2.5 sm:p-3 bg-black/40 border border-white/10 flex flex-col gap-1">
            <div className="text-[10px] text-[#6b7280] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#C8FF00] shrink-0" />
              STANDBY PORTAL
            </div>
            <div className="text-[11px] font-semibold text-[#C8FF00]">
              100% OPERATIONAL
            </div>
          </div>
        </div>

        {/* Primary Action Button (Brutalist CTA) */}
        <div className="space-y-3">
          <a
            href="https://nirmaan-gules.vercel.app/"
            className="lp-redirect-btn w-full inline-flex items-center justify-center gap-2.5 sm:gap-3 font-mono uppercase text-xs sm:text-sm font-bold tracking-[0.14em] sm:tracking-[0.16em] px-5 sm:px-8 py-3.5 sm:py-4 active:translate-x-[1px] active:translate-y-[1px] group cursor-pointer text-center"
          >
            <span className="text-white">ACCESS BACKUP PORTAL</span>
            <ArrowRight className="w-4 h-4 text-white transition-transform group-hover:translate-x-1" />
          </a>

          {/* Fallback Direct Link */}
          <div className="text-center pt-0.5">
            <a
              href="https://nirmaan-gules.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px] text-[#71768a] hover:text-[#0057FF] transition-colors break-all"
            >
              <span>Direct Link: nirmaan-gules.vercel.app</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        {/* Card Footer Micro-Metadata */}
        <div className="mt-6 sm:mt-8 pt-3 sm:pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 font-mono text-[9px] sm:text-[10px] text-[#555a6d]">
          <span>GATEWAY: TLS 1.3 // REGION: IN-BOM</span>
          <span>DISPATCH TICK: #{1420 + pulseTick}</span>
        </div>
      </div>

      {/* Bottom Sub-Footer */}
      <div className="relative z-10 mt-4 sm:mt-6 font-mono text-[9px] sm:text-[10px] text-[#424654] tracking-wider sm:tracking-widest uppercase text-center px-4">
        NST Student Developer Community © 2026 // ALL SYSTEMS MONITORED
      </div>
    </div>
  );
}
