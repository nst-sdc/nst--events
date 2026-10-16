'use client';
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { useLogout } from '../../../../hooks/useLogout';
import { 
  useNotificationPreferences, 
  useUpdateNotificationPreferences, 
  NotificationPreferences 
} from '../../../../hooks/useNotificationPreferences';
import { LogOut, ChevronRight } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { DevClubCreditsModal } from '../../../../components/brand/DevClubCreditsModal';
import { DASHBOARD_APP_VERSION, DEV_CLUB_MISSION } from '../../../../lib/brand-config';
import { useQuery } from '@tanstack/react-query';
import { eventResultsApi } from '../../../../lib/event-results-api';
import { StudentPortfolioSettings } from '../../../../components/student/StudentPortfolioSettings';

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

const profileStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .profile-editorial-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .collage-noise-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.35;
    background-image: radial-gradient(rgba(245, 245, 242, 0.08) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .micro-annotation {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }

  .annotation-blue { color: var(--electric-blue); }
  .annotation-green { color: var(--acid-green); }

  .font-display-hero {
    font-family: var(--font-display);
    font-size: clamp(48px, 7vw, 84px);
    font-weight: 900;
    line-height: 0.92;
    letter-spacing: -2px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
  }

  /* Identity Dossier Card */
  .profile-dossier-card {
    border: 3px solid #ffffff;
    background: var(--bg-dark-card);
    padding: 36px 40px;
    margin-bottom: 40px;
    box-shadow: 12px 12px 0px var(--electric-blue);
    position: relative;
    z-index: 2;
  }

  /* Generic Editorial Box */
  .profile-section-card {
    border: 3px solid #ffffff;
    background: var(--bg-dark-card);
    padding: 36px 40px;
    margin-bottom: 40px;
    box-shadow: 12px 12px 0px #000000;
    position: relative;
    z-index: 2;
  }

  .profile-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--electric-blue);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 28px;
    border: 2px solid var(--bg-paper-white);
    cursor: pointer;
    text-decoration: none;
    box-shadow: 4px 4px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .profile-cta-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }

  /* Danger / Session Termination Card */
  .profile-danger-card {
    border: 3px solid #ffffff;
    background: var(--bg-dark-card);
    padding: 36px 40px;
    margin-bottom: 40px;
    box-shadow: 12px 12px 0px var(--warm-red);
    position: relative;
    z-index: 2;
  }

  .profile-danger-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--warm-red);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 28px;
    border: 2px solid #ffffff;
    cursor: pointer;
    box-shadow: 4px 4px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
    white-space: nowrap;
  }

  .profile-danger-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
    background: #e02d23;
  }

  /* Checkbox / Toggle */
  .editorial-toggle {
    width: 24px;
    height: 24px;
    cursor: pointer;
    accent-color: var(--electric-blue);
  }

  @media (max-width: 768px) {
    .profile-dossier-card, .profile-section-card {
      padding: 24px 20px;
    }
  }
`;

export default function StudentProfilePage() {
  const router = useRouter();
  const { data: user, isLoading: isLoadingUser, isError: isErrorUser, error: errorUser, refetch: refetchUser } = useCurrentUser();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const { theme, setTheme } = useTheme();
  
  const { data: prefData, isLoading: isLoadingPrefs, isError: isErrorPrefs, refetch: refetchPrefs } = useNotificationPreferences();
  const { mutate: updatePref, isPending: isUpdatingPref } = useUpdateNotificationPreferences();

  const [mounted, setMounted] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<keyof NotificationPreferences | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const { data: achievementsData, isLoading: isLoadingAchievements } = useQuery({
    queryKey: ['student-achievements', user?.id],
    queryFn: () => eventResultsApi.getStudentAchievements(user!.id),
    enabled: !!user?.id,
  });
  const achievements = achievementsData?.achievements || [];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (isLoadingUser) {
    return (
      <div className="w-full max-w-[1000px] mx-auto px-8 py-16 animate-pulse space-y-8 bg-[#050505] min-h-screen">
        <div className="h-12 w-64 bg-neutral-900 rounded-none" />
        <div className="p-8 border-2 border-white/20 bg-[#0d0e12] space-y-6">
          <div className="h-8 w-1/3 bg-neutral-900 rounded-none" />
          <div className="h-20 w-full bg-neutral-900 rounded-none" />
        </div>
      </div>
    );
  }

  if (isErrorUser || !user) {
    return (
      <div className="w-full max-w-[1000px] mx-auto px-8 py-20 text-center bg-[#050505] min-h-screen">
        <p className="text-sm font-mono text-[#a0a4b8] mb-6">
          {errorUser?.message || "Failed to load student profile."}
        </p>
        <button
          onClick={() => refetchUser()}
          className="px-6 py-3 bg-[#0057FF] text-white border-2 border-white font-mono text-xs uppercase tracking-widest hover:opacity-90 shadow-[4px_4px_0px_#ffffff]"
        >
          Retry
        </button>
      </div>
    );
  }

  // Derive Student ID from email (e.g. e25b070597 -> E25B070597)
  const studentId = user.email ? user.email.split('@')[0].toUpperCase() : 'NST-2026-8942';

  // Academic Identity
  const getAcademicIdentityText = () => {
    const batch = user.academic_profile?.batch;
    if (!batch) return null;
    const graduationYear = typeof batch.graduation_year === 'number' ? batch.graduation_year : null;
    const batchText = graduationYear ? `Batch of ${graduationYear}` : null;
    const program = batch.program;
    const programText = program?.name || program?.code || null;

    if (batchText && programText) return `${batchText} · ${programText}`;
    if (batchText) return batchText;
    if (programText) return programText;
    return null;
  };

  const academicIdentityText = getAcademicIdentityText() || 'Newton School of Technology (ADYPU)';
  const clubMemberships = user.club_memberships || [];

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
    <main className="profile-editorial-page">
      <style href="student-profile-styles" precedence="high">
        {profileStyles}
      </style>
      
      {/* Background Noise Overlay */}
      <div className="collage-noise-overlay" />

      {/* SIGN OUT CONFIRMATION MODAL */}
      <Modal
        isOpen={isSignOutModalOpen}
        onClose={() => !isLoggingOut && setIsSignOutModalOpen(false)}
        title="SIGN OUT"
      >
        <div className="p-6 pt-0 bg-[#0d0e12] text-[#F5F5F2]">
          <p className="text-sm text-[#a0a4b8] mb-6 font-mono">
            Are you sure you want to sign out of your institutional account on this device?
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsSignOutModalOpen(false)}
              disabled={isLoggingOut}
              className="w-full sm:w-auto px-5 py-2.5 border-2 border-white text-white font-mono font-bold text-xs tracking-widest uppercase hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="w-full sm:flex-1 px-5 py-2.5 bg-red-600 border-2 border-white text-white font-mono font-bold text-xs tracking-widest uppercase hover:bg-red-700 transition-colors disabled:opacity-50 shadow-[3px_3px_0px_#000]"
            >
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Main Container */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 32px 100px 32px', position: 'relative', zIndex: 1 }}>
        
        {/* Page Header */}
        <div style={{ borderBottom: '3px solid #ffffff', paddingBottom: '24px', marginBottom: '40px' }}>
          <div className="micro-annotation annotation-blue" style={{ marginBottom: '8px' }}>
            STUDENT DOSSIER // ACCOUNT IDENTITY
          </div>
          <h1 className="font-display-hero">PROFILE</h1>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: '#a0a4b8',
            marginTop: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            MANAGE YOUR ACCOUNT AND PREFERENCES
          </p>
        </div>

        {/* ==========================================================================
             1. DOSSIER IDENTITY CARD
             ========================================================================== */}
        <div className="profile-dossier-card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #ffffff',
            paddingBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <span className="micro-annotation annotation-green">
                IDENTITY VERIFIED &bull; ACTIVE
              </span>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4vw, 36px)',
                fontWeight: 900,
                marginTop: '4px',
                color: '#ffffff',
                textTransform: 'uppercase',
              }}>
                {user.full_name || 'STUDENT'}
              </h2>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: '#ffffff',
              background: 'var(--electric-blue)',
              padding: '8px 18px',
              fontWeight: 700,
              border: '2px solid #ffffff',
              boxShadow: '3px 3px 0px #ffffff',
              textTransform: 'uppercase',
            }}>
              {user.global_role === 'STUDENT' ? 'STUDENT' : user.global_role.replace(/_/g, ' ')}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            marginTop: '24px',
          }}>
            <div style={{ border: '1px solid rgba(245,245,242,0.2)', padding: '16px', background: '#000' }}>
              <div className="micro-annotation">STUDENT ID</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '15px',
                fontWeight: 700,
                color: '#fff',
                marginTop: '4px',
              }}>
                {studentId}
              </div>
            </div>

            <div style={{ border: '1px solid rgba(245,245,242,0.2)', padding: '16px', background: '#000' }}>
              <div className="micro-annotation">INSTITUTIONAL EMAIL</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '15px',
                fontWeight: 700,
                color: '#fff',
                marginTop: '4px',
                wordBreak: 'break-all',
              }}>
                {user.email}
              </div>
            </div>

            <div style={{
              border: '1px solid rgba(245,245,242,0.2)',
              padding: '16px',
              background: '#000',
              gridColumn: '1 / -1',
            }}>
              <div className="micro-annotation">YOUR CAMPUS</div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--electric-blue)',
                marginTop: '4px',
              }}>
                {academicIdentityText}
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================================================
             1B. PUBLIC DOSSIER, PORTFOLIO & VISIBILITY SETTINGS
             ========================================================================== */}
        <StudentPortfolioSettings />

        {/* ==========================================================================
             2. OFFICIAL HONORS & ACHIEVEMENTS
             ========================================================================== */}
        <div className="profile-section-card">
          <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
            VERIFIED CREDENTIALS // COMPETITIONS & JAM RECOGNITION
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '26px',
              fontWeight: 900,
              textTransform: 'uppercase',
              margin: 0,
            }}>
              OFFICIAL HONORS & ACHIEVEMENTS
            </h3>
            <span className="micro-annotation annotation-green">
              INSTITUTIONAL RECORD
            </span>
          </div>

          {isLoadingAchievements ? (
            <div className="animate-pulse space-y-4 py-4">
              <div className="h-16 w-full bg-neutral-900" />
              <div className="h-16 w-full bg-neutral-900" />
            </div>
          ) : achievements && achievements.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              {achievements.map((ach: StudentAchievementItem) => (
                <div
                  key={ach.id}
                  style={{
                    background: '#000',
                    border: '2px solid rgba(245,245,242,0.2)',
                    padding: '16px',
                    position: 'relative',
                  }}
                  className="hover:border-[#C8FF00] transition-colors"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        background: ach.placement === 1 ? '#FEF08A' : ach.placement === 2 ? '#E2E8F0' : ach.placement === 3 ? '#FED7AA' : 'rgba(255,255,255,0.1)',
                        color: ach.placement === 1 ? '#854D0E' : ach.placement === 2 ? '#334155' : ach.placement === 3 ? '#9A3412' : '#FFF',
                        textTransform: 'uppercase',
                      }}
                    >
                      {ach.placement ? (ach.placement === 1 ? '🥇 1st Place' : ach.placement === 2 ? '🥈 2nd Place' : ach.placement === 3 ? '🥉 3rd Place' : `Rank #${ach.placement}`) : 'Award'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#666' }}>
                      {new Date(ach.published_at).getFullYear()}
                    </span>
                  </div>

                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, color: '#FFF', margin: '4px 0 6px 0' }}>
                    {ach.award_title}
                  </h4>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#a0a4b8', marginBottom: '12px' }}>
                    {ach.event?.title}
                    {ach.is_team_award && ach.team_name && (
                      <span style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '2px' }}>
                        Team: {ach.team_name}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                    <Link
                      href={`/event/${ach.event.slug}/results`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--electric-blue)',
                        textDecoration: 'none',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>OFFICIAL RESULTS</span>
                      <ChevronRight size={12} />
                    </Link>

                    {ach.linked_project && (
                      <Link
                        href={`/projects/${ach.linked_project.slug}`}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--acid-green)',
                          textDecoration: 'none',
                          fontWeight: 700,
                        }}
                      >
                        VIEW PROJECT ↗
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: '#000',
              border: '1px dashed rgba(245,245,242,0.2)',
              padding: '28px 24px',
              textAlign: 'center',
              marginBottom: '16px',
            }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: '#a0a4b8',
                margin: '0 0 16px 0',
                lineHeight: 1.6,
              }}>
                No official competition awards recorded yet. Participate in campus hackathons, design jams, and competitive events to earn verified institutional honors.
              </p>
              <Link
                href="/student/events"
                className="profile-cta-btn"
                style={{ fontSize: '11px', padding: '10px 20px' }}
              >
                BROWSE UPCOMING EVENTS →
              </Link>
            </div>
          )}
        </div>

        {/* ==========================================================================
             3. MY CLUBS SECTION
             ========================================================================== */}
        <div className="profile-section-card">
          <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
            COMMUNITY // CLUBS
          </div>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: 900,
            marginBottom: '12px',
            textTransform: 'uppercase',
          }}>
            MY CLUBS
          </h3>

          {clubMemberships.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {clubMemberships.map((m) => (
                <Link
                  key={m.club_id}
                  href={`/student/campus/clubs/${m.club_id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                    border: '2px solid rgba(245,245,242,0.2)',
                    background: '#000',
                    textDecoration: 'none',
                    color: '#fff',
                  }}
                  className="hover:border-[#0057FF] transition-colors"
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800 }}>
                      {m.club_name}
                    </div>
                    <div className="micro-annotation" style={{ fontSize: '9px', marginTop: '2px' }}>
                      {m.role === 'CLUB_ADMIN' ? 'CLUB ADMIN' : m.role === 'CORE_MEMBER' ? 'CORE MEMBER' : 'MEMBER'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--electric-blue)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>VIEW</span>
                    <ChevronRight size={14} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              color: '#a0a4b8',
              marginBottom: '24px',
              lineHeight: 1.6,
            }}>
              You're not part of any clubs yet. Join student development groups to access private events and workshops.
            </p>
          )}

          <button
            onClick={() => router.push('/student/campus/clubs')}
            className="profile-cta-btn"
          >
            EXPLORE ALL CLUBS ↗
          </button>
        </div>

        {/* ==========================================================================
             3. PREFERENCES // STAY IN THE LOOP
             ========================================================================== */}
        <div className="profile-section-card">
          <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
            PREFERENCES // NOTIFICATIONS
          </div>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: 900,
            marginBottom: '24px',
            textTransform: 'uppercase',
          }}>
            STAY IN THE LOOP
          </h3>

          {updateError && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 59, 48, 0.1)',
              border: '2px solid var(--warm-red)',
              color: 'var(--warm-red)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              marginBottom: '16px',
            }}>
              {updateError}
            </div>
          )}

          {isLoadingPrefs ? (
            <div className="animate-pulse space-y-4 py-4">
              <div className="h-6 w-1/3 bg-neutral-900" />
              <div className="h-6 w-1/2 bg-neutral-900" />
            </div>
          ) : isErrorPrefs ? (
            <div style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#a0a4b8' }}>
              Couldn't load preferences.{' '}
              <button onClick={() => refetchPrefs()} style={{ color: 'var(--electric-blue)', textDecoration: 'underline' }}>
                Retry
              </button>
            </div>
          ) : (
            <div>
              {/* Push Notifications */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(245,245,242,0.15)',
                padding: '18px 0',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700 }}>
                    Push Notifications
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#a0a4b8', marginTop: '2px' }}>
                    Receive push notifications from NST Events.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="editorial-toggle"
                  checked={prefData ? !!prefData.pushEnabled : true}
                  disabled={isUpdatingPref && updatingKey === 'pushEnabled'}
                  onChange={() => handleTogglePreference('pushEnabled', prefData ? !!prefData.pushEnabled : true)}
                />
              </div>

              {/* Event Reminders */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(245,245,242,0.15)',
                padding: '18px 0',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700 }}>
                    Event Reminders
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#a0a4b8', marginTop: '2px' }}>
                    Reminders for events you're registered for.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="editorial-toggle"
                  checked={prefData ? !!prefData.eventReminders : true}
                  disabled={isUpdatingPref && updatingKey === 'eventReminders'}
                  onChange={() => handleTogglePreference('eventReminders', prefData ? !!prefData.eventReminders : true)}
                />
              </div>

              {/* Club Announcements */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(245,245,242,0.15)',
                padding: '18px 0',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700 }}>
                    Club Announcements
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#a0a4b8', marginTop: '2px' }}>
                    Updates from clubs you're part of.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="editorial-toggle"
                  checked={prefData ? !!prefData.clubAnnouncements : false}
                  disabled={isUpdatingPref && updatingKey === 'clubAnnouncements'}
                  onChange={() => handleTogglePreference('clubAnnouncements', prefData ? !!prefData.clubAnnouncements : false)}
                />
              </div>

              {/* Attendance Alerts */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 0',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700 }}>
                    Attendance Alerts
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#a0a4b8', marginTop: '2px' }}>
                    Check-in windows and dispute updates.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="editorial-toggle"
                  checked={prefData ? !!prefData.attendanceAlerts : true}
                  disabled={isUpdatingPref && updatingKey === 'attendanceAlerts'}
                  onChange={() => handleTogglePreference('attendanceAlerts', prefData ? !!prefData.attendanceAlerts : true)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ==========================================================================
             4. APPEARANCE & THEME
             ========================================================================== */}
        <div className="profile-section-card">
          <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
            SYSTEM // APPEARANCE
          </div>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: 900,
            marginBottom: '16px',
            textTransform: 'uppercase',
          }}>
            THEME DISPLAY
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#a0a4b8', marginBottom: '20px' }}>
            Select how the NST Events interface renders across your workstation.
          </p>

          {mounted ? (
            <div style={{ display: 'inline-flex', gap: '8px', background: '#000', padding: '6px', border: '2px solid #ffffff' }}>
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '8px 18px',
                    cursor: 'pointer',
                    background: theme === t ? 'var(--electric-blue)' : 'transparent',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ==========================================================================
             5. PLATFORM CREDITS & ENGINEERING
             ========================================================================== */}
        <div className="profile-section-card">
          <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
            ENGINEERING // CREDITS
          </div>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: 900,
            marginBottom: '12px',
            textTransform: 'uppercase',
          }}>
            NST SOFTWARE DEVELOPERS CLUB
          </h3>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: '#a0a4b8',
            lineHeight: 1.6,
            marginBottom: '20px',
            maxWidth: '680px',
          }}>
            {DEV_CLUB_MISSION}
          </p>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsCreditsOpen(true)}
              className="profile-cta-btn"
            >
              [ VIEW CREDITS & CONTRIBUTORS ]
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#666' }}>
              v{DASHBOARD_APP_VERSION}
            </span>
          </div>
        </div>

        {/* ==========================================================================
             6. ACCOUNT ACTIONS // SIGN OUT
             ========================================================================== */}
        <div className="profile-danger-card">
          <div className="micro-annotation" style={{ color: 'var(--warm-red)', marginBottom: '12px' }}>
            SECURITY PROTOCOL // SESSION REVOCATION
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px',
          }}>
            <div style={{ maxWidth: '600px' }}>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '26px',
                fontWeight: 900,
                marginBottom: '8px',
                textTransform: 'uppercase',
                color: '#ffffff',
              }}>
                TERMINATE ACTIVE SESSION
              </h3>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: '#a0a4b8',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Sign out of your institutional credentials on this computer. Any synchronized offline attendance tokens and cached session credentials will be revoked.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSignOutModalOpen(true)}
              className="profile-danger-btn"
            >
              <LogOut size={16} />
              <span>[ SIGN OUT ]</span>
            </button>
          </div>
        </div>

      </div>

      <DevClubCreditsModal
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />
    </main>
  );
}
