// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, renderHook, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogout } from '../hooks/useLogout';
import { getWebAuthStore } from '../lib/auth-store';
import { refreshToken } from '../lib/api';
import { getQueryClient } from '../lib/query-client';
import { AppShell } from '../components/layout/AppShell';

// Mock router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/dashboard',
}));

// Mock useTheme
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

// Mock useRealtimeNotifications
vi.mock('../hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: vi.fn(),
}));

// Mock useCurrentUser
const mockUser = {
  id: 'user-1',
  email: 'admin@newtonschool.co',
  full_name: 'Admin User',
  global_role: 'PLATFORM_ADMIN',
  club_memberships: [],
};

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: mockUser,
    isLoading: false,
    isError: false,
  }),
}));

// Mock window.matchMedia for Ant Design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock antd Dropdown to expose items cleanly in test environment
vi.mock('antd', async (importOriginal) => {
  const antd = (await importOriginal()) as any;
  return {
    ...antd,
    Dropdown: ({ children, menu }: any) => (
      <div>
        {children}
        <div data-testid="mock-dropdown-menu">
          {menu?.items?.map((item: any, i: number) => (
            <button
              key={item?.key || i}
              data-testid={`menu-item-${item?.key || i}`}
              onClick={item?.onClick}
            >
              {item?.label}
            </button>
          ))}
        </div>
      </div>
    ),
  };
});

describe('Web Sign-Out & useLogout Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWebAuthStore().setLoggingOut(false);
    getWebAuthStore().logout();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('1. useLogout dispatches POST /auth/logout with credentials: include', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLogout(), { wrapper });
    await result.current.mutateAsync();

    expect(fetchMock).toHaveBeenCalled();
    const logoutCall = fetchMock.mock.calls.find((call) =>
      call[0].toString().includes('/auth/logout')
    );
    expect(logoutCall).toBeDefined();
    expect(logoutCall![1].method).toBe('POST');
    expect(logoutCall![1].credentials).toBe('include');
    expect(logoutCall![1].headers['X-Client-Platform']).toBe('web');
  });

  it('2. cleanup runs even if network call fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', fetchMock);

    const authStore = getWebAuthStore();
    authStore.setAccessToken('valid-token', 'user-123');
    document.cookie = 'user_role=PLATFORM_ADMIN; Path=/';
    window.sessionStorage.setItem('return_to', '/dashboard');
    getQueryClient().setQueryData(['test-query'], { data: 'stale' });

    expect(authStore.accessToken).toBe('valid-token');
    expect(getQueryClient().getQueryData(['test-query'])).toEqual({ data: 'stale' });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLogout(), { wrapper });
    await result.current.mutateAsync();

    // Verify all local session state is purged
    expect(authStore.accessToken).toBeNull();
    expect(authStore.userId).toBeNull();
    expect(window.sessionStorage.getItem('return_to')).toBeNull();
    expect(getQueryClient().getQueryData(['test-query'])).toBeUndefined();
    expect(mockRouter.replace).toHaveBeenCalledWith('/login');
  });

  it('3. late in-flight refresh result resolving after logout is ignored', async () => {
    let resolveRefreshFetch!: (res: any) => void;
    const pendingRefreshPromise = new Promise((resolve) => {
      resolveRefreshFetch = resolve;
    });

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.toString().includes('/auth/refresh')) {
        return pendingRefreshPromise;
      }
      if (url.toString().includes('/auth/logout')) {
        return Promise.resolve({
          ok: true,
          status: 204,
          headers: new Headers(),
          text: async () => '',
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const authStore = getWebAuthStore();
    authStore.setLoggingOut(false);
    authStore.setAccessToken('initial-token');

    // Start in-flight refresh
    const inFlightRefresh = refreshToken();

    // Trigger logout
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLogout(), { wrapper });
    await result.current.mutateAsync();

    // Store is cleared
    expect(authStore.accessToken).toBeNull();

    // Now resolve the in-flight refresh with a token
    resolveRefreshFetch({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'late-stale-token', user: { global_role: 'STUDENT' } }),
      headers: new Headers(),
    });

    const refreshResult = await inFlightRefresh;

    // Refresh result must not be SUCCESS
    expect(refreshResult.status).toBe('SESSION_DEAD');

    // Even if caller tried to setAccessToken with the late token, store must ignore it
    authStore.setAccessToken('late-stale-token');
    expect(authStore.accessToken).toBeNull();
  });

  it('4. AppShell sign-out triggers POST /auth/logout API call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AppShell>
          <div>Protected Content</div>
        </AppShell>
      </QueryClientProvider>
    );

    // Find Sign Out in the dropdown menu
    const signOutBtn = screen.getByTestId('menu-item-logout');
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);

    await waitFor(() => {
      const logoutCall = fetchMock.mock.calls.find((call) =>
        call[0].toString().includes('/auth/logout')
      );
      expect(logoutCall).toBeDefined();
    });

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });
  });
});
