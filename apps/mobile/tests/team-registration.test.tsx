import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventScreen from '../app/(app)/events/[id]/index';
import TeamsScreen from '../app/(app)/events/[id]/teams';
import InvitationsScreen from '../app/(app)/invitations';
import { useAuthStore } from '../src/store/auth';
import { apiClient } from '../src/infrastructure/api';

// Mock dependencies
vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'event-1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), canGoBack: () => false, replace: vi.fn() }),
}));

vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

const createTestQueryClient = () => new QueryClient({
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
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  describe('EventScreen (index.tsx)', () => {
    it('shows Team Requirements and Squad Details button for team events', async () => {
      vi.mocked(apiClient).mockImplementation(async (url) => {
        if (url === '/v1/events/event-1') {
          return { id: 'event-1', title: 'Hackathon', registration_type: 'TEAM', state: 'PUBLISHED', metadata: { minimum_team_size: 2, maximum_team_size: 4 } };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'UNREGISTERED' };
        }
        return {};
      });

      render(<EventScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('TEAM REQUIREMENTS')).toBeTruthy());
      expect(screen.getByText('[ SQUAD DETAILS & RULES ]')).toBeTruthy();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull(); // No solo individual register
    });

    it('shows Event Locked if event is locked', async () => {
      vi.mocked(apiClient).mockImplementation(async (url) => {
        if (url === '/v1/events/event-1') {
          return { id: 'event-1', registration_type: 'TEAM', state: 'PUBLISHED', is_locked: true };
        }
        if (url === '/v1/events/event-1/my-registration') {
          return { status: 'UNREGISTERED' };
        }
        return {};
      });

      render(<EventScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('EVENT LOCKED')).toBeTruthy());
    });
  });

  describe('TeamsScreen', () => {
    it('renders desktop portal notice for team roster and management', async () => {
      render(<TeamsScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('TEAM FORMATION & ROSTER')).toBeTruthy());
      expect(screen.getByText(/restricted to the desktop web application/i)).toBeTruthy();
      expect(screen.getByText('ACCESS VIA WEB DASHBOARD')).toBeTruthy();
    });
  });

  describe('InvitationsScreen', () => {
    it('displays pending invitations and handles expiry', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      vi.mocked(apiClient).mockImplementation(async (url) => {
        if (url === '/v1/users/me/team-invitations') return [
          {
            invitation_id: 'inv-1',
            status: 'PENDING',
            expires_at: futureDate.toISOString(),
            team: { team_id: 't-1', team_name: 'Future Team' },
            event: { event_id: 'e-1', event_title: 'Event A' },
            inviter: { full_name: 'Inviter' }
          },
          {
            invitation_id: 'inv-2',
            status: 'PENDING',
            expires_at: pastDate.toISOString(),
            team: { team_id: 't-2', team_name: 'Expired Team' },
            event: { event_id: 'e-1', event_title: 'Event A' },
            inviter: { full_name: 'Inviter' }
          }
        ];
        return [];
      });

      render(<InvitationsScreen />, { wrapper });
      await waitFor(() => expect(screen.getByText('FUTURE TEAM')).toBeTruthy());
      
      expect(screen.getByText('EXPIRED TEAM')).toBeTruthy();
      expect(screen.getByText('INVITATION EXPIRED')).toBeTruthy();
      
      // Should have Accept/Decline for the non-expired one
      expect(screen.getAllByText('ACCEPT')).toHaveLength(1);
      expect(screen.getAllByText('DECLINE')).toHaveLength(1);
    });
  });
});
