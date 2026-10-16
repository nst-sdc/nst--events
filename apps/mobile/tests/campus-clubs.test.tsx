// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CampusClubsScreen from '../app/(app)/clubs/index';
import { apiClient } from '../src/infrastructure/api';

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
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
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Phase 6 — Campus Club Directory', () => {
  let queryClient: QueryClient;

  const mockClubsResponse = {
    data: [
      {
        id: 'club-1',
        name: 'Developers Club',
        description: 'Software development and hackathon team',
        status: 'ACTIVE',
        banner_url: 'https://cdn.example.com/devclub.png',
        event_count: 8,
        member_count: 24,
      },
      {
        id: 'club-2',
        name: 'Robotics Society',
        description: 'Hardware, firmware, and autonomous robotics',
        status: 'ACTIVE',
        banner_url: null,
        event_count: 3,
        member_count: 15,
      },
    ],
    pagination: {
      next_cursor: null,
      has_more: false,
    },
  };

  const mockClubDetail = {
    id: 'club-1',
    name: 'Developers Club',
    description: 'Software development and hackathon team at NST',
    banner_url: 'https://cdn.example.com/devclub.png',
    status: 'ACTIVE',
    event_count: 8,
    members: [
      {
        user_id: 'u-1',
        full_name: 'Aarav Sharma',
        role: 'LEAD',
        avatar_url: null,
      },
      {
        user_id: 'u-2',
        full_name: 'Priya Patel',
        role: 'TECH_HEAD',
        avatar_url: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('renders the campus clubs directory list with branding and counts', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url === '/clubs') {
        return Promise.resolve(mockClubsResponse);
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusClubsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('STUDENT CLUBS')).toBeTruthy();
      expect(screen.getByText('DEVELOPERS CLUB')).toBeTruthy();
      expect(screen.getByText('ROBOTICS SOCIETY')).toBeTruthy();
      expect(screen.getByText('[ 8 EVENTS ]')).toBeTruthy();
      expect(screen.getByText('[ 24 MEMBERS ]')).toBeTruthy();
      expect(screen.getByText('2 COLLECTIVES FOUND')).toBeTruthy();
    });
  });

  it('searches clubs when query is typed and triggers endpoint with query', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url.includes('/clubs/search?q=Robo')) {
        return Promise.resolve({
          data: [mockClubsResponse.data[1]],
          pagination: { next_cursor: null, has_more: false },
        });
      }
      if (url === '/clubs') {
        return Promise.resolve(mockClubsResponse);
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusClubsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('DEVELOPERS CLUB')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Search clubs by name, domain, keywords...');
    fireEvent.changeText(searchInput, 'Robo');

    await waitFor(() => {
      expect(screen.getByText('ROBOTICS SOCIETY')).toBeTruthy();
      expect(screen.queryByText('DEVELOPERS CLUB')).toBeNull();
      expect(screen.getByText('1 COLLECTIVE FOUND')).toBeTruthy();
    });
  });

  it('opens club profile modal and shows leadership roster and details', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url === '/clubs') {
        return Promise.resolve(mockClubsResponse);
      }
      if (url === '/clubs/club-1') {
        return Promise.resolve(mockClubDetail);
      }
      return Promise.resolve({});
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusClubsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('DEVELOPERS CLUB')).toBeTruthy();
    });

    // Press card to open details modal
    fireEvent.press(screen.getAllByText('VIEW PROFILE & ROSTER →')[0]);

    await waitFor(() => {
      expect(screen.getByText('LEADERSHIP & CORE TEAM')).toBeTruthy();
      expect(screen.getByText('Aarav Sharma')).toBeTruthy();
      expect(screen.getByText('[LEAD]')).toBeTruthy();
      expect(screen.getByText('Priya Patel')).toBeTruthy();
      expect(screen.getByText('[TECH_HEAD]')).toBeTruthy();
    });
  });

  it('displays empty state when search returns no matches', async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url.includes('/clubs/search')) {
        return Promise.resolve({ data: [], pagination: { has_more: false } });
      }
      return Promise.resolve(mockClubsResponse);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CampusClubsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('DEVELOPERS CLUB')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Search clubs by name, domain, keywords...');
    fireEvent.changeText(searchInput, 'NonExistentClub');

    await waitFor(() => {
      expect(screen.getByText('NO CLUBS FOUND')).toBeTruthy();
      expect(screen.getByText('RESET SEARCH FILTER')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('RESET SEARCH FILTER'));

    await waitFor(() => {
      expect(screen.getByText('DEVELOPERS CLUB')).toBeTruthy();
    });
  });

  it('displays error message with retry button on failure', async () => {
    (apiClient as any).mockRejectedValueOnce(new Error('Directory network failure'));

    render(
      <QueryClientProvider client={queryClient}>
        <CampusClubsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("COULDN'T LOAD CLUBS")).toBeTruthy();
      expect(screen.getByText('RETRY CONNECTION ↺')).toBeTruthy();
    });
  });
});
