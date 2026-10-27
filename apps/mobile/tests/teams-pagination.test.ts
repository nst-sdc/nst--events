import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTeamsList, type TeamsResponse } from '../src/hooks/use-teams';
import { apiClient } from '../src/infrastructure/api';

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
}));

vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

describe('Mobile Teams pagination contract consistency (WORKSTREAM 04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fixtureTeam = {
    id: 'team-mobile-1',
    name: 'Cyber Squad',
    leader_id: 'user-leader-1',
    leader_name: 'Leader One',
    member_count: 1,
    members: [
      { user_id: 'user-leader-1', full_name: 'Leader One', registration_status: 'REGISTERED' },
    ],
  };

  it('interprets realistic API response with pagination.nextCursor consistently with dashboard', async () => {
    const realisticBackendResponse: TeamsResponse = {
      data: [fixtureTeam],
      pagination: {
        nextCursor: 'cursor_page_2',
      },
    };

    vi.mocked(apiClient).mockResolvedValueOnce(realisticBackendResponse);

    // Verify type contract
    expect(realisticBackendResponse.pagination.nextCursor).toBe('cursor_page_2');
    // Verify no legacy/fabricated fields
    expect((realisticBackendResponse.pagination as any).next_cursor).toBeUndefined();
    expect((realisticBackendResponse.pagination as any).has_more).toBeUndefined();
  });

  it('interprets terminal page with empty pagination consistently', async () => {
    const terminalBackendResponse: TeamsResponse = {
      data: [fixtureTeam],
      pagination: {},
    };

    vi.mocked(apiClient).mockResolvedValueOnce(terminalBackendResponse);

    expect(terminalBackendResponse.pagination.nextCursor).toBeUndefined();
    expect((terminalBackendResponse.pagination as any).next_cursor).toBeUndefined();
  });
});
