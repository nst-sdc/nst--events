import React from 'react';
import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import {
  Calendar,
  Clock,
  MapPin,
  Lock,
  ArrowLeft,
  Building2,
  Trophy,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { EventRegistrationHandoff } from '@/components/public/EventRegistrationHandoff';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchPublicEvent(slug: string) {
  const apiBase =
    API_BASE_URL && API_BASE_URL.startsWith('http')
      ? API_BASE_URL
      : process.env.INTERNAL_API_URL && process.env.INTERNAL_API_URL.startsWith('http')
        ? process.env.INTERNAL_API_URL
        : '';
  if (!apiBase) return null;

  try {
    const res = await fetch(`${apiBase}/v1/events/public/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 404) return null;
    if (res.status === 401) return { status: 'UNAUTHENTICATED_RESTRICTED' as const };
    if (res.status === 403) return { status: 'FORBIDDEN_RESTRICTED' as const };
    if (!res.ok) return null;

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Error fetching public event:', err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  const event = await fetchPublicEvent(slug);

  if (!event || event.redirect || event.status === 'UNAUTHENTICATED_RESTRICTED' || event.status === 'FORBIDDEN_RESTRICTED') {
    return {
      title: 'Event Not Found — NST Events',
      robots: { index: false, follow: false },
    };
  }

  const isUnlisted = event.visibility === 'UNLISTED';
  const canonicalUrl = `${siteUrl}/event/${event.slug || slug}`;
  const banner = event.banner_url || `${siteUrl}/icon.png`;

  return {
    title: `${event.title} — NST Events`,
    description: event.description || `Attend ${event.title} organized by ${event.primary_club?.name || 'NST Student Club'}.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: isUnlisted
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: `${event.title} — NST Events`,
      description: event.description || `Campus event at Newton School of Technology`,
      url: canonicalUrl,
      siteName: 'NST Events',
      images: [
        {
          url: banner,
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
      type: 'article',
      publishedTime: event.start_time,
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description: event.description || `Campus event at Newton School of Technology`,
      images: [banner],
    },
  };
}

export default async function PublicEventPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await fetchPublicEvent(slug);

  if (!event) {
    notFound();
  }

  // Handle permanent direct redirect (HTTP 308)
  if (event.redirect && event.canonical_slug) {
    permanentRedirect(`/event/${event.canonical_slug}`);
  }

  // Handle restricted event gating
  if (event.status === 'UNAUTHENTICATED_RESTRICTED' || event.status === 'FORBIDDEN_RESTRICTED') {
    return (
      <div className="min-h-screen bg-[#050505] text-[#F5F5F2] flex flex-col justify-between selection:bg-[#C8FF00] selection:text-black">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-mono font-bold text-xl text-[#F5F5F2] hover:text-[#0057FF]">
              NST_EVENTS
            </Link>
            <Link href="/projects" className="text-[#a0a4b8] hover:text-[#0057FF] font-['JetBrains_Mono',monospace] text-xs font-bold uppercase tracking-wider transition-colors">
              PROJECTS
            </Link>
          </div>
        </header>

        <div className="max-w-md mx-auto my-auto px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto mb-6 text-[#FF9500]">
            <Lock className="w-8 h-8" />
          </div>
          <span className="px-2.5 py-1 text-[11px] font-mono font-bold tracking-widest uppercase bg-[#FF9500]/10 text-[#FF9500] border border-[#FF9500]/30 rounded">
            RESTRICTED EVENT
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight mt-4 text-[#F5F5F2]">
            INSTITUTIONAL ACCESS REQUIRED
          </h1>
          <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
            This event is restricted to verified Newton School of Technology / ADYPU students and faculty. Please sign in with your institutional Google account (@adypu.edu.in or @newtonschool.co) to view event details and register.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/login?redirect=/event/${encodeURIComponent(slug)}`}
              className="px-6 py-3 bg-[#C8FF00] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b8eb00] transition-colors"
            >
              Sign In With Google
            </Link>
            <Link
              href="/"
              className="px-6 py-3 bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono font-bold text-xs uppercase tracking-wider rounded-xl hover:text-white transition-colors"
            >
              Back to Events
            </Link>
          </div>
        </div>

        <footer className="border-t border-zinc-900 py-6 text-center text-xs font-mono text-zinc-600">
          NST Events &copy; {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  const startDate = dayjs(event.start_time);
  const endDate = dayjs(event.end_time);
  const formattedDate = startDate.format('dddd, MMMM D, YYYY');
  const formattedTimeRange = `${startDate.format('h:mm A')} – ${endDate.format('h:mm A')}`;

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F2] font-sans relative selection:bg-[#C8FF00] selection:text-black">
      {/* Background Grid Pattern */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Navigation Header */}
      <header className="relative z-10 border-b border-zinc-800/80 bg-[#050505]/90 backdrop-blur-md sticky top-0 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link
              href="/"
              className="flex items-center space-x-2 text-zinc-400 hover:text-[#0057FF] font-mono text-xs uppercase tracking-wider transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ALL EVENTS</span>
            </Link>
            <Link
              href="/projects"
              className="text-[#a0a4b8] hover:text-[#0057FF] font-['JetBrains_Mono',monospace] text-xs font-bold uppercase tracking-wider transition-colors"
            >
              PROJECTS
            </Link>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono text-zinc-500 hidden sm:inline-block">
              {`${event.event_type} // ${event.registration_type}`}
            </span>
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded text-zinc-300 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Banner Section */}
        {event.banner_url && (
          <div className="w-full h-64 sm:h-96 rounded-2xl overflow-hidden border border-zinc-800 mb-8 relative">
            <img
              src={event.banner_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80" />
          </div>
        )}

        {/* Header Details */}
        <div className="border-b border-zinc-800/80 pb-8 mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-300 border border-zinc-700 rounded-md">
              {event.event_type}
            </span>
            <span className="px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-md">
              {event.registration_type} ENTRY
            </span>
            {event.primary_club && (
              <span className="px-3 py-1 text-xs font-mono text-zinc-300 border border-zinc-800 bg-zinc-950 rounded-md flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>{event.primary_club.name}</span>
              </span>
            )}
            <Link
              href={`/event/${event.slug || slug}/results`}
              className="ml-auto px-3.5 py-1 text-xs font-mono font-black tracking-wider uppercase bg-[#C8FF00] text-black hover:bg-[#b8eb00] rounded-md flex items-center gap-1.5 shadow-[2px_2px_0px_#000] transition-all"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Official Results</span>
            </Link>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#F5F5F2] leading-tight">
            {event.title}
          </h1>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-zinc-900">
            <div className="flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-[#C8FF00] shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase">DATE</p>
                <p className="text-sm font-semibold text-zinc-200">{formattedDate}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-[#C8FF00] shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase">TIME</p>
                <p className="text-sm font-semibold text-zinc-200">{formattedTimeRange}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-[#C8FF00] shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase">VENUE</p>
                <p className="text-sm font-semibold text-zinc-200">
                  {event.location_name || 'NST Campus'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Registration CTA Module */}
        <section className="mb-12">
          <EventRegistrationHandoff
            eventId={event.id}
            eventSlug={event.slug}
            eventTitle={event.title}
            registrationStatus={event.registration_status}
            registrationType={event.registration_type}
          />
        </section>

        {/* Description & About Content */}
        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 sm:p-8">
          <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-zinc-200 mb-4 pb-2 border-b border-zinc-800/60">
            ABOUT THE EVENT
          </h2>
          <div className="text-sm sm:text-base text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
            {event.description || 'No detailed description provided for this event.'}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-900 mt-20 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div>
            <span>NST Events &copy; {new Date().getFullYear()} &mdash; Newton School of Technology</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/" className="hover:text-zinc-300 transition-colors">
              Browse More Events
            </Link>
            <Link href="/privacy-policy" className="hover:text-zinc-300 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
