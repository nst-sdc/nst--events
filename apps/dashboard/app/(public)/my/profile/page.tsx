'use client';
/* eslint-disable react/no-unescaped-entities */

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
  User,
  ExternalLink,
  ShieldCheck,
  FolderHeart,
  Globe,
  Award,
  Bell,
  LogOut,
  ArrowLeft,
  ChevronRight,
  GraduationCap,
  Calendar,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { DevClubCreditsModal } from '../../../../components/brand/DevClubCreditsModal';
import { DASHBOARD_APP_VERSION, DEV_CLUB_MISSION } from '../../../../lib/brand-config';
import { useQuery } from '@tanstack/react-query';
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

export default function MyProfilePage() {
  const router = useRouter();
  const authStore = getWebAuthStore();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const { data: prefs, isLoading: isPrefsLoading } = useNotificationPreferences();
  const { mutate: updatePref } = useUpdateNotificationPreferences();

  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

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

  if (isUserLoading) {
    return (
      <ClubAdminProvider>
        <StudentAppShell>
          <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-mono text-xs text-zinc-400 uppercase tracking-widest">
                Loading Student Profile...
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
          <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-sm">
              <ShieldCheck className="w-12 h-12 text-zinc-600 mx-auto" />
              <h2 className="text-lg font-bold text-white uppercase">Authentication Required</h2>
              <p className="text-xs text-zinc-400">
                Please sign in with your verified institutional account to access your portfolio settings.
              </p>
              <Link
                href="/login?return_to=/my/profile"
                className="inline-block px-5 py-2.5 rounded-lg bg-blue-600 text-white font-mono text-xs font-bold uppercase tracking-wider"
              >
                Sign In
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
    setUpdateError(null);
    setUpdatingKey(key);
    updatePref(
      { [key]: !currentValue },
      {
        onSettled: () => setUpdatingKey(null),
        onError: () => setUpdateError("Couldn't save this setting. Please try again."),
      }
    );
  };

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <div className="min-h-screen bg-[#050505] text-[#F5F5F2] font-sans relative selection:bg-[#0057FF] selection:text-white">
          {/* Subtle Background Texture */}
          <div
            className="fixed inset-0 pointer-events-none z-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.15) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* SIGN OUT MODAL */}
          <Modal
            isOpen={isSignOutModalOpen}
            onClose={() => !isLoggingOut && setIsSignOutModalOpen(false)}
            title="SIGN OUT"
          >
            <div className="p-6 pt-0 bg-[#0d0e12] text-[#F5F5F2]">
              <p className="text-sm text-zinc-400 mb-6 font-mono">
                Are you sure you want to sign out of your institutional account on this device?
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setIsSignOutModalOpen(false)}
                  disabled={isLoggingOut}
                  className="w-full sm:w-auto px-5 py-2.5 border-2 border-zinc-700 text-white font-mono font-bold text-xs tracking-widest uppercase hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => logout()}
                  disabled={isLoggingOut}
                  className="w-full sm:flex-1 px-5 py-2.5 bg-red-600 text-white font-mono font-bold text-xs tracking-widest uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </Modal>

          <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            {/* Top Workspace Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-blue-400 mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Student Portfolio & Privacy Settings</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white font-['Syne',sans-serif]">
                  My Profile
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Manage your public portfolio identity, section visibility, curated projects, and notification preferences.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/my/projects"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <FolderHeart className="w-3.5 h-3.5 text-blue-400" />
                  <span>My Projects</span>
                </Link>

                <button
                  onClick={() => setIsSignOutModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            </div>

            {/* =========================================================================
                 1. INSTITUTIONAL IDENTITY SUMMARY
                 ========================================================================= */}
            <section className="mb-8 p-6 sm:p-7 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0057FF] to-cyan-500 flex items-center justify-center text-white font-['Syne',sans-serif] font-black text-2xl shadow-lg shrink-0">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name || 'Student'}
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      user.full_name?.charAt(0) || 'S'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold uppercase tracking-tight text-white">
                        {user.full_name || 'NST Student'}
                      </h2>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </div>
                    <p className="text-xs font-mono text-zinc-400 mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Academic Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full sm:w-auto">
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase">STUDENT ID</p>
                    <p className="text-xs font-mono font-bold text-zinc-200 mt-0.5 truncate">{studentId}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase">BATCH</p>
                    <p className="text-xs font-mono font-bold text-zinc-200 mt-0.5 truncate">{batchName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase">CAMPUS</p>
                    <p className="text-xs font-mono font-bold text-blue-400 mt-0.5 truncate">{campusName}</p>
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
            <section className="mb-8 p-6 sm:p-7 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-6">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 mb-1">
                    Authoritative Credential Ledger
                  </div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span>Official Honors & Event Placements</span>
                  </h3>
                </div>
                <span className="text-xs font-mono text-zinc-500">
                  {achievements?.length || 0} recognized
                </span>
              </div>

              {isLoadingAchievements ? (
                <div className="space-y-3 py-2">
                  <div className="h-16 w-full bg-zinc-900/60 rounded-xl animate-pulse" />
                  <div className="h-16 w-full bg-zinc-900/60 rounded-xl animate-pulse" />
                </div>
              ) : achievements && achievements.length > 0 ? (
                <div className="space-y-3">
                  {achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500 text-black">
                            {ach.placement ? `${ach.placement} PLACE` : 'AWARD'}
                          </span>
                          <span className="text-sm font-bold text-white">{ach.award_title}</span>
                        </div>
                        <div className="text-xs font-mono text-zinc-400">
                          <span>Event: </span>
                          <Link href={`/event/${ach.event.slug}/results`} className="text-blue-400 hover:underline">
                            {ach.event.title} ↗
                          </Link>
                          <span className="text-zinc-600"> · </span>
                          <span>{new Date(ach.published_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {ach.linked_project && (
                        <Link
                          href={`/projects/${ach.linked_project.slug}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                          <span>Linked: {ach.linked_project.title}</span>
                          <ExternalLink className="w-3 h-3 text-blue-400" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-dashed border-zinc-800 text-center bg-zinc-900/20">
                  <Award className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    No Official Event Recognitions Yet
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                    Verified competition results and awards won during NST hackathons will automatically be registered here.
                  </p>
                </div>
              )}
            </section>

            {/* =========================================================================
                 4. NOTIFICATION & DIGEST PREFERENCES
                 ========================================================================= */}
            <section className="mb-8 p-6 sm:p-7 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-6">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 mb-1">
                    System Preferences
                  </div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-white flex items-center gap-2">
                    <Bell className="w-5 h-5 text-blue-400" />
                    <span>Notification & Communication Channels</span>
                  </h3>
                </div>
              </div>

              {isPrefsLoading ? (
                <div className="h-24 w-full bg-zinc-900/60 rounded-xl animate-pulse" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
                    <div>
                      <p className="text-sm font-semibold text-white">Event & Competition Announcements</p>
                      <p className="text-xs text-zinc-400">Receive alerts when campus hackathons, workshops, and team registrations open.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePreference('eventReminders', prefs?.eventReminders ?? true)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        (prefs?.eventReminders ?? true) ? 'bg-blue-600' : 'bg-zinc-800'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          (prefs?.eventReminders ?? true) ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
                    <div>
                      <p className="text-sm font-semibold text-white">Campus Club & Team Announcements</p>
                      <p className="text-xs text-zinc-400">Receive notifications when clubs post updates and event activities.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePreference('clubAnnouncements', prefs?.clubAnnouncements ?? true)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        (prefs?.clubAnnouncements ?? true) ? 'bg-blue-600' : 'bg-zinc-800'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          (prefs?.clubAnnouncements ?? true) ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
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
