'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWebAuthStore } from '../../lib/auth-store';
import { AppShell } from '../../components/layout/AppShell';
import { apiClient } from '../../lib/api';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { validateSafeRedirectPath } from '../../lib/auth-helpers';
import { Spin, Layout, Result, Button } from 'antd';

// Module-level promise to prevent duplicate concurrent refresh requests across remounts
let refreshPromise: Promise<string | null> | null = null;

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const store = getWebAuthStore();
  const [isHydrating, setIsHydrating] = useState(!store.accessToken);
  const [isAuthenticated, setIsAuthenticated] = useState(!!store.accessToken);

  const { data: user, isLoading: isUserLoading, isError: isUserError } = useCurrentUser();

  useEffect(() => {
    if (store.accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsHydrating(false);
      return;
    }

    const bootstrap = async () => {
      try {
        if (!refreshPromise) {
          refreshPromise = apiClient<{ access_token: string }>('/auth/refresh', { method: 'POST' }).then(data => {
            return data?.access_token || null;
          }).catch(() => null);
        }
        
        const token = await refreshPromise;
        if (token) {
          store.setAccessToken(token);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          if (typeof document !== 'undefined') {
            document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
          }
          const currentPath = typeof window !== 'undefined'
            ? validateSafeRedirectPath(window.location.pathname + window.location.search)
            : null;
          const isNonTrivialDestination = !!currentPath && currentPath !== '/' && currentPath !== '/login';
          if (isNonTrivialDestination && typeof window !== 'undefined') {
            window.sessionStorage?.setItem('return_to', currentPath);
          }
          const loginTarget = isNonTrivialDestination
            ? `/login?return_to=${encodeURIComponent(currentPath)}`
            : '/login';
          router.push(loginTarget);
        }
      } catch {
        setIsAuthenticated(false);
        if (typeof document !== 'undefined') {
          document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
        }
        const currentPath = typeof window !== 'undefined'
          ? validateSafeRedirectPath(window.location.pathname + window.location.search)
          : null;
        const isNonTrivialDestination = !!currentPath && currentPath !== '/' && currentPath !== '/login';
        if (isNonTrivialDestination && typeof window !== 'undefined') {
          window.sessionStorage?.setItem('return_to', currentPath);
        }
        const loginTarget = isNonTrivialDestination
          ? `/login?return_to=${encodeURIComponent(currentPath)}`
          : '/login';
        router.push(loginTarget);
      } finally {
        setIsHydrating(false);
        refreshPromise = null;
      }
    };

    bootstrap();
  }, [router, store]);

  const isStudent = user?.global_role === 'STUDENT';
  const isAuthorizedAdmin = user && ['PLATFORM_ADMIN', 'FACULTY_ADMIN', 'FACULTY_MENTOR'].includes(user.global_role);

  useEffect(() => {
    // If authenticated and user is loaded, enforce role-appropriate routing
    if (isAuthenticated && user) {
      // Reconcile client-controlled cookie with authoritative role from backend
      if (typeof document !== 'undefined' && user.global_role) {
        document.cookie = `user_role=${user.global_role}; path=/; max-age=2592000; SameSite=Lax`;
      }

      // 1. Students are strictly barred from operations dashboard and admin routes
      if (isStudent) {
        if (typeof window !== 'undefined') {
          window.sessionStorage?.removeItem('return_to');
        }
        router.replace('/student/home');
        return;
      }

      // 2. Handle returnTo for authorized administrators
      if (typeof window !== 'undefined') {
        const stored = window.sessionStorage?.getItem('return_to');
        const returnTo = validateSafeRedirectPath(stored);
        if (returnTo) {
          window.sessionStorage?.removeItem('return_to');
          router.replace(returnTo);
          return;
        }
      }
    }
  }, [isAuthenticated, user, isStudent, router]);

  if (isHydrating || (isAuthenticated && isUserLoading)) {
    return (
      <Layout className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </Layout>
    );
  }

  if (isAuthenticated && isUserError) {
    return (
      <Layout className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <Result
          status="500"
          title="Failed to Load User Profile"
          subTitle="We couldn't connect to the server or your session is invalid. Please try again."
          extra={<Button type="primary" onClick={() => window.location.reload()}>Retry</Button>}
        />
      </Layout>
    );
  }

  // Reject unauthenticated access, student access, or unauthorized roles from rendering AppShell
  if (!isAuthenticated || isStudent || !isAuthorizedAdmin) {
    return null;
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
