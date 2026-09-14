'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

const loginStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  /* ── Card wrapper ── */
  .lp-card-shell {
    width: 100%;
    max-width: 560px;
    position: relative;
  }

  /* Main poster card — blue shadow is the "blue card" */
  .lp-card {
    background: #F5F5F1;
    color: #000;
    border: 4px solid #000000;
    padding: 44px 40px;
    box-shadow: 16px 16px 0px #0047FF;
    position: relative;
    z-index: 2;
    width: 100%;
  }

  /* ── Typography ── */
  .lp-mono {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: #555;
  }

  .lp-mono-blue { color: #0047FF; }

  /* "ACCESS STUDENT PORTAL" — Syne 900 */
  .lp-headline {
    font-family: 'Syne', sans-serif;
    font-weight: 900;
    font-size: 36px;
    line-height: 1.0;
    letter-spacing: -0.01em;
    text-transform: uppercase;
    color: #000;
    margin: 0;
  }

  /* Sub-labels like "NST EVENTS • NEWTON…" */
  .lp-outfit-label {
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .lp-body {
    font-family: 'Inter', sans-serif;
    font-size: 13.5px;
    color: #333;
    line-height: 1.65;
  }

  /* ── Session Matrix ── */
  .lp-matrix {
    border: 2px solid #000;
    width: 100%;
    margin-bottom: 24px;
  }

  .lp-matrix-hd {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 14px;
    border-bottom: 2px solid #000;
    background: #e8e8e4;
  }

  .lp-matrix-row {
    display: flex;
    border-bottom: 1px solid #ccc;
  }
  .lp-matrix-row:last-child { border-bottom: none; }

  .lp-matrix-cell {
    padding: 9px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    width: 50%;
    border-right: 1px solid #ccc;
    color: #666;
  }
  .lp-matrix-cell:last-child {
    border-right: none;
    color: #000;
  }
  .lp-matrix-cell.val-blue { color: #0047FF; }

  /* ── Primary CTA ── */
  .lp-btn-google {
    width: 100%;
    height: 54px;
    background: #0047FF;
    color: #fff;
    border: 2.5px solid #000;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    cursor: pointer;
    transition: background 0.15s, transform 0.12s;
    box-shadow: 3px 3px 0px #000;
    margin-bottom: 10px;
  }
  .lp-btn-google:hover:not(:disabled) {
    background: #003be0;
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0px #000;
  }
  .lp-btn-google:active:not(:disabled) {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0px #000;
  }
  .lp-btn-google:disabled { opacity: 0.55; cursor: not-allowed; }

  .lp-google-icon-wrap {
    width: 24px; height: 24px;
    background: #fff;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }


  /* ── Error block ── */
  .lp-error {
    border: 2px solid #c0392b;
    background: #fff8f8;
    padding: 14px 16px;
    margin-bottom: 22px;
  }
  .lp-error-hd {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid #f5c6c2;
    margin-bottom: 10px;
  }
  .lp-error-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; color: #c0392b;
    display: flex; align-items: center; gap: 6px;
  }
  .lp-error-dismiss {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #c0392b; background: transparent;
    border: 1.5px solid #c0392b; padding: 3px 8px;
    cursor: pointer; transition: all 0.15s;
  }
  .lp-error-dismiss:hover { background: #c0392b; color: #fff; }
  .lp-error-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #7b1a14; margin-bottom: 4px;
  }
  .lp-error-msg  { font-family: 'Inter', sans-serif; font-size: 12.5px; color: #922b21; line-height: 1.5; margin-bottom: 5px; }
  .lp-error-detail { font-family: 'Inter', sans-serif; font-size: 11.5px; color: #a93226; opacity: 0.85; line-height: 1.5; }
  .lp-error-action {
    width: 100%; padding: 9px 12px; margin-top: 8px;
    background: #c0392b; color: #fff; border: none;
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: background 0.15s;
  }
  .lp-error-action:hover { background: #a93226; }
  .lp-error-outline {
    width: 100%; padding: 8px 12px; margin-top: 6px;
    background: transparent; color: #c0392b;
    border: 1.5px solid #c0392b;
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; transition: all 0.15s;
  }
  .lp-error-outline:hover { background: rgba(192,57,43,0.08); }
  .lp-error-note {
    font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #c0392b;
    opacity: 0.6; letter-spacing: 0.08em; text-transform: uppercase;
    line-height: 1.5; margin-top: 10px; padding-top: 8px;
    border-top: 1px dashed #f5c6c2;
  }

  /* ── Footer ── */
  .lp-footer {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 2px dashed #bbb;
    text-align: center;
  }
  .lp-footer-p {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #666; margin-bottom: 3px;
  }
  .lp-footer-s {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px; letter-spacing: 0.1em;
    text-transform: uppercase; color: #aaa; margin-bottom: 10px;
  }
  .lp-footer-link {
    font-family: 'Outfit', sans-serif;
    font-size: 12px; font-weight: 700;
    color: #0047FF; cursor: pointer;
    text-decoration: underline; text-underline-offset: 2px;
    background: none; border: none; padding: 0; letter-spacing: 0.04em;
  }
  .lp-footer-link:hover { color: #003be0; }

  /* ── Spinner ── */
  .lp-spin {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: lp-rotate 0.7s linear infinite;
  }
  @keyframes lp-rotate { to { transform: rotate(360deg); } }
`;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = getWebAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const lastLoginClickRef = React.useRef<number>(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [prevErrorParam, setPrevErrorParam] = useState<string | null>(null);

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
      <style dangerouslySetInnerHTML={{ __html: loginStyles }} />

      <div className="lp-card-shell">

        {/* Main poster card — blue offset is via box-shadow */}
        <div className="lp-card">

          {/* ── Top annotations ── */}
          <div className="lp-mono" style={{ marginBottom: 3 }}>AUTH GATEWAY // NST-NET</div>
          <div className="lp-outfit-label lp-mono-blue" style={{ marginBottom: 22 }}>
            NST EVENTS &bull; NEWTON SCHOOL OF TECHNOLOGY
          </div>

          {/* ── Divider + Headline ── */}
          <div style={{ borderBottom: '3px solid #000', paddingBottom: 18, marginBottom: 22 }}>
            <div className="lp-mono" style={{ color: '#000', marginBottom: 8 }}>
              IDENTITY VERIFICATION // SEC-02
            </div>
            <h1 className="lp-headline">
              ACCESS<br />STUDENT<br />PORTAL
            </h1>
          </div>

          {/* ── Body copy ── */}
          <p className="lp-body" style={{ marginBottom: 22 }}>
            Sign in with your institutional{' '}
            <strong>@adypu.edu.in</strong> or{' '}
            <strong>@newtonschool.co</strong>{' '}
            account to synchronize: attendance, event registrations, and club management.
          </p>

          {/* ── Session Handshake Matrix ── */}
          <div className="lp-matrix">
            <div className="lp-matrix-hd">
              <span className="lp-mono" style={{ color: '#000' }}>SESSION HANDSHAKE MATRIX</span>
              <span className="lp-mono lp-mono-blue">READY FOR SSO</span>
            </div>
            <div className="lp-matrix-row">
              <div className="lp-matrix-cell">CLEARANCE</div>
              <div className="lp-matrix-cell">LEVEL-03</div>
            </div>
            <div className="lp-matrix-row">
              <div className="lp-matrix-cell">CLUSTER</div>
              <div className="lp-matrix-cell">AI-ENG-01</div>
            </div>
            <div className="lp-matrix-row">
              <div className="lp-matrix-cell">PROTOCOL</div>
              <div className="lp-matrix-cell val-blue">ACTIVE SSO</div>
            </div>
          </div>

          {/* ── Auth Error Block ── */}
          {authError && (
            <div className="lp-error">
              <div className="lp-error-hd">
                <div className="lp-error-badge">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c0392b', display: 'inline-block', flexShrink: 0 }} />
                  {authError.badge}
                </div>
                <button type="button" className="lp-error-dismiss" onClick={handleDismissError} aria-label="Dismiss error">
                  DISMISS [×]
                </button>
              </div>
              <div className="lp-error-title">{authError.title}</div>
              <div className="lp-error-msg">{authError.message}</div>
              <div className="lp-error-detail">{authError.detail}</div>
              {authError.canSwitchAccount && (
                <button type="button" className="lp-error-action" onClick={handleLogin} disabled={isLoading}>
                  <GoogleIcon className="w-3.5 h-3.5" />
                  SWITCH GOOGLE ACCOUNT
                </button>
              )}
              {authError.canContactCoordinator && (
                <button type="button" className="lp-error-outline" onClick={handleContactCoordinator}>
                  CONTACT ACADEMIC COORDINATOR
                </button>
              )}
              <div className="lp-error-note">
                NOTE: If Google signs you in automatically without prompting, sign out at accounts.google.com or use private browsing.
              </div>
            </div>
          )}

          {/* ── Primary CTA ── */}
          <button
            id="btn-google-login"
            type="button"
            className="lp-btn-google"
            onClick={handleLogin}
            disabled={isLoading}
            aria-label="Sign in with Google"
          >
            {isLoading ? (
              <><div className="lp-spin" />AUTHENTICATING...</>
            ) : (
              <>
                <div className="lp-google-icon-wrap"><GoogleIcon className="w-4 h-4" /></div>
                CONTINUE WITH GOOGLE
              </>
            )}
          </button>

          {/* ── Footer ── */}
          <div className="lp-footer">
            <div className="lp-footer-p">RESTRICTED TO ENROLLED NST STUDENTS &amp; FACULTY</div>
            <div className="lp-footer-s">SEC-02 IDENTITY GATEWAY // @ADYPU.EDU.IN &amp; @NEWTONSCHOOL.CO</div>
            <button type="button" className="lp-footer-link" onClick={() => setIsCreditsOpen(true)}>
              Crafted by NST Software Developers Club
            </button>
          </div>
        </div>
      </div>

      <DevClubCreditsModal isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />
    </>
  );
}

export default function LoginPage() {
  return (
    <div
      suppressHydrationWarning
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        padding: '48px 24px',
      }}
    >
      <Suspense
        fallback={
          <div style={{
            position: 'relative', width: '100%', maxWidth: 620,
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: '#0047FF', transform: 'translate(10px,10px)', zIndex: 0,
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              background: '#f5f0e8', border: '2.5px solid #000',
              padding: '40px 44px', minHeight: 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 32, height: 32,
                  border: '3px solid #0047FF', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'lp-rotate 0.7s linear infinite',
                }} />
                <span style={{
                  fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555',
                }}>
                  INITIALIZING AUTH GATEWAY...
                </span>
              </div>
            </div>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
