'use client';

import React, { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck, Lock, Activity } from 'lucide-react';
import { getWebAuthStore } from '../../../lib/auth-store';
import { API_BASE_URL } from '../../../lib/api';
import { DevClubCreditsModal } from '../../../components/brand/DevClubCreditsModal';

const SUPPORT_EMAIL = 'events-support@adypu.edu.in';

interface AuthErrorInfo {
  type:
    | 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED'
    | 'STUDENT_ACCESS_NOT_AUTHORIZED'
    | 'ACCESS_DENIED'
    | 'AUTHENTICATION_FAILED'
    | 'GENERIC';
  badge: string;
  title: string;
  message: string;
  detail: string;
  canSwitchAccount: boolean;
  canContactCoordinator: boolean;
}

function resolveAuthError(errorCode: string | null): AuthErrorInfo | null {
  if (!errorCode) return null;
  const normalized = errorCode.trim().toUpperCase();

  if (
    normalized === 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED' ||
    normalized === 'DOMAIN_NOT_ALLOWED' ||
    normalized === 'INVALID_DOMAIN'
  ) {
    return {
      type: 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED',
      badge: 'RESTRICTED DOMAIN',
      title: 'INSTITUTIONAL DOMAIN NOT ALLOWED',
      message: 'NST Events is restricted to institutional accounts.',
      detail:
        'Please sign in with your official @adypu.edu.in (students) or @newtonschool.co (faculty/staff) Google account.',
      canSwitchAccount: true,
      canContactCoordinator: false,
    };
  }

  if (
    normalized === 'STUDENT_ACCESS_NOT_AUTHORIZED' ||
    normalized === 'STUDENT_NOT_AUTHORIZED' ||
    normalized === 'NOT_ENROLLED'
  ) {
    return {
      type: 'STUDENT_ACCESS_NOT_AUTHORIZED',
      badge: 'DIRECTORY STATUS',
      title: 'STUDENT NOT ENROLLED IN DIRECTORY',
      message: 'Account recognized, but not enrolled in the active NST Student Directory.',
      detail:
        'If you are an enrolled student at NST, your institutional account must be provisioned in the directory before you can access the platform. Please contact your academic coordinator to request access.',
      canSwitchAccount: true,
      canContactCoordinator: true,
    };
  }

  if (normalized === 'ACCESS_DENIED') {
    return {
      type: 'ACCESS_DENIED',
      badge: 'SIGN-IN CANCELLED',
      title: 'GOOGLE SIGN-IN CANCELLED',
      message: 'Google authentication was cancelled or permissions were not granted.',
      detail: 'Please approve the requested permissions to sign in to the portal.',
      canSwitchAccount: true,
      canContactCoordinator: false,
    };
  }

  return {
    type: 'AUTHENTICATION_FAILED',
    badge: 'AUTH FAILED // SEC-02',
    title: 'AUTHENTICATION FAILED',
    message: 'Unable to verify your institutional credentials.',
    detail:
      'NST Events requires an active institutional Google account (@adypu.edu.in for students, @newtonschool.co for faculty/staff). If you were automatically signed in with a personal Gmail account, please switch accounts.',
    canSwitchAccount: true,
    canContactCoordinator: true,
  };
}

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

const responsiveStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  .lp-login-btn {
    background-color: #0057FF !important;
    color: #FFFFFF !important;
    border: 2px solid #000000 !important;
    box-shadow: 5px 5px 0px #C8FF00;
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }
  .lp-login-btn:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 7px 7px 0px #C8FF00;
    filter: brightness(1.08);
  }
  .lp-login-btn:active:not(:disabled) {
    transform: translate(1px, 1px);
    box-shadow: 3px 3px 0px #C8FF00;
  }
  .lp-login-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .lp-title-responsive {
    font-family: var(--font-syne), 'Syne', sans-serif;
    font-weight: 900;
    font-size: clamp(24px, 7vw, 42px);
    line-height: 1.02;
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

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = getWebAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [pulseTick, setPulseTick] = useState(0);
  const lastLoginClickRef = useRef<number>(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [prevErrorParam, setPrevErrorParam] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseTick((prev) => (prev + 1) % 100);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const errorParam = searchParams.get('error');
  if (errorParam !== prevErrorParam) {
    setPrevErrorParam(errorParam);
    setIsDismissed(false);
    if (isLoading) setIsLoading(false);
  }

  const authError = useMemo(() => {
    if (!errorParam || isDismissed) return null;
    return resolveAuthError(errorParam);
  }, [errorParam, isDismissed]);

  useEffect(() => {
    const handleResetLoading = () => {
      if (Date.now() - lastLoginClickRef.current < 500) return;
      setIsLoading(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleResetLoading();
    };
    const handlePageShow = () => setIsLoading(false);
    window.addEventListener('focus', handleResetLoading);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleResetLoading);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (store.accessToken) {
      let returnTo = searchParams.get('return_to');
      if (!returnTo && typeof window !== 'undefined') returnTo = window.sessionStorage.getItem('return_to');
      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        if (typeof window !== 'undefined') window.sessionStorage.removeItem('return_to');
        router.push(returnTo);
      } else {
        router.push('/student/home');
      }
    }
  }, [store.accessToken, router, searchParams]);

  const handleLogin = () => {
    lastLoginClickRef.current = Date.now();
    setIsLoading(true);
    const returnTo = searchParams.get('return_to');
    if (returnTo && typeof window !== 'undefined') window.sessionStorage.setItem('return_to', returnTo);
    const authBase = API_BASE_URL || '';
    window.location.href = `${authBase}/auth/google`;
  };

  const handleDismissError = () => {
    setIsDismissed(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('error');
    const newQuery = params.toString();
    const targetUrl = newQuery ? `/login?${newQuery}` : '/login';
    if (typeof window !== 'undefined') window.history.replaceState(null, '', targetUrl);
    router.replace(targetUrl);
  };

  const handleContactCoordinator = () => {
    const subject = encodeURIComponent('Student Directory Inquiry - NST Events');
    const body = encodeURIComponent('Student Name:\nProgram:\nBatch Year:\nStudent ID:\nInstitutional Email:\n\nProblem: Institutional account not authorized or not enrolled in NST Events directory.');
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <>
      <style href="login-styles" precedence="high">
        {responsiveStyles}
      </style>

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
          <span className="hidden xs:inline">AUTH_GATEWAY_ACTIVE</span>
          <span className="xs:hidden">ACTIVE</span>
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
            <span className="w-2.5 h-2.5 bg-[#0057FF] inline-block animate-pulse shrink-0"></span>
            <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-[1.5px] sm:tracking-[2px] uppercase text-[#0057FF]">
              AUTH GATEWAY // PROTOCOL SEC-02
            </span>
          </div>
          <span className="font-mono text-[9px] sm:text-[10px] text-[#C8FF00] uppercase tracking-widest bg-[#C8FF00]/10 px-2 py-0.5 border border-[#C8FF00]/30 font-semibold shrink-0">
            INSTITUTIONAL SSO
          </span>
        </div>

        {/* Main Headline */}
        <div className="mb-4 sm:mb-6">
          <div className="font-mono text-[10px] sm:text-[11px] font-bold tracking-[0.16em] sm:tracking-[0.2em] text-[#0057FF] uppercase mb-1.5 flex items-center gap-1.5 sm:gap-2">
            <span className="inline-block w-2 sm:w-2.5 h-0.5 bg-[#0057FF]" />
            IDENTITY VERIFICATION &bull; NEWTON SCHOOL OF TECHNOLOGY
          </div>
          <h1 className="lp-title-responsive">
            ACCESS<br className="block sm:hidden" /> STUDENT PORTAL
          </h1>
        </div>

        {/* Primary Explanation Box */}
        <div className="p-3.5 sm:p-4 bg-white/[0.03] border border-white/10 mb-4 sm:mb-6 font-mono text-[11px] sm:text-xs text-[#a0a4b8] leading-relaxed">
          <p className="mb-2.5 sm:mb-3 text-[#d0d4e4]">
            Sign in with your verified institutional Google account to synchronize event attendance, ticket passes, and club leadership roles.
          </p>
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-[#C8FF00]">
            <ShieldCheck className="w-4 h-4 text-[#C8FF00] shrink-0" />
            <span>Authorized: @adypu.edu.in (students) &bull; @newtonschool.co (faculty)</span>
          </div>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="p-3.5 sm:p-4 bg-red-950/20 border-2 border-[#FF3B30] mb-4 sm:mb-6 font-mono text-[11px] sm:text-xs text-[#ffb3af] relative">
            <div className="flex items-center justify-between border-b border-[#FF3B30]/30 pb-2 mb-2.5">
              <div className="flex items-center gap-2 text-[#FF3B30] font-bold tracking-wider text-[10px] uppercase">
                <span className="w-2 h-2 rounded-full bg-[#FF3B30] inline-block animate-ping" />
                {authError.badge}
              </div>
              <button
                type="button"
                onClick={handleDismissError}
                aria-label="Dismiss error"
                className="text-[9px] font-bold text-[#FF3B30] hover:text-white border border-[#FF3B30]/50 hover:bg-[#FF3B30] px-2 py-0.5 transition-colors uppercase cursor-pointer"
              >
                DISMISS [×]
              </button>
            </div>
            <div className="font-bold text-[#ff8a84] text-[11px] uppercase tracking-wide mb-1">
              {authError.title}
            </div>
            <p className="font-sans text-xs text-[#ffb3af] mb-1.5 leading-relaxed">
              {authError.message}
            </p>
            <p className="font-sans text-[11px] text-[#d67a76] leading-relaxed mb-3">
              {authError.detail}
            </p>
            {authError.canSwitchAccount && (
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-3 bg-[#FF3B30] text-white border-2 border-black font-mono text-[10px] font-bold tracking-wider uppercase flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer mb-2 disabled:opacity-50"
              >
                <GoogleIcon className="w-3.5 h-3.5" />
                SWITCH GOOGLE ACCOUNT
              </button>
            )}
            {authError.canContactCoordinator && (
              <button
                type="button"
                onClick={handleContactCoordinator}
                className="w-full py-2 px-3 bg-transparent text-[#FF3B30] hover:bg-[#FF3B30]/10 border border-[#FF3B30] font-mono text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer"
              >
                CONTACT ACADEMIC COORDINATOR
              </button>
            )}
            <div className="text-[9px] text-[#FF3B30]/80 uppercase tracking-wider mt-2.5 pt-2 border-t border-dashed border-[#FF3B30]/30 leading-normal">
              NOTE: If Google signs you in automatically without prompting, sign out at accounts.google.com or use private browsing.
            </div>
          </div>
        )}

        {/* Status Telemetry Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-5 sm:mb-7 font-mono text-xs">
          <div className="p-2.5 sm:p-3 bg-black/40 border border-white/10 flex flex-col gap-1">
            <div className="text-[10px] text-[#6b7280] uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-[#0057FF] shrink-0" />
              SESSION ENCRYPTION
            </div>
            <div className="text-[11px] font-semibold text-[#0057FF] flex items-center gap-1.5">
              TLS 1.3 // SEC-02 RBAC
            </div>
          </div>

          <div className="p-2.5 sm:p-3 bg-black/40 border border-white/10 flex flex-col gap-1">
            <div className="text-[10px] text-[#6b7280] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#C8FF00] shrink-0" />
              DIRECTORY SSO GATEWAY
            </div>
            <div className="text-[11px] font-semibold text-[#C8FF00]">
              100% OPERATIONAL
            </div>
          </div>
        </div>

        {/* Primary Action Button (Neo-Brutalist CTA) */}
        <div className="space-y-3">
          <button
            id="btn-google-login"
            type="button"
            className="lp-login-btn w-full inline-flex items-center justify-center gap-2.5 sm:gap-3 font-mono uppercase text-xs sm:text-sm font-bold tracking-[0.14em] sm:tracking-[0.16em] px-5 sm:px-8 py-3.5 sm:py-4 active:translate-x-[1px] active:translate-y-[1px] group cursor-pointer text-center"
            onClick={handleLogin}
            disabled={isLoading}
            aria-label="Sign in with Google"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white">AUTHENTICATING...</span>
              </>
            ) : (
              <>
                <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center shrink-0 p-0.5">
                  <GoogleIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-white">CONTINUE WITH GOOGLE</span>
                <ArrowRight className="w-4 h-4 text-white transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>

        {/* Card Footer Micro-Metadata */}
        <div className="mt-6 sm:mt-8 pt-3 sm:pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 font-mono text-[9px] sm:text-[10px] text-[#555a6d]">
          <span>GATEWAY: TLS 1.3 // REGION: IN-BOM</span>
          <span>DISPATCH TICK: #{1420 + pulseTick}</span>
        </div>
      </div>

      {/* Bottom Sub-Footer with Dev Club Credits */}
      <div className="relative z-10 mt-4 sm:mt-6 flex flex-col items-center gap-2 font-mono text-[9px] sm:text-[10px] text-[#424654] tracking-wider sm:tracking-widest uppercase text-center px-4">
        <button
          type="button"
          onClick={() => setIsCreditsOpen(true)}
          className="text-[#71768a] hover:text-[#0057FF] transition-colors border-b border-dashed border-[#71768a]/40 pb-0.5 cursor-pointer uppercase font-mono"
        >
          CRAFTED BY NST SOFTWARE DEVELOPERS CLUB
        </button>
        <div>NST Student Developer Community © 2026 // ALL SYSTEMS MONITORED</div>
      </div>

      <DevClubCreditsModal isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />
    </>
  );
}

export default function LoginPage() {
  return (
    <div
      suppressHydrationWarning
      className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-[#F5F5F2] px-3 py-6 sm:p-6 md:p-8 overflow-x-hidden select-none"
    >
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
        className="pointer-events-none absolute z-0 text-[20vw] sm:text-[18vw] font-black uppercase text-white/[0.02] tracking-tighter leading-none select-none"
        style={{ fontFamily: "var(--font-syne), 'Syne', sans-serif" }}
      >
        NST AUTH
      </div>

      <Suspense
        fallback={
          <div className="relative z-10 w-full max-w-xl bg-[#0c0d12]/95 border-2 border-white/20 p-8 shadow-[12px_12px_0px_#0057FF] backdrop-blur-xl flex flex-col items-center justify-center min-h-[360px]">
            <div className="w-8 h-8 border-3 border-[#0057FF] border-t-transparent rounded-full animate-spin mb-4" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#888]">
              INITIALIZING AUTH GATEWAY...
            </span>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
