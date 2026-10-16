// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MobileEventResultsScreen from '../app/(app)/events/[id]/results';
import ProfileScreen from '../app/(app)/(tabs)/profile';
import { ResultReportModal } from '../src/ui/ResultReportModal';
import { resolveNotificationRoute } from '../src/lib/notification-routing';
import { apiClient } from '../src/infrastructure/api';

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    signOut: vi.fn().mockResolvedValue(null),
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn(),
  },
}));

vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', props, props.name),
  };
});

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    canGoBack: () => true,
    replace: vi.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'event-uuid-1' }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Mobile Event Results & Recognition Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  const mockPublishedResultsResponse = {
    status: 'PUBLISHED',
    event: {
      id: 'event-uuid-1',
      title: 'NST Grand Hackathon 2026',
      slug: 'nst-grand-hackathon-2026',
      start_time: '2026-10-15T09:00:00Z',
    },
    results: {
      revision_number: 1,
      published_at: '2026-10-15T18:00:00Z',
      is_correction: false,
      podium: [
        {
          id: 'award-1',
          title: '1st Place Grand Winner',
          award_type: 'RANKED_PLACEMENT',
          placement: 1,
          is_tied: false,
          recipients: [
            {
              id: 'rec-1',
              recipient_type: 'INDIVIDUAL',
              student: {
                id: 'student-1',
                name: 'Alice Turing',
                program: 'B.Tech CSE AI/ML',
                batch: '2028',
              },
            },
          ],
          project_links: [
            {
              id: 'pl-1',
              type: 'NST_PROJECT',
              project: {
                id: 'proj-1',
                title: 'Autonomous Campus Drone',
                slug: 'autonomous-campus-drone',
              },
            },
          ],
        },
        {
          id: 'award-2',
          title: '2nd Place Team Honor',
          award_type: 'RANKED_PLACEMENT',
          placement: 2,
          is_tied: true,
          recipients: [
            {
              id: 'rec-2',
              recipient_type: 'TEAM',
              team: {
                id: 'team-1',
                name: 'Binary Builders',
              },
              members: [
                { id: 'm-1', name: 'Bob Duo', team_role: 'LEADER' },
                { id: 'm-2', name: 'Charlie Code', team_role: 'MEMBER' },
              ],
            },
            {
              id: 'rec-3',
              recipient_type: 'EXTERNAL',
              external: {
                name: 'Dr. External Innovator',
                details: 'Visiting Research Fellow',
              },
            },
          ],
        },
      ],
      additional_ranked: [],
      special_awards: [
        {
          id: 'award-special',
          title: 'Best Technical Architecture',
          award_type: 'SPECIAL_AWARD',
          display_order: 10,
          is_tied: false,
          recipients: [
            {
              id: 'rec-special',
              recipient_type: 'INDIVIDUAL',
              student: {
                id: 'student-3',
                name: 'Dave Designer',
              },
            },
          ],
        },
      ],
      total_awards: 3,
      total_recipients: 4,
    },
  };

  it('1. Renders published results with podium, individual winner, and recognized team members', async () => {
    (apiClient as any).mockResolvedValueOnce(mockPublishedResultsResponse);

    render(
      <QueryClientProvider client={queryClient}>
        <MobileEventResultsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('NST GRAND HACKATHON 2026')).toBeTruthy();
      expect(screen.getByText('1ST PLACE GRAND WINNER')).toBeTruthy();
      expect(screen.getByText('ALICE TURING')).toBeTruthy();
      expect(screen.getByText('[VERIFIED STUDENT]')).toBeTruthy();
      expect(screen.getByText('BINARY BUILDERS')).toBeTruthy();
      expect(screen.getByText('[REGISTERED TEAM]')).toBeTruthy();
      expect(screen.getByText('• Bob Duo')).toBeTruthy();
      expect(screen.getByText('• Charlie Code')).toBeTruthy();
      expect(screen.getByText('DR. EXTERNAL INNOVATOR')).toBeTruthy();
      expect(screen.getByText('[EXTERNAL / GUEST]')).toBeTruthy();
      expect(screen.getByText('BEST TECHNICAL ARCHITECTURE')).toBeTruthy();
    });
  });

  it('2. Correctly renders tied placement indicators', async () => {
    (apiClient as any).mockResolvedValueOnce(mockPublishedResultsResponse);

    render(
      <QueryClientProvider client={queryClient}>
        <MobileEventResultsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('🥈 2ND PLACE (TIE)')).toBeTruthy();
    });
  });

  it('3. Renders restricted event barrier when unauthenticated', async () => {
    (apiClient as any).mockResolvedValueOnce({
      status: 'UNAUTHENTICATED_RESTRICTED',
      event: {
        id: 'event-uuid-1',
        title: 'Restricted Faculty Event',
      },
      results: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MobileEventResultsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('RESTRICTED EVENT')).toBeTruthy();
      expect(screen.getByText(/restricted to verified institutional members/i)).toBeTruthy();
    });
  });

  it('4. Renders pending notice when results are not yet published (no draft info leaked)', async () => {
    (apiClient as any).mockResolvedValueOnce({
      status: 'NOT_CONFIGURED',
      event: { id: 'event-uuid-1', title: 'Pending Hackathon' },
      results: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MobileEventResultsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('RESULTS PENDING')).toBeTruthy();
      expect(screen.queryByText('PODIUM PLACEMENTS')).toBeNull();
    });
  });

  it('5. Renders withdrawn results notice', async () => {
    (apiClient as any).mockResolvedValueOnce({
      status: 'WITHDRAWN',
      event: { id: 'event-uuid-1', title: 'Withdrawn Hackathon' },
      results: null,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MobileEventResultsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('RESULTS WITHDRAWN')).toBeTruthy();
      expect(screen.queryByText('PODIUM PLACEMENTS')).toBeNull();
    });
  });

  it('6. ResultReportModal validates required fields and submits report', async () => {
    (apiClient as any).mockResolvedValueOnce({ success: true, report_id: 'rep-1' });

    const onClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <ResultReportModal
          isOpen={true}
          onClose={onClose}
          eventId="event-uuid-1"
          eventTitle="Hackathon 2026"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/REPORT INACCURACY/i)).toBeTruthy();

    const subjectInput = screen.getByPlaceholderText(/Unrecognized team member/i);
    const detailsInput = screen.getByPlaceholderText(/Provide full details/i);

    fireEvent.changeText(subjectInput, 'Missing teammate');
    fireEvent.changeText(detailsInput, 'My teammate John was not listed in the recognized members list.');

    const submitBtn = screen.getByText('[ SUBMIT REPORT ]');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith('/v1/events/event-uuid-1/results/report', {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Missing teammate',
          details: 'My teammate John was not listed in the recognized members list.',
        }),
      });
      expect(screen.getByText('REPORT SUBMITTED')).toBeTruthy();
    });
  });

  it('7. Student Profile displays active verified achievements', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          id: 'student-1',
          email: 'alice@adypu.edu.in',
          full_name: 'Alice Turing',
          global_role: 'STUDENT',
          club_memberships: [],
          academic_profile: {
            batch: {
              program: { code: 'BTECH_CSE' },
              graduation_year: 2028,
            },
          },
        });
      }
      if (url.includes('/achievements')) {
        return Promise.resolve({
          achievements: [
            {
              id: 'ach-1',
              award_title: '1st Place Grand Winner',
              award_type: 'RANKED_PLACEMENT',
              placement: 1,
              is_team_award: false,
              published_at: '2026-10-15T18:00:00Z',
              event: {
                id: 'event-uuid-1',
                title: 'NST Grand Hackathon 2026',
                slug: 'nst-grand-hackathon-2026',
              },
              linked_project: {
                id: 'proj-1',
                title: 'Drone Project',
                slug: 'drone-project',
              },
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('OFFICIAL HONORS & ACHIEVEMENTS')).toBeTruthy();
      expect(screen.getByText('1ST PLACE GRAND WINNER')).toBeTruthy();
      expect(screen.getByText(/NST Grand Hackathon 2026/i)).toBeTruthy();
      expect(screen.getByText('[ VIEW RESULTS ]')).toBeTruthy();
    });
  });

  it('8. Notification deep link resolver routes EventResults notifications to results screen', () => {
    const route = resolveNotificationRoute({
      metadata: {
        event_id: 'event-uuid-1',
        screen: 'EventResults',
      },
    });

    expect(route).toBe('/(app)/events/event-uuid-1/results');
  });
});
