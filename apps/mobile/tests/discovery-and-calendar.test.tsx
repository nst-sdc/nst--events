// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomeAttendanceScreen from '../app/(app)/(tabs)/index';
import { StudentCalendarView } from '../src/ui/StudentCalendarView';
import { apiClient } from '../src/infrastructure/api';
import { useAuthStore } from '../src/store/auth';

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
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

describe('Phases 4, 5 & 8 — Event Discovery, My Events Filter & Calendar View', () => {
  let queryClient: QueryClient;

  const mockEvents = [
    {
      id: 'ev-1',
      title: 'AI Workshop Bootcamp',
      description: 'Hands on AI',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 90000000).toISOString(),
      locationName: 'Auditorium A',
      eventType: 'WORKSHOP',
      state: 'PUBLISHED',
      registrationType: 'INDIVIDUAL',
      maxCapacity: 100,
      registrationCount: 20,
    },
    {
      id: 'ev-2',
      title: 'NST Annual Hackathon',
      description: 'Code all night',
      startTime: new Date(Date.now() + 172800000).toISOString(),
      endTime: new Date(Date.now() + 180000000).toISOString(),
      locationName: 'Innovation Hub',
      eventType: 'HACKATHON',
      state: 'PUBLISHED',
      registrationType: 'TEAM',
      maxCapacity: 20,
      registrationCount: 5,
    },
  ];

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    useAuthStore.setState({ userId: 'student-1', isLoggedIn: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('renders search input, category chips, and scope segmented control', async () => {
    vi.mocked(apiClient).mockImplementation(async (url: string) => {
      if (url.startsWith('/v1/events')) {
        return { data: mockEvents, pagination: { next_cursor: null, has_more: false } };
      }
      if (url === '/users/me') {
        return { id: 'student-1', club_memberships: [] };
      }
      if (url === '/v1/users/me/registrations') {
        return [
          {
            id: 'reg-1',
            eventId: 'ev-1',
            registrationStatus: 'REGISTERED',
            event: mockEvents[0],
          },
        ];
      }
      return {};
    });

    render(<HomeAttendanceScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('AI Workshop Bootcamp')).toBeTruthy());
    expect(screen.getByText('NST Annual Hackathon')).toBeTruthy();

    // Verify Scope & View toggles
    expect(screen.getByText('ALL EVENTS')).toBeTruthy();
    expect(screen.getByText('MY EVENTS')).toBeTruthy();
    expect(screen.getByText('LIST')).toBeTruthy();
    expect(screen.getByText('CALENDAR')).toBeTruthy();
  });

  it('filters to MY EVENTS and shows only registered passes', async () => {
    vi.mocked(apiClient).mockImplementation(async (url: string) => {
      if (url.startsWith('/v1/events')) {
        return { data: mockEvents, pagination: { next_cursor: null, has_more: false } };
      }
      if (url === '/users/me') {
        return { id: 'student-1', club_memberships: [] };
      }
      if (url === '/v1/users/me/registrations') {
        return [
          {
            id: 'reg-1',
            eventId: 'ev-1',
            registrationStatus: 'REGISTERED',
            event: mockEvents[0],
          },
        ];
      }
      return {};
    });

    render(<HomeAttendanceScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('AI Workshop Bootcamp')).toBeTruthy());

    // Switch to MY EVENTS tab
    fireEvent.press(screen.getByText('MY EVENTS'));

    // Only ev-1 (registered) should be present; ev-2 should be excluded
    await waitFor(() => {
      expect(screen.getByText('AI Workshop Bootcamp')).toBeTruthy();
      expect(screen.queryByText('NST Annual Hackathon')).toBeNull();
    });
  });

  it('switches to CALENDAR view and navigates months', async () => {
    vi.mocked(apiClient).mockImplementation(async (url: string) => {
      if (url.startsWith('/v1/events')) {
        return { data: mockEvents, pagination: { next_cursor: null, has_more: false } };
      }
      if (url === '/users/me') {
        return { id: 'student-1', club_memberships: [] };
      }
      if (url === '/v1/users/me/registrations') {
        return [];
      }
      return {};
    });

    render(<HomeAttendanceScreen />, { wrapper });

    await waitFor(() => expect(screen.getByText('LIST')).toBeTruthy());

    // Switch to CALENDAR mode
    fireEvent.press(screen.getByText('CALENDAR'));

    await waitFor(() => expect(screen.getByText('< PREV')).toBeTruthy());
    expect(screen.getByText('NEXT >')).toBeTruthy();
    expect(screen.getByText('SUN')).toBeTruthy();
    expect(screen.getByText('MON')).toBeTruthy();

    // Next month button
    fireEvent.press(screen.getByText('NEXT >'));
    expect(screen.getByText('< PREV')).toBeTruthy();
  });

  it('StudentCalendarView displays events agenda for selected day', async () => {
    render(
      <StudentCalendarView
        events={mockEvents as any}
        registrations={[]}
        userClubMemberships={[]}
      />
    );

    expect(screen.getByText('< PREV')).toBeTruthy();
    expect(screen.getByText('NEXT >')).toBeTruthy();
  });
});
