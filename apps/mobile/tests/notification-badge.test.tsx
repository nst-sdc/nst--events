// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const apiClientMock = vi.fn();

vi.mock('../src/infrastructure/api', () => ({
  apiClient: (...args: any[]) => apiClientMock(...args),
  APP_VERSION: '1.0.0',
}));

vi.mock('../src/sse/manager', () => ({
  SSEManager: class MockSSEManager {
    on = vi.fn();
    connect = vi.fn();
    disconnect = vi.fn();
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    canGoBack: () => false,
    replace: vi.fn(),
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

import { useAuthStore } from '../src/store/auth';
import { MobileShell } from '../src/ui/core/MobileShell';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('Notification Badge Semantics (Aggregate Unread Count)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isLoggedIn: true,
      accessToken: 'test-jwt',
      userId: 'user-1',
    } as any);
  });

  it('displays aggregate unread count returned by GET /v1/notifications/unread-count (unfiltered across all types)', async () => {
    apiClientMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/v1/notifications/unread-count') {
        return Promise.resolve({ unread_count: 5 });
      }
      if (endpoint.startsWith('/v1/notifications')) {
        return Promise.resolve({ data: [], pagination: { has_more: false } });
      }
      return Promise.resolve({});
    });

    await render(
      <MobileShell title="HOME">
        <></>
      </MobileShell>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('[INBOX: 5]')).toBeTruthy();
    });
    expect(apiClientMock).toHaveBeenCalledWith('/v1/notifications/unread-count');
  });

  it('renders plain [INBOX] with no count when unread_count is 0', async () => {
    apiClientMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/v1/notifications/unread-count') {
        return Promise.resolve({ unread_count: 0 });
      }
      return Promise.resolve({ data: [], pagination: { has_more: false } });
    });

    await render(
      <MobileShell title="HOME">
        <></>
      </MobileShell>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('[INBOX]')).toBeTruthy();
    });
  });

  it('degrades gracefully to plain [INBOX] without crashing when unread-count endpoint fails', async () => {
    apiClientMock.mockRejectedValue(new Error('Network unavailable'));

    await render(
      <MobileShell title="HOME">
        <></>
      </MobileShell>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('[INBOX]')).toBeTruthy();
    });
  });
});
