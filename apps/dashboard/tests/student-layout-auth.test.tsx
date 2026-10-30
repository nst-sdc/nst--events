// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextRequest } from 'next/server';
import { proxy as middleware } from '../proxy';
import StudentLayout from '../app/(student)/layout';
import HomePage from '../app/page';
import { getWebAuthStore } from '../lib/auth-store';
import * as api from '../lib/api';

// Mock matchMedia for Ant Design / style compatibility
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

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockPathname = '/student/home';
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

let mockCurrentUser: Record<string, unknown> | null = {
  id: 'student-uuid-1',
  email: 'student@adypu.edu.in',
  name: 'Student Tester',
  global_role: 'STUDENT',
  club_memberships: [],
};
let mockIsUserLoading = false;
let mockIsUserError = false;

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: mockCurrentUser,
    isLoading: mockIsUserLoading,
    isError: mockIsUserError,
  }),
}));

vi.mock('../hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: vi.fn(),
}));

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ data: { pages: [{ data: [] }] }, isLoading: false }),
  useUnreadCount: () => ({ count: 0 }),
  useReadNotification: () => ({ mutate: vi.fn() }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
    resolvedTheme: 'dark',
  }),
}));

describe('Task 3: Student Layout Auth & Hydration Flow', () => {
  let refreshTokenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    mockPathname = '/student/home';
    mockSearchParams = new URLSearchParams();
    mockCurrentUser = {
      id: 'student-uuid-1',
      email: 'student@adypu.edu.in',
      name: 'Student Tester',
      global_role: 'STUDENT',
      club_memberships: [],
    };
    mockIsUserLoading = false;
    mockIsUserError = false;
    getWebAuthStore().setAccessToken(null);

    refreshTokenSpy = vi.spyOn(api, 'refreshToken');
  });

  afterEach(() => {
    refreshTokenSpy.mockRestore();
  });

  it('no hint -> redirects to /login with returnTo and zero refresh calls', async () => {
    // Session hint is missing from cookies
    document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';

    render(
      <StudentLayout>
        <div data-testid="protected-content">Secret Student Content</div>
      </StudentLayout>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/login?return_to=%2Fstudent%2Fhome&returnTo=%2Fstudent%2Fhome'
      );
    });

    // Zero refresh calls must be dispatched
    expect(refreshTokenSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('hint + valid refresh -> page hydrates and renders protected content', async () => {
    // Provide user_role session hint
    document.cookie = 'user_role=STUDENT; Path=/;';
    refreshTokenSpy.mockResolvedValueOnce({
      status: 'SUCCESS',
      token: 'fresh-mock-jwt-token',
    });

    render(
      <StudentLayout>
        <div data-testid="protected-content">Secret Student Content</div>
      </StudentLayout>
    );

    // Should render protected content once hydrated
    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();

    expect(refreshTokenSpy).toHaveBeenCalledTimes(1);
    expect(getWebAuthStore().accessToken).toBe('fresh-mock-jwt-token');
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/login'));
  });

  it('hint + 401 refresh -> redirects to /login, clears user_role hint, and bars protected content', async () => {
    // Provide stale session hint
    document.cookie = 'user_role=STUDENT; Path=/;';
    refreshTokenSpy.mockResolvedValueOnce({
      status: 'SESSION_DEAD',
    });

    render(
      <StudentLayout>
        <div data-testid="protected-content">Secret Student Content</div>
      </StudentLayout>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/login?return_to=%2Fstudent%2Fhome&returnTo=%2Fstudent%2Fhome'
      );
    });

    // Stale hint must be cleared
    const hasRoleHint = document.cookie
      .split('; ')
      .some((row) => row.startsWith('user_role=') && Boolean(row.split('=')[1]?.trim()));
    expect(hasRoleHint).toBe(false);

    // In-memory token must be null
    expect(getWebAuthStore().accessToken).toBeNull();
    // Protected content must not be rendered
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('hint + failed refresh (network error) -> redirects to /login and clears hint', async () => {
    document.cookie = 'user_role=STUDENT; Path=/;';
    refreshTokenSpy.mockRejectedValueOnce(new Error('Connection refused'));

    render(
      <StudentLayout>
        <div data-testid="protected-content">Secret Student Content</div>
      </StudentLayout>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/login?return_to=%2Fstudent%2Fhome&returnTo=%2Fstudent%2Fhome'
      );
    });

    const hasRoleHint = document.cookie
      .split('; ')
      .some((row) => row.startsWith('user_role=') && Boolean(row.split('=')[1]?.trim()));
    expect(hasRoleHint).toBe(false);

    expect(getWebAuthStore().accessToken).toBeNull();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('shows loading state while hydrating with no flash of protected content', () => {
    document.cookie = 'user_role=STUDENT; Path=/;';
    // Keep refresh promise pending
    refreshTokenSpy.mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <StudentLayout>
        <div data-testid="protected-content">Secret Student Content</div>
      </StudentLayout>
    );

    // Protected content is NOT shown
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    // Loading skeleton is shown
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

describe('Task 3: Middleware Student Route Guard', () => {
  it('redirects unauthenticated /student request to /login with returnTo and return_to', () => {
    const req = new NextRequest('http://localhost:3000/student');
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?return_to=%2Fstudent&returnTo=%2Fstudent'
    );
  });

  it('redirects unauthenticated /student/campus/discover request to /login', () => {
    const req = new NextRequest('http://localhost:3000/student/campus/discover');
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?return_to=%2Fstudent%2Fcampus%2Fdiscover&returnTo=%2Fstudent%2Fcampus%2Fdiscover'
    );
  });

  it('allows request with user_role=STUDENT hint to pass through to layout hydration', () => {
    const req = new NextRequest('http://localhost:3000/student/campus/discover', {
      headers: { cookie: 'user_role=STUDENT' },
    });
    const res = middleware(req);
    expect(res.status).toBe(200);
  });
});

describe('Task 3: Public Landing Page ("/") Network Auth Isolation', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/v1/events/public')) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('"/" makes no network auth or refresh calls and renders Go to Events CTA', async () => {
    const pageJsx = await HomePage();
    render(pageJsx);

    // Verify "Go to Events" CTA exists and links to student events route
    const ctaButton = screen.getByRole('link', { name: /go to events/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveAttribute('href', '/student/campus/discover');

    // Verify that NO calls were made to /auth/refresh, /auth/logout, or any authenticated route
    const calls = fetchSpy.mock.calls.map((call: [RequestInfo | URL, RequestInit?]) => String(call[0]));
    const authCalls = calls.filter((url: string) => url.includes('/auth/'));
    expect(authCalls).toHaveLength(0);
  });
});
