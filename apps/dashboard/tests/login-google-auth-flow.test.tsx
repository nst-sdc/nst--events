// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextRequest } from 'next/server';
import { proxy as middleware } from '../proxy';
import LoginPage from '../app/(auth)/login/page';
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
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/login',
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

describe('Google OAuth Login & Destination Preservation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    document.cookie = 'user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    mockSearchParams = new URLSearchParams({ return_to: '/admin/users' });
    mockCurrentUser = null;
    mockIsUserLoading = false;
    getWebAuthStore().setAccessToken(null);
  });

  describe('1. Google sign-in initiation & return_to preservation', () => {
    it('initiates OAuth redirect to API /auth/google and stores return_to in sessionStorage', async () => {
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as any;

      render(<LoginPage />);

      const googleBtn = screen.getByRole('button', { name: /sign in with google/i });
      expect(googleBtn).toBeInTheDocument();

      fireEvent.click(googleBtn);

      expect(window.sessionStorage.getItem('return_to')).toBe('/admin/users');
      expect(window.location.href).toBe('http://localhost:3001/auth/google');

      (window as any).location = originalLocation;
    });

    it('rejects external/malformed return_to destinations and does not store evil targets', async () => {
      mockSearchParams = new URLSearchParams({ return_to: 'https://evil.com/phish' });
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as any;

      render(<LoginPage />);

      const googleBtn = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(googleBtn);

      expect(window.sessionStorage.getItem('return_to')).toBeNull();
      expect(window.location.href).toBe('http://localhost:3001/auth/google');

      (window as any).location = originalLocation;
    });
  });

  describe('2. Error handling & Spinner Reset', () => {
    it('resets spinner and displays non-sensitive error banner when sign-in handler catches an exception', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      const mockLocation = {
        get href() {
          return '';
        },
        set href(_val: string) {
          throw new Error('Network navigation failed');
        },
      };
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: mockLocation,
      });

      render(<LoginPage />);

      const googleBtn = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(googleBtn);

      // Button must NOT remain disabled or permanently spinning
      await waitFor(() => {
        expect(screen.getByText(/sign-in error/i)).toBeInTheDocument();
        expect(screen.getByText(/unable to initiate google sign-in/i)).toBeInTheDocument();
      });

      expect(googleBtn).not.toBeDisabled();
      expect(screen.getByText(/continue with google/i)).toBeInTheDocument();

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    });
  });

  describe('3. Middleware Protection & Role Enforcement', () => {
    it('allows authenticated PLATFORM_ADMIN to access /admin/users', () => {
      const req = new NextRequest('http://localhost:3000/admin/users', {
        headers: { cookie: 'user_role=PLATFORM_ADMIN' },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated users attempting to access /admin/users to /login with return_to', () => {
      const req = new NextRequest('http://localhost:3000/admin/users');
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?return_to=%2Fadmin%2Fusers');
    });

    it('redirects STUDENT users attempting to access /admin/users to /student/home', () => {
      const req = new NextRequest('http://localhost:3000/admin/users', {
        headers: { cookie: 'user_role=STUDENT' },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/student/home');
    });

    it('redirects unrecognized role cookies to /login', () => {
      const req = new NextRequest('http://localhost:3000/admin/users', {
        headers: { cookie: 'user_role=ANONYMOUS_GUEST' },
      });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost:3000/login?return_to=%2Fadmin%2Fusers');
    });
  });

  describe('4. Session hydration & immediate routing for active sessions', () => {
    it('redirects active PLATFORM_ADMIN to /admin/users immediately upon session hydration', async () => {
      const store = getWebAuthStore();
      store.setAccessToken('valid-admin-jwt');
      document.cookie = 'user_role=PLATFORM_ADMIN; path=/';
      mockCurrentUser = {
        id: 'admin-platform',
        email: 'e25b070564@adypu.edu.in',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      };

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/users');
      });
    });
  });
});
