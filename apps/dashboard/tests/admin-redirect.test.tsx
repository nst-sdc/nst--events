// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import LoginPage from '../app/(auth)/login/page';
import AppLayout from '../app/(app)/layout';
import { StudentAppShell } from '../components/layout/StudentAppShell';
import { validateSafeRedirectPath } from '../lib/auth-helpers';
import { getWebAuthStore } from '../lib/auth-store';

// Mock window.matchMedia for Ant Design components
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
let mockPathname = '/login';
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

let mockCurrentUser: Record<string, unknown> | null = null;
let mockIsUserLoading = false;

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: mockCurrentUser,
    isLoading: mockIsUserLoading,
    isError: false,
  }),
}));

vi.mock('../components/layout/ClubAdminProvider', () => ({
  useClubAdmin: () => ({
    isClubAdminMode: false,
    setClubAdminMode: vi.fn(),
    managedClubs: [],
    adminClubs: [],
  }),
  ClubAdminProvider: ({ children }: any) => <>{children}</>,
  ClubAdminToggle: () => null,
}));

vi.mock('../lib/api', () => ({
  apiClient: vi.fn(),
  API_BASE_URL: 'http://localhost:3001',
}));

vi.mock('../hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: vi.fn(),
}));

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ data: { pages: [{ data: [] }] }, isLoading: false }),
  useUnreadCount: () => ({ count: 0 }),
  useReadNotification: () => ({ mutate: vi.fn() }),
}));

describe('Admin Ops Authentication & Redirect Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    mockPathname = '/login';
    mockSearchParams = new URLSearchParams();
    mockCurrentUser = null;
    mockIsUserLoading = false;
  });

  describe('1. validateSafeRedirectPath Security Invariants', () => {
    it('accepts safe relative paths', () => {
      expect(validateSafeRedirectPath('/admin')).toBe('/admin');
      expect(validateSafeRedirectPath('/admin/users?sort=name')).toBe('/admin/users?sort=name');
      expect(validateSafeRedirectPath('/dashboard')).toBe('/dashboard');
      expect(validateSafeRedirectPath('/student/home')).toBe('/student/home');
      expect(validateSafeRedirectPath('/projects/submit#step2')).toBe('/projects/submit#step2');
    });

    it('rejects external URLs and open redirect vectors', () => {
      expect(validateSafeRedirectPath('https://evil.com')).toBeNull();
      expect(validateSafeRedirectPath('http://evil.com/admin')).toBeNull();
      expect(validateSafeRedirectPath('//evil.com')).toBeNull();
      expect(validateSafeRedirectPath('//attacker.com/admin')).toBeNull();
      expect(validateSafeRedirectPath('/\\evil.com')).toBeNull();
      expect(validateSafeRedirectPath('/\\attacker.com')).toBeNull();
      expect(validateSafeRedirectPath('javascript:alert(1)')).toBeNull();
      expect(validateSafeRedirectPath('/foo\\bar')).toBeNull();
      expect(validateSafeRedirectPath('admin')).toBeNull();
      expect(validateSafeRedirectPath('')).toBeNull();
      expect(validateSafeRedirectPath(null)).toBeNull();
      expect(validateSafeRedirectPath(undefined)).toBeNull();
    });
  });

  describe('2. StudentAppShell Navbar Admin Ops Link', () => {
    it('renders ADMIN OPS linking to /admin for unauthenticated users', () => {
      mockCurrentUser = null;

      render(
        <StudentAppShell>
          <div>Page Content</div>
        </StudentAppShell>
      );

      const adminOpsLink = screen.getByText(/ADMIN OPS/i).closest('a');
      expect(adminOpsLink).toBeInTheDocument();
      expect(adminOpsLink).toHaveAttribute('href', '/admin');
    });

    it('renders ADMIN OPS linking to /admin for authorized administrators', () => {
      mockCurrentUser = {
        id: 'user-admin',
        full_name: 'Admin User',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      };

      render(
        <StudentAppShell>
          <div>Page Content</div>
        </StudentAppShell>
      );

      const adminOpsLink = screen.getByText(/ADMIN OPS/i).closest('a');
      expect(adminOpsLink).toBeInTheDocument();
      expect(adminOpsLink).toHaveAttribute('href', '/admin');
    });

    it('does NOT render ADMIN OPS in navbar for ordinary students', () => {
      mockCurrentUser = {
        id: 'user-student',
        full_name: 'Student User',
        global_role: 'STUDENT',
        club_memberships: [],
      };

      render(
        <StudentAppShell>
          <div>Page Content</div>
        </StudentAppShell>
      );

      expect(screen.queryByText(/ADMIN OPS/i)).not.toBeInTheDocument();
    });
  });

  describe('3. Middleware Preservation of Admin Destination', () => {
    it('preserves /admin destination when unauthenticated user navigates to /admin', () => {
      const req = new NextRequest('http://localhost:3000/admin');
      const res = middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?return_to=%2Fadmin');
    });

    it('strictly redirects students attempting to visit /admin to /student/home', () => {
      const req = new NextRequest('http://localhost:3000/admin', {
        headers: { cookie: 'user_role=STUDENT' },
      });
      const res = middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/student/home');
    });
  });

  describe('4. Login Page Redirect Handling & Authorization Enforcement', () => {
    it('redirects authorized PLATFORM_ADMIN to /admin when redirectTo=%2Fadmin is specified', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-admin-token');
      document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
      mockSearchParams = new URLSearchParams({ redirectTo: '/admin' });
      mockCurrentUser = {
        id: 'admin-1',
        email: 'padmin@newtonschool.co',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      };

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      });
    });

    it('redirects authorized FACULTY_ADMIN to /admin when return_to=%2Fadmin is specified', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-admin-token');
      document.cookie = 'user_role=FACULTY_ADMIN; path=/';
      mockSearchParams = new URLSearchParams({ return_to: '/admin' });
      mockCurrentUser = {
        id: 'fac-admin-1',
        email: 'fadmin@newtonschool.co',
        global_role: 'FACULTY_ADMIN',
        club_memberships: [],
      };

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      });
    });

    it('redirects authorized admin to /admin when redirect=%2Fadmin is specified', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-admin-token');
      document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
      mockSearchParams = new URLSearchParams({ redirect: '/admin' });
      mockCurrentUser = {
        id: 'admin-1',
        email: 'padmin@newtonschool.co',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      };

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      });
    });

    it('prevents student from gaining admin access via redirectTo parameter', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-student-token');
      document.cookie = 'user_role=STUDENT; path=/';
      mockSearchParams = new URLSearchParams({ redirectTo: '/admin' });
      mockCurrentUser = {
        id: 'student-1',
        email: 'student@adypu.edu.in',
        global_role: 'STUDENT',
        club_memberships: [],
      };

      render(<LoginPage />);

      await waitFor(() => {
        // Student MUST be sent to /student/home, NOT /admin
        expect(mockPush).toHaveBeenCalledWith('/student/home');
      });
      expect(mockPush).not.toHaveBeenCalledWith('/admin');
    });

    it('preserves normal login behavior when no explicit redirect parameter is provided', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-token');
      mockSearchParams = new URLSearchParams();

      // Student without destination -> /student/home
      document.cookie = 'user_role=STUDENT; path=/';
      mockCurrentUser = {
        id: 'student-1',
        email: 'student@adypu.edu.in',
        global_role: 'STUDENT',
        club_memberships: [],
      };

      const { unmount } = render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/student/home');
      });

      unmount();
      mockPush.mockClear();

      // Admin without destination -> /dashboard (normal default)
      document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
      mockCurrentUser = {
        id: 'admin-1',
        email: 'admin@newtonschool.co',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      };

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('rejects external open-redirect destinations and falls back to safe default', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-admin-token');
      document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
      mockSearchParams = new URLSearchParams({ redirectTo: 'https://evil-phishing.com/admin' });
      mockCurrentUser = {
        id: 'admin-1',
        email: 'admin@newtonschool.co',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      };

      render(<LoginPage />);

      await waitFor(() => {
        // Must fall back to safe default /dashboard, never redirect to evil domain
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
      expect(mockPush).not.toHaveBeenCalledWith('https://evil-phishing.com/admin');
    });

    it('avoids race condition by not redirecting while user profile is loading', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-token');
      mockSearchParams = new URLSearchParams({ redirectTo: '/admin' });
      mockIsUserLoading = true;
      mockCurrentUser = null;

      render(<LoginPage />);

      // While user session is loading, router.push must NOT be called yet
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('5. AppLayout Post-OAuth ReturnTo Redirection', () => {
    it('redirects authorized administrator landing on /dashboard to /admin when return_to was stored', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-admin-token');
      sessionStorage.setItem('return_to', '/admin');
      mockPathname = '/dashboard';
      mockCurrentUser = {
        id: 'admin-1',
        email: 'admin@newtonschool.co',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      };

      render(
        <AppLayout>
          <div>Admin Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/admin');
      });
      // Session storage must be cleared after redirection
      expect(sessionStorage.getItem('return_to')).toBeNull();
    });

    it('bars student landing on /dashboard with stored return_to from admin access and redirects to /student/home', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('mock-student-token');
      sessionStorage.setItem('return_to', '/admin');
      mockPathname = '/dashboard';
      mockCurrentUser = {
        id: 'student-1',
        email: 'student@adypu.edu.in',
        global_role: 'STUDENT',
        club_memberships: [],
      };

      render(
        <AppLayout>
          <div>Privileged Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/student/home');
      });
      expect(mockReplace).not.toHaveBeenCalledWith('/admin');
      expect(sessionStorage.getItem('return_to')).toBeNull();
    });
  });
});
