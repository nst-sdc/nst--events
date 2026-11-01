import React from 'react';
import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import clsx from 'clsx';
import {
  Trophy,
  ArrowLeft,
  Medal,
  Users,
  Globe,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Compass,
  Lock
} from 'lucide-react';
import {
  PublicResultsResponse,
  FormattedAward,
  AwardRecipientData,
  AwardProjectLinkData,
  TeamMemberSnapshot,
  StudentSnapshot,
} from '@/lib/event-results-api';
import { ResultReportModal } from '@/components/results/ResultReportModal';
import { API_BASE_URL } from '@/lib/api';

type PublicRecipient = AwardRecipientData & {
  student?: StudentSnapshot & { slug?: string | null };
  members?: (TeamMemberSnapshot & { slug?: string | null })[];
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchResults(slug: string): Promise<PublicResultsResponse | null> {
  const apiBase =
    API_BASE_URL && API_BASE_URL.startsWith('http')
      ? API_BASE_URL
      : process.env.INTERNAL_API_URL && process.env.INTERNAL_API_URL.startsWith('http')
        ? process.env.INTERNAL_API_URL
        : '';
  if (!apiBase) return null;

  try {
    const res = await fetch(`${apiBase}/v1/events/public/${encodeURIComponent(slug)}/results`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    return await res.json();
  } catch (err) {
    console.error('Error fetching public event results:', err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';
  const data = await fetchResults(slug);

  if (!data || data.redirect || data.status === 'UNAUTHENTICATED_RESTRICTED') {
    return {
      title: 'Event Results Not Available — NST Events',
      robots: { index: false, follow: false },
    };
  }

  const isUnlisted = data.event.visibility === 'UNLISTED';
  const canonicalUrl = `${siteUrl}/event/${data.event.slug || slug}/results`;

  return {
    title: `Official Results: ${data.event.title} — NST Events`,
    description: `Official winners, awards, and podium placements for ${data.event.title} at Newton School of Technology.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: isUnlisted ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: `Official Results: ${data.event.title}`,
      description: `Official winners, awards, and podium placements for ${data.event.title}`,
      url: canonicalUrl,
      siteName: 'NST Events',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Official Results: ${data.event.title}`,
      description: `Official winners, awards, and podium placements for ${data.event.title}`,
    },
  };
}

export default async function PublicEventResultsPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await fetchResults(slug);

  if (!data) {
    notFound();
  }

  if (data.redirect && data.canonical_slug) {
    permanentRedirect(`/event/${data.canonical_slug}/results`);
  }

  if (data.status === 'UNAUTHENTICATED_RESTRICTED') {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#050505] text-zinc-950 dark:text-[#F5F5F2] flex flex-col justify-center items-center px-6 py-20">
        <div className="max-w-md w-full bg-white dark:bg-[#090a0f] border-3 border-amber-500/50 p-8 shadow-[8px_8px_0px_#000] text-center flex flex-col items-center">
          <div className="w-14 h-14 bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-amber-500" />
          </div>
          <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">
            Restricted Event Results
          </span>
          <h1 className="text-xl font-black uppercase text-zinc-950 dark:text-[#F5F5F2] mb-3">
            {data.event.title}
          </h1>
          <p className="text-xs text-zinc-600 dark:text-[#a0a4b8] leading-relaxed mb-6">
            Official results for this institutional event are restricted to authenticated Newton School of Technology students and faculty members.
          </p>
          <Link
            href="/login"
            className="w-full py-3 bg-[#0057FF] text-white font-mono text-xs font-black uppercase tracking-wider hover:bg-[#0047D4] transition-all shadow-[4px_4px_0px_#000]"
          >
            Sign In with Institutional Account
          </Link>
        </div>
      </div>
    );
  }

  const { event, results, status } = data;

  if (status !== 'PUBLISHED' || !results) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#050505] text-zinc-950 dark:text-[#F5F5F2] flex flex-col justify-center items-center px-6 py-20">
        <div className="max-w-md w-full bg-white dark:bg-[#090a0f] border-2 border-zinc-200 dark:border-white/20 p-8 shadow-[8px_8px_0px_#000] text-center flex flex-col items-center">
          <Trophy className="w-12 h-12 text-zinc-400 dark:text-white/30 mb-4" />
          <h1 className="text-xl font-black uppercase text-zinc-950 dark:text-[#F5F5F2] mb-2">
            Results Not Published
          </h1>
          <p className="text-xs text-zinc-600 dark:text-[#a0a4b8] leading-relaxed mb-6">
            Official results for <span className="text-zinc-950 dark:text-white font-bold">{event.title}</span> {status === 'WITHDRAWN' ? 'have been temporarily withdrawn.' : 'have not been finalized yet.'}
          </p>
          <Link
            href={`/event/${event.slug || slug}`}
            className="px-5 py-2.5 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 border border-zinc-300 dark:border-white/20 text-zinc-800 dark:text-white font-mono text-xs font-bold uppercase transition-all"
          >
            ← Return to Event Page
          </Link>
        </div>
      </div>
    );
  }

  const podium1 = results.podium.find((a) => a.placement === 1);
  const podium2 = results.podium.find((a) => a.placement === 2);
  const podium3 = results.podium.find((a) => a.placement === 3);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#050505] text-zinc-950 dark:text-[#F5F5F2] font-sans antialiased selection:bg-[#C8FF00] selection:text-black">
      {/* Top Banner Ribbon */}
      <div className="h-2 w-full bg-gradient-to-r from-[#0057FF] via-[#C8FF00] to-[#0057FF]" />

      <main className="max-w-[1360px] mx-auto px-6 py-10 md:px-12 md:py-16 flex flex-col gap-10">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4">
          <Link
            href={`/event/${event.slug || slug}`}
            className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-[#0057FF] hover:text-blue-700 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Event Page
          </Link>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-[#a0a4b8]">
            <span>NST OFFICIAL RESULTS</span>
            <span>•</span>
            <span className="text-[#0057FF] dark:text-[#C8FF00] font-bold">VERIFIED RECORD</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="p-8 md:p-12 bg-white dark:bg-[#090a0f] border-3 border-black dark:border-[#F5F5F2] shadow-[8px_8px_0px_#0057FF] relative overflow-hidden flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3 py-1 bg-[#C8FF00] text-black font-mono text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Official Results
            </span>

            {results.is_correction && (
              <span className="px-3 py-1 bg-[#FF9500] text-black font-mono text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                Official Revision #{results.revision_number}
              </span>
            )}

            <span className="text-xs font-mono text-zinc-500 dark:text-[#a0a4b8]">
              Published {dayjs(results.published_at).format('MMMM D, YYYY')}
            </span>

            {event.primary_club && (
              <span className="text-xs font-mono text-[#0057FF]">
                • Organized by {event.primary_club.name}
              </span>
            )}
          </div>

          <div>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-zinc-950 dark:text-[#F5F5F2] tracking-tight uppercase leading-none"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {event.title}
            </h1>
            <p className="mt-3 text-sm md:text-base text-zinc-600 dark:text-[#a0a4b8] max-w-3xl">
              Official recognized awards, podium standings, and certified student achievements for {event.title}.
            </p>
          </div>

          {/* Correction Notice Banner */}
          {results.correction_reason && (
            <div className="p-4 bg-amber-50 dark:bg-[#FF9500]/10 border-2 border-amber-500 dark:border-[#FF9500] flex items-start gap-3 shadow-[4px_4px_0px_#000]">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-[#FF9500] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-mono text-xs font-black uppercase text-amber-800 dark:text-[#FF9500] tracking-wider block">
                  Official Record Correction Note:
                </span>
                <p className="text-xs text-zinc-900 dark:text-[#F5F5F2] mt-0.5 leading-relaxed">
                  {results.correction_reason}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 1. Official Podium (Placements 1, 2, 3) */}
        {results.podium.length > 0 && (
          <section className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#0057FF] dark:text-[#C8FF00]" />
              <h2 className="font-mono text-base font-black uppercase tracking-widest text-zinc-950 dark:text-[#F5F5F2]">
                Podium Placements
              </h2>
            </div>

            {/* Visual 3-Pedestal Podium Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* 2nd Place Podium Card */}
              {podium2 ? (
                <div className="order-2 md:order-1">
                  <PodiumCard award={podium2} placementRank={2} />
                </div>
              ) : (
                <div className="order-2 md:order-1 hidden md:block" />
              )}

              {/* 1st Place Champion Podium Card */}
              {podium1 && (
                <div className="order-1 md:order-2">
                  <PodiumCard award={podium1} placementRank={1} />
                </div>
              )}

              {/* 3rd Place Podium Card */}
              {podium3 ? (
                <div className="order-3">
                  <PodiumCard award={podium3} placementRank={3} />
                </div>
              ) : (
                <div className="order-3 hidden md:block" />
              )}
            </div>
          </section>
        )}

        {/* 2. Additional Ranked Placements (4th+) */}
        {results.additional_ranked.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="font-mono text-sm font-black uppercase tracking-widest text-zinc-600 dark:text-[#a0a4b8] border-b border-zinc-200 dark:border-white/10 pb-2">
              Additional Ranked Placements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.additional_ranked.map((award, i) => (
                <StandardAwardCard key={i} award={award} />
              ))}
            </div>
          </section>
        )}

        {/* 3. Special Awards & Honorable Mentions */}
        {results.special_awards.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="font-mono text-sm font-black uppercase tracking-widest text-emerald-700 dark:text-[#C8FF00] border-b border-zinc-200 dark:border-white/10 pb-2 flex items-center gap-2">
              <Medal className="w-4 h-4" />
              Special Category Awards & Honorable Mentions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.special_awards.map((award, i) => (
                <SpecialAwardCard key={i} award={award} />
              ))}
            </div>
          </section>
        )}

        {/* Footer & Inaccuracy Reporting Boundary */}
        <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-[#a0a4b8]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Official NST Events certified results ledger.</span>
          </div>

          <ResultReportModal eventId={event.id} eventTitle={event.title} />
        </div>
      </main>
    </div>
  );
}

// =========================================================================
// Subcomponents: High-Contrast Brutalist Award Renderers
// =========================================================================

function PodiumCard({ award, placementRank }: { award: FormattedAward; placementRank: 1 | 2 | 3 }) {
  const isGold = placementRank === 1;
  const isSilver = placementRank === 2;

  return (
    <div
      className={clsx(
        "p-6 bg-white dark:bg-[#090a0f] border-3 shadow-[6px_6px_0px_#000] flex flex-col gap-5 relative",
        isGold ? "border-[#0057FF] dark:border-[#C8FF00] shadow-[8px_8px_0px_#0057FF] dark:shadow-[8px_8px_0px_#C8FF00] md:min-h-[460px]" :
        isSilver ? "border-slate-400 dark:border-slate-300 shadow-[6px_6px_0px_#94A3B8] md:min-h-[410px]" :
        "border-amber-600 shadow-[6px_6px_0px_#D97706] md:min-h-[380px]"
      )}
    >
      {/* Placement Badge */}
      <div className="flex items-center justify-between">
        <span
          className={clsx(
            "px-3 py-1 font-mono text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]",
            isGold ? "bg-[#C8FF00] text-black" :
            isSilver ? "bg-slate-200 dark:bg-slate-300 text-black" :
            "bg-amber-600 text-white"
          )}
        >
          {isGold ? '1ST PLACE • WINNER' : isSilver ? '2ND PLACE • RUNNER-UP' : '3RD PLACE'}
        </span>

        {award.is_tied && (
          <span className="px-2 py-0.5 bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-white font-mono text-[10px] uppercase font-bold">
            Tied
          </span>
        )}
      </div>

      <div>
        <h3
          className={clsx(
            "text-xl sm:text-2xl font-black uppercase leading-tight tracking-tight",
            isGold ? "text-[#0057FF] dark:text-[#C8FF00]" : "text-zinc-950 dark:text-[#F5F5F2]"
          )}
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          {award.title}
        </h3>
        {award.description && (
          <p className="mt-1 text-xs text-zinc-600 dark:text-[#a0a4b8] leading-relaxed">
            {award.description}
          </p>
        )}
      </div>

      {/* Recipients */}
      <div className="flex flex-col gap-3 flex-grow justify-start">
        {award.recipients.map((rec, rIdx) => (
          <RecipientItem key={rIdx} recipient={rec} isGold={isGold} />
        ))}
      </div>

      {/* Linked Projects */}
      {award.project_links && award.project_links.length > 0 && (
        <div className="pt-3 border-t border-zinc-200 dark:border-white/10">
          <ProjectLinkList links={award.project_links} />
        </div>
      )}
    </div>
  );
}

function StandardAwardCard({ award }: { award: FormattedAward }) {
  return (
    <div className="p-5 bg-white dark:bg-[#090a0f] border-2 border-zinc-200 dark:border-white/15 shadow-[4px_4px_0px_#000] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="px-2.5 py-0.5 bg-zinc-100 dark:bg-white/10 font-mono text-xs font-bold uppercase text-zinc-950 dark:text-[#F5F5F2]">
          {award.placement ? `${award.placement}th Place` : 'Ranked Placement'}
        </span>
        {award.is_tied && (
          <span className="text-[10px] font-mono text-zinc-500 dark:text-[#a0a4b8] uppercase">Tied</span>
        )}
      </div>

      <h4 className="text-base font-black uppercase text-zinc-950 dark:text-[#F5F5F2]" style={{ fontFamily: "'Syne', sans-serif" }}>
        {award.title}
      </h4>
      {award.description && (
        <p className="text-xs text-zinc-600 dark:text-[#a0a4b8]">{award.description}</p>
      )}

      <div className="flex flex-col gap-2 mt-1">
        {award.recipients.map((rec, i) => (
          <RecipientItem key={i} recipient={rec} isGold={false} />
        ))}
      </div>

      {award.project_links && award.project_links.length > 0 && (
        <div className="pt-2 border-t border-zinc-200 dark:border-white/10">
          <ProjectLinkList links={award.project_links} />
        </div>
      )}
    </div>
  );
}

function SpecialAwardCard({ award }: { award: FormattedAward }) {
  return (
    <div className="p-6 bg-white dark:bg-[#090a0f] border-2 border-[#0057FF] shadow-[4px_4px_0px_#0057FF] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-[#0057FF]/20 text-blue-700 dark:text-[#0057FF] border border-blue-200 dark:border-[#0057FF]/40 font-mono text-[11px] font-black uppercase tracking-wider">
          {award.award_type === 'HONORABLE_MENTION' ? 'Honorable Mention' : 'Special Recognition'}
        </span>
      </div>

      <div>
        <h4 className="text-lg font-black uppercase text-zinc-950 dark:text-[#F5F5F2]" style={{ fontFamily: "'Syne', sans-serif" }}>
          {award.title}
        </h4>
        {award.description && (
          <p className="mt-1 text-xs text-zinc-600 dark:text-[#a0a4b8] leading-relaxed">{award.description}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        {award.recipients.map((rec, i) => (
          <RecipientItem key={i} recipient={rec} isGold={false} />
        ))}
      </div>

      {award.project_links && award.project_links.length > 0 && (
        <div className="pt-3 border-t border-zinc-200 dark:border-white/10">
          <ProjectLinkList links={award.project_links} />
        </div>
      )}
    </div>
  );
}

function RecipientItem({ recipient }: { recipient: PublicRecipient; isGold: boolean }) {
  if (recipient.recipient_type === 'INDIVIDUAL' && recipient.student) {
    const s = recipient.student;
    return (
      <div className="p-3 bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-white/10 flex items-center justify-center font-mono text-xs font-bold text-zinc-950 dark:text-white border border-zinc-300 dark:border-white/20 overflow-hidden flex-shrink-0">
            {s.avatar_url ? (
              <img src={s.avatar_url} alt={s.name} className="w-full h-full object-cover" />
            ) : (
              s.name[0]
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              {s.slug ? (
                <Link
                  href={`/students/${s.slug}`}
                  className="text-xs sm:text-sm font-bold text-zinc-950 dark:text-[#F5F5F2] hover:text-[#0057FF] hover:underline transition-colors"
                >
                  {s.name}
                </Link>
              ) : (
                <span className="text-xs sm:text-sm font-bold text-zinc-950 dark:text-[#F5F5F2]">{s.name}</span>
              )}
              <span title="Verified NST Student"><ShieldCheck className="w-3.5 h-3.5 text-[#0057FF] dark:text-[#C8FF00]" /></span>
            </div>
            <p className="text-[11px] font-mono text-zinc-500 dark:text-[#a0a4b8]">
              {s.program || 'Student'} {s.batch ? `'${s.batch.slice(-2)}` : ''} {s.roll_number ? `• ${s.roll_number}` : ''}
            </p>
          </div>
        </div>
        {s.slug && (
          <Link
            href={`/students/${s.slug}`}
            className="text-[10px] font-mono text-[#0057FF] hover:underline uppercase"
          >
            Dossier ↗
          </Link>
        )}
      </div>
    );
  }

  if (recipient.recipient_type === 'TEAM' && recipient.team) {
    return (
      <div className="p-3 bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-white/10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0057FF] dark:text-[#C8FF00]" />
            <span className="text-sm font-bold text-zinc-950 dark:text-[#F5F5F2]">{recipient.team.name}</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 dark:text-[#a0a4b8] uppercase font-bold">
            Registered Team
          </span>
        </div>

        {recipient.members && recipient.members.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {recipient.members.map((m, mIdx: number) => {
              const chip = (
                <span
                  className="px-2 py-0.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-[11px] font-mono text-zinc-800 dark:text-[#F5F5F2] flex items-center gap-1 hover:border-[#0057FF] transition-colors"
                >
                  <span>{m.name}</span>
                  {m.team_role === 'LEADER' && (
                    <span className="text-[9px] text-[#0057FF] dark:text-[#C8FF00] font-bold">★</span>
                  )}
                </span>
              );

              return m.slug ? (
                <Link key={mIdx} href={`/students/${m.slug}`}>
                  {chip}
                </Link>
              ) : (
                <span key={mIdx}>{chip}</span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (recipient.recipient_type === 'EXTERNAL' && recipient.external) {
    return (
      <div className="p-3 bg-zinc-50 dark:bg-[#050505] border border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <div>
            <p className="text-xs font-bold text-zinc-950 dark:text-[#F5F5F2]">{recipient.external.name}</p>
            {recipient.external.details && (
              <p className="text-[10px] font-mono text-zinc-500 dark:text-[#a0a4b8]">{recipient.external.details}</p>
            )}
          </div>
        </div>
        <span className="text-[9px] font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5">
          External Winner
        </span>
      </div>
    );
  }

  return null;
}

function ProjectLinkList({ links }: { links: AwardProjectLinkData[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-[#a0a4b8] flex items-center gap-1">
        <Compass className="w-3 h-3 text-[#0057FF]" />
        Recognized Project Submission:
      </span>
      {links.map((link, lIdx) => {
        if (link.type === 'NST_PROJECT' && link.project) {
          return (
            <Link
              key={lIdx}
              href={`/projects/${link.project.slug}`}
              className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-white/10 hover:border-[#0057FF] transition-all group"
            >
              <div className="flex items-center gap-2">
                {link.project.cover_image_url && (
                  <img
                    src={link.project.cover_image_url}
                    alt={link.project.title}
                    className="w-7 h-7 object-cover border border-zinc-200 dark:border-white/10"
                  />
                )}
                <div>
                  <p className="text-xs font-bold text-zinc-950 dark:text-[#F5F5F2] group-hover:text-[#0057FF] transition-colors">
                    {link.project.title}
                  </p>
                  {link.project.tagline && (
                    <p className="text-[10px] text-zinc-500 dark:text-[#a0a4b8] truncate max-w-xs">{link.project.tagline}</p>
                  )}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400 dark:text-[#a0a4b8] group-hover:text-[#0057FF]" />
            </Link>
          );
        }

        if (link.external_url) {
          return (
            <a
              key={lIdx}
              href={link.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-[#050505] border border-zinc-200 dark:border-white/10 hover:border-[#0057FF] transition-all text-xs text-zinc-600 dark:text-[#a0a4b8] hover:text-zinc-950 dark:hover:text-white"
            >
              <span className="truncate">{link.title_snapshot || link.external_url}</span>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            </a>
          );
        }

        return null;
      })}
    </div>
  );
}
