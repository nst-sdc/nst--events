// @vitest-environment jsdom
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, waitFor } from './mocks/testing-library-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EventRegisterScreen from '../app/(app)/events/[id]/register';
import CampusClubsScreen from '../app/(app)/clubs/index';
import { useSentInvitations } from '../src/hooks/use-invitations';
import { useClubs, useClub } from '../src/hooks/use-clubs';
import { apiClient } from '../src/infrastructure/api';
import { useAuthStore } from '../src/store/auth';

vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', props, props.name),
    Ionicons: (props: any) => React.createElement('Text', props, props.name),
    FontAwesome: (props: any) => React.createElement('Text', props, props.name),
    Feather: (props: any) => React.createElement('Text', props, props.name),
  };
});

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockReplace = vi.fn();
let mockCanGoBack = true;
let mockSearchParams: Record<string, string> = { id: 'event-1' };

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

const mockShowToast = vi.fn();
vi.mock('../src/hooks/use-toast', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const withProviders = (ui: React.ReactElement, queryClient = createQueryClient()) => (
  <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
);

function TestSentInvitations({ eventId, teamId }: { eventId?: string; teamId?: string }) {
  const { data, isSuccess, isError, error, fetchStatus } = useSentInvitations(eventId || '', teamId);
  return (
    <>
      <Text testID="fetch-status">{fetchStatus}</Text>
      {isSuccess && <Text testID="invitations-data">{JSON.stringify(data)}</Text>}
      {isError && <Text testID="invitations-error">{JSON.stringify(error)}</Text>}
    </>
  );
}

function TestClubsHook() {
  const { data, isSuccess } = useClubs();
  return (
    <>
      {isSuccess && <Text testID="clubs-normalized">{JSON.stringify(data)}</Text>}
    </>
  );
}

function TestClubDetailHook({ clubId }: { clubId: string }) {
  const { data, isSuccess } = useClub(clubId);
  return (
    <>
      {isSuccess && <Text testID="club-detail-normalized">{JSON.stringify(data)}</Text>}
    </>
  );
}

describe('Phase 3 Mobile Audit Remediation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanGoBack = true;
    mockSearchParams = { id: 'event-1' };
    useAuthStore.setState({ userId: 'user-1', isLoggedIn: true });
  });

  // =========================================================================
  // 1. Invitation API Endpoint Mismatch
  // =========================================================================
  describe('1. Invitation API endpoint mismatch', () => {
    it('useSentInvitations queries /v1/teams/:teamId/invitations with canonical team route', async () => {
      const mockInvitations = [
        {
          invitation_id: 'inv-1',
          status: 'PENDING',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          team: { team_id: 'team-123', team_name: 'Team Alpha', leader_id: 'user-1' },
          event: { event_id: 'event-1', event_title: 'Hackathon' },
          inviter: { user_id: 'user-1', full_name: 'Leader' },
        },
      ];

      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/teams/team-123/invitations') {
          return mockInvitations;
        }
        throw new Error(`Unexpected endpoint called: ${url}`);
      });

      render(withProviders(<TestSentInvitations eventId="event-1" teamId="team-123" />));

      await waitFor(() => {
        const dataNode = screen.getByTestId('invitations-data');
        expect(dataNode).toBeTruthy();
        expect(JSON.parse(dataNode.textContent || '{}')).toEqual(mockInvitations);
      });

      expect(apiClient).toHaveBeenCalledWith('/v1/teams/team-123/invitations');
    });

    it('useSentInvitations also supports direct teamId parameter', async () => {
      (apiClient as any).mockResolvedValueOnce([]);

      render(withProviders(<TestSentInvitations eventId="team-456" />));

      await waitFor(() => {
        const dataNode = screen.getByTestId('invitations-data');
        expect(dataNode).toBeTruthy();
      });

      expect(apiClient).toHaveBeenCalledWith('/v1/teams/team-456/invitations');
    });

    it('useSentInvitations handles 403 authorization failure when caller is not team leader', async () => {
      (apiClient as any).mockRejectedValueOnce({
        status: 403,
        message: 'Only the team leader can view sent invitations',
      });

      render(withProviders(<TestSentInvitations eventId="event-1" teamId="team-999" />));

      await waitFor(() => {
        const errorNode = screen.getByTestId('invitations-error');
        expect(errorNode).toBeTruthy();
        expect(JSON.parse(errorNode.textContent || '{}')).toEqual({
          status: 403,
          message: 'Only the team leader can view sent invitations',
        });
      });

      expect(apiClient).toHaveBeenCalledWith('/v1/teams/team-999/invitations');
    });

    it('useSentInvitations is disabled and makes no network call when teamId is empty', async () => {
      render(withProviders(<TestSentInvitations eventId="" teamId="" />));

      const statusNode = screen.getByTestId('fetch-status');
      expect(statusNode.textContent).toBe('idle');
      expect(apiClient).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Club Banner Field Casing
  // =========================================================================
  describe('2. Club banner field casing', () => {
    it('useClubs hook normalizes banner_url and bannerUrl from documented snake_case API response', async () => {
      (apiClient as any).mockResolvedValueOnce({
        data: [
          {
            id: 'club-1',
            name: 'Dev Club',
            description: 'Coding society',
            status: 'ACTIVE',
            banner_url: 'https://cdn.example.com/devclub-banner.jpg',
            event_count: 5,
            member_count: 30,
          },
        ],
        pagination: { next_cursor: null, has_more: false },
      });

      render(withProviders(<TestClubsHook />));

      await waitFor(() => {
        const dataNode = screen.getByTestId('clubs-normalized');
        expect(dataNode).toBeTruthy();
        const parsed = JSON.parse(dataNode.textContent || '{}');
        expect(parsed.data[0].banner_url).toBe('https://cdn.example.com/devclub-banner.jpg');
        expect(parsed.data[0].bannerUrl).toBe('https://cdn.example.com/devclub-banner.jpg');
      });
    });

    it('useClubs hook normalizes when API returns camelCase bannerUrl', async () => {
      (apiClient as any).mockResolvedValueOnce({
        data: [
          {
            id: 'club-2',
            name: 'Robotics Club',
            description: 'Robotics society',
            status: 'ACTIVE',
            bannerUrl: 'https://cdn.example.com/robotics-banner.jpg',
            event_count: 2,
            member_count: 12,
          },
        ],
        pagination: { next_cursor: null, has_more: false },
      });

      render(withProviders(<TestClubsHook />));

      await waitFor(() => {
        const dataNode = screen.getByTestId('clubs-normalized');
        expect(dataNode).toBeTruthy();
        const parsed = JSON.parse(dataNode.textContent || '{}');
        expect(parsed.data[0].banner_url).toBe('https://cdn.example.com/robotics-banner.jpg');
        expect(parsed.data[0].bannerUrl).toBe('https://cdn.example.com/robotics-banner.jpg');
      });
    });

    it('useClub hook normalizes banner fields for single club detail', async () => {
      (apiClient as any).mockResolvedValueOnce({
        id: 'club-1',
        name: 'Dev Club',
        description: 'Tech club',
        banner_url: 'https://cdn.example.com/devclub-banner.jpg',
        status: 'ACTIVE',
        event_count: 5,
        members: [],
      });

      render(withProviders(<TestClubDetailHook clubId="club-1" />));

      await waitFor(() => {
        const dataNode = screen.getByTestId('club-detail-normalized');
        expect(dataNode).toBeTruthy();
        const parsed = JSON.parse(dataNode.textContent || '{}');
        expect(parsed.banner_url).toBe('https://cdn.example.com/devclub-banner.jpg');
        expect(parsed.bannerUrl).toBe('https://cdn.example.com/devclub-banner.jpg');
      });
    });

    it('CampusClubsScreen renders club banner image with documented response shape (banner_url)', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/clubs') {
          return {
            data: [
              {
                id: 'club-alpha',
                name: 'Alpha Club',
                description: 'Alpha description',
                status: 'ACTIVE',
                banner_url: 'https://cdn.example.com/alpha-banner.jpg',
                event_count: 4,
                member_count: 20,
              },
            ],
            pagination: { next_cursor: null, has_more: false },
          };
        }
        return { data: [] };
      });

      render(withProviders(<CampusClubsScreen />));

      await waitFor(() => {
        expect(screen.getByText('ALPHA CLUB')).toBeTruthy();
      });

      const bannerImage = screen.getByTestId('club-banner-club-alpha');
      expect(bannerImage).toBeTruthy();
      expect(bannerImage.getAttribute('src')).toBe('https://cdn.example.com/alpha-banner.jpg');
    });

    it('CampusClubsScreen renders placeholder monogram when club banner is null', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/clubs') {
          return {
            data: [
              {
                id: 'club-beta',
                name: 'Beta Society',
                description: 'No banner society',
                status: 'ACTIVE',
                banner_url: null,
                event_count: 1,
                member_count: 10,
              },
            ],
            pagination: { next_cursor: null, has_more: false },
          };
        }
        return { data: [] };
      });

      render(withProviders(<CampusClubsScreen />));

      await waitFor(() => {
        expect(screen.getByText('BETA SOCIETY')).toBeTruthy();
      });

      expect(screen.queryByTestId('club-banner-club-beta')).toBeNull();
      expect(screen.getByText('[ CAMPUS CHAPTER ]')).toBeTruthy();
      expect(screen.getByText('BET')).toBeTruthy();
    });

    it('CampusClubsScreen modal detail renders banner image', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/clubs') {
          return {
            data: [
              {
                id: 'club-gamma',
                name: 'Gamma Society',
                description: 'Gamma description',
                status: 'ACTIVE',
                banner_url: 'https://cdn.example.com/gamma.jpg',
                event_count: 2,
                member_count: 15,
              },
            ],
            pagination: { next_cursor: null, has_more: false },
          };
        }
        if (url === '/clubs/club-gamma') {
          return {
            id: 'club-gamma',
            name: 'Gamma Society',
            description: 'Full gamma description',
            banner_url: 'https://cdn.example.com/gamma.jpg',
            status: 'ACTIVE',
            event_count: 2,
            members: [],
          };
        }
        return {};
      });

      render(withProviders(<CampusClubsScreen />));

      await waitFor(() => {
        expect(screen.getByText('GAMMA SOCIETY')).toBeTruthy();
      });

      // Press card to open modal
      fireEvent.press(screen.getByText('GAMMA SOCIETY'));

      await waitFor(() => {
        const modalBanner = screen.getByTestId('club-modal-banner');
        expect(modalBanner).toBeTruthy();
        expect(modalBanner.getAttribute('src')).toBe('https://cdn.example.com/gamma.jpg');
      });
    });
  });

  // =========================================================================
  // 3. Registration Form Error Feedback
  // =========================================================================
  describe('3. Registration form error feedback', () => {
    const mockFormFields = [
      {
        fieldDefinitionId: 'field-email',
        order: 1,
        isRequired: true,
        fieldDefinition: {
          id: 'field-email',
          label: 'Contact Email',
          fieldType: 'EMAIL',
          required: true,
        },
      },
      {
        fieldDefinitionId: 'field-tshirt',
        order: 2,
        isRequired: false,
        fieldDefinition: {
          id: 'field-tshirt',
          label: 'T-Shirt Size',
          fieldType: 'TEXT',
          required: false,
        },
      },
    ];

    it('displays visible validation error and preserves form when required field is empty', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1/form-fields') {
          return { data: mockFormFields };
        }
        return {};
      });

      render(withProviders(<EventRegisterScreen />));

      await waitFor(() => {
        expect(screen.getByText(/Contact Email/i)).toBeTruthy();
      });

      // Try to submit with required field empty
      const submitBtn = screen.getByText('[ CONFIRM REGISTRATION ]');
      fireEvent.press(submitBtn);

      // Verify visible error banner appears
      await waitFor(() => {
        const banner = screen.getByTestId('registration-error-banner');
        expect(banner).toBeTruthy();
        expect(screen.getByText(/Please answer required question: "Contact Email"/i)).toBeTruthy();
      });

      // Form remains recoverable and button is enabled
      expect(screen.getByText('[ CONFIRM REGISTRATION ]')).toBeTruthy();
    });

    it('displays validation error when field fails client validation format rules', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1/form-fields') {
          return { data: mockFormFields };
        }
        return {};
      });

      render(withProviders(<EventRegisterScreen />));

      await waitFor(() => {
        expect(screen.getByText(/Contact Email/i)).toBeTruthy();
      });

      // Type invalid email address
      const input = document.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      fireEvent.changeText(input, 'not-an-email');

      const submitBtn = screen.getByText('[ CONFIRM REGISTRATION ]');
      fireEvent.press(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('registration-error-banner')).toBeTruthy();
        expect(screen.getByText(/Invalid email address for "Contact Email"/i)).toBeTruthy();
      });

      // Form remains recoverable
      expect(screen.getByText('[ CONFIRM REGISTRATION ]')).toBeTruthy();
    });

    it('displays server error message on 400 failure and keeps form recoverable with typed answers intact', async () => {
      (apiClient as any).mockImplementation(async (url: string, options: any = {}) => {
        if (url === '/v1/events/event-1/form-fields') {
          return { data: mockFormFields };
        }
        if (url === '/v1/events/event-1/register' && options?.method === 'POST') {
          throw {
            status: 400,
            message: 'You have already registered for this event.',
          };
        }
        return {};
      });

      render(withProviders(<EventRegisterScreen />));

      await waitFor(() => {
        expect(screen.getByText(/Contact Email/i)).toBeTruthy();
      });

      const input = document.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      fireEvent.changeText(input, 'student@example.com');

      const submitBtn = screen.getByText('[ CONFIRM REGISTRATION ]');
      fireEvent.press(submitBtn);

      // Verify visible error banner displays the server failure message
      await waitFor(() => {
        expect(screen.getByTestId('registration-error-banner')).toBeTruthy();
        expect(screen.getByText('You have already registered for this event.')).toBeTruthy();
      });

      // Verify form is in recoverable state:
      // 1. Button is re-enabled
      expect(screen.getByText('[ CONFIRM REGISTRATION ]')).toBeTruthy();
      // 2. Typed value is preserved in input
      expect(input.value).toBe('student@example.com');
    });

    it('does NOT leak raw server details or SQL stack traces on 500 server error', async () => {
      (apiClient as any).mockImplementation(async (url: string, options: any = {}) => {
        if (url === '/v1/events/event-1/form-fields') {
          return { data: mockFormFields };
        }
        if (url === '/v1/events/event-1/register' && options?.method === 'POST') {
          throw {
            status: 500,
            message: 'PrismaClientKnownRequestError: SELECT * FROM registrations WHERE id = ... at /prisma/client.js',
          };
        }
        return {};
      });

      render(withProviders(<EventRegisterScreen />));

      await waitFor(() => {
        expect(screen.getByText(/Contact Email/i)).toBeTruthy();
      });

      const input = document.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      fireEvent.changeText(input, 'student@example.com');

      const submitBtn = screen.getByText('[ CONFIRM REGISTRATION ]');
      fireEvent.press(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('registration-error-banner')).toBeTruthy();
        expect(screen.getByText('A server error occurred. Please try again later.')).toBeTruthy();
        expect(screen.queryByText(/Prisma/i)).toBeNull();
        expect(screen.queryByText(/SELECT/i)).toBeNull();
      });
    });

    it('displays helpful offline connection message on network failure', async () => {
      (apiClient as any).mockImplementation(async (url: string, options: any = {}) => {
        if (url === '/v1/events/event-1/form-fields') {
          return { data: mockFormFields };
        }
        if (url === '/v1/events/event-1/register' && options?.method === 'POST') {
          throw { status: 0, message: 'Offline' };
        }
        return {};
      });

      render(withProviders(<EventRegisterScreen />));

      await waitFor(() => {
        expect(screen.getByText(/Contact Email/i)).toBeTruthy();
      });

      const input = document.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      fireEvent.changeText(input, 'student@example.com');

      fireEvent.press(screen.getByText('[ CONFIRM REGISTRATION ]'));

      await waitFor(() => {
        expect(screen.getByTestId('registration-error-banner')).toBeTruthy();
        expect(
          screen.getByText('You appear to be offline. Please check your connection and try again.')
        ).toBeTruthy();
      });
    });

    it('allows successful retry after an initial submission failure', async () => {
      let attempt = 0;
      (apiClient as any).mockImplementation(async (url: string, options: any = {}) => {
        if (url === '/v1/events/event-1/form-fields') {
          return { data: mockFormFields };
        }
        if (url === '/v1/events/event-1/register' && options?.method === 'POST') {
          attempt++;
          if (attempt === 1) {
            throw { status: 400, message: 'Temporary submission error. Please retry.' };
          }
          return { status: 'REGISTERED' };
        }
        return {};
      });

      render(withProviders(<EventRegisterScreen />));

      await waitFor(() => {
        expect(screen.getByText(/Contact Email/i)).toBeTruthy();
      });

      const input = document.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      fireEvent.changeText(input, 'student@example.com');

      // Attempt 1 -> fails
      fireEvent.press(screen.getByText('[ CONFIRM REGISTRATION ]'));

      await waitFor(() => {
        expect(screen.getByTestId('registration-error-banner')).toBeTruthy();
        expect(screen.getByText('Temporary submission error. Please retry.')).toBeTruthy();
      });

      // Attempt 2 -> user retries, submission succeeds
      fireEvent.press(screen.getByText('[ CONFIRM REGISTRATION ]'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalledTimes(1);
      });
    });
  });
});
