'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, ShieldCheck, Database, RefreshCw, ExternalLink, Activity } from 'lucide-react';

export default function RedirectPage() {
  const [pulseTick, setPulseTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseTick((prev) => (prev + 1) % 100);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-[#F5F5F2] p-4 sm:p-6 md:p-8 overflow-hidden select-none">
      {/* Dynamic Background Glow */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(0, 87, 255, 0.18) 0%, rgba(5, 5, 5, 0) 70%)',
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
          backgroundSize: '36px 36px',
        }}
      />

      {/* Huge Background Brutalist Watermark */}
      <div 
        className="pointer-events-none absolute z-0 text-[18vw] font-black uppercase text-white/[0.02] tracking-tighter leading-none select-none"
        style={{ fontFamily: "var(--font-syne), 'Syne', sans-serif" }}
      >
        NST 503
      </div>

      {/* Top Branding / Environment Strip */}
      <div className="relative z-10 w-full max-w-xl mb-4 flex items-center justify-between font-mono text-[11px] text-[#71768a] px-1 tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0057FF] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0057FF]"></span>
          </span>
          <span className="font-semibold text-[#a0a4b8]">NST EVENTS PLATFORM</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[#5e6378]">
          <Activity className="w-3.5 h-3.5 text-[#0057FF]" />
          <span>STANDBY_ROUTING_ACTIVE</span>
        </div>
      </div>

      {/* Main Brutalist Poster Card */}
      <div className="relative z-10 w-full max-w-xl bg-[#0c0d12]/95 border-2 border-white/20 p-6 sm:p-9 md:p-10 shadow-[12px_12px_0px_#0057FF] backdrop-blur-xl">
        {/* Tactical Corner Crosshairs */}
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-[#C8FF00]" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-[#C8FF00]" />
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-[#0057FF]" />
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-[#0057FF]" />

        {/* Card Header: System Status Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#FF9500] inline-block animate-pulse"></span>
            <span className="font-mono text-[11px] font-bold tracking-[2px] uppercase text-[#FF9500]">
              SYSTEM NOTICE // PROTOCOL 503
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#0057FF] uppercase tracking-widest bg-[#0057FF]/10 px-2 py-0.5 border border-[#0057FF]/30 font-semibold">
            EVENTS.NSTSDC.ORG
          </span>
        </div>

        {/* Main Headline */}
        <div className="mb-6">
          <div className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#0057FF] uppercase mb-1.5 flex items-center gap-2">
            <span className="inline-block w-2.5 h-0.5 bg-[#0057FF]" />
            CRITICAL INFRASTRUCTURE UPDATE
          </div>
          <h1 
            style={{ fontFamily: "var(--font-syne), 'Syne', sans-serif" }}
            className="text-3xl sm:text-4xl md:text-[42px] font-black uppercase tracking-tight text-white leading-[1.05]"
          >
            UNDER MAINTENANCE
          </h1>
        </div>

        {/* Primary Explanation Box */}
        <div className="p-4 bg-white/[0.03] border border-white/10 mb-6 font-mono text-xs text-[#a0a4b8] leading-relaxed">
          <p className="mb-3 text-[#d0d4e4]">
            The primary NST Events cluster is temporarily undergoing emergency maintenance and database resynchronization.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-[#C8FF00]">
            <ShieldCheck className="w-4 h-4 text-[#C8FF00] shrink-0" />
            <span>Redundant backup portal is live & ready for all event activities.</span>
          </div>
        </div>

        {/* Status Telemetry Grid */}
        <div className="grid grid-cols-2 gap-3 mb-7 font-mono text-xs">
          <div className="p-3 bg-black/40 border border-white/10 flex flex-col gap-1">
            <div className="text-[10px] text-[#6b7280] uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3 h-3 text-[#FF9500]" />
              PRIMARY CLUSTER
            </div>
            <div className="text-[11px] font-semibold text-[#FF9500] flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-[#FF9500]" />
              RESYNC IN PROGRESS
            </div>
          </div>

          <div className="p-3 bg-black/40 border border-white/10 flex flex-col gap-1">
            <div className="text-[10px] text-[#6b7280] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#C8FF00]" />
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
            className="w-full inline-flex items-center justify-center gap-3 font-mono uppercase text-xs sm:text-sm font-bold tracking-[0.16em] px-8 py-4 bg-[#0057FF] text-white hover:bg-[#0047e0] border-2 border-black shadow-[6px_6px_0px_#C8FF00] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#C8FF00] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[3px_3px_0px_#C8FF00] transition-all group cursor-pointer text-center"
          >
            <span>ACCESS BACKUP PORTAL</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>

          {/* Fallback Direct Link */}
          <div className="text-center">
            <a
              href="https://nirmaan-gules.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#6b7280] hover:text-[#0057FF] transition-colors"
            >
              <span>Direct Link: nirmaan-gules.vercel.app</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Card Footer Micro-Metadata */}
        <div className="mt-8 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[10px] text-[#555a6d]">
          <span>GATEWAY: TLS 1.3 // REGION: IN-BOM</span>
          <span>DISPATCH TICK: #{1420 + pulseTick}</span>
        </div>
      </div>

      {/* Bottom Sub-Footer */}
      <div className="relative z-10 mt-6 font-mono text-[10px] text-[#424654] tracking-widest uppercase text-center">
        NST Student Developer Community © 2026 // ALL SYSTEMS MONITORED
      </div>
    </div>
  );
}
