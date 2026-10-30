'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getWebAuthStore } from '../../lib/auth-store';
import { refreshToken } from '../../lib/api';
import { StudentAppShell } from '../../components/layout/StudentAppShell';
import { ClubAdminProvider } from '../../components/layout/ClubAdminProvider';
import { useCurrentUser } from '../../hooks/useCurrentUser';


function StudentLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const store = getWebAuthStore();
  const [isHydrating, setIsHydrating] = useState(!store.accessToken);
  const [isAuthenticated, setIsAuthenticated] = useState(!!store.accessToken);

  const { isLoading: isUserLoading, isError: isUserError } = useCurrentUser();

  useEffect(() => {
    if (store.accessToken) {
      setIsAuthenticated(true);
      setIsHydrating(false);
      return;
    }

    const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    const loginTarget = `/login?return_to=${encodeURIComponent(currentPath)}&returnTo=${encodeURIComponent(currentPath)}`;

    // Session hint check (non-HttpOnly user_role cookie cleared on logout)
    const hasSessionHint =
      typeof document !== 'undefined' &&
      document.cookie
        .split('; ')
        .some((row) => row.startsWith('user_role=') && Boolean(row.split('=')[1]?.trim()));

    // Skip the refresh call entirely when there is no session hint and go straight to /login
    if (!hasSessionHint) {
      setIsAuthenticated(false);
      setIsHydrating(false);
      router.replace(loginTarget);
      return;
    }

    const bootstrap = async () => {
      try {
        const res = await refreshToken();
        if (res.status === 'SUCCESS' && res.token) {
          store.setAccessToken(res.token);
          setIsAuthenticated(true);
        } else {
          // If refresh returns 401/403 or fails, clear stale hint and redirect to /login
          if (typeof document !== 'undefined') {
            document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
          }
          store.setAccessToken(null);
          setIsAuthenticated(false);
          router.replace(loginTarget);
        }
      } catch {
        if (typeof document !== 'undefined') {
          document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
        }
        store.setAccessToken(null);
        setIsAuthenticated(false);
        router.replace(loginTarget);
      } finally {
        setIsHydrating(false);
      }
    };

    bootstrap();
  }, [router, store, pathname, searchParams]);

  if (isHydrating || !isAuthenticated || isUserLoading) {
    return (
      <div className="min-h-screen bg-m3-surface flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-surface-variant/50"></div>
          <div className="w-24 h-4 rounded-md bg-m3-surface-variant/50"></div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && isUserError) {
    return (
      <div className="min-h-screen bg-m3-surface flex flex-col items-center justify-center gap-4 p-4 text-center">
        <h2 className="text-xl font-bold text-m3-on-surface">Failed to Load User Profile</h2>
        <p className="text-m3-on-surface-variant">We couldn&apos;t connect to the server or your session is invalid. Please try again.</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-m3-primary text-m3-on-primary rounded-full font-medium mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-m3-surface flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-surface-variant/50"></div>
          <div className="w-24 h-4 rounded-md bg-m3-surface-variant/50"></div>
        </div>
      </div>
    );
  }

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        {children}
      </StudentAppShell>
    </ClubAdminProvider>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-m3-surface flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-surface-variant/50"></div>
          <div className="w-24 h-4 rounded-md bg-m3-surface-variant/50"></div>
        </div>
      </div>
    }>
      <StudentLayoutContent>{children}</StudentLayoutContent>
    </React.Suspense>
  );
}
