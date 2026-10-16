// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CampusLeaderboardScreen from '../app/(app)/leaderboard';
import { apiClient } from '../src/infrastructure/api';

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
}));

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    canGoBack: () => true,
    replace: vi.fn(),
  }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Phase 7 — Campus Leaderboard', () => {
  let queryClient: QueryClient;

  const mockUserProfile = {
    id: 'user-self',
    full_name: 'Current Student',
    email: 'student@nst.edu',
    global_role: 'STUDENT',
  };

  const mockMyRank = {
    rank: 4,
    total_points: 150,
  };

  const mockStudents = {
    data: [
      {
        rank: 1,
        user_id: 'u-1',
        display_name: 'Ananya Sharma',
        total_points: 320,
      },
      {
        rank: 2,
        user_id: 'u-2',
        display_name: 'Rohan Verma',
        total_points: 280,
      },
      {
        rank: 3,
        user_id: 'u-3',
        display_name: 'Ishaan Gupta',
        total_points: 210,
      },
      {
        rank: 4,
        user_id: 'user-self',
        display_name: 'Current Student',
        total_points: 150,
      },
      {
        rank: 5,
        user_id: 'u-5',
        display_name: 'Neha Roy',
        total_points: 110,
      },
    ],
  };

  const mockClubs = {
    data: [
      {
        rank: 1,
        club_id: 'c-1',
        club_name: 'Developers Club',
        total_points: 950,
        event_count: 12,
        member_count: 45,
      },
      {
        rank: 2,
        club_id: 'c-2',
        club_name: 'Robotics Society',
        total_points: 720,
        event_count: 8,
        member_count: 30,
      },
      {
        rank: 3,
        club_id: 'c-3',
        club_name: 'Design Collective',
        total_points: 540,
        event_count: 5,
        member_count: 22,
      },
      {
        rank: 4,
        club_id: 'c-4',
        club_name: 'Competitive Programming Guild',
        total_points: 400,
        event_count: 4,
        member_count: 18,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('renders student merit standing card with current rank and points', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url === '/users/me') return Promise.resolve(mockUserProfile);
      if (url === '/v1/leaderboard/me') return Promise.resolve(mockMyRank);
      if (url.startsWith('/v1/leaderboard/students')) return Promise.resolve(mockStudents);
      if (url.startsWith('/v1/leaderboard/clubs')) return Promise.resolve(mockClubs);
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusLeaderboardScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('CAMPUS LEADERBOARD')).toBeTruthy();
      expect(screen.getByText('#4')).toBeTruthy();
      expect(screen.getByText('150 PTS')).toBeTruthy();
      expect(screen.getByText('[RANKED]')).toBeTruthy();
    });
  });

  it('renders unranked state in standing card when user has no attendance points', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url === '/users/me') return Promise.resolve(mockUserProfile);
      if (url === '/v1/leaderboard/me') return Promise.resolve({ rank: null, total_points: 0 });
      if (url.startsWith('/v1/leaderboard/students')) return Promise.resolve(mockStudents);
      if (url.startsWith('/v1/leaderboard/clubs')) return Promise.resolve(mockClubs);
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusLeaderboardScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('UNRANKED')).toBeTruthy();
      expect(screen.getByText('[UNRANKED]')).toBeTruthy();
    });
  });

  it('renders top 3 podium cards and marks the current student with YOU badge', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url === '/users/me') return Promise.resolve(mockUserProfile);
      if (url === '/v1/leaderboard/me') return Promise.resolve(mockMyRank);
      if (url.startsWith('/v1/leaderboard/students')) return Promise.resolve(mockStudents);
      if (url.startsWith('/v1/leaderboard/clubs')) return Promise.resolve(mockClubs);
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusLeaderboardScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Podium top 3
      expect(screen.getByText('ANANYA SHARMA')).toBeTruthy();
      expect(screen.getByText('ROHAN VERMA')).toBeTruthy();
      expect(screen.getByText('ISHAAN GUPTA')).toBeTruthy();
      expect(screen.getByText('320 PTS')).toBeTruthy();

      // List rank 4 (self) & rank 5
      expect(screen.getByText('Current Student')).toBeTruthy();
      expect(screen.getByText('YOU')).toBeTruthy();
      expect(screen.getByText('Neha Roy')).toBeTruthy();
    });
  });

  it('switches to CLUBS tab and renders club leaderboard podium and roster', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url === '/users/me') return Promise.resolve(mockUserProfile);
      if (url === '/v1/leaderboard/me') return Promise.resolve(mockMyRank);
      if (url.startsWith('/v1/leaderboard/students')) return Promise.resolve(mockStudents);
      if (url.startsWith('/v1/leaderboard/clubs')) return Promise.resolve(mockClubs);
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusLeaderboardScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('ANANYA SHARMA')).toBeTruthy();
    });

    // Switch to CLUBS tab
    fireEvent.press(screen.getByText('CLUBS'));

    await waitFor(() => {
      expect(screen.getByText('DEVELOPERS CLUB')).toBeTruthy();
      expect(screen.getByText('ROBOTICS SOCIETY')).toBeTruthy();
      expect(screen.getByText('DESIGN COLLECTIVE')).toBeTruthy();
      expect(screen.getByText('Competitive Programming Guild')).toBeTruthy();
      expect(screen.getByText('4 EVENTS // 18 MEMBERS')).toBeTruthy();
    });
  });

  it('renders error state with retry on query failure', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url === '/users/me') return Promise.resolve(mockUserProfile);
      if (url === '/v1/leaderboard/me') return Promise.resolve({ rank: null, total_points: 0 });
      return Promise.reject(new Error('Leaderboard service down'));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusLeaderboardScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("COULDN'T LOAD LEADERBOARD")).toBeTruthy();
      expect(screen.getByText('RETRY ↺')).toBeTruthy();
    });
  });
});
