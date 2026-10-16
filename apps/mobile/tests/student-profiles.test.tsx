// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentDirectoryScreen from '../app/(app)/students/index';
import PublicStudentProfileScreen from '../app/(app)/students/[slug]';
import { ProfileVisibilityModal } from '../src/ui/ProfileVisibilityModal';
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
const mockReplace = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    canGoBack: () => true,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => ({
    slug: 'charlie-dev',
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

describe('Mobile Student Profiles & Directory Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it('renders student directory with items and navigates on press', async () => {
    const mockDirectoryData = {
      items: [
        {
          id: 'user-1',
          fullName: 'Charlie Developer',
          slug: 'charlie-dev',
          avatarUrl: null,
          headline: 'Full-Stack Lead',
          bio: 'Building systems on campus',
          batch: '2026',
          program: 'B.Tech CS',
          campus: 'Pune',
          skills: ['typescript', 'react', 'go'],
          projectsCount: 2,
          achievementsCount: 1,
        },
      ],
      pagination: { total: 1, page: 1, limit: 12, totalPages: 1 },
      facets: {
        programs: ['B.Tech CS'],
        batches: ['2026'],
        skills: ['typescript', 'react'],
      },
    };

    (apiClient as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDirectoryData,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <StudentDirectoryScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Charlie Developer')).toBeTruthy();
      expect(screen.getByText('@charlie-dev')).toBeTruthy();
      expect(screen.getByText('Full-Stack Lead')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Charlie Developer'));
    expect(mockPush).toHaveBeenCalledWith('/students/charlie-dev');
  });

  it('renders public profile dossier screen with projects and honors', async () => {
    const mockProfile = {
      id: 'user-1',
      fullName: 'Charlie Developer',
      slug: 'charlie-dev',
      avatarUrl: null,
      headline: 'Full-Stack Lead',
      bio: 'Building systems on campus',
      batch: '2026',
      program: 'B.Tech CS',
      campus: 'Pune',
      skills: ['typescript', 'react'],
      interests: ['distributed algorithms'],
      externalLinks: {
        github: 'https://github.com/charlie',
      },
      projects: [
        {
          id: 'p-1',
          title: 'Campus Food Delivery',
          slug: 'campus-food-delivery',
          tagline: 'Hyperlocal delivery network',
          category: 'MOBILE',
          tags: ['react-native'],
          cover_image_url: '',
          role: 'CREATOR',
          is_owner: true,
          published_at: new Date().toISOString(),
          featured: true,
          display_order: 1,
        },
      ],
      achievements: [
        {
          id: 'ach-1',
          award_name: 'Hackathon 1st Place',
          placement: '1',
          tier: 'GOLD',
          certificate_url: null,
          awarded_at: new Date().toISOString(),
          event: {
            id: 'e-1',
            title: 'NST Hackathon 2026',
            slug: 'hackathon-2026',
          },
        },
      ],
      clubs: [],
      isMinimal: false,
    };

    (apiClient as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockProfile,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PublicStudentProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Charlie Developer')).toBeTruthy();
      expect(screen.getByText('@charlie-dev')).toBeTruthy();
      expect(screen.getByText('Campus Food Delivery')).toBeTruthy();
      expect(screen.getByText('Hackathon 1st Place')).toBeTruthy();
    });
  });

  it('renders ProfileVisibilityModal with toggles and triggers curation', async () => {
    const mockEditableProfile = {
      user: {
        id: 'user-1',
        fullName: 'Charlie Developer',
        email: 'charlie@adypu.edu.in',
        avatarUrl: null,
        headline: 'Lead Dev',
        bio: 'Bio',
        batch: '2026',
        program: 'B.Tech CS',
        campus: 'Pune',
        skills: ['react'],
        interests: [],
        externalLinks: {},
      },
      profile: {
        id: 'sp-1',
        slug: 'charlie-dev',
        directoryListed: true,
        sectionVisibility: {
          identity: true,
          avatar: false,
          academic: true,
          bio: true,
          skills: true,
          links: false,
          projects: true,
          achievements: true,
          clubs: false,
        },
      },
      curatedItems: [],
      availableProjects: [
        {
          id: 'p-1',
          title: 'Campus Food Delivery',
          slug: 'campus-food-delivery',
          tagline: 'App',
          category: 'MOBILE',
          tags: [],
          cover_image_url: '',
          role: 'CREATOR',
          is_owner: true,
          visibility: 'PUBLISHED',
        },
      ],
      availableAchievements: [],
      availableClubs: [],
    };

    (apiClient as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockEditableProfile,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ProfileVisibilityModal visible={true} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PROFILE & VISIBILITY SETTINGS')).toBeTruthy();
      expect(screen.getByText('Full Display Name')).toBeTruthy();
      expect(screen.getByText('Campus Food Delivery')).toBeTruthy();
    });
  });

  it('handles canonical slug redirect automatically without crashing', async () => {
    (apiClient as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        redirect: true,
        canonical_slug: 'charlie-canonical',
      }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PublicStudentProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('REDIRECTING TO @charlie-canonical...')).toBeTruthy();
      expect(mockReplace).toHaveBeenCalledWith('/students/charlie-canonical');
    });
  });

  it('renders Profile Not Found error state when profile query fails', async () => {
    (apiClient as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not found' }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PublicStudentProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Profile Not Found')).toBeTruthy();
      expect(screen.getByText('RETURN TO DIRECTORY')).toBeTruthy();
    });
  });

  it('renders hidden identity and masked avatar safely without leaking personal data', async () => {
    const anonymousProfile = {
      id: 'user-anon',
      fullName: null,
      slug: 'student-9c9c488e',
      avatarUrl: null,
      headline: null,
      bio: null,
      batch: '2026',
      program: 'B.Tech CS',
      campus: 'Pune',
      skills: ['cryptography'],
      interests: [],
      externalLinks: {},
      projects: [],
      achievements: [],
      clubs: [],
      isMinimal: true,
    };

    (apiClient as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => anonymousProfile,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PublicStudentProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('@student-9c9c488e')).toBeTruthy();
      expect(screen.queryByText('Charlie Developer')).toBeNull();
      expect(screen.getByText('ST')).toBeTruthy(); // Initials derived from slug
    });
  });

  it('renders directory empty state when no students match search query', async () => {
    (apiClient as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        pagination: { total: 0, page: 1, limit: 12, totalPages: 0 },
        facets: { programs: [], batches: [], skills: [] },
      }),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <StudentDirectoryScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No students found')).toBeTruthy();
      expect(screen.getByText('Try adjusting your search query or removing program filters.')).toBeTruthy();
    });
  });
});
