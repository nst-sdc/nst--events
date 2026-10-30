import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import dayjs from 'dayjs';
import { API_BASE_URL } from '@/lib/api';
import {
  MapPin,
  ArrowRight,
  Terminal,
  Code2,
  Trophy,
  ExternalLink,
  Laptop,
} from 'lucide-react';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';

export const metadata: Metadata = {
  title: 'NST Events — Official Campus Events & Hackathons | Newton School of Technology (NST SDC)',
  description:
    'NST Events (events.nstsdc.org) is the official events, hackathons, and developer ecosystem portal for Newton School of Technology (NST) and NST SDC at ADYPU Pune. Discover campus hackathons, technical workshops, coding competitions, and the annual Neutron fest.',
  keywords: [
    'NST Events',
    'nst events',
    'events.nstsdc.org',
    'Newton School of Technology',
    'Newton School of Technology Events',
    'NST',
    'NST SDC',
    'NST ADYPU',
    'NST Hackathons',
    'Newton School Events',
    'Neutron Fest',
    'Neutron NST',
    'Campus Technical Events',
    'Coding Competitions',
    'Tech Workshops Pune',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'NST Events — Official Campus Events & Hackathons | Newton School of Technology (NST SDC)',
    description:
      'Official events portal for Newton School of Technology (NST) and NST SDC. Discover campus hackathons, workshops, coding competitions, and Neutron fest.',
    url: siteUrl,
    siteName: 'NST Events',
    images: [{ url: '/icon.png', width: 512, height: 512, alt: 'NST Events — Newton School of Technology' }],
    type: 'website',
    locale: 'en_IN',
  },
};

interface PublicEvent {
  id: string;
  slug?: string;
  title: string;
  description?: string | null;
  start_time?: string;
  end_time?: string;
  location_name?: string | null;
  event_type?: string;
  metadata?: Record<string, unknown> | null;
}

async function getPublicEvents(): Promise<PublicEvent[]> {
  const apiBase =
    API_BASE_URL && API_BASE_URL.startsWith('http')
      ? API_BASE_URL
      : process.env.INTERNAL_API_URL && process.env.INTERNAL_API_URL.startsWith('http')
        ? process.env.INTERNAL_API_URL
        : process.env.NODE_ENV === 'production'
          ? (process.env.INTERNAL_SERVICE_URL || 'http://nst-api-service')
          : 'http://localhost:3001';

  try {
    const res = await fetch(`${apiBase}/v1/events/public?limit=6`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const events = await getPublicEvents();

  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Featured NST Campus Events & Hackathons',
    description: 'Upcoming technical events and hackathons hosted at Newton School of Technology.',
    itemListElement: events.map((ev, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Event',
        name: ev.title,
        description: ev.description || undefined,
        startDate: ev.start_time,
        endDate: ev.end_time || ev.start_time,
        url: ev.slug ? `${siteUrl}/event/${ev.slug}` : undefined,
        location: {
          '@type': 'Place',
          name: ev.location_name || 'Newton School of Technology, ADYPU Campus, Pune',
        },
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F2] font-sans selection:bg-[#0057FF] selection:text-white relative overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      {/* Background Radial Pattern Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-25 z-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Technical Navigation Header */}
      <header className="relative z-10 border-b-2 border-white/15 bg-[#050505]/90 backdrop-blur-md sticky top-0">
        <div className="max-w-[1320px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-[#0057FF] inline-block shadow-[0_0_8px_#0057FF]" />
            <span className="font-mono text-xs font-bold tracking-[2px] uppercase text-[#F5F5F2]">
              NST EVENTS <span className="text-[#0057FF]">{'//'}</span> SDC
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 font-mono text-xs font-semibold tracking-wider text-[#a0a4b8]">
            <Link href="/student/campus/discover" className="hover:text-white transition-colors">
              DISCOVER EVENTS
            </Link>
            <Link href="/projects" className="hover:text-white transition-colors">
              STUDENT PROJECTS
            </Link>
            <Link href="/students" className="hover:text-white transition-colors">
              STUDENT DIRECTORY
            </Link>
            <Link
              href="/login"
              className="border-2 border-white text-white px-4 py-2 hover:bg-white hover:text-black transition-colors"
            >
              PORTAL LOGIN ↗
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-[1320px] mx-auto px-6 pt-16 pb-24">
        {/* Institutional Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 font-mono text-[11px] font-bold tracking-widest uppercase text-[#0057FF] mb-6">
          <span className="w-2 h-2 rounded-full bg-[#0057FF] animate-pulse" />
          NEWTON SCHOOL OF TECHNOLOGY &bull; NST ADYPU PUNE
        </div>

        {/* H1 Heading */}
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tight text-[#F5F5F2] leading-[0.92] mb-8 font-display">
          NST EVENTS <br />
          <span className="text-[#0057FF] bg-[#F5F5F2] px-3 py-1 shadow-[8px_8px_0px_#0057FF] inline-block transform rotate-[-0.5deg] mt-3 mb-2">
            CAMPUS HUB.
          </span>
        </h1>

        {/* SEO-Rich Subtitle */}
        <p className="max-w-3xl text-lg sm:text-xl text-[#a0a4b8] leading-relaxed mb-10 font-body">
          The official technical events, hackathons, and developer ecosystem platform for{' '}
          <strong className="text-white font-semibold">Newton School of Technology (NST)</strong> and the{' '}
          <strong className="text-white font-semibold">Student Developer Community (NST SDC)</strong> at ADYPU Pune.
          Access campus hackathons, technical workshops, coding sprints, and the annual Neutron fest.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center gap-4 mb-20 font-mono text-xs font-bold uppercase tracking-wider">
          <Link
            href="/student/campus/discover"
            className="px-8 py-4 bg-[#0057FF] text-white border-2 border-[#0057FF] shadow-[6px_6px_0px_#ffffff] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#ffffff] transition-all flex items-center gap-2"
          >
            Go to Events <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 bg-transparent text-[#F5F5F2] border-2 border-white/30 hover:border-white hover:bg-white/5 transition-all flex items-center gap-2"
          >
            STUDENT PORTAL LOGIN ↗
          </Link>
          <Link
            href="/projects"
            className="px-6 py-4 bg-transparent text-[#a0a4b8] hover:text-white transition-colors"
          >
            VIEW STUDENT PROJECTS
          </Link>
        </div>

        {/* Technical Event Pillars */}
        <section className="border-t-2 border-white/15 pt-16 mb-24">
          <div className="flex items-center justify-between mb-10">
            <div>
              <span className="font-mono text-xs font-bold tracking-[2px] uppercase text-[#0057FF] block mb-2">
                CAMPUS ECOSYSTEM {'//'} CORE TRACKS
              </span>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#F5F5F2] font-display">
                WHAT HAPPENS AT NST
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <div className="bg-[#0d0e12] border-2 border-white/15 p-6 shadow-[6px_6px_0px_#0057FF] flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-[#0057FF]/20 border border-[#0057FF] flex items-center justify-center text-[#0057FF] mb-4">
                  <Terminal className="w-5 h-5" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#a0a4b8] block mb-1">
                  SPRINTS {'//'} 36H BUILDS
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tight text-[#F5F5F2] mb-3 font-display">
                  HACKATHONS
                </h3>
                <p className="text-xs text-[#a0a4b8] leading-relaxed font-body">
                  Flagship campus hackathons like HackNST and Hacktoberfest Pune x NST ADYPU, bringing autonomous AI systems, open-source building, and developer tools to life.
                </p>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="bg-[#0d0e12] border-2 border-white/15 p-6 shadow-[6px_6px_0px_#0057FF] flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-[#0057FF]/20 border border-[#0057FF] flex items-center justify-center text-[#0057FF] mb-4">
                  <Laptop className="w-5 h-5" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#a0a4b8] block mb-1">
                  HANDS-ON LABS
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tight text-[#F5F5F2] mb-3 font-display">
                  TECH WORKSHOPS
                </h3>
                <p className="text-xs text-[#a0a4b8] leading-relaxed font-body">
                  Deep-dive technical sessions covering LLM fine-tuning, retrieval-augmented generation (RAG), cloud infrastructure orchestration, eBPF, and systems engineering.
                </p>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="bg-[#0d0e12] border-2 border-white/15 p-6 shadow-[6px_6px_0px_#0057FF] flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-[#0057FF]/20 border border-[#0057FF] flex items-center justify-center text-[#0057FF] mb-4">
                  <Code2 className="w-5 h-5" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#a0a4b8] block mb-1">
                  ALGORITHMS {'//'} TIMED
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tight text-[#F5F5F2] mb-3 font-display">
                  COMPETITIVE SPRINT
                </h3>
                <p className="text-xs text-[#a0a4b8] leading-relaxed font-body">
                  High-intensity competitive programming contests testing dynamic programming, graph theory, and algorithmic optimization under strict clock constraints.
                </p>
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="bg-[#0d0e12] border-2 border-white/15 p-6 shadow-[6px_6px_0px_#0057FF] flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-[#0057FF]/20 border border-[#0057FF] flex items-center justify-center text-[#0057FF] mb-4">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#a0a4b8] block mb-1">
                  ANNUAL FLAGSHIP FEST
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tight text-[#F5F5F2] mb-3 font-display">
                  NEUTRON FEST
                </h3>
                <p className="text-xs text-[#a0a4b8] leading-relaxed font-body">
                  Newton School of Technology&apos;s premier annual techno-cultural fest, featuring drone formations, robotics competitions, tech summits, and developer showcases.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Live Published Events Feed */}
        <section className="border-t-2 border-white/15 pt-16 mb-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="font-mono text-xs font-bold tracking-[2px] uppercase text-[#0057FF] block mb-2">
                LIVE POSTER WALL {'//'} UPCOMING SESSIONS
              </span>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#F5F5F2] font-display">
                PUBLIC CAMPUS EVENTS
              </h2>
            </div>
            <Link
              href="/student/campus/discover"
              className="font-mono text-xs font-bold tracking-wider text-[#0057FF] hover:text-white uppercase flex items-center gap-1"
            >
              VIEW ALL IN CAMPUS DISCOVERY <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((ev) => {
                const date = ev.start_time ? dayjs(ev.start_time).format('DD MMM • YYYY').toUpperCase() : 'UPCOMING';
                const eventLink = ev.slug ? `/event/${ev.slug}` : `/student/campus/discover`;
                return (
                  <Link
                    key={ev.id}
                    href={eventLink}
                    className="group bg-[#0d0e12] border-2 border-white/20 p-6 hover:border-white transition-all shadow-[6px_6px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#0057FF] block"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 font-mono text-xs">
                      <span className="bg-white text-black font-bold px-2 py-0.5">{date}</span>
                      <span className="text-[#a0a4b8] uppercase font-bold">{ev.event_type || 'EVENT'}</span>
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-[#F5F5F2] mb-3 group-hover:text-[#0057FF] transition-colors font-display line-clamp-2">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-[#a0a4b8] leading-relaxed mb-6 font-body line-clamp-3">
                      {ev.description || 'Join this technical session at Newton School of Technology campus.'}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/10 font-mono text-xs text-[#a0a4b8]">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#0057FF]" />
                        {ev.location_name || 'Main Campus'}
                      </span>
                      <span className="font-bold text-white group-hover:text-[#0057FF] transition-colors flex items-center gap-1">
                        DETAILS <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#0d0e12] border-2 border-white/20 p-12 text-center max-w-2xl mx-auto shadow-[10px_10px_0px_#0057FF]">
              <span className="font-mono text-xs font-bold tracking-[2px] uppercase text-[#0057FF] block mb-3">
                STATUS {'//'} ACTIVE CYCLE PREPARATION
              </span>
              <h3 className="text-2xl font-black uppercase tracking-tight text-[#F5F5F2] mb-3 font-display">
                NEXT SPRINT COMING SOON
              </h3>
              <p className="text-sm text-[#a0a4b8] leading-relaxed mb-6 font-body max-w-md mx-auto">
                All upcoming events for the current academic session are being finalized by NST SDC organizers. Explore student projects or connect through the student portal.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-xs font-bold uppercase">
                <Link
                  href="/projects"
                  className="px-6 py-3 bg-[#0057FF] text-white border border-[#0057FF] hover:bg-[#0042c7] transition-colors"
                >
                  BROWSE STUDENT PROJECTS ↗
                </Link>
                <Link
                  href="/students"
                  className="px-6 py-3 bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
                >
                  STUDENT DIRECTORY ↗
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Quick Links Gateway */}
        <section className="border-2 border-white/15 bg-white/5 p-8 md:p-12 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <span className="font-mono text-xs font-bold tracking-[2px] uppercase text-[#0057FF] block mb-2">
                COMMUNITY PORTAL
              </span>
              <h3 className="text-2xl font-black uppercase text-white font-display mb-2">
                STUDENT GATEWAY
              </h3>
              <p className="text-xs text-[#a0a4b8] leading-relaxed mb-4 font-body">
                Access your campus credentials, QR attendance check-ins, event registrations, and club leadership tools.
              </p>
              <Link
                href="/login"
                className="font-mono text-xs font-bold text-white hover:text-[#0057FF] transition-colors inline-flex items-center gap-1"
              >
                SIGN IN WITH NST ACCOUNT <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div>
              <span className="font-mono text-xs font-bold tracking-[2px] uppercase text-[#0057FF] block mb-2">
                SHOWCASE
              </span>
              <h3 className="text-2xl font-black uppercase text-white font-display mb-2">
                STUDENT PROJECTS
              </h3>
              <p className="text-xs text-[#a0a4b8] leading-relaxed mb-4 font-body">
                Explore open-source developer tools, AI applications, autonomous agents, and systems built by NST students.
              </p>
              <Link
                href="/projects"
                className="font-mono text-xs font-bold text-white hover:text-[#0057FF] transition-colors inline-flex items-center gap-1"
              >
                EXPLORE PROJECTS DIRECTORY <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div>
              <span className="font-mono text-xs font-bold tracking-[2px] uppercase text-[#0057FF] block mb-2">
                IDENTITY
              </span>
              <h3 className="text-2xl font-black uppercase text-white font-display mb-2">
                STUDENT DIRECTORY
              </h3>
              <p className="text-xs text-[#a0a4b8] leading-relaxed mb-4 font-body">
                Browse verified student developer profiles, academic badges, GitHub repositories, and club affiliations.
              </p>
              <Link
                href="/students"
                className="font-mono text-xs font-bold text-white hover:text-[#0057FF] transition-colors inline-flex items-center gap-1"
              >
                BROWSE STUDENTS <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Institutional Footer */}
      <footer className="relative z-10 border-t-2 border-white/15 bg-[#050505] py-12 text-[#a0a4b8] font-mono text-xs">
        <div className="max-w-[1320px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1 text-center md:text-left">
            <span className="font-bold text-white tracking-wider">
              NEWTON SCHOOL OF TECHNOLOGY (NST)
            </span>
            <span>NST Student Developer Community (SDC) &bull; ADYPU Campus, Pune, Maharashtra</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              PRIVACY POLICY
            </Link>
            <Link href="/projects" className="hover:text-white transition-colors">
              PROJECTS
            </Link>
            <Link href="/students" className="hover:text-white transition-colors">
              DIRECTORY
            </Link>
            <a
              href="https://github.com/nst-sdc"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              GITHUB <ExternalLink className="w-3 h-3" />
            </a>
            <Link href="/login" className="text-white hover:text-[#0057FF] font-bold transition-colors">
              LOGIN ↗
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
