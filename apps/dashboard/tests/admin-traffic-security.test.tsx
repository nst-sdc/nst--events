// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminTrafficSecurityPage, { sanitizeCsvField } from '../app/(app)/admin/traffic-security/page';
import * as currentUserHook from '../hooks/useCurrentUser';
import * as trafficSecurityHook from '../hooks/useAdminTrafficSecurity';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: vi.fn(),
  }),
}));

// Mock recharts ResponsiveContainer to avoid size computation in jsdom
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 500, height: 300 }}>{children}</div>,
  };
});

// Mock matchMedia and ResizeObserver for Antd
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

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Platform Admin Traffic & Security Analytics Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('renders 403 access restricted for non-PLATFORM_ADMIN users', () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'student-1',
        email: 'student@nstsdc.org',
        global_role: 'STUDENT',
        full_name: 'Student User',
      } as any,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <AdminTrafficSecurityPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(
      screen.getByText('Traffic & Security Analytics is strictly restricted to PLATFORM_ADMIN operators.')
    ).toBeInTheDocument();
  });

  it('renders stats, breakdown, and auth events for PLATFORM_ADMIN', () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'admin-1',
        email: 'admin@nstsdc.org',
        global_role: 'PLATFORM_ADMIN',
        full_name: 'Platform Admin',
      } as any,
      isLoading: false,
    } as any);

    vi.spyOn(trafficSecurityHook, 'useAuthStats').mockReturnValue({
      data: {
        summary: {
          total_success: 342,
          total_failed: 12,
          total_attempts: 354,
          failure_rate: 3.4,
          dau: 85,
          wau: 210,
        },
        time_series: [
          { timestamp: '2026-11-01T00:00:00Z', success_count: 10, failure_count: 1 },
          { timestamp: '2026-11-01T01:00:00Z', success_count: 15, failure_count: 2 },
        ],
        platform_breakdown: { web: 200, mobile: 154 },
        network_breakdown: { campus: 290, off_campus: 64 },
        top_failure_reasons: [
          { reason: 'INVALID_CREDENTIALS', count: 8 },
          { reason: 'DOMAIN_REJECTED', count: 4 },
        ],
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(trafficSecurityHook, 'useAuthEvents').mockReturnValue({
      data: {
        data: [
          {
            id: 'evt-1',
            user_id: 'user-100',
            user: {
              id: 'user-100',
              email: 'alice@nstsdc.org',
              full_name: 'Alice Smith',
            },
            event_type: 'LOGIN_SUCCESS',
            platform: 'web',
            app_version: '1.0.0',
            user_agent_family: 'Chrome',
            device_class: 'Desktop',
            ip_hash: 'a1b2c3d4e5f67890',
            raw_ip: null,
            network_class: 'campus',
            failure_reason: null,
            created_at: new Date().toISOString(),
          },
        ],
        pagination: {
          next_cursor: null,
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(trafficSecurityHook, 'useUserSessions').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <AdminTrafficSecurityPage />
      </QueryClientProvider>
    );

    expect(screen.getByText('Traffic & Security Analytics')).toBeInTheDocument();
    expect(screen.getByText('Total Logins')).toBeInTheDocument();
    expect(screen.getByText('342')).toBeInTheDocument();
    expect(screen.getByText('Login Failures & Rate')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Authentication Traffic Over Time')).toBeInTheDocument();
    expect(screen.getByText('Top Failure Reasons')).toBeInTheDocument();
    expect(screen.getByText('INVALID_CREDENTIALS')).toBeInTheDocument();
    expect(screen.getByText('Structured Authentication Event Log')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Export Events CSV')).toBeInTheDocument();
  });

  it('escapes CSV cells against formula injection attacks', () => {
    // Formula characters: =, +, -, @, \t, \r
    expect(sanitizeCsvField('=SUM(1+1)')).toBe(`"'=SUM(1+1)"`);
    expect(sanitizeCsvField('+cmd|calc')).toBe(`"'+cmd|calc"`);
    expect(sanitizeCsvField('-123')).toBe(`"'-123"`);
    expect(sanitizeCsvField('@alert')).toBe(`"'@alert"`);
    expect(sanitizeCsvField('\ttabbed')).toBe(`"'\ttabbed"`);
    expect(sanitizeCsvField('\rcarriage')).toBe(`"'\rcarriage"`);
    expect(sanitizeCsvField('normal text')).toBe(`"normal text"`);
    expect(sanitizeCsvField('text "with" quotes')).toBe(`"text ""with"" quotes"`);
    expect(sanitizeCsvField(null)).toBe('""');
    expect(sanitizeCsvField(undefined)).toBe('""');
  });
});
