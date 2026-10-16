'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getWebAuthStore } from '../../lib/auth-store';
import { AppShell } from '../../components/layout/AppShell';
import { apiClient } from '../../lib/api';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { Spin, Layout, Result, Button } from 'antd';

// Module-level promise to prevent duplicate concurrent refresh requests across remounts
let refreshPromise: Promise<string | null> | null = null;

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
          router.push('/login');
        }
      } catch {
        setIsAuthenticated(false);
        router.push('/login');
      } finally {
        setIsHydrating(false);
        refreshPromise = null;
      }
    };

    bootstrap();
  }, [router, store]);

  useEffect(() => {
    // If authenticated and user is loaded, check role
    if (isAuthenticated && user) {
      if (typeof window !== 'undefined') {
        const returnTo = window.sessionStorage.getItem('return_to');
        if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
          window.sessionStorage.removeItem('return_to');
          router.replace(returnTo);
          return;
        }
      }
      if (user.global_role === 'STUDENT' && !pathname.startsWith('/student')) {
        router.replace('/student/home');
      }
    }
  }, [isAuthenticated, user, router, pathname]);

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

  const isStudent = user?.global_role === 'STUDENT';
  if (!isAuthenticated || isStudent) {
    return null;
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
