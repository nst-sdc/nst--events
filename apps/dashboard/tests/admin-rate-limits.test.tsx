// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import AdminRateLimitsPage from '../app/(app)/admin/rate-limits/page';
import * as currentUserHook from '../hooks/useCurrentUser';
import * as rateLimitsHook from '../hooks/useAdminRateLimits';

const mockPush = vi.fn();
const mockReplace = vi.fn();

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

describe('Platform Admin Rate Limits Control Page', () => {
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
        <App>
          <AdminRateLimitsPage />
        </App>
      </QueryClientProvider>
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(
      screen.getByText('Rate Limit Control is strictly restricted to PLATFORM_ADMIN operators.')
    ).toBeInTheDocument();
  });

  it('renders rate limit settings and bounds for PLATFORM_ADMIN', () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'admin-1',
        email: 'admin@nstsdc.org',
        global_role: 'PLATFORM_ADMIN',
        full_name: 'Platform Admin',
      } as any,
      isLoading: false,
    } as any);

    vi.spyOn(rateLimitsHook, 'useRateLimits').mockReturnValue({
      settings: [
        {
          bucket: 'global',
          max: 1000,
          window_ms: 900000,
          floor: 100,
          ceiling: 10000,
          effective_per_replica: 500,
        },
        {
          bucket: 'auth_strict',
          max: 20,
          window_ms: 900000,
          floor: 5,
          ceiling: 500,
          effective_per_replica: 10,
        },
      ],
      replicas: 2,
      windowMs: 900000,
      isLoadingSettings: false,
      isSettingsError: false,
      overrides: [
        {
          id: 'ov-1',
          bucket: 'auth_token',
          action: 'allow',
          custom_max: null,
          target_identifier: null,
          target_ip: '192.168.1.1',
          target_user_id: null,
          reason: 'Load test bypass',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
          created_by_user_id: 'admin-1',
        },
      ],
      isLoadingOverrides: false,
      isOverridesError: false,
      updateSetting: vi.fn(),
      isUpdatingSetting: false,
      resetSettings: vi.fn(),
      isResettingSettings: false,
      createOverride: vi.fn(),
      isCreatingOverride: false,
      deleteOverride: vi.fn(),
      isDeletingOverride: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <App>
          <AdminRateLimitsPage />
        </App>
      </QueryClientProvider>
    );

    expect(screen.getByText('Rate Limits Control')).toBeInTheDocument();
    expect(screen.getByText('Active Rate Limit Buckets')).toBeInTheDocument();
    expect(screen.getByText('global')).toBeInTheDocument();
    expect(screen.getByText('auth_strict')).toBeInTheDocument();
    expect(screen.getByText('Active Temporary Overrides')).toBeInTheDocument();
    expect(screen.getByText('Load test bypass')).toBeInTheDocument();
    expect(screen.getByText('Reset All to Defaults')).toBeInTheDocument();
    expect(screen.getByText('Create Override')).toBeInTheDocument();
  });

  it('opens Create Override modal with user name select', async () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'admin-1',
        email: 'admin@nstsdc.org',
        global_role: 'PLATFORM_ADMIN',
        full_name: 'Platform Admin',
      } as any,
      isLoading: false,
    } as any);

    vi.spyOn(rateLimitsHook, 'useRateLimits').mockReturnValue({
      settings: [],
      replicas: 2,
      windowMs: 900000,
      isLoadingSettings: false,
      isSettingsError: false,
      overrides: [],
      isLoadingOverrides: false,
      isOverridesError: false,
      updateSetting: vi.fn(),
      isUpdatingSetting: false,
      resetSettings: vi.fn(),
      isResettingSettings: false,
      createOverride: vi.fn(),
      isCreatingOverride: false,
      deleteOverride: vi.fn(),
      isDeletingOverride: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <App>
          <AdminRateLimitsPage />
        </App>
      </QueryClientProvider>
    );

    const createBtn = screen.getByText('Create Override');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('Create Temporary Rate Limit Override')).toBeInTheDocument();
    });

    expect(screen.getByText('User (Select by Name)')).toBeInTheDocument();
    expect(screen.getByText('Select User (by Name / Email)')).toBeInTheDocument();
  });
});
