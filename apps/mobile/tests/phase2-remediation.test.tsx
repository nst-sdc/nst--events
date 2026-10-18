// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from './mocks/testing-library-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AppHomeScreen from '../app/(app)/(tabs)/index';
import ActivityScreen from '../app/(app)/(tabs)/activity';
import EventScreen from '../app/(app)/events/[id]/index';
import {
  isAdministratorAccount,
  calculateRegistrationWindowStatus,
} from '../src/lib/auth-helpers';
import { apiClient } from '../src/infrastructure/api';
import { useAuthStore } from '../src/store/auth';

const mockPush = vi.fn();
let mockSearchParams: Record<string, string> = { id: 'event-1' };

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock('../src/hooks/use-toast', () => ({
  useToast: () => ({ show: vi.fn() }),
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

describe('Phase 2 Mobile Audit Remediation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = { id: 'event-1' };
    useAuthStore.setState({ userId: 'user-1', isLoggedIn: true });
  });

  // =========================================================================
  // 1. Invitation Navigation
  // =========================================================================
  describe('1. Invitation Navigation Remediation', () => {
    it('routes the Home pending squad invitation banner to Activity tab with tab=invites', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/users/me/team-invitations') {
          return [
            {
              invitation_id: 'inv-1',
              team: { team_id: 't-1', team_name: 'Hack Squad' },
              event: { event_id: 'e-1', event_title: 'Hackathon' },
              inviter: { full_name: 'Jane Doe' },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            },
          ];
        }
        if (url.includes('/events') && !url.includes('/my-registration')) {
          return { data: [] };
        }
        if (url === '/users/me') {
          return {
            id: 'user-1',
            email: 'student@adypu.edu.in',
            global_role: 'STUDENT',
            club_memberships: [],
          };
        }
        return [];
      });

      render(withProviders(<AppHomeScreen />));
      const banner = await screen.findByText(/PENDING SQUAD INVITATION/);
      expect(banner).toBeTruthy();

      fireEvent.press(banner);
      expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/activity?tab=invites');
    });

    it('ActivityScreen activates the INVITES segment when tab=invites param is supplied', async () => {
      mockSearchParams = { tab: 'invites' };

      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/users/me/team-invitations') {
          return [
            {
              invitation_id: 'inv-1',
              team: { team_id: 't-1', team_name: 'Cyber Squad' },
              event: { event_id: 'e-1', event_title: 'Capture The Flag' },
              inviter: { full_name: 'Captain Hook' },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            },
          ];
        }
        if (url.includes('/my-registrations')) return [];
        if (url.includes('/events')) return { pages: [{ data: [] }] };
        if (url.includes('/attendance')) return { pages: [{ data: [] }] };
        if (url.includes('/disputes')) return { pages: [{ data: [] }] };
        if (url.includes('/achievements')) return { achievements: [] };
        if (url === '/users/me') {
          return {
            id: 'user-1',
            email: 'student@adypu.edu.in',
            global_role: 'STUDENT',
            club_memberships: [],
          };
        }
        return [];
      });

      render(withProviders(<ActivityScreen />));
      expect(await screen.findByText('PENDING SQUAD INVITATIONS')).toBeTruthy();
      expect(await screen.findByText('CYBER SQUAD')).toBeTruthy();
      expect(screen.getByText('[ ACCEPT SQUAD ]')).toBeTruthy();
      expect(screen.getByText('[ DECLINE ]')).toBeTruthy();
    });
  });

  // =========================================================================
  // 2. Event Registration Availability & Time Boundaries
  // =========================================================================
  describe('2. Event Registration Availability Time Boundaries', () => {
    const baseNow = new Date('2026-10-17T12:00:00.000Z');
    const opensAt = new Date('2026-10-17T14:00:00.000Z');
    const closesAt = new Date('2026-10-17T18:00:00.000Z');

    it('2a. Before opening (now < start): calculateRegistrationWindowStatus returns UPCOMING', () => {
      const now = new Date('2026-10-17T13:59:59.999Z');
      expect(calculateRegistrationWindowStatus(now, opensAt, closesAt)).toBe('UPCOMING');
    });

    it('2b. At opening boundary (now == start): calculateRegistrationWindowStatus returns OPEN', () => {
      const now = new Date('2026-10-17T14:00:00.000Z');
      expect(calculateRegistrationWindowStatus(now, opensAt, closesAt)).toBe('OPEN');
    });

    it('2c. During window (start < now < end): calculateRegistrationWindowStatus returns OPEN', () => {
      const now = new Date('2026-10-17T16:00:00.000Z');
      expect(calculateRegistrationWindowStatus(now, opensAt, closesAt)).toBe('OPEN');
    });

    it('2d. At closing boundary (now == end): calculateRegistrationWindowStatus returns CLOSED', () => {
      const now = new Date('2026-10-17T18:00:00.000Z');
      expect(calculateRegistrationWindowStatus(now, opensAt, closesAt)).toBe('CLOSED');
    });

    it('2e. After closing (now > end): calculateRegistrationWindowStatus returns CLOSED', () => {
      const now = new Date('2026-10-17T18:00:00.001Z');
      expect(calculateRegistrationWindowStatus(now, opensAt, closesAt)).toBe('CLOSED');
    });

    it('2f. Invalid window (start >= end or missing boundary) returns CLOSED', () => {
      expect(calculateRegistrationWindowStatus(baseNow, closesAt, opensAt)).toBe('CLOSED');
      expect(calculateRegistrationWindowStatus(baseNow, opensAt, opensAt)).toBe('CLOSED');
      expect(calculateRegistrationWindowStatus(baseNow, opensAt, null)).toBe('CLOSED');
      expect(calculateRegistrationWindowStatus(baseNow, null, closesAt)).toBe('CLOSED');
    });

    it('2g. Event detail UI disables registration and displays scheduled status before window opens', async () => {
      const futureOpen = new Date(Date.now() + 3600000).toISOString();
      const futureClose = new Date(Date.now() + 7200000).toISOString();

      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Future Workshop',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            registration_start_time: futureOpen,
            registration_end_time: futureClose,
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NOT_REGISTERED' };
        if (url === '/users/me') {
          return {
            id: 'user-1',
            email: 'student@adypu.edu.in',
            global_role: 'STUDENT',
            club_memberships: [],
          };
        }
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText(/REGISTRATION OPENS/)).toBeTruthy();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull();
    });

    it('2h. Event detail UI allows registration during active open window', async () => {
      const pastOpen = new Date(Date.now() - 3600000).toISOString();
      const futureClose = new Date(Date.now() + 7200000).toISOString();

      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Active Workshop',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            registration_start_time: pastOpen,
            registration_end_time: futureClose,
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NOT_REGISTERED' };
        if (url === '/users/me') {
          return {
            id: 'user-1',
            email: 'student@adypu.edu.in',
            global_role: 'STUDENT',
            club_memberships: [],
          };
        }
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('[ REGISTER FOR EVENT ]')).toBeTruthy();
      expect(screen.queryByText(/REGISTRATION OPENS/)).toBeNull();
      expect(screen.queryByText('REGISTRATION CLOSED')).toBeNull();
    });

    it('2i. Event detail UI disables registration and displays closed status after window closes', async () => {
      const pastOpen = new Date(Date.now() - 7200000).toISOString();
      const pastClose = new Date(Date.now() - 1000).toISOString();

      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Closed Workshop',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            registration_start_time: pastOpen,
            registration_end_time: pastClose,
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NOT_REGISTERED' };
        if (url === '/users/me') {
          return {
            id: 'user-1',
            email: 'student@adypu.edu.in',
            global_role: 'STUDENT',
            club_memberships: [],
          };
        }
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('REGISTRATION CLOSED')).toBeTruthy();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull();
    });
  });

  // =========================================================================
  // 3. Administrative Registration Restrictions
  // =========================================================================
  describe('3. Administrative Registration Restrictions', () => {
    it('3a. Permits eligible student account with no administrative roles', () => {
      const student = {
        global_role: 'STUDENT' as const,
        club_memberships: [{ club_id: 'club-1', role: 'MEMBER' }],
      };
      expect(isAdministratorAccount(student as any)).toBe(false);
    });

    it('3b. Permits student account with CORE_MEMBER role in club', () => {
      const coreMember = {
        global_role: 'STUDENT' as const,
        club_memberships: [{ club_id: 'club-1', role: 'CORE_MEMBER' }],
      };
      expect(isAdministratorAccount(coreMember as any)).toBe(false);
    });

    it('3c. Permits student account with deactivated former club admin membership', () => {
      const formerAdmin = {
        global_role: 'STUDENT' as const,
        club_memberships: [{ club_id: 'club-1', role: 'CLUB_ADMIN', deletedAt: new Date() }],
      };
      expect(isAdministratorAccount(formerAdmin as any)).toBe(false);
    });

    it('3d. Blocks PLATFORM_ADMIN role', () => {
      const admin = {
        global_role: 'PLATFORM_ADMIN' as const,
        club_memberships: [],
      };
      expect(isAdministratorAccount(admin as any)).toBe(true);
    });

    it('3e. Blocks FACULTY_ADMIN role', () => {
      const faculty = {
        global_role: 'FACULTY_ADMIN' as const,
        club_memberships: [],
      };
      expect(isAdministratorAccount(faculty as any)).toBe(true);
    });

    it('3f. Blocks FACULTY_MENTOR role', () => {
      const mentor = {
        global_role: 'FACULTY_MENTOR' as const,
        club_memberships: [],
      };
      expect(isAdministratorAccount(mentor as any)).toBe(true);
    });

    it('3g. Blocks active CLUB_ADMIN role across any club', () => {
      const clubAdmin = {
        global_role: 'STUDENT' as const,
        club_memberships: [{ club_id: 'other-club', role: 'CLUB_ADMIN' }],
      };
      expect(isAdministratorAccount(clubAdmin as any)).toBe(true);
    });

    it('3h. Event detail registration UI blocks PLATFORM_ADMIN and displays restricted notice', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Grand Tech Summit',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NOT_REGISTERED' };
        if (url === '/users/me') {
          return {
            id: 'admin-1',
            email: 'admin@adypu.edu.in',
            global_role: 'PLATFORM_ADMIN',
            club_memberships: [],
          };
        }
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('ACCESS RESTRICTED // ADMINISTRATOR ACCOUNT')).toBeTruthy();
      expect(screen.getByText('ADMINISTRATOR ACCOUNTS CANNOT REGISTER FOR EVENTS')).toBeTruthy();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull();
    });

    it('3i. Event detail registration UI blocks FACULTY_ADMIN and displays restricted notice', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Grand Tech Summit',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NOT_REGISTERED' };
        if (url === '/users/me') {
          return {
            id: 'fac-1',
            email: 'faculty@adypu.edu.in',
            global_role: 'FACULTY_ADMIN',
            club_memberships: [],
          };
        }
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('ACCESS RESTRICTED // ADMINISTRATOR ACCOUNT')).toBeTruthy();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull();
    });

    it('3j. Event detail registration UI blocks CLUB_ADMIN of another club', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Design Workshop',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
            eventClubs: [{ clubId: 'club-robotics', isPrimary: true }],
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NOT_REGISTERED' };
        if (url === '/users/me') {
          return {
            id: 'clubadmin-1',
            email: 'student@adypu.edu.in',
            global_role: 'STUDENT',
            club_memberships: [{ club_id: 'club-coding', role: 'CLUB_ADMIN' }],
          };
        }
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('ACCESS RESTRICTED // ADMINISTRATOR ACCOUNT')).toBeTruthy();
      expect(screen.getByText('ADMINISTRATOR ACCOUNTS CANNOT REGISTER FOR EVENTS')).toBeTruthy();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull();
    });

    it('3k. Event detail registration UI preserves primary club organizer desktop guidance', async () => {
      vi.mocked(apiClient).mockImplementation(async (url: string) => {
        if (url === '/v1/events/event-1') {
          return {
            id: 'event-1',
            title: 'Own Club Event',
            state: 'PUBLISHED',
            registration_type: 'INDIVIDUAL',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            endTime: new Date(Date.now() + 90000000).toISOString(),
            eventClubs: [{ clubId: 'club-primary', isPrimary: true }],
          };
        }
        if (url === '/v1/events/event-1/my-registration') return { status: 'NOT_REGISTERED' };
        if (url === '/users/me') {
          return {
            id: 'organizer-1',
            email: 'student@adypu.edu.in',
            global_role: 'STUDENT',
            club_memberships: [{ club_id: 'club-primary', role: 'CLUB_ADMIN' }],
          };
        }
        return [];
      });

      render(withProviders(<EventScreen />));
      expect(await screen.findByText('ORGANIZER — USE DESKTOP TO MANAGE')).toBeTruthy();
      expect(screen.queryByText('[ REGISTER FOR EVENT ]')).toBeNull();
    });
  });
});
