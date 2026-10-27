// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeamsList } from '../hooks/useTeams';
import type { TeamsResponse } from '@nst/shared';

describe('useTeamsList infinite pagination contract (WORKSTREAM 04)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.unstubAllGlobals();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const page1Teams = [
    {
      id: 'team-1',
      name: 'Alpha Team',
      leader_id: 'user-1',
      leader_name: 'Alice Leader',
      member_count: 2,
      members: [
        { user_id: 'user-1', full_name: 'Alice Leader', registration_status: 'REGISTERED' },
        { user_id: 'user-2', full_name: 'Bob Member', registration_status: 'REGISTERED' },
      ],
    },
    {
      id: 'team-2',
      name: 'Beta Team',
      leader_id: 'user-3',
      leader_name: 'Charlie Leader',
      member_count: 1,
      members: [
        { user_id: 'user-3', full_name: 'Charlie Leader', registration_status: 'REGISTERED' },
      ],
    },
  ];

  const page2Teams = [
    {
      id: 'team-3',
      name: 'Gamma Team',
      leader_id: 'user-4',
      leader_name: 'Dave Leader',
      member_count: 3,
      members: [
        { user_id: 'user-4', full_name: 'Dave Leader', registration_status: 'REGISTERED' },
      ],
    },
  ];

  it('correctly returns nextCursor when backend response contains pagination.nextCursor', async () => {
    const page1Response: TeamsResponse = {
      data: page1Teams,
      pagination: { nextCursor: 'cursor_page_2' },
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(page1Response),
        headers: new Headers(),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTeamsList('evt-100'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('terminates pagination and sets hasNextPage to false when no next cursor exists', async () => {
    const finalPageResponse: TeamsResponse = {
      data: page1Teams,
      pagination: {}, // Backend omits nextCursor on final page
    };

    const fetchMock = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(finalPageResponse),
        headers: new Headers(),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTeamsList('evt-100'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('loads multi-page results and passes cursor to subsequent page queryParam', async () => {
    const requestedUrls: string[] = [];

    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      requestedUrls.push(url);

      if (url.includes('cursor=cursor_page_2')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: page2Teams,
              pagination: {}, // Final page
            }),
          headers: new Headers(),
        };
      }

      // Page 1
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: page1Teams,
            pagination: { nextCursor: 'cursor_page_2' },
          }),
        headers: new Headers(),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTeamsList('evt-100'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify first page state
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.data?.pages[0].data).toHaveLength(2);
    expect(requestedUrls[0]).toContain('/v1/events/evt-100/teams?limit=20');
    expect(requestedUrls[0]).not.toContain('cursor=');

    // Fetch next page
    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    // Verify second page was requested with cursor
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[1]).toContain('/v1/events/evt-100/teams?limit=20&cursor=cursor_page_2');

    // Verify all teams are accumulated
    const allTeams = result.current.data?.pages.flatMap((p) => p.data) || [];
    expect(allTeams).toHaveLength(3);
    expect(allTeams.map((t) => t.id)).toEqual(['team-1', 'team-2', 'team-3']);

    // Verify final page terminated
    expect(result.current.hasNextPage).toBe(false);

    // Calling fetchNextPage again does not trigger another fetch
    result.current.fetchNextPage();
    expect(requestedUrls).toHaveLength(2);
  });

  it('renders multi-page teams in UI and toggles Load More button based on hasNextPage', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('cursor=cursor_page_2')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: page2Teams,
              pagination: {}, // Final page
            }),
          headers: new Headers(),
        };
      }

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: page1Teams,
            pagination: { nextCursor: 'cursor_page_2' },
          }),
        headers: new Headers(),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    function TestTeamsComponent() {
      const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useTeamsList('evt-100');
      const teams = data?.pages.flatMap((p) => p.data) || [];

      if (isLoading) return <div>Loading teams...</div>;

      return (
        <div>
          <ul>
            {teams.map((t) => (
              <li key={t.id}>{t.name}</li>
            ))}
          </ul>
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading more...' : 'Load More Teams'}
            </button>
          )}
        </div>
      );
    }

    render(<TestTeamsComponent />, { wrapper });

    // Wait for Page 1 to load
    await waitFor(() => expect(screen.getByText('Alpha Team')).toBeTruthy());
    expect(screen.getByText('Beta Team')).toBeTruthy();
    expect(screen.queryByText('Gamma Team')).toBeNull();

    // Load More button should be present
    const loadMoreBtn = screen.getByText('Load More Teams');
    expect(loadMoreBtn).toBeTruthy();

    // Click Load More
    fireEvent.click(loadMoreBtn);

    // Page 2 teams should appear
    await waitFor(() => expect(screen.getByText('Gamma Team')).toBeTruthy());
    expect(screen.getByText('Alpha Team')).toBeTruthy();
    expect(screen.getByText('Beta Team')).toBeTruthy();

    // Load More button should disappear on final page
    expect(screen.queryByText('Load More Teams')).toBeNull();
  });

  it('handles error state properly when initial request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' }),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTeamsList('evt-100'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Internal Server Error');
    expect(result.current.hasNextPage).toBe(false);
  });
});
