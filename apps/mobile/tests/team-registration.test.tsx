// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventScreen from '../app/(app)/events/[id]/index';
import TeamsScreen from '../app/(app)/events/[id]/teams';
import InvitationsScreen from '../app/(app)/invitations';
import { TeamGatewayModal } from '../src/ui/TeamGatewayModal';
import { useAuthStore } from '../src/store/auth';
import { apiClient } from '../src/infrastructure/api';

// Mock dependencies
vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
}));

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'event-1' }),
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    canGoBack: () => true,
    replace: vi.fn(),
  }),
}));

vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Mobile Team Workflow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    useAuthStore.setState({ userId: 'student-1', isLoggedIn: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('EventScreen (index.tsx)', () => {
    it('shows Team Requirements, dual capacity indicators, and Create or Join Squad for unregistered team events', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Hackathon',
            registration_type: 'TEAM',
            registrationType: 'TEAM',
            state: 'PUBLISHED',
            maxCapacity: 10,
            registrationCount: 4,
            maxParticipants: 40,
            participantCount: 16,
            metadata: { minimum_team_size: 2, maximum_team_size: 4 },
          };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'NOT_REGISTERED' };
        }
        if (url === '/v1/events/event-1/form-fields') {
          return { data: [] };
        }
        if (url === '/v1/users/me/profile-values') {
          return { data: [] };
        }
        return {};
      });

      render(<EventScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('TEAM REQUIREMENTS')).toBeTruthy());
      expect(screen.getByText('[ CREATE OR JOIN SQUAD ]')).toBeTruthy();
      expect(screen.getByText('TEAM LIMIT')).toBeTruthy();
      expect(screen.getByText('PARTICIPANTS')).toBeTruthy();
      expect(screen.getByText('4 / 10')).toBeTruthy();
      expect(screen.getByText('16 / 40')).toBeTruthy();
    });

    it('shows Participant Capacity Full when max participants limit is reached', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Full Hackathon',
            registration_type: 'TEAM',
            registrationType: 'TEAM',
            state: 'PUBLISHED',
            maxCapacity: 10,
            registrationCount: 2,
            maxParticipants: 8,
            participantCount: 8,
            metadata: { minimum_team_size: 2, maximum_team_size: 4 },
          };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'NOT_REGISTERED' };
        }
        return {};
      });

      render(<EventScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('[ PARTICIPANT CAPACITY FULL ]')).toBeTruthy());
    });

    it('shows Squad Command / Hub button for registered team event', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Hackathon',
            registration_type: 'TEAM',
            registrationType: 'TEAM',
            state: 'PUBLISHED',
            maxCapacity: 10,
            registrationCount: 4,
          };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'REGISTERED', team_id: 'team-1' };
        }
        return {};
      });

      render(<EventScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('[ SQUAD COMMAND / HUB ]')).toBeTruthy());
    });

    it('shows Event Locked if event is locked', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            registration_type: 'TEAM',
            registrationType: 'TEAM',
            state: 'PUBLISHED',
            is_locked: true,
          };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'NOT_REGISTERED' };
        }
        return {};
      });

      render(<EventScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('EVENT LOCKED')).toBeTruthy());
    });
  });

  describe('TeamGatewayModal', () => {
    it('allows switching to Create Squad and creates team with responses', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string, opts?: any) => {
        if (url === '/v1/events/event-1/form-fields') {
          return {
            data: [
              {
                eventId: 'event-1',
                fieldDefinitionId: 'field-1',
                isRequired: true,
                order: 1,
                fieldDefinition: {
                  id: 'field-1',
                  label: 'Project Link',
                  fieldType: 'TEXT',
                  options: null,
                },
              },
            ],
          };
        }
        if (url === '/v1/users/me/profile-values') {
          return { data: [] };
        }
        if (url === '/v1/events/event-1/teams?limit=50') {
          return { data: [], pagination: {} };
        }
        if (url === '/v1/events/event-1/teams' && opts?.method === 'POST') {
          return { team_id: 'team-123', name: 'Alpha Squad', leader_id: 'student-1' };
        }
        return {};
      });

      render(
        <TeamGatewayModal
          eventId="event-1"
          isOpen={true}
          onClose={vi.fn()}
        />,
        { wrapper }
      );

      await waitFor(() => expect(screen.getByText('+ CREATE A SQUAD')).toBeTruthy());
      fireEvent.press(screen.getByText('+ CREATE A SQUAD'));

      await waitFor(() => expect(screen.getByText('SQUAD NAME *')).toBeTruthy());
      expect(screen.getByText('PROJECT LINK *')).toBeTruthy();
    });

    it('allows switching to Join Squad and selecting an open team', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1/teams?limit=50') {
          return {
            data: [
              {
                id: 'team-42',
                name: 'Cyber Ninjas',
                leader_id: 'lead-1',
                leader_name: 'Cipher Master',
                member_count: 2,
                members: [],
              },
            ],
            pagination: {},
          };
        }
        if (url === '/v1/events/event-1/form-fields') {
          return { data: [] };
        }
        if (url === '/v1/users/me/profile-values') {
          return { data: [] };
        }
        return {};
      });

      render(
        <TeamGatewayModal
          eventId="event-1"
          isOpen={true}
          onClose={vi.fn()}
        />,
        { wrapper }
      );

      await waitFor(() => expect(screen.getByText('→ JOIN EXISTING SQUAD')).toBeTruthy());
      fireEvent.press(screen.getByText('→ JOIN EXISTING SQUAD'));

      await waitFor(() => expect(screen.getByText('Cyber Ninjas')).toBeTruthy());
      expect(screen.getByText(/Cipher Master/)).toBeTruthy();
    });
  });

  describe('TeamsScreen (Squad Hub)', () => {
    it('renders empty state when user is not enrolled in a squad', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return { id: 'event-1', title: 'Hackathon', registration_type: 'TEAM' };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'NOT_REGISTERED', team_id: null };
        }
        return {};
      });

      render(<TeamsScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('NO SQUAD ENROLLMENT')).toBeTruthy());
      expect(screen.getByText('[ RETURN TO EVENT ]')).toBeTruthy();
    });

    it('renders squad details, roster, and leader command controls for squad leader', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Hackathon Grand Prix',
            registration_type: 'TEAM',
            metadata: { minimum_team_size: 2, maximum_team_size: 4 },
          };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'REGISTERED', team_id: 'team-100' };
        }
        if (url === '/v1/teams/team-100') {
          return {
            id: 'team-100',
            name: 'Delta Force',
            leader_id: 'student-1',
            leader_name: 'Lead Student',
            status: 'REGISTERED',
            member_count: 2,
            members: [
              { user_id: 'student-1', full_name: 'Lead Student', registration_status: 'REGISTERED' },
              { user_id: 'student-2', full_name: 'Operative Two', registration_status: 'REGISTERED' },
            ],
          };
        }
        return {};
      });

      render(<TeamsScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('DELTA FORCE')).toBeTruthy());
      expect(screen.getByText('Operative Two')).toBeTruthy();
      expect(screen.getByText('[LEADER]')).toBeTruthy();
      expect(screen.getByText('[YOU]')).toBeTruthy();

      // Leader command controls
      expect(screen.getByText('[ INVITE OPERATIVE ]')).toBeTruthy();
      expect(screen.getByText('[ TRANSFER LEADERSHIP ]')).toBeTruthy();
      expect(screen.getByText('[REMOVE]')).toBeTruthy();
      expect(screen.getByText('[ LEAVE SQUAD ]')).toBeTruthy();
    });
  });

  describe('InvitationsScreen', () => {
    it('displays pending invitations and handles expiry', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/users/me/team-invitations') {
          return [
            {
              invitation_id: 'inv-1',
              status: 'PENDING',
              expires_at: futureDate.toISOString(),
              team: { team_id: 't-1', team_name: 'Future Team' },
              event: { event_id: 'e-1', event_title: 'Event A' },
              inviter: { full_name: 'Inviter' },
            },
            {
              invitation_id: 'inv-2',
              status: 'PENDING',
              expires_at: pastDate.toISOString(),
              team: { team_id: 't-2', team_name: 'Expired Team' },
              event: { event_id: 'e-1', event_title: 'Event A' },
              inviter: { full_name: 'Inviter' },
            },
          ];
        }
        return [];
      });

      render(<InvitationsScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('FUTURE TEAM')).toBeTruthy());

      expect(screen.getByText('EXPIRED TEAM')).toBeTruthy();
      expect(screen.getByText('INVITATION EXPIRED')).toBeTruthy();

      expect(screen.getAllByText('ACCEPT')).toHaveLength(1);
      expect(screen.getAllByText('DECLINE')).toHaveLength(1);
    });
  });
});
