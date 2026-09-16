import React from 'react';
import { render, screen, fireEvent, waitFor } from './mocks/testing-library-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppHomeScreen from '../app/(app)/(tabs)/index';
import EventScreen from '../app/(app)/events/[id]/index';
import TeamsScreen from '../app/(app)/events/[id]/teams';
import InvitationsScreen from '../app/(app)/invitations';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: 'event-1', invitationId: 'inv-1' }),
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

import { apiClient } from '../src/infrastructure/api';
import { useAuthStore } from '../src/store/auth';

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const withProviders = (ui: React.ReactElement) => (
  <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>
);

describe('Phase UI-27: Student Event Discovery & Registration UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ userId: 'user-1', isLoggedIn: true });
  });

  describe('Event Feed', () => {
    it('1. Event feed renders events with title and location', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url.includes('/events') && !url.includes('/my-registration')) {
          return {
            data: [{
              id: '1',
              title: 'Tech Talk',
              startTime: new Date(Date.now() + 86400000).toISOString(),
              locationName: 'Auditorium',
              eventType: 'SEMINAR',
              registrationType: 'INDIVIDUAL',
              audience: 'ALL_STUDENTS',
              state: 'PUBLISHED',
            }],
            pagination: { has_more: false },
          };
        }
        if (url === '/users/me') return { id: 'user-1', club_memberships: [] };
        if (url.includes('/my-registrations')) return { data: [], pagination: { has_more: false } };
        if (url.includes('/unread-count')) return { unread_count: 0 };
        return [];
      });
      render(withProviders(<AppHomeScreen />));
      expect(await screen.findByText('Tech Talk')).toBeTruthy();
      expect(screen.getByText('AUDITORIUM')).toBeTruthy();
    });

    it('2. Event feed empty state', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url.includes('/events') && !url.includes('/my-registration')) {
          return { data: [], pagination: { has_more: false } };
        }
        if (url === '/users/me') return { id: 'user-1', club_memberships: [] };
        if (url.includes('/my-registrations')) return { data: [], pagination: { has_more: false } };
        if (url.includes('/unread-count')) return { unread_count: 0 };
        return [];
      });
      render(withProviders(<AppHomeScreen />));
      expect(await screen.findByText('NO SESSIONS')).toBeTruthy();
      expect(screen.getByText('Check back later when an event session begins.')).toBeTruthy();
    });
  });

  describe('Event Detail & Registration Interactions', () => {
    it('3. Event detail loads & opens confirmation modal on Register click', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Workshop',
            state: 'PUBLISHED',
            audience: 'ALL_STUDENTS',
            registration_type: 'INDIVIDUAL',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
            locationName: 'Hall B',
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NONE' };
        if (url === '/v1/events/event-1/register') return { id: 'reg-1', status: 'REGISTERED' };
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('WORKSHOP')).toBeTruthy();
      expect(screen.getByText('HALL B')).toBeTruthy();

      const registerBtn = screen.getByText('[ REGISTER FOR EVENT ]');
      expect(registerBtn).toBeTruthy();

      // Open Modal
      fireEvent.press(registerBtn);
      expect(await screen.findByText('CONFIRM REGISTRATION')).toBeTruthy();
      expect(screen.getByText(/reserves an individual attendance slot/i)).toBeTruthy();

      // Confirm in Modal
      const confirmBtn = screen.getByText('[ CONFIRM & SECURE PASS ]');
      fireEvent.press(confirmBtn);

      await waitFor(() => {
        expect(apiClient).toHaveBeenCalledWith('/v1/events/event-1/register', { method: 'POST' });
      });
    });

    it('4. REGISTERED state shows Cancel Registration and opens cancellation modal', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Workshop',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'REGISTERED' };
        if (url === '/v1/events/event-1/register') return { success: true };
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('REGISTERED')).toBeTruthy();

      const cancelBtn = screen.getByText('[ CANCEL REGISTRATION ]');
      expect(cancelBtn).toBeTruthy();

      // Open Cancellation Modal
      fireEvent.press(cancelBtn);
      expect(await screen.findByText('CANCEL ENTRY PASS')).toBeTruthy();
      expect(screen.getByText(/Are you sure you want to cancel your event registration/i)).toBeTruthy();

      // Confirm cancellation
      const confirmCancelBtn = screen.getByText('[ YES, CANCEL REGISTRATION ]');
      fireEvent.press(confirmCancelBtn);

      await waitFor(() => {
        expect(apiClient).toHaveBeenCalledWith('/v1/events/event-1/register', { method: 'DELETE' });
      });
    });

    it('5. WAITLISTED state shows Leave Waitlist and opens waitlist-specific modal', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Workshop',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'WAITLISTED', waitlist_position: 3 };
        if (url === '/v1/events/event-1/register') return { success: true };
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('WAITLISTED')).toBeTruthy();

      const leaveWaitlistBtn = screen.getByText('[ LEAVE WAITLIST ]');
      expect(leaveWaitlistBtn).toBeTruthy();

      // Open Leave Waitlist Modal
      fireEvent.press(leaveWaitlistBtn);
      expect(await screen.findByText('LEAVE WAITLIST QUEUE')).toBeTruthy();
      expect(screen.getByText(/You will give up your current position in line/i)).toBeTruthy();

      // Confirm leave waitlist
      const confirmLeaveBtn = screen.getByText('[ YES, LEAVE WAITLIST ]');
      fireEvent.press(confirmLeaveBtn);

      await waitFor(() => {
        expect(apiClient).toHaveBeenCalledWith('/v1/events/event-1/register', { method: 'DELETE' });
      });
    });

    it('6. Event lock hides mutation buttons', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Workshop',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            is_locked: true,
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'REGISTERED' };
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('EVENT LOCKED')).toBeTruthy();
      expect(screen.queryByText('[ CANCEL REGISTRATION ]')).toBeNull();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull();
    });
  });

  describe('Team Management', () => {
    it('7. TEAM event shows Squad Details button and rules', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Hackathon',
            state: 'PUBLISHED',
            registration_type: 'TEAM',
            metadata: { minimum_team_size: 2, maximum_team_size: 4 },
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NONE' };
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('TEAM REQUIREMENTS')).toBeTruthy();
      expect(screen.getByText(/Minimum: 2 • Maximum: 4/)).toBeTruthy();
      expect(screen.getByText('[ SQUAD DETAILS & RULES ]')).toBeTruthy();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull();
    });

    it('8. TeamsScreen renders desktop portal restriction notice', async () => {
      render(withProviders(<TeamsScreen />));
      expect(await screen.findByText('TEAM FORMATION & ROSTER')).toBeTruthy();
      expect(screen.getByText(/restricted to the desktop web application/i)).toBeTruthy();
      expect(screen.getByText('ACCESS VIA WEB DASHBOARD')).toBeTruthy();
    });
  });

  describe('Invitations', () => {
    it('9. Invitation deep link highlights target invitation', async () => {
      (apiClient as any).mockImplementation(async (url: string) => {
        if (url === '/v1/users/me/team-invitations') {
          return [
            {
              invitation_id: 'inv-1',
              team: { team_id: 't-1', team_name: 'Alpha Squad' },
              event: { event_id: 'e-1', event_title: 'Hackathon' },
              inviter: { full_name: 'John Doe' },
              expires_at: new Date(Date.now() + 100000).toISOString(),
            },
            {
              invitation_id: 'inv-2',
              team: { team_id: 't-2', team_name: 'Beta Squad' },
              event: { event_id: 'e-2', event_title: 'Workshop' },
              inviter: { full_name: 'Jane Doe' },
              expires_at: new Date(Date.now() + 100000).toISOString(),
            },
          ];
        }
        return [];
      });

      render(withProviders(<InvitationsScreen />));
      // Only inv-1 should be rendered due to invitationId deep link in mock
      expect(await screen.findByText('ALPHA SQUAD')).toBeTruthy();
      expect(screen.queryByText('BETA SQUAD')).toBeNull();
      expect(screen.getByText('ACCEPT')).toBeTruthy();
      expect(screen.getByText('DECLINE')).toBeTruthy();
    });
  });
});
