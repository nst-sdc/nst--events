// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentDirectoryScreen from '../app/(app)/students/index';
import PublicStudentProfileScreen from '../app/(app)/students/[slug]';
import { ProfileVisibilityModal } from '../src/ui/ProfileVisibilityModal';
import { apiClient } from '../src/infrastructure/api';
import {
  usePublicStudentProfile,
  normalizePublicStudentProfile,
  type PublicStudentProfileTransportDto,
  type PublicStudentProfile,
} from '../src/hooks/use-student-profiles';
import { Text } from 'react-native';

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

    (apiClient as any).mockResolvedValueOnce(mockDirectoryData);

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

  it('renders public profile dossier screen with projects and honors from real transport payload', async () => {
    const realBackendProfile: PublicStudentProfileTransportDto = {
      slug: 'charlie-dev',
      full_name: 'Charlie Developer',
      avatar_url: null,
      headline: 'Full-Stack Lead',
      bio: 'Building systems on campus',
      academic: {
        program: 'B.Tech CS',
        program_code: 'BTCS',
        graduation_year: 2026,
      },
      skills: ['typescript', 'react'],
      interests: ['distributed algorithms'],
      external_links: [
        { type: 'github', url: 'https://github.com/charlie' },
      ],
      projects: [
        {
          id: 'p-1',
          title: 'Campus Food Delivery',
          slug: 'campus-food-delivery',
          tagline: 'Hyperlocal delivery network',
          description: 'A platform for peer campus food delivery',
          category: 'MOBILE',
          tags: ['react-native'],
          cover_image_url: '',
          is_owner: true,
          is_featured: true,
          like_count: 10,
          view_count: 50,
          published_at: new Date().toISOString(),
        },
      ],
      achievements: [
        {
          id: 'ach-1',
          award_title: 'Hackathon 1st Place',
          award_type: 'GOLD',
          placement: 1,
          is_team_award: false,
          team_name: null,
          is_featured: true,
          published_at: new Date().toISOString(),
          event: {
            id: 'e-1',
            title: 'NST Hackathon 2026',
            slug: 'hackathon-2026',
            start_time: new Date().toISOString(),
          },
          linked_project: null,
        },
      ],
      clubs: [],
    };

    (apiClient as any).mockResolvedValueOnce(realBackendProfile);

    render(
      <QueryClientProvider client={queryClient}>
        <PublicStudentProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Charlie Developer')).toBeTruthy();
      expect(screen.getByText('@charlie-dev')).toBeTruthy();
      expect(screen.getByText('🎓 B.Tech CS')).toBeTruthy();
      expect(screen.getByText('📅 Batch 2026')).toBeTruthy();
      expect(screen.getByText('GITHUB ↗')).toBeTruthy();
      expect(screen.getByText('Campus Food Delivery')).toBeTruthy();
      expect(screen.getByText('Hackathon 1st Place')).toBeTruthy();
      expect(screen.getByText('1 PLACE')).toBeTruthy();
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

    (apiClient as any).mockResolvedValueOnce(mockEditableProfile);

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
      redirect: true,
      canonical_slug: 'charlie-canonical',
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
    (apiClient as any).mockRejectedValueOnce({
      status: 404,
      message: 'Not found',
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

  it('renders hidden identity and masked avatar safely without leaking personal data from transport payload', async () => {
    const anonymousProfileTransport: PublicStudentProfileTransportDto = {
      slug: 'student-9c9c488e',
      full_name: null,
      avatar_url: null,
      headline: null,
      bio: null,
      academic: {
        program: 'B.Tech CS',
        program_code: 'BTCS',
        graduation_year: 2026,
      },
      skills: ['cryptography'],
      interests: [],
      external_links: [],
      projects: [],
      achievements: [],
      clubs: [],
    };

    (apiClient as any).mockResolvedValueOnce(anonymousProfileTransport);

    render(
      <QueryClientProvider client={queryClient}>
        <PublicStudentProfileScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('@student-9c9c488e')).toBeTruthy();
      expect(screen.queryByText('Charlie Developer')).toBeNull();
      expect(screen.getByText('ST')).toBeTruthy(); // Initials derived from slug
      expect(screen.getByText('Verified NST Student Identity')).toBeTruthy();
      expect(screen.getByText('Portfolio sections are hidden according to student privacy preferences.')).toBeTruthy();
    });
  });

  it('renders directory empty state when no students match search query', async () => {
    (apiClient as any).mockResolvedValueOnce({
      items: [],
      pagination: { total: 0, page: 1, limit: 12, totalPages: 0 },
      facets: { programs: [], batches: [], skills: [] },
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

  describe('Contract and Regression Suite: Plain apiClient Responses (No .json() call)', () => {
    it('useStudentDirectory directly handles plain objects and fails if res.json is called', async () => {
      // Mock apiClient returning a pure JSON object without any .json property
      const directoryPayload = {
        items: [
          {
            id: 'u-reg-1',
            fullName: 'Regression Test Student',
            slug: 'reg-student',
            avatarUrl: null,
            headline: 'Tester',
            bio: 'Bio',
            batch: '2025',
            program: 'B.Tech AI',
            campus: 'Pune',
            skills: ['vitest'],
            projectsCount: 1,
            achievementsCount: 0,
          },
        ],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
        facets: { programs: ['B.Tech AI'], batches: ['2025'], skills: ['vitest'] },
      };

      // Ensure object has no .json method
      expect((directoryPayload as any).json).toBeUndefined();

      (apiClient as any).mockResolvedValueOnce(directoryPayload);

      render(
        <QueryClientProvider client={queryClient}>
          <StudentDirectoryScreen />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Regression Test Student')).toBeTruthy();
        expect(screen.getByText('@reg-student')).toBeTruthy();
      });

      expect(apiClient).toHaveBeenCalledWith(expect.stringContaining('/v1/students'));
    });

    it('usePublicStudentProfile directly handles plain objects and renders portfolio', async () => {
      const publicProfilePayload: PublicStudentProfileTransportDto = {
        slug: 'jane-verified',
        full_name: 'Jane Verified',
        avatar_url: null,
        headline: 'Lead Architect',
        bio: 'Campus builder',
        academic: {
          program: 'B.Tech Data Science',
          program_code: 'BTDS',
          graduation_year: 2027,
        },
        skills: ['python', 'react-native'],
        interests: ['mlops'],
        external_links: [{ type: 'github', url: 'https://github.com/jane' }],
        projects: [
          {
            id: 'proj-1',
            title: 'Attendance AI Vision',
            slug: 'attendance-ai',
            tagline: 'Computer vision attendance validation',
            category: 'RESEARCH',
            tags: ['python'],
            cover_image_url: '',
            is_owner: true,
            is_featured: true,
            like_count: 5,
            view_count: 25,
            published_at: new Date().toISOString(),
          },
        ],
        achievements: [],
        clubs: [],
      };

      expect((publicProfilePayload as any).json).toBeUndefined();

      (apiClient as any).mockResolvedValueOnce(publicProfilePayload);

      render(
        <QueryClientProvider client={queryClient}>
          <PublicStudentProfileScreen />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Jane Verified')).toBeTruthy();
        expect(screen.getByText('Attendance AI Vision')).toBeTruthy();
      });

      expect(apiClient).toHaveBeenCalledWith('/v1/students/charlie-dev');
    });

    it('ProfileVisibilityModal toggle triggers useUpdateMyVisibility with plain object resolution', async () => {
      const mockEditableProfile = {
        user: {
          id: 'u-vis-1',
          fullName: 'Visibility Test User',
          email: 'vis@adypu.edu.in',
          avatarUrl: null,
          headline: 'Developer',
          bio: 'Bio',
          batch: '2026',
          program: 'B.Tech CS',
          campus: 'Pune',
          skills: [],
          interests: [],
          externalLinks: {},
        },
        profile: {
          id: 'prof-vis-1',
          slug: 'vis-user',
          directoryListed: true,
          sectionVisibility: {
            identity: true,
            avatar: true,
            academic: true,
            bio: true,
            skills: true,
            links: true,
            projects: true,
            achievements: true,
            clubs: true,
          },
        },
        curatedItems: [],
        availableProjects: [],
        availableAchievements: [],
        availableClubs: [],
      };

      // Mock apiClient implementation to handle initial fetch, mutation, and invalidation refetch
      const mutationResponse = {
        success: true,
        directory_listed: false,
      };
      (apiClient as any).mockImplementation((url: string, opts?: any) => {
        if (url === '/v1/students/me/profile') {
          return Promise.resolve(mockEditableProfile);
        }
        if (url === '/v1/students/me/visibility' && opts?.method === 'PATCH') {
          return Promise.resolve(mutationResponse);
        }
        return Promise.resolve({});
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ProfileVisibilityModal visible={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('PROFILE & VISIBILITY SETTINGS')).toBeTruthy();
        expect(screen.getByText('List in Student Directory')).toBeTruthy();
      });

      // Find Directory Listed Switch checkbox and toggle it
      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      fireEvent.press(checkbox as any);

      await waitFor(() => {
        expect(apiClient).toHaveBeenCalledWith('/v1/students/me/visibility', {
          method: 'PATCH',
          body: JSON.stringify({ directory_listed: false }),
        });
      });
    });
  });

  describe('Transport-to-Canonical Boundary Normalization & Hook Regression Suite', () => {
    it('1. correctly maps snake_case fields into canonical camelCase model', () => {
      const rawWire: PublicStudentProfileTransportDto = {
        slug: 'alex-dev',
        full_name: 'Alex Developer',
        avatar_url: 'https://cdn.example.com/alex.jpg',
        headline: 'Frontend Engineer',
        bio: 'Coding with React and TypeScript',
        academic: null,
        skills: ['react', 'typescript'],
        interests: ['ui/ux'],
        external_links: [],
        projects: [],
        achievements: [],
        clubs: [],
      };

      const normalized = normalizePublicStudentProfile(rawWire);

      expect(normalized.fullName).toBe('Alex Developer');
      expect(normalized.avatarUrl).toBe('https://cdn.example.com/alex.jpg');
      expect(normalized.slug).toBe('alex-dev');
      expect(normalized.id).toBe('alex-dev');
      expect(normalized.headline).toBe('Frontend Engineer');
      expect(normalized.bio).toBe('Coding with React and TypeScript');
    });

    it('2. maps nested academic data according to backend contract', () => {
      const rawWire: PublicStudentProfileTransportDto = {
        slug: 'bob-engineer',
        full_name: 'Bob Engineer',
        avatar_url: null,
        headline: null,
        bio: null,
        academic: {
          program: 'B.Tech Computer Science',
          program_code: 'BTCS',
          graduation_year: 2026,
          admission_year: 2022,
        },
        skills: [],
        interests: [],
        external_links: [],
        projects: [],
        achievements: [],
        clubs: [],
      };

      const normalized = normalizePublicStudentProfile(rawWire);

      expect(normalized.program).toBe('B.Tech Computer Science');
      expect(normalized.batch).toBe('2026');
    });

    it('3. normalizes external links array into lowercase dictionary representation', () => {
      const rawWire: PublicStudentProfileTransportDto = {
        slug: 'link-tester',
        full_name: 'Link Tester',
        avatar_url: null,
        headline: null,
        bio: null,
        academic: null,
        skills: [],
        interests: [],
        external_links: [
          { type: 'GitHub', url: 'https://github.com/linktester' },
          { type: 'LinkedIn', label: 'LinkedIn', url: 'https://linkedin.com/in/linktester' },
          { type: 'Portfolio', url: 'https://linktester.dev' },
          { type: 'OTHER', url: 'https://twitter.com/linktester' },
        ],
        projects: [],
        achievements: [],
        clubs: [],
      };

      const normalized = normalizePublicStudentProfile(rawWire);

      expect(normalized.externalLinks).toEqual({
        github: 'https://github.com/linktester',
        linkedin: 'https://linkedin.com/in/linktester',
        portfolio: 'https://linktester.dev',
        other: 'https://twitter.com/linktester',
      });
    });

    it('4. preserves projects, achievements, skills, clubs, and featured metadata from actual transport response', () => {
      const rawWire: PublicStudentProfileTransportDto = {
        slug: 'full-portfolio',
        full_name: 'Full Portfolio Student',
        avatar_url: 'https://cdn.example.com/avatar.png',
        headline: 'Lead Developer',
        bio: 'Building systems',
        academic: {
          program: 'B.Tech AI',
          program_code: 'BTAI',
          graduation_year: 2025,
        },
        skills: ['python', 'pytorch'],
        interests: ['deep-learning'],
        external_links: [{ type: 'github', url: 'https://github.com/ai' }],
        projects: [
          {
            id: 'proj-101',
            title: 'Neural Network Simulator',
            slug: 'neural-sim',
            tagline: 'Interactive deep learning playground',
            description: 'Full simulation suite',
            category: 'AI / ML',
            tags: ['python', 'webgl'],
            cover_image_url: 'https://cdn.example.com/cover.png',
            is_owner: true,
            is_featured: true,
            like_count: 42,
            view_count: 500,
            published_at: '2026-05-01T10:00:00.000Z',
          },
        ],
        achievements: [
          {
            id: 'ach-202',
            award_title: 'Best AI Innovation',
            award_type: 'GOLD',
            placement: 1,
            is_team_award: true,
            team_name: 'Team Cortex',
            is_featured: true,
            published_at: '2026-06-15T12:00:00.000Z',
            event: {
              id: 'event-303',
              title: 'AI Summit 2026',
              slug: 'ai-summit-2026',
              start_time: '2026-06-15T09:00:00.000Z',
            },
            linked_project: {
              id: 'proj-101',
              title: 'Neural Network Simulator',
              slug: 'neural-sim',
              cover_image_url: 'https://cdn.example.com/cover.png',
            },
          },
        ],
        clubs: [
          {
            club_id: 'club-404',
            club_name: 'Robotics & AI Club',
            role: 'PRESIDENT',
            banner_url: 'https://cdn.example.com/club-banner.png',
            is_featured: true,
          },
        ],
      };

      const normalized = normalizePublicStudentProfile(rawWire);

      // Projects
      expect(normalized.projects).toHaveLength(1);
      expect(normalized.projects[0].id).toBe('proj-101');
      expect(normalized.projects[0].title).toBe('Neural Network Simulator');
      expect(normalized.projects[0].role).toBe('Creator / Lead');
      expect(normalized.projects[0].is_owner).toBe(true);
      expect(normalized.projects[0].featured).toBe(true);
      expect(normalized.projects[0].published_at).toBe('2026-05-01T10:00:00.000Z');

      // Achievements
      expect(normalized.achievements).toHaveLength(1);
      expect(normalized.achievements[0].id).toBe('ach-202');
      expect(normalized.achievements[0].award_name).toBe('Best AI Innovation');
      expect(normalized.achievements[0].placement).toBe('1');
      expect(normalized.achievements[0].tier).toBe('GOLD');
      expect(normalized.achievements[0].event.title).toBe('AI Summit 2026');

      // Clubs
      expect(normalized.clubs).toHaveLength(1);
      expect(normalized.clubs[0].id).toBe('club-404');
      expect(normalized.clubs[0].club_name).toBe('Robotics & AI Club');
      expect(normalized.clubs[0].role).toBe('PRESIDENT');
      expect(normalized.clubs[0].banner_url).toBe('https://cdn.example.com/club-banner.png');

      // Minimal
      expect(normalized.isMinimal).toBe(false);
    });

    it('5. handles nullable and optional values predictably', () => {
      const rawWire: PublicStudentProfileTransportDto = {
        slug: 'minimalist',
        full_name: null,
        avatar_url: null,
        headline: null,
        bio: null,
        academic: null,
        skills: [],
        interests: [],
        external_links: [],
        projects: [],
        achievements: [],
        clubs: [],
      };

      const normalized = normalizePublicStudentProfile(rawWire);

      expect(normalized.fullName).toBeNull();
      expect(normalized.avatarUrl).toBeNull();
      expect(normalized.headline).toBeNull();
      expect(normalized.bio).toBeNull();
      expect((normalized as any).academic).toBeUndefined();
      expect(normalized.program).toBeNull();
      expect(normalized.batch).toBeNull();
      expect(normalized.campus).toBeNull();
      expect(normalized.skills).toEqual([]);
      expect(normalized.interests).toEqual([]);
      expect(normalized.externalLinks).toEqual({});
      expect(normalized.projects).toEqual([]);
      expect(normalized.achievements).toEqual([]);
      expect(normalized.clubs).toEqual([]);
      expect(normalized.isMinimal).toBe(true);
    });

    it('6. preserves legitimate false and 0 values without truthiness coercion', () => {
      const rawWire: PublicStudentProfileTransportDto = {
        slug: 'zero-and-false',
        full_name: '',
        avatar_url: null,
        headline: null,
        bio: '',
        academic: {
          program: 'B.Tech CS',
          program_code: 'BTCS',
          graduation_year: 2026,
        },
        skills: [],
        interests: [],
        external_links: [],
        projects: [
          {
            id: 'proj-zero',
            title: 'Contributor Project',
            slug: 'contrib-project',
            tagline: 'Supporting project',
            cover_image_url: '',
            category: 'TOOLS',
            tags: [],
            is_owner: false,
            is_featured: false,
            published_at: null,
          },
        ],
        achievements: [
          {
            id: 'ach-zero',
            award_title: 'Participation Award',
            award_type: 'PARTICIPATION',
            placement: 0,
            is_featured: false,
            published_at: '2026-01-01T00:00:00.000Z',
            event: {
              id: 'ev-0',
              title: 'Hackathon 0',
              slug: 'hack-0',
              start_time: '2026-01-01T00:00:00.000Z',
            },
          },
        ],
        clubs: [
          {
            club_id: 'club-zero',
            club_name: 'Open Source Club',
            role: 'MEMBER',
            banner_url: null,
            is_featured: false,
          },
        ],
      };

      const normalized = normalizePublicStudentProfile(rawWire);

      // Empty string bio and fullName preserved
      expect(normalized.fullName).toBe('');
      expect(normalized.bio).toBe('');

      // Project: is_owner: false preserved, role is Contributor, featured: false
      expect(normalized.projects[0].is_owner).toBe(false);
      expect(normalized.projects[0].role).toBe('Contributor');
      expect(normalized.projects[0].featured).toBe(false);

      // Achievement: placement: 0 preserved as '0'
      expect(normalized.achievements[0].placement).toBe('0');

      // Not minimal because it has projects, achievements, and clubs
      expect(normalized.isMinimal).toBe(false);
    });

    it('7. usePublicStudentProfile hook returns canonical UI data after receiving transport shape', async () => {
      const transportPayload: PublicStudentProfileTransportDto = {
        slug: 'hook-test-student',
        full_name: 'Hook Test Student',
        avatar_url: 'https://cdn.example.com/hook.png',
        headline: 'Hook Tester',
        bio: 'Testing query hook normalizer integration',
        academic: {
          program: 'B.Tech Robotics',
          program_code: 'BTROB',
          graduation_year: 2028,
        },
        skills: ['c++', 'ros2'],
        interests: ['kinematics'],
        external_links: [{ type: 'github', url: 'https://github.com/hook' }],
        projects: [
          {
            id: 'p-hook',
            title: 'Hexapod Walker',
            slug: 'hexapod-walker',
            tagline: 'Six-legged autonomous robot',
            cover_image_url: '',
            category: 'HARDWARE',
            tags: ['ros2'],
            is_owner: true,
            is_featured: true,
            published_at: '2026-08-01T00:00:00.000Z',
          },
        ],
        achievements: [],
        clubs: [],
      };

      (apiClient as any).mockResolvedValueOnce(transportPayload);

      let hookResult: PublicStudentProfile | undefined;
      function TestHookComponent() {
        const { data } = usePublicStudentProfile('hook-test-student');
        hookResult = data;
        return <Text testID="rendered-slug">{data?.slug || 'loading'}</Text>;
      }

      render(
        <QueryClientProvider client={queryClient}>
          <TestHookComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
        expect(hookResult?.fullName).toBe('Hook Test Student');
        expect(hookResult?.program).toBe('B.Tech Robotics');
        expect(hookResult?.batch).toBe('2028');
        expect(hookResult?.externalLinks.github).toBe('https://github.com/hook');
        expect(hookResult?.projects[0].featured).toBe(true);
        expect(hookResult?.projects[0].role).toBe('Creator / Lead');
      });
    });

    it('8. normalizes canonical slug redirect response predictably', () => {
      const redirectPayload = {
        redirect: true,
        canonical_slug: 'canonical-charlie',
      };

      const normalized = normalizePublicStudentProfile(redirectPayload);

      expect(normalized.redirect).toBe(true);
      expect(normalized.canonical_slug).toBe('canonical-charlie');
      expect(normalized.slug).toBe('canonical-charlie');
      expect(normalized.isMinimal).toBe(false);
    });
  });
});
