'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useLogout } from '../../../../hooks/useLogout';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  NotificationPreferences,
} from '../../../../hooks/useNotificationPreferences';
import {
  ExternalLink,
  ShieldCheck,
  FolderHeart,
  Award,
  Bell,
  LogOut,
} from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { useQuery } from '@tanstack/react-query';
import { useDashboardSummary } from '../../../../hooks/useDashboardSummary';
import { eventResultsApi } from '../../../../lib/event-results-api';
import { StudentPortfolioSettings } from '../../../../components/student/StudentPortfolioSettings';
import { StudentAppShell } from '../../../../components/layout/StudentAppShell';
import { ClubAdminProvider } from '../../../../components/layout/ClubAdminProvider';
import { getWebAuthStore } from '../../../../lib/auth-store';
import { refreshToken } from '../../../../lib/api';

interface StudentAchievementItem {
  id: string;
  placement?: number | null;
  published_at: string;
  award_title: string;
  is_team_award?: boolean;
  team_name?: string | null;
  event: {
    id: string;
    title: string;
    slug: string;
  };
  linked_project?: {
    id: string;
    slug: string;
    title: string;
  } | null;
}

const myProfileStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --warm-amber: #FF9500;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .my-profile-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  html.light .my-profile-page, .light .my-profile-page {
    background-color: #fbfbfb;
    color: #131313;
  }

  .my-profile-dot-grid {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.25;
    background-image: radial-gradient(rgba(245, 245, 242, 0.12) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  html.light .my-profile-dot-grid, .light .my-profile-dot-grid {
    opacity: 0.15;
    background-image: radial-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px);
  }

  .my-profile-watermark {
    position: absolute;
    top: 40px;
    right: 20px;
    font-family: var(--font-display);
    font-size: clamp(80px, 14vw, 180px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.02);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
    z-index: 0;
  }

  html.light .my-profile-watermark, .light .my-profile-watermark {
    color: rgba(0, 0, 0, 0.03);
  }

  .neo-profile-hero {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.2);
    box-shadow: 10px 10px 0px var(--electric-blue);
    position: relative;
    padding: 32px;
    margin-bottom: 32px;
  }

  html.light .neo-profile-hero, .light .neo-profile-hero {
    background: #ffffff;
    border: 3px solid #000000;
    box-shadow: 10px 10px 0px #000000;
  }

  .neo-profile-card {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.15);
    padding: 28px;
    margin-bottom: 32px;
    position: relative;
  }

  html.light .neo-profile-card, .light .neo-profile-card {
    background: #ffffff;
    border: 2px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  .neo-meta-box {
    background: #050505;
    border: 2px solid rgba(245, 245, 242, 0.15);
    padding: 12px 14px;
  }

  html.light .neo-meta-box, .light .neo-meta-box {
    background: #f5f5f2;
    border: 2px solid #000000;
  }

  .neo-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 8px 14px;
    background: transparent;
    border: 2px solid rgba(245, 245, 242, 0.3);
    color: var(--bg-paper-white);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .neo-btn:hover {
    border-color: var(--electric-blue);
    background: var(--electric-blue);
    color: #ffffff;
    box-shadow: 4px 4px 0px rgba(0, 87, 255, 0.4);
    transform: translate3d(-1px, -1px, 0);
  }

  html.light .neo-btn, .light .neo-btn {
    border: 2px solid #000000;
    color: #000000;
  }

  html.light .neo-btn:hover, .light .neo-btn:hover {
    background: #000000;
    color: #ffffff;
    box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.4);
  }

  .neo-toggle-track {
    width: 48px;
    height: 26px;
    background: #1c1d24;
    border: 2px solid rgba(245, 245, 242, 0.3);
    display: flex;
    align-items: center;
    padding: 2px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .neo-toggle-track.active {
    background: var(--electric-blue);
    border-color: var(--electric-blue);
  }

  .neo-toggle-thumb {
    width: 18px;
    height: 18px;
    background: #ffffff;
    border: 1px solid #000000;
    transition: transform 0.15s ease;
  }

  .neo-toggle-thumb.active {
    transform: translateX(22px);
  }
`;

export default function MyProfilePage() {
  const router = useRouter();
  const authStore = getWebAuthStore();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const { data: prefs, isLoading: isPrefsLoading } = useNotificationPreferences();
  const { mutate: updatePref } = useUpdateNotificationPreferences();

  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);

  // Authenticate user
  useEffect(() => {
    const checkAuth = async () => {
      if (!authStore.accessToken) {
        try {
          const res = await refreshToken();
          if (res.status === 'SUCCESS') {
            authStore.setAccessToken(res.token);
            return;
          }
        } catch {
          // Token refresh failed
        }
        router.push('/login?return_to=/my/profile');
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch verified event achievements
  const { data: achievements, isLoading: isLoadingAchievements } = useQuery({
    queryKey: ['my-achievements', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const res = await eventResultsApi.getStudentAchievements(user.id);
        return (res?.achievements || []) as StudentAchievementItem[];
      } catch {
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Fetch verified event attendance count from dashboard summary
  const { data: summary } = useDashboardSummary();
  const attendedCount = summary?.eventsAttendedCount ?? 0;

  if (isUserLoading) {
    return (
      <ClubAdminProvider>
        <StudentAppShell>
          <style dangerouslySetInnerHTML={{ __html: myProfileStyles }} />
          <div className="my-profile-page flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-2 border-[#0057FF] border-t-transparent animate-spin mx-auto" />
              <p className="font-['JetBrains_Mono',monospace] text-xs text-zinc-400 uppercase tracking-widest font-bold">
                [SYNCHRONIZING SCHOLAR IDENTITY...]
              </p>
            </div>
          </div>
        </StudentAppShell>
      </ClubAdminProvider>
    );
  }

  if (!user) {
    return (
      <ClubAdminProvider>
        <StudentAppShell>
          <style dangerouslySetInnerHTML={{ __html: myProfileStyles }} />
          <div className="my-profile-page flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-sm p-8 neo-profile-card">
              <ShieldCheck className="w-12 h-12 text-[#0057FF] mx-auto" />
              <h2 className="text-lg font-bold uppercase font-['Syne',sans-serif]">
                Authentication Required
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Please authenticate with your verified institutional Google account (@adypu.edu.in) to access your portfolio control center.
              </p>
              <Link
                href="/login?return_to=/my/profile"
                className="neo-btn inline-block bg-[#0057FF] text-white border-[#0057FF]"
              >
                [SIGN IN TO GATEWAY ↗]
              </Link>
            </div>
          </div>
        </StudentAppShell>
      </ClubAdminProvider>
    );
  }

  // Derive Student ID from email
  const studentId = user.email ? user.email.split('@')[0].toUpperCase() : 'NST-STUDENT';

  // Academic identity details
  const batch = user.academic_profile?.batch;
  const program = batch?.program?.name || batch?.program?.code || 'B.Tech Program';
  const batchName = batch?.graduation_year ? `Batch of ${batch.graduation_year}` : 'Class of 2026';
  const campusName = 'Newton School of Technology';

  const handleTogglePreference = (key: keyof NotificationPreferences, currentValue: boolean) => {
    updatePref({ [key]: !currentValue });
  };

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <style dangerouslySetInnerHTML={{ __html: myProfileStyles }} />
        <div className="my-profile-page relative selection:bg-[#0057FF] selection:text-white">
          {/* Subtle Background Cyber Texture */}
          <div className="my-profile-dot-grid" />

          {/* Watermark */}
          <div className="my-profile-watermark">
            IDENTITY
          </div>

          {/* SIGN OUT MODAL */}
          <Modal
            isOpen={isSignOutModalOpen}
            onClose={() => !isLoggingOut && setIsSignOutModalOpen(false)}
            title="CONFIRM SESSION TERMINATION"
          >
            <div className="p-6 pt-0 bg-white dark:bg-[#0d0e12] text-zinc-950 dark:text-[#F5F5F2] border-t-2 border-black/20 dark:border-white/20">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 font-['JetBrains_Mono',monospace] font-bold">
                {'//'} Are you sure you want to sign out of your institutional scholar account on this device?
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setIsSignOutModalOpen(false)}
                  disabled={isLoggingOut}
                  className="w-full sm:w-auto px-5 py-2.5 border-2 border-black dark:border-white/30 text-zinc-800 dark:text-white font-['JetBrains_Mono',monospace] font-bold text-xs tracking-wider uppercase hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  [CANCEL]
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  disabled={isLoggingOut}
                  className="w-full sm:flex-1 px-5 py-2.5 bg-red-600 border-2 border-red-700 text-white font-['JetBrains_Mono',monospace] font-bold text-xs tracking-wider uppercase hover:bg-red-700 transition-colors disabled:opacity-50 shadow-[3px_3px_0px_#000000]"
                >
                  {isLoggingOut ? '[SIGNING OUT...]' : '[SIGN OUT NOW]'}
                </button>
              </div>
            </div>
          </Modal>

          <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            {/* Top Workspace Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black/15 dark:border-white/15 pb-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-[#0057FF] dark:text-[#7bd0ff] mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{'//'} SCHOLAR PORTFOLIO &amp; PRIVACY SUITE</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-black dark:text-[#F5F5F2] font-['Syne',sans-serif]">
                  My Profile
                </h1>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 font-sans">
                  Manage your public portfolio identity, section visibility, curated projects, and notification preferences.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/my/projects"
                  className="neo-btn"
                >
                  <FolderHeart className="w-3.5 h-3.5 text-[#0057FF] dark:text-[#7bd0ff]" />
                  <span>[MY PROJECTS ↗]</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsSignOutModalOpen(true)}
                  className="neo-btn text-rose-600 dark:text-rose-400 border-rose-500/40 hover:bg-rose-600 hover:text-white hover:border-rose-600"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>[SIGN OUT]</span>
                </button>
              </div>
            </div>

            {/* =========================================================================
                 1. INSTITUTIONAL IDENTITY SUMMARY
                 ========================================================================= */}
            <section className="neo-profile-hero">
              <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-600 select-none">
                + [ACCOUNT_STATE: AUTHORIZED]
              </div>
              <div className="absolute top-2 right-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-600 select-none hidden sm:block">
                NST_CAMPUS // PORTFOLIO_CORE
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mt-2">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-black dark:border-white/30 bg-[#0057FF] flex items-center justify-center text-white font-['Syne',sans-serif] font-black text-2xl sm:text-3xl shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_rgba(0,87,255,0.4)] overflow-hidden">
                      {user.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={user.avatar_url}
                          alt={user.full_name || 'Student'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user.full_name?.charAt(0) || 'S'
                      )}
                    </div>
                    <div
                      title="Verified Institutional Scholar"
                      className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 dark:bg-[#C8FF00] text-black font-['JetBrains_Mono',monospace] text-[9px] font-black px-1.5 py-0.5 border-2 border-black shadow-[2px_2px_0px_#000000]"
                    >
                      [VERIFIED]
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black dark:text-white font-['Syne',sans-serif]">
                        {user.full_name || 'NST Student'}
                      </h2>
                    </div>
                    <p className="text-xs font-['JetBrains_Mono',monospace] font-bold text-[#0057FF] dark:text-[#7bd0ff] mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Academic Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 w-full lg:w-auto">
                  <div className="neo-meta-box">
                    <p className="text-[10px] font-['JetBrains_Mono',monospace] font-bold text-zinc-500 uppercase tracking-wider">
                      STUDENT ID
                    </p>
                    <p className="text-xs font-['JetBrains_Mono',monospace] font-bold text-black dark:text-[#F5F5F2] mt-0.5 truncate">
                      {studentId}
                    </p>
                  </div>
                  <div className="neo-meta-box">
                    <p className="text-[10px] font-['JetBrains_Mono',monospace] font-bold text-zinc-500 uppercase tracking-wider">
                      PROGRAM
                    </p>
                    <p className="text-xs font-['JetBrains_Mono',monospace] font-bold text-black dark:text-[#F5F5F2] mt-0.5 truncate">
                      {program}
                    </p>
                  </div>
                  <div className="neo-meta-box">
                    <p className="text-[10px] font-['JetBrains_Mono',monospace] font-bold text-zinc-500 uppercase tracking-wider">
                      BATCH
                    </p>
                    <p className="text-xs font-['JetBrains_Mono',monospace] font-bold text-black dark:text-[#F5F5F2] mt-0.5 truncate">
                      {batchName}
                    </p>
                  </div>
                  <div className="neo-meta-box">
                    <p className="text-[10px] font-['JetBrains_Mono',monospace] font-bold text-zinc-500 uppercase tracking-wider">
                      CAMPUS
                    </p>
                    <p className="text-xs font-['JetBrains_Mono',monospace] font-bold text-[#0057FF] dark:text-[#7bd0ff] mt-0.5 truncate">
                      {campusName}
                    </p>
                  </div>
                  <div className="neo-meta-box border-l-2 border-l-[#0057FF]">
                    <p className="text-[10px] font-['JetBrains_Mono',monospace] font-bold text-[#0057FF] dark:text-[#7bd0ff] uppercase tracking-wider">
                      EVENTS ATTENDED
                    </p>
                    <p className="text-xs font-['JetBrains_Mono',monospace] font-black text-black dark:text-[#F5F5F2] mt-0.5 truncate">
                      {String(attendedCount).padStart(2, '0')} VERIFIED
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* =========================================================================
                 2. PORTFOLIO SETTINGS, VISIBILITY CONTROLS, & PUBLIC PREVIEW
                 ========================================================================= */}
            <div className="mb-8">
              <StudentPortfolioSettings />
            </div>

            {/* =========================================================================
                 3. VERIFIED HONORS & ACHIEVEMENTS (Authoritative Ledger)
                 ========================================================================= */}
            <section className="neo-profile-card">
              <div className="flex items-center justify-between border-b-2 border-black/15 dark:border-white/15 pb-4 mb-6">
                <div>
                  <div className="text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-amber-500 mb-1">
                    {'//'} AUTHORITATIVE CREDENTIAL LEDGER
                  </div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-black dark:text-white flex items-center gap-2 font-['Syne',sans-serif]">
                    <Award className="w-5 h-5 text-amber-500" />
                    <span>Official Honors &amp; Event Placements</span>
                  </h3>
                </div>
                <span className="text-xs font-['JetBrains_Mono',monospace] font-bold uppercase text-zinc-500 dark:text-zinc-400">
                  [{achievements?.length || 0} RECOGNIZED]
                </span>
              </div>

              {isLoadingAchievements ? (
                <div className="space-y-3 py-2">
                  <div className="h-16 w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 animate-pulse" />
                  <div className="h-16 w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 animate-pulse" />
                </div>
              ) : achievements && achievements.length > 0 ? (
                <div className="space-y-3">
                  {achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="p-4 border-2 border-amber-500/40 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[3px_3px_0px_rgba(255,149,0,0.15)]"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-[10px] font-['JetBrains_Mono',monospace] font-black uppercase bg-amber-500 text-black">
                            [{ach.placement ? `${ach.placement} PLACE` : 'AWARD'}]
                          </span>
                          <span className="text-sm font-bold text-black dark:text-white font-['Syne',sans-serif] uppercase">
                            {ach.award_title}
                          </span>
                        </div>
                        <div className="text-xs font-['JetBrains_Mono',monospace] text-zinc-600 dark:text-zinc-400">
                          <span>EVENT: </span>
                          <Link href={`/event/${ach.event.slug}/results`} className="text-[#0057FF] dark:text-[#7bd0ff] hover:underline font-bold">
                            {ach.event.title} ↗
                          </Link>
                          <span className="text-zinc-400 dark:text-zinc-600"> · </span>
                          <span>DATE // {new Date(ach.published_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {ach.linked_project && (
                        <Link
                          href={`/projects/${ach.linked_project.slug}`}
                          className="neo-btn text-xs"
                        >
                          <span>LINKED: {ach.linked_project.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#0057FF] dark:text-[#7bd0ff]" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-black/20 dark:border-white/20 text-center bg-black/[0.02] dark:bg-white/[0.02]">
                  <Award className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs font-['JetBrains_Mono',monospace] font-bold text-black dark:text-[#F5F5F2] uppercase tracking-wider">
                    {'//'} NO OFFICIAL EVENT RECOGNITIONS RECORDED
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-md mx-auto font-sans">
                    Verified competition results and awards won during NST hackathons will automatically be registered here.
                  </p>
                </div>
              )}
            </section>

            {/* =========================================================================
                 4. NOTIFICATION & DIGEST PREFERENCES
                 ========================================================================= */}
            <section className="neo-profile-card">
              <div className="flex items-center justify-between border-b-2 border-black/15 dark:border-white/15 pb-4 mb-6">
                <div>
                  <div className="text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-[#0057FF] dark:text-[#7bd0ff] mb-1">
                    {'//'} SYSTEM BROADCAST PREFERENCES
                  </div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-black dark:text-white flex items-center gap-2 font-['Syne',sans-serif]">
                    <Bell className="w-5 h-5 text-[#0057FF] dark:text-[#7bd0ff]" />
                    <span>Notification &amp; Communication Channels</span>
                  </h3>
                </div>
              </div>

              {isPrefsLoading ? (
                <div className="h-24 w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 animate-pulse" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.03] border-2 border-black/15 dark:border-white/15">
                    <div>
                      <p className="text-sm font-bold text-black dark:text-white font-['Syne',sans-serif] uppercase">
                        Event &amp; Competition Announcements
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans mt-0.5">
                        Receive alerts when campus hackathons, workshops, and team registrations open.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePreference('eventReminders', prefs?.eventReminders ?? true)}
                      aria-label="Toggle Event Reminders"
                      className={`neo-toggle-track ${(prefs?.eventReminders ?? true) ? 'active' : ''}`}
                    >
                      <div className={`neo-toggle-thumb ${(prefs?.eventReminders ?? true) ? 'active' : ''}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.03] border-2 border-black/15 dark:border-white/15">
                    <div>
                      <p className="text-sm font-bold text-black dark:text-white font-['Syne',sans-serif] uppercase">
                        Campus Club &amp; Team Announcements
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans mt-0.5">
                        Receive notifications when clubs post updates and event activities.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePreference('clubAnnouncements', prefs?.clubAnnouncements ?? true)}
                      aria-label="Toggle Club Announcements"
                      className={`neo-toggle-track ${(prefs?.clubAnnouncements ?? true) ? 'active' : ''}`}
                    >
                      <div className={`neo-toggle-thumb ${(prefs?.clubAnnouncements ?? true) ? 'active' : ''}`} />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
