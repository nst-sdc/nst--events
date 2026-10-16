'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { NstLogoMark } from '../brand/NstLogo';

export interface PublicEventItem {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  banner_url?: string | null;
  start_time: string;
  end_time: string;
  registration_start_time?: string | null;
  registration_end_time?: string | null;
  location_name?: string | null;
  event_type: string;
  registration_type: string;
  attendance_type: string;
  registration_status: 'NOT_STARTED' | 'OPEN' | 'CLOSING_SOON' | 'CLOSED';
  primary_club?: {
    id: string;
    name: string;
    logo_url?: string | null;
  } | null;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Categories' },
  { id: 'WORKSHOP', label: 'Workshops' },
  { id: 'HACKATHON', label: 'Hackathons' },
  { id: 'COMPETITION', label: 'Competitions' },
  { id: 'MEETUP', label: 'Meetups' },
  { id: 'TALK', label: 'Guest Talks' },
  { id: 'CULTURAL', label: 'Cultural' },
  { id: 'SPORTS', label: 'Sports' },
  { id: 'OTHER', label: 'Other' },
];

export function PublicEventsDiscovery({ initialScope = 'upcoming' }: { initialScope?: 'upcoming' | 'past' }) {
  const [tab, setTab] = useState<'upcoming' | 'past'>(initialScope);
  const [category, setCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [events, setEvents] = useState<PublicEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('time_filter', tab);
        params.set('limit', '50');
        if (category !== 'ALL') {
          params.set('filter_event_type', category);
        }
        if (searchQuery.trim()) {
          params.set('q', searchQuery.trim());
        }

        const res = await fetch(`${API_BASE_URL}/v1/events/public?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load events');
        }
        const data = await res.json();
        if (!isCancelled) {
          setEvents(data?.data || []);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || 'Failed to fetch events');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    const timeout = setTimeout(fetchEvents, searchQuery ? 300 : 0);
    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [tab, category, searchQuery]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F2] font-sans relative selection:bg-[#C8FF00] selection:text-black">
      {/* Background Dot Texture */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Top Header / Navigation Bar */}
      <header className="relative z-50 border-b border-[#F5F5F2]/15 bg-[#050505] sticky top-0 px-4 md:px-8 py-3">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="NST Events Home" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
              <div className="w-8 h-8 bg-[#0057FF] flex items-center justify-center shadow-[3px_3px_0px_#ffffff] flex-shrink-0">
                <NstLogoMark size={20} color="#ffffff" />
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span className="font-['Syne',sans-serif] text-[18px] font-black tracking-tight text-[#F5F5F2] uppercase">
                  NST EVENTS
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-7 font-['JetBrains_Mono',monospace] text-[11px] font-bold uppercase tracking-[1.5px]">
            <Link
              href="/"
              aria-current="page"
              className="transition-colors duration-200 text-[#0057FF]"
            >
              EVENTS
            </Link>
            <Link
              href="/projects"
              className="transition-colors duration-200 text-[#a0a4b8] hover:text-[#0057FF]"
            >
              PROJECTS
            </Link>
          </nav>

          {/* Mobile Navigation Links */}
          <div className="flex md:hidden items-center gap-5 font-['JetBrains_Mono',monospace] text-[11px] font-bold uppercase tracking-[1.5px]">
            <Link href="/" className="text-[#0057FF]">
              EVENTS
            </Link>
            <Link href="/projects" className="text-[#a0a4b8] hover:text-[#0057FF]">
              PROJECTS
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="font-['JetBrains_Mono',monospace] text-[11px] font-bold tracking-wider text-[#ffffff] bg-[#0057FF] px-3.5 py-1.5 uppercase shadow-[3px_3px_0px_#ffffff] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              SIGN IN
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-10">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-[#C8FF00] tracking-widest uppercase mb-3">
              <Compass className="w-4 h-4" />
              <span>EXPLORE HAPPENINGS & WORKSHOPS</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight uppercase leading-[0.95] text-[#F5F5F2]">
              WHAT&apos;S ON <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8FF00] via-[#0057FF] to-[#F5F5F2]">
                AT CAMPUS
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-xl">
              Discover official student clubs, hackathons, guest lectures, and cultural events. Open for all students and campus members.
            </p>
          </div>

          {/* Time Scope Toggle (Upcoming / Past) */}
          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-lg self-start md:self-auto">
            <button
              onClick={() => setTab('upcoming')}
              className={`px-5 py-2 text-xs font-mono font-bold tracking-wider uppercase rounded transition-all ${
                tab === 'upcoming'
                  ? 'bg-[#C8FF00] text-black shadow-lg shadow-[#C8FF00]/10'
                  : 'text-zinc-400 hover:text-[#F5F5F2]'
              }`}
            >
              UPCOMING
            </button>
            <button
              onClick={() => setTab('past')}
              className={`px-5 py-2 text-xs font-mono font-bold tracking-wider uppercase rounded transition-all ${
                tab === 'past'
                  ? 'bg-[#C8FF00] text-black shadow-lg shadow-[#C8FF00]/10'
                  : 'text-zinc-400 hover:text-[#F5F5F2]'
              }`}
            >
              PAST ARCHIVE
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="mt-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by title or keyword..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-[#F5F5F2] placeholder-zinc-500 focus:outline-none focus:border-[#C8FF00] transition-colors"
            />
          </div>

          {/* Categories Pill Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-mono tracking-wider rounded transition-colors ${
                  category === cat.id
                    ? 'bg-zinc-100 text-black font-bold'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Event Cards Grid */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-80 bg-zinc-900/40 border border-zinc-800/80 rounded-xl animate-pulse p-6 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-4 bg-zinc-800 w-1/3 rounded" />
                  <div className="h-8 bg-zinc-800 w-3/4 rounded" />
                  <div className="h-4 bg-zinc-800 w-1/2 rounded" />
                </div>
                <div className="h-10 bg-zinc-800/60 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-20 text-center border border-red-900/40 bg-red-950/20 rounded-xl p-8 max-w-md mx-auto">
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-xs font-mono uppercase bg-zinc-900 border border-zinc-700 text-zinc-200 rounded hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="py-24 text-center border border-zinc-800/80 rounded-2xl bg-zinc-950/40 max-w-lg mx-auto p-8">
            <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold uppercase tracking-tight text-zinc-300">No events found</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-xs mx-auto">
              {searchQuery || category !== 'ALL'
                ? 'Try broadening your search or choosing a different category filter.'
                : tab === 'upcoming'
                ? 'There are currently no upcoming public events scheduled. Check back soon!'
                : 'No past public events match the filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev) => {
              const startDate = dayjs(ev.start_time);
              const formattedDate = startDate.format('MMM D, YYYY');
              const formattedTime = startDate.format('h:mm A');
              const slugLink = `/event/${ev.slug || ev.id}`;

              const regStatusBadge = () => {
                switch (ev.registration_status) {
                  case 'OPEN':
                    return (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-[#C8FF00]/10 text-[#C8FF00] border border-[#C8FF00]/30 rounded">
                        REGISTRATION OPEN
                      </span>
                    );
                  case 'CLOSING_SOON':
                    return (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-[#FF9500]/10 text-[#FF9500] border border-[#FF9500]/30 rounded">
                        CLOSING SOON
                      </span>
                    );
                  case 'CLOSED':
                    return (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-500 border border-zinc-800 rounded">
                        REGISTRATION CLOSED
                      </span>
                    );
                  default:
                    return (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-[#0057FF]/10 text-[#0057FF] border border-[#0057FF]/30 rounded">
                        COMING SOON
                      </span>
                    );
                }
              };

              return (
                <Link
                  key={ev.id}
                  href={slugLink}
                  className="group relative flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6 hover:border-zinc-600 hover:bg-zinc-900/50 transition-all duration-200"
                >
                  <div>
                    {/* Top Meta Bar */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-400 border border-zinc-800 rounded">
                        {ev.event_type}
                      </span>
                      {regStatusBadge()}
                    </div>

                    {/* Event Title */}
                    <h2 className="text-xl font-bold tracking-tight text-[#F5F5F2] group-hover:text-[#C8FF00] transition-colors line-clamp-2">
                      {ev.title}
                    </h2>

                    {/* Club / Organizer */}
                    {ev.primary_club && (
                      <p className="mt-1.5 text-xs font-mono text-zinc-400 flex items-center space-x-1.5">
                        <span className="text-zinc-600">by</span>
                        <span className="text-zinc-300 font-semibold truncate">{ev.primary_club.name}</span>
                      </p>
                    )}

                    {/* Description excerpt */}
                    {ev.description && (
                      <p className="mt-3 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="mt-6 pt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="font-mono text-zinc-300">{formattedDate}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="font-mono text-zinc-400">{formattedTime}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 text-zinc-400 group-hover:text-[#C8FF00] transition-colors font-mono text-[11px] font-semibold">
                      <span>VIEW EVENT</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="relative z-10 border-t border-zinc-900 mt-20 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div>
            <span>NST Events &copy; {new Date().getFullYear()} &mdash; Newton School of Technology</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/privacy-policy" className="hover:text-zinc-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/login" className="hover:text-zinc-300 transition-colors">
              Organizer Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
