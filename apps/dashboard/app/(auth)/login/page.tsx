'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getWebAuthStore } from '../../../lib/auth-store';
import { API_BASE_URL } from '../../../lib/api';
import { NstLogoMark } from '../../../components/brand/NstLogo';

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

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = getWebAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const [isDismissed, setIsDismissed] = useState(false);
  const [prevErrorParam, setPrevErrorParam] = useState<string | null>(null);

  const errorParam = searchParams.get('error');

  if (errorParam !== prevErrorParam) {
    setPrevErrorParam(errorParam);
    setIsDismissed(false);
  }

  const authError = useMemo(() => {
    if (!errorParam || isDismissed) return null;
    return resolveAuthError(errorParam);
  }, [errorParam, isDismissed]);

  useEffect(() => {
    if (store.accessToken) {
      let returnTo = searchParams.get('return_to');
      if (!returnTo && typeof window !== 'undefined') {
        returnTo = window.sessionStorage.getItem('return_to');
      }

      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('return_to');
        }
        router.push(returnTo);
      } else {
        router.push('/student/home');
      }
    }
  }, [store.accessToken, router, searchParams]);

  const handleLogin = () => {
    setIsLoading(true);
    const returnTo = searchParams.get('return_to');
    if (returnTo && typeof window !== 'undefined') {
      window.sessionStorage.setItem('return_to', returnTo);
    }
    const authBase = API_BASE_URL || '';
    window.location.href = `${authBase}/auth/google`;
  };

  const handleDismissError = () => {
    setIsDismissed(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('error');
    const newQuery = params.toString();
    const targetUrl = newQuery ? `/login?${newQuery}` : '/login';

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', targetUrl);
    }
    router.replace(targetUrl);
  };

  const handleContactCoordinator = () => {
    const subject = encodeURIComponent('Student Directory Inquiry - NST Events');
    const body = encodeURIComponent(
      'Student Name:\nProgram:\nBatch Year:\nStudent ID:\nInstitutional Email:\n\nProblem: Institutional account not authorized or not enrolled in NST Events directory.'
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <div
      suppressHydrationWarning
      className="w-full max-w-[480px] bg-[#111113] border border-[#2a2b36] p-6 sm:p-8 text-left shadow-2xl relative"
    >
      {/* Top Ledger Header: Ping status & Cluster pill */}
      <div
        suppressHydrationWarning
        className="flex items-center justify-between pb-4 border-b border-[#242530]"
      >
        <div suppressHydrationWarning className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#0047FF] animate-pulse" />
          <span
            suppressHydrationWarning
            className="font-stitch-label text-[11px] font-bold text-[#e2e2e6] tracking-widest uppercase"
          >
            AUTH GATEWAY // NST-NET
          </span>
        </div>
      </div>

      {/* Brand Header */}
      <div suppressHydrationWarning className="mt-6 mb-2 flex items-center gap-3">
        <NstLogoMark size={36} className="w-9 h-9 shrink-0" withSquircle />
        <div suppressHydrationWarning className="flex flex-col leading-none">
          <div suppressHydrationWarning className="font-stitch-headline text-[20px] font-extrabold tracking-tight text-white">
            NST <span className="text-[#0047FF]">EVENTS</span>
          </div>
          <div suppressHydrationWarning className="font-stitch-label text-[9px] font-semibold tracking-widest text-[#717487] uppercase mt-1">
            Newton School of Technology
          </div>
        </div>
      </div>

      {/* Editorial Section Header */}
      <div suppressHydrationWarning className="mt-5 mb-5">
        <div suppressHydrationWarning className="flex items-center gap-2 mb-2">
          <span
            suppressHydrationWarning
            className="font-stitch-label text-[11px] font-bold text-[#0047FF] tracking-wider uppercase"
          >
            IDENTITY VERIFICATION
          </span>
          <span
            suppressHydrationWarning
            className="font-stitch-label text-[11px] text-[#717487] tracking-wider uppercase"
          >
            {'// SEC-02'}
          </span>
        </div>

        <h1
          suppressHydrationWarning
          className="font-stitch-headline text-2xl sm:text-3xl font-bold tracking-tight text-white m-0"
        >
          Access Student Portal
        </h1>

        <p
          suppressHydrationWarning
          className="font-stitch-body text-sm text-[#9a9db0] mt-2 leading-relaxed"
        >
          Sign in with your institutional{' '}
          <span className="font-stitch-label text-xs text-[#b7c4ff] bg-[#1b1c26] px-1 py-0.5 border border-[#2e3040]">
            @adypu.edu.in
          </span>{' '}
          or{' '}
          <span className="font-stitch-label text-xs text-[#b7c4ff] bg-[#1b1c26] px-1 py-0.5 border border-[#2e3040]">
            @newtonschool.co
          </span>{' '}
          account to synchronize attendance, event registrations, and club management.
        </p>
      </div>

      {/* Ledger Identity Matrix Card */}
      <div
        suppressHydrationWarning
        className="border border-[#262734] bg-[#0c0c0e] p-3.5 mb-6"
      >
        <div
          suppressHydrationWarning
          className="flex items-center justify-between border-b border-[#1f202b] pb-2 mb-2.5"
        >
          <span
            suppressHydrationWarning
            className="font-stitch-label text-[10px] font-bold text-[#717487] tracking-widest uppercase"
          >
            SESSION HANDSHAKE MATRIX
          </span>
          <span
            suppressHydrationWarning
            className="font-stitch-label text-[10px] font-bold text-[#0047FF] tracking-wider uppercase"
          >
            READY FOR SSO
          </span>
        </div>

        <div suppressHydrationWarning className="grid grid-cols-3 gap-2">
          <div
            suppressHydrationWarning
            className="bg-[#14151c] border border-[#22232f] p-2"
          >
            <div
              suppressHydrationWarning
              className="font-stitch-label text-[9px] text-[#717487] uppercase tracking-wider"
            >
              CLEARANCE
            </div>
            <div
              suppressHydrationWarning
              className="font-stitch-label text-[11px] font-bold text-white mt-1"
            >
              LEVEL-03
            </div>
          </div>
          <div
            suppressHydrationWarning
            className="bg-[#14151c] border border-[#22232f] p-2"
          >
            <div
              suppressHydrationWarning
              className="font-stitch-label text-[9px] text-[#717487] uppercase tracking-wider"
            >
              CLUSTER
            </div>
            <div
              suppressHydrationWarning
              className="font-stitch-label text-[11px] font-bold text-white mt-1"
            >
              AI-ENG-01
            </div>
          </div>
          <div
            suppressHydrationWarning
            className="bg-[#14151c] border border-[#22232f] p-2"
          >
            <div
              suppressHydrationWarning
              className="font-stitch-label text-[9px] text-[#717487] uppercase tracking-wider"
            >
              PROTOCOL
            </div>
            <div
              suppressHydrationWarning
              className="font-stitch-label text-[11px] font-bold text-[#0047FF] mt-1"
            >
              ACTIVE SSO
            </div>
          </div>
        </div>
      </div>

      {/* Rich Neo-Brutalist Error Enclosure */}
      {authError && (
        <div
          suppressHydrationWarning
          className="border border-[#ffb4ab]/40 bg-[#1c0b0c] p-4 mb-6 text-left"
        >
          <div
            suppressHydrationWarning
            className="flex items-center justify-between pb-2 border-b border-[#ffb4ab]/20 mb-2.5"
          >
            <div suppressHydrationWarning className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]" />
              <span
                suppressHydrationWarning
                className="font-stitch-label text-[10px] font-bold tracking-wider text-[#ffb4ab] uppercase"
              >
                {authError.badge}
              </span>
            </div>

            <button
              type="button"
              suppressHydrationWarning
              onClick={handleDismissError}
              aria-label="Dismiss error"
              className="bg-transparent border border-[#ffb4ab]/30 hover:border-[#ffb4ab] text-[#ffb4ab] px-1.5 py-0.5 font-stitch-label text-[10px] cursor-pointer uppercase transition-colors"
            >
              DISMISS [×]
            </button>
          </div>

          <div suppressHydrationWarning className="mb-3">
            <div
              suppressHydrationWarning
              className="font-stitch-label text-xs font-bold text-[#ffdad6] tracking-wide mb-1 uppercase"
            >
              {authError.title}
            </div>
            <div
              suppressHydrationWarning
              className="font-stitch-body text-xs text-[#ffb4ab] leading-relaxed mb-1.5"
            >
              {authError.message}
            </div>
            <div
              suppressHydrationWarning
              className="font-stitch-body text-[11px] text-[#ffdad6]/80 leading-normal"
            >
              {authError.detail}
            </div>
          </div>

          <div suppressHydrationWarning className="flex flex-col gap-2 mt-3">
            {authError.canSwitchAccount && (
              <button
                type="button"
                suppressHydrationWarning
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full bg-[#ffb4ab] hover:bg-[#ffdad6] text-[#690005] font-stitch-label text-[11px] font-bold tracking-widest uppercase py-2.5 px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors border-none"
              >
                <GoogleIcon />
                SWITCH GOOGLE ACCOUNT
              </button>
            )}

            {authError.canContactCoordinator && (
              <button
                type="button"
                suppressHydrationWarning
                onClick={handleContactCoordinator}
                className="w-full bg-transparent border border-[#ffb4ab]/50 hover:bg-[#ffb4ab]/10 text-[#ffb4ab] font-stitch-label text-[11px] font-bold tracking-widest uppercase py-2 px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                CONTACT ACADEMIC COORDINATOR
              </button>
            )}
          </div>

          <div
            suppressHydrationWarning
            className="mt-3 pt-2 border-t border-dashed border-[#ffb4ab]/20 font-stitch-label text-[9px] text-[#ffb4ab]/70 leading-normal uppercase tracking-wider"
          >
            NOTE: If Google signs you in automatically without prompting, sign out at accounts.google.com or use private browsing.
          </div>
        </div>
      )}

      {/* Primary CTA Button */}
      <button
        type="button"
        suppressHydrationWarning
        onClick={handleLogin}
        disabled={isLoading}
        aria-label="Sign in with Google"
        className="w-full h-12 bg-[#0047FF] hover:bg-[#0038cc] active:bg-[#002ba8] text-white font-stitch-label text-[12px] sm:text-[13px] font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all cursor-pointer border border-[#0047FF] shadow-[0_0_20px_rgba(0,71,255,0.25)] hover:shadow-[0_0_24px_rgba(0,71,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>AUTHENTICATING...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-white flex items-center justify-center p-0.5">
              <GoogleIcon />
            </div>
            <span>CONTINUE WITH GOOGLE</span>
          </div>
        )}
      </button>

      {/* Footer Security Notice */}
      <div
        suppressHydrationWarning
        className="mt-6 pt-4 border-t border-[#242530] flex flex-col items-center gap-1 text-center"
      >
        <span
          suppressHydrationWarning
          className="font-stitch-label text-[10px] font-bold text-[#9a9db0] tracking-widest uppercase"
        >
          RESTRICTED TO ENROLLED NST STUDENTS & FACULTY
        </span>
        <span
          suppressHydrationWarning
          className="font-stitch-label text-[9px] text-[#555868] tracking-wider uppercase"
        >
          SEC-02 IDENTITY GATEWAY // @ADYPU.EDU.IN & @NEWTONSCHOOL.CO
        </span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      suppressHydrationWarning
      className="min-h-screen flex items-center justify-center bg-[#070709] px-4 py-8 relative overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <Suspense
        fallback={
          <div className="w-full max-w-[480px] h-96 bg-[#111113] border border-[#2a2b36] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="w-8 h-8 border-2 border-[#0047FF] border-t-transparent rounded-full animate-spin" />
              <span className="font-stitch-label text-xs font-bold text-[#9a9db0] tracking-widest uppercase">
                INITIALIZING AUTH GATEWAY...
              </span>
            </div>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
