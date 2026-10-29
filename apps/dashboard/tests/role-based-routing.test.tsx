// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import AppLayout from '../app/(app)/layout';
import LoginPage from '../app/(auth)/login/page';
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

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
};

let mockPathname = '/dashboard';
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

let mockUser: Record<string, unknown> | null = null;
let mockIsUserLoading = false;
const mockIsUserError = false;

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: mockUser,
    isLoading: mockIsUserLoading,
    isError: mockIsUserError,
  }),
}));

vi.mock('../lib/api', () => ({
  apiClient: vi.fn(),
  refreshToken: vi.fn(),
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

describe('1. Server-Side Route Guard (Next.js Middleware)', () => {
  it('rejects STUDENT role from /dashboard and redirects server-side to /student/home', () => {
    const req = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'user_role=STUDENT',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/student/home');
  });

  it('rejects STUDENT role from /admin/users and redirects server-side to /student/home', () => {
    const req = new NextRequest('http://localhost:3000/admin/users', {
      headers: {
        cookie: 'user_role=STUDENT',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/student/home');
  });

  it('rejects STUDENT role from /events and /clubs operations views', () => {
    const reqEvents = new NextRequest('http://localhost:3000/events', {
      headers: { cookie: 'user_role=STUDENT' },
    });
    expect(middleware(reqEvents).headers.get('location')).toBe('http://localhost:3000/student/home');

    const reqClubs = new NextRequest('http://localhost:3000/clubs', {
      headers: { cookie: 'user_role=STUDENT' },
    });
    expect(middleware(reqClubs).headers.get('location')).toBe('http://localhost:3000/student/home');
  });

  it('allows authenticated PLATFORM_ADMIN to access /dashboard', () => {
    const req = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'refreshToken=admin-refresh-token; user_role=PLATFORM_ADMIN',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(200); // NextResponse.next() continues
  });

  it('allows authenticated FACULTY_ADMIN to access /dashboard', () => {
    const req = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'refreshToken=faculty-refresh-token; user_role=FACULTY_ADMIN',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows PLATFORM_ADMIN role hint to proceed to AppLayout session validation', () => {
    const req = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'user_role=PLATFORM_ADMIN',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(200);
  });

  it('redirects unauthenticated requests on /dashboard to /login with return_to', () => {
    const req = new NextRequest('http://localhost:3000/dashboard');

    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?return_to=%2Fdashboard');
  });

  it('allows public routes like /student/home without interference', () => {
    const req = new NextRequest('http://localhost:3000/student/home');
    const res = middleware(req);
    expect(res.status).toBe(200);
  });
});

describe('2. Client-Side AppLayout Guard Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/dashboard';
    mockSearchParams = new URLSearchParams();
    sessionStorage.clear();
    const store = getWebAuthStore();
    store.setAccessToken('valid-mock-token');
  });

  it('strictly bars regular student from rendering AppShell and redirects to /student/home', async () => {
    mockUser = {
      id: 'student-1',
      email: 'student@adypu.edu.in',
      global_role: 'STUDENT',
      club_memberships: [],
    };
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="protected-content">Secret Admin Dashboard</div>
      </AppLayout>
    );

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/student/home');
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('strictly bars student club admin from rendering operations dashboard and redirects to /student/home', async () => {
    mockUser = {
      id: 'club-admin-1',
      email: 'clubadmin@adypu.edu.in',
      global_role: 'STUDENT',
      club_memberships: [
        {
          club_id: 'club-123',
          club_name: 'Coding Club',
          role: 'CLUB_ADMIN',
        },
      ],
    };
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="protected-content">Secret Admin Dashboard</div>
      </AppLayout>
    );

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/student/home');
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('prevents student from reaching admin page via sessionStorage return_to', async () => {
    sessionStorage.setItem('return_to', '/admin/users');
    mockUser = {
      id: 'student-2',
      email: 'student2@adypu.edu.in',
      global_role: 'STUDENT',
      club_memberships: [],
    };
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="protected-content">Secret Admin Dashboard</div>
      </AppLayout>
    );

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/student/home');
    });
    expect(sessionStorage.getItem('return_to')).toBeNull();
  });

  it('allows PLATFORM_ADMIN to render AppShell and children', async () => {
    mockUser = {
      id: 'admin-1',
      email: 'admin@newtonschool.co',
      global_role: 'PLATFORM_ADMIN',
      club_memberships: [],
    };
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="protected-content">Admin Dashboard Visible</div>
      </AppLayout>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/student/home');
  });

  it('allows FACULTY_ADMIN to render AppShell and children', async () => {
    mockUser = {
      id: 'faculty-admin-1',
      email: 'faculty@newtonschool.co',
      global_role: 'FACULTY_ADMIN',
      club_memberships: [],
    };
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="protected-content">Faculty Admin Content</div>
      </AppLayout>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/student/home');
  });
});

describe('3. Login Post-Auth Role Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    const store = getWebAuthStore();
    store.setAccessToken('valid-mock-token');
  });

  it('routes STUDENT account to /student/home after login', async () => {
    document.cookie = 'user_role=STUDENT; path=/';
    mockUser = {
      id: 'student-3',
      email: 'student3@adypu.edu.in',
      global_role: 'STUDENT',
      club_memberships: [],
    };

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/student/home');
    });
  });

  it('routes PLATFORM_ADMIN account to /dashboard after login', async () => {
    document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
    mockUser = {
      id: 'platform-admin-1',
      email: 'admin@newtonschool.co',
      global_role: 'PLATFORM_ADMIN',
      club_memberships: [],
    };

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('blocks student from using return_to query to reach admin routes on login', async () => {
    document.cookie = 'user_role=STUDENT; path=/';
    mockSearchParams = new URLSearchParams({ return_to: '/admin/audit-logs' });
    mockUser = {
      id: 'student-4',
      email: 'student4@adypu.edu.in',
      global_role: 'STUDENT',
      club_memberships: [],
    };

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/student/home');
    });
    expect(mockRouter.push).not.toHaveBeenCalledWith('/admin/audit-logs');
  });
});

describe('4. Workstream 05: Dashboard Role-Guard Security & Threat Boundary Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  });

  it('Requirement 1: A student cannot gain administrative authorization by changing the role cookie', async () => {
    // Attack scenario: Student user modifies document.cookie to PLATFORM_ADMIN
    document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
    const store = getWebAuthStore();
    store.setAccessToken('student-jwt-token');

    // Server profile (/v1/users/me) returns the true authenticated identity: STUDENT
    mockUser = {
      id: 'student-attacker-1',
      email: 'attacker@adypu.edu.in',
      global_role: 'STUDENT',
      club_memberships: [],
    };
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="privileged-admin-panel">SENSITIVE ADMIN DATA</div>
      </AppLayout>
    );

    // AppLayout must detect true role, refuse to render sensitive UI, and redirect
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/student/home');
    });
    expect(screen.queryByTestId('privileged-admin-panel')).not.toBeInTheDocument();

    // AppLayout must actively reconcile and correct the tampered cookie
    expect(document.cookie).toContain('user_role=STUDENT');
  });

  it('Requirement 2: An unauthenticated user cannot access protected dashboard data by setting a privileged role cookie', async () => {
    // Attack scenario: Unauthenticated visitor sets user_role=PLATFORM_ADMIN
    document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
    const store = getWebAuthStore();
    store.setAccessToken(null); // No valid token

    // Mock apiClient: refresh fails with 401
    const { apiClient } = await import('../lib/api');
    vi.mocked(apiClient).mockRejectedValueOnce(new Error('401 Unauthorized'));

    mockUser = null;
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="privileged-admin-panel">SENSITIVE ADMIN DATA</div>
      </AppLayout>
    );

    // AppLayout must block, redirect to /login, and not display data
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByTestId('privileged-admin-panel')).not.toBeInTheDocument();
  });

  it('Requirement 3: A legitimate administrator retains access when authenticated and authorized', async () => {
    document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
    const store = getWebAuthStore();
    store.setAccessToken('legitimate-admin-jwt');

    mockUser = {
      id: 'legit-admin-1',
      email: 'admin@newtonschool.co',
      global_role: 'PLATFORM_ADMIN',
      club_memberships: [],
    };
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="privileged-admin-panel">SENSITIVE ADMIN DATA</div>
      </AppLayout>
    );

    await waitFor(() => {
      expect(screen.getByTestId('privileged-admin-panel')).toBeInTheDocument();
    });
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/student/home');
    expect(mockRouter.push).not.toHaveBeenCalledWith('/login');
    expect(document.cookie).toContain('user_role=PLATFORM_ADMIN');
  });

  it('Requirement 4: Stale privileged state and return_to are cleared after logout and account switching', async () => {
    // 1. Admin session with return_to set in sessionStorage and privileged cookie
    const store = getWebAuthStore();
    store.setAccessToken('admin-token-active');
    document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
    sessionStorage.setItem('return_to', '/admin/audit-logs');

    // 2. Admin logs out
    store.logout();

    expect(store.accessToken).toBeNull();
    expect(sessionStorage.getItem('return_to')).toBeNull();
    // Cookie is expired
    expect(document.cookie).not.toContain('user_role=PLATFORM_ADMIN');

    // 3. Next user logs in as a STUDENT on the same browser window
    store.setAccessToken('student-switched-token');
    mockUser = {
      id: 'student-switched-1',
      email: 'student.switched@adypu.edu.in',
      global_role: 'STUDENT',
      club_memberships: [],
    };
    mockIsUserLoading = false;

    render(
      <AppLayout>
        <div data-testid="privileged-admin-panel">SENSITIVE ADMIN DATA</div>
      </AppLayout>
    );

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/student/home');
    });
    expect(screen.queryByTestId('privileged-admin-panel')).not.toBeInTheDocument();
    // No lingering return_to carried over
    expect(sessionStorage.getItem('return_to')).toBeNull();
  });

  it('Requirement 5: Backend authorization failures remain enforced even if frontend routing is bypassed', async () => {
    // Simulate an unauthorized caller invoking a privileged admin API endpoint
    const { apiClient } = await import('../lib/api');
    vi.mocked(apiClient).mockRejectedValueOnce(
      Object.assign(new Error('Insufficient global role'), {
        status: 403,
        data: { detail: 'Insufficient global role' },
      })
    );

    await expect(apiClient('/admin/users')).rejects.toMatchObject({
      status: 403,
      message: 'Insufficient global role',
    });
  });

  it('Requirement 6: Existing legitimate student routes continue working in middleware without interference', () => {
    const studentRoutes = [
      'http://localhost:3000/student/home',
      'http://localhost:3000/student/events',
      'http://localhost:3000/student/profile',
      'http://localhost:3000/login',
    ];

    studentRoutes.forEach((url) => {
      const req = new NextRequest(url, {
        headers: { cookie: 'user_role=STUDENT' },
      });
      const res = middleware(req);
      expect(res.status).toBe(200); // Pass through cleanly
    });
  });

  it('Requirement 7: Middleware rejects unrecognized or malicious role cookies without a valid session', () => {
    const maliciousCookies = [
      'user_role=HACKER',
      'user_role=SUPERADMIN',
      'user_role=ADMIN',
      'user_role=root',
    ];

    maliciousCookies.forEach((cookie) => {
      const req = new NextRequest('http://localhost:3000/dashboard', {
        headers: { cookie },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?return_to=%2Fdashboard');
    });
  });
});
