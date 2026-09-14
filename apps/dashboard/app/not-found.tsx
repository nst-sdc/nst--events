import Link from 'next/link';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#050505] text-[#F5F5F2] p-6 relative overflow-hidden font-sans">
      {/* Texture & Noise Background Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-30 z-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Decorative Watermark */}
      <div 
        className="absolute select-none pointer-events-none uppercase font-black opacity-[0.03] text-[28vw] leading-none z-0"
        style={{ fontFamily: "'Syne', 'Outfit', sans-serif" }}
      >
        404
      </div>

      {/* Main Poster Card */}
      <div className="relative z-10 max-w-lg w-full bg-[#0d0e12] border-3 border-[#F5F5F2] p-8 md:p-10 shadow-[14px_14px_0px_#0057FF] flex flex-col gap-6 text-left">
        <div className="flex items-center justify-between border-b-2 border-white/15 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#FF3B30] inline-block animate-pulse"></span>
            <span className="font-mono text-[11px] font-bold tracking-[2px] uppercase text-[#FF3B30]">
              SYSTEM FAULT // ERROR 404
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#a0a4b8] uppercase tracking-widest">
            [ ARCHIVE MISSING ]
          </span>
        </div>

        <div>
          <h1 
            style={{ fontFamily: "'Syne', 'Outfit', sans-serif" }} 
            className="text-4xl md:text-5xl font-black uppercase tracking-tight text-[#F5F5F2] leading-none mb-3"
          >
            RESOURCE NOT FOUND
          </h1>
          <p className="font-mono text-xs text-[#a0a4b8] leading-relaxed">
            The requested campus endpoint, event log, or directory page does not exist or has been relocated to another corridor.
          </p>
        </div>

        <div className="p-4 bg-white/5 border border-white/10 font-mono text-xs text-[#c0c4d8] flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#FF9500] shrink-0" />
          <span>Verify the URL or return to the student gateway to resume navigation.</span>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link
            href="/student/home"
            className="flex-1 inline-flex items-center justify-center gap-2 font-mono uppercase text-xs font-bold tracking-widest px-6 py-3.5 bg-[#0057FF] text-white hover:bg-[#0042c7] border-2 border-[#0057FF] shadow-[4px_4px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
          >
            RETURN TO HOME <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/student/events"
            className="inline-flex items-center justify-center gap-2 font-mono uppercase text-xs font-bold tracking-widest px-6 py-3.5 bg-transparent text-[#F5F5F2] hover:bg-white/10 border-2 border-white/20 hover:border-white transition-all"
          >
            BROWSE EVENTS
          </Link>
        </div>
      </div>
    </div>
  );
}
