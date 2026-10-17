/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TeamHubPage from '../app/(student)/student/events/[id]/team/page';
import * as useCurrentUserHook from '../hooks/useCurrentUser';
import * as useEventDetailHook from '../hooks/useEventDetail';
import * as useTeamsHook from '../hooks/useTeams';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn().mockReturnValue('/student/events/evt-team-1/team'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

vi.mock('../hooks/useCurrentUser');
vi.mock('../hooks/useEventDetail');
vi.mock('../hooks/useTeams');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('Team Hub Contract & Navigation Guard (FINDING-CONTRACT-01)', () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: pushMock });

    // Mock current user as eligible student
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'student-user-1',
        email: 'student@adypu.edu.in',
        full_name: 'Alex Student',
        global_role: 'STUDENT',
        club_memberships: [],
      },
      isLoading: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useTransferLeadership').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  it('1. Eligible student reaches Team Hub for TEAM event without redirect', async () => {
    // Mock team event detail
    vi.spyOn(useEventDetailHook, 'useEventDetail').mockReturnValue({
      data: {
        id: 'evt-team-1',
        title: 'Hackathon 2026',
        registrationType: 'TEAM',
        registration_type: 'TEAM',
        maxCapacity: 20,
        maxParticipants: 80,
        participantCount: 4,
        registrationCount: 4,
        lock_state: 'UNLOCKED',
        lock_deadline: new Date(Date.now() + 86400000).toISOString(),
        lockDeadline: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        metadata: { minimum_team_size: 2, maximum_team_size: 4 },
      },
      isLoading: false,
    } as any);

    // Mock registration with team
    vi.spyOn(useEventDetailHook, 'useMyRegistration').mockReturnValue({
      data: {
        id: 'reg-1',
        event_id: 'evt-team-1',
        user_id: 'student-user-1',
        team_id: 'team-alpha-1',
        registration_status: 'REGISTERED',
      },
      isLoading: false,
    } as any);

    // Mock team lookup
    vi.spyOn(useTeamsHook, 'useTeamLookup').mockReturnValue({
      data: {
        id: 'team-alpha-1',
        name: 'Alpha Squad',
        leader_id: 'student-user-1',
        status: 'REGISTERED',
        member_count: 2,
        members: [
          { user_id: 'student-user-1', user: { full_name: 'Alex Student', email: 'student@adypu.edu.in' } },
          { user_id: 'student-user-2', user: { full_name: 'Sam Teammate', email: 'sam@adypu.edu.in' } },
        ],
      },
      isLoading: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useLeaveTeam').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    renderWithProviders(<TeamHubPage params={{ id: 'evt-team-1' }} />);

    // Should NOT redirect
    expect(pushMock).not.toHaveBeenCalled();

    // Proves eligible student reaches Team Hub and sees Squad Headquarters
    expect(screen.getByText(/SQUAD HEADQUARTERS \/\//i)).toBeInTheDocument();
    expect(screen.getByText('Alpha Squad')).toBeInTheDocument();
    expect(screen.getByText(/Squad Roster/i)).toBeInTheDocument();
  });

  it('2. Non-team event (INDIVIDUAL) automatically redirects student to Event Dossier', async () => {
    // Mock individual event detail
    vi.spyOn(useEventDetailHook, 'useEventDetail').mockReturnValue({
      data: {
        id: 'evt-indiv-1',
        title: 'Solo Workshop',
        registrationType: 'INDIVIDUAL',
        registration_type: 'INDIVIDUAL',
        maxCapacity: 50,
        maxParticipants: 50,
        participantCount: 10,
        registrationCount: 10,
        lock_state: 'UNLOCKED',
        lockDeadline: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
      },
      isLoading: false,
    } as any);

    vi.spyOn(useEventDetailHook, 'useMyRegistration').mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useTeamLookup').mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useLeaveTeam').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    renderWithProviders(<TeamHubPage params={{ id: 'evt-indiv-1' }} />);

    await waitFor(() => {
      // Must redirect to event dossier
      expect(pushMock).toHaveBeenCalledWith('/student/events/evt-indiv-1');
    });

    // Does not render squad command
    expect(screen.queryByText('SQUAD COMMAND //')).not.toBeInTheDocument();
  });
});
