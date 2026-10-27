// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  usePendingInvitations, 
  useSearchInvitees, 
  UnsupportedEndpointError, 
  PendingInvitation,
  InviteeSearchResult
} from '../src/hooks/use-invitations';
import * as apiModule from '../src/infrastructure/api';

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
}));

const renderHookSync: any = renderHook;

describe('Workstream 16: Mobile Invitation Endpoints & Error Distinction', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('1.1: 404 response on /v1/users/me/team-invitations throws UnsupportedEndpointError and is not swallowed into empty array', async () => {
    vi.spyOn(apiModule, 'apiClient').mockRejectedValue({
      status: 404,
      message: 'Route not found',
    });

    const { result } = renderHookSync(() => usePendingInvitations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(UnsupportedEndpointError);
    const err = result.current.error as UnsupportedEndpointError;
    expect(err.isUnsupported).toBe(true);
    expect(err.status).toBe(404);
    expect(err.endpoint).toBe('/v1/users/me/team-invitations');
    // Ensure data is not falsely set to []
    expect(result.current.data).toBeUndefined();
  });

  it('1.2: 500 internal server error propagates as a genuine server failure, not an unsupported endpoint', async () => {
    const serverError = new Error('Database connection failed');
    (serverError as any).status = 500;
    vi.spyOn(apiModule, 'apiClient').mockRejectedValue(serverError);

    const { result } = renderHookSync(() => usePendingInvitations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(serverError);
    expect((result.current.error as any).isUnsupported).toBeUndefined();
    expect(result.current.error).not.toBeInstanceOf(UnsupportedEndpointError);
  });

  it('1.3: Genuine 200 OK empty response returns empty array without throwing error', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue([]);

    const { result } = renderHookSync(() => usePendingInvitations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('1.4: 200 OK with invitation records correctly populates data', async () => {
    const mockInvitations: PendingInvitation[] = [
      {
        invitation_id: 'inv-1',
        status: 'PENDING',
        created_at: '2026-10-27T10:00:00Z',
        expires_at: '2026-11-27T10:00:00Z',
        team: {
          team_id: 'team-1',
          team_name: 'Hack Squad',
          leader_id: 'leader-1',
        },
        event: {
          event_id: 'event-1',
          event_title: 'Hackathon 2026',
        },
        inviter: {
          user_id: 'leader-1',
          full_name: 'Alice Leader',
        },
      },
    ];

    vi.spyOn(apiModule, 'apiClient').mockResolvedValue(mockInvitations);

    const { result } = renderHookSync(() => usePendingInvitations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockInvitations);
  });

  it('2.1: useSearchInvitees skips query when input length < 2', async () => {
    const apiClientSpy = vi.spyOn(apiModule, 'apiClient');

    const { result } = renderHookSync(() => useSearchInvitees('evt-1', 'a'), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(apiClientSpy).not.toHaveBeenCalled();
  });

  it('2.2: useSearchInvitees converts 404 to UnsupportedEndpointError', async () => {
    vi.spyOn(apiModule, 'apiClient').mockRejectedValue({
      status: 404,
      message: 'Not found',
    });

    const { result } = renderHookSync(() => useSearchInvitees('evt-1', 'alice'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(UnsupportedEndpointError);
    expect((result.current.error as UnsupportedEndpointError).isUnsupported).toBe(true);
  });
});
