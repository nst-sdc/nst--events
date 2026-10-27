// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectCoverBanner, isWatermarkedStockImage } from '../components/projects/ProjectCoverBanner';
import PublicProjectDetailPage from '../app/(public)/projects/[slug]/page';
import { StudentAppShell } from '../components/layout/StudentAppShell';
import { projectsApi, ProjectDetail } from '../lib/projects-api';
import * as useCurrentUserModule from '../hooks/useCurrentUser';

// Mock Next.js navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/projects/soham-project',
  useParams: () => ({
    slug: 'soham-project',
  }),
  notFound: vi.fn(),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

// Mock layout providers
vi.mock('../components/layout/ClubAdminProvider', () => ({
  ClubAdminProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useClubAdmin: () => ({ isClubAdminMode: false }),
}));

vi.mock('../hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => {},
}));

vi.mock('../hooks/useNotifications', () => ({
  useUnreadCount: () => ({ data: 0 }),
  useNotifications: () => ({ data: { notifications: [] }, isLoading: false }),
  useReadNotification: () => ({ mutate: vi.fn() }),
}));

vi.mock('../components/notifications/StudentNotificationPopover', () => ({
  StudentNotificationPopover: () => <div data-testid="student-notification-popover" />,
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Campus Portfolio & Discovery Redesign Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. ProjectCoverBanner: Stock Watermark Detection & Fallback Cover Art
  // =========================================================================
  describe('ProjectCoverBanner: Watermark Detection & Fallback Rendering', () => {
    it('accurately identifies stock watermarked image domains and invalid URLs', () => {
      // Shutterstock
      expect(
        isWatermarkedStockImage(
          'https://www.shutterstock.com/shutterstock/photos/2644178503/display_1500/stock-vector-http.jpg'
        )
      ).toBe(true);

      // iStock / Getty
      expect(isWatermarkedStockImage('https://media.istockphoto.com/id/12345/photo/test.jpg')).toBe(true);
      expect(isWatermarkedStockImage('https://image.gettyimages.com/preview/456.jpg')).toBe(true);

      // Stock Adobe & Dreamstime
      expect(isWatermarkedStockImage('https://stock.adobe.com/images/vector-sample.jpg')).toBe(true);
      expect(isWatermarkedStockImage('https://dreamstime.com/watermark-preview.jpg')).toBe(true);

      // Invalid schemes
      expect(isWatermarkedStockImage('ftp://internal/image.png')).toBe(true);
      expect(isWatermarkedStockImage('javascript:void(0)')).toBe(true);

      // Legitimate portfolio images
      expect(isWatermarkedStockImage('https://images.unsplash.com/photo-1555066931-4365d14bab8c')).toBe(false);
      expect(isWatermarkedStockImage('https://storage.googleapis.com/nst-bucket/project-shot.png')).toBe(false);
      expect(isWatermarkedStockImage('/assets/custom-cover.jpg')).toBe(false);
      expect(isWatermarkedStockImage(null)).toBe(false);
      expect(isWatermarkedStockImage(undefined)).toBe(false);
    });

    it('renders category-themed designed fallback cover when coverImageUrl is watermarked', () => {
      renderWithQuery(
        <ProjectCoverBanner
          coverImageUrl="https://www.shutterstock.com/photos/vector-certificate.jpg"
          title="Campus Neural Hub"
          category="AI / Machine Learning"
          tagline="Distributed inference cluster for campus labs."
          tags={['python', 'pytorch', 'distributed']}
          developmentStatus="IN_PROGRESS"
          size="lg"
        />
      );

      // Verifies designed fallback badge and title
      expect(screen.getByText('NST PROJECT SHOWCASE')).toBeInTheDocument();
      expect(screen.getByText('Campus Neural Hub')).toBeInTheDocument();
      expect(screen.getByText('Distributed inference cluster for campus labs.')).toBeInTheDocument();
      expect(screen.getByText('AI / Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
      expect(screen.getByText('#python')).toBeInTheDocument();
      expect(screen.getByText('#pytorch')).toBeInTheDocument();

      // Verifies no raw <img> tag renders the watermarked stock image
      const img = screen.queryByRole('img');
      expect(img).toBeNull();
    });

    it('renders real image when URL is valid and falls back on error event', () => {
      renderWithQuery(
        <ProjectCoverBanner
          coverImageUrl="https://storage.googleapis.com/nst-bucket/valid-screenshot.png"
          title="Cloud Mesh"
          category="Systems & Infrastructure"
          size="lg"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://storage.googleapis.com/nst-bucket/valid-screenshot.png');

      // Trigger image load failure
      fireEvent.error(img);

      // Should gracefully transition to designed fallback banner
      expect(screen.getByText('NST PROJECT SHOWCASE')).toBeInTheDocument();
      expect(screen.getByText('Cloud Mesh')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Project Detail Page Redesign (/projects/:slug)
  // =========================================================================
  describe('Project Detail Page: Creator Spotlight & Structured Layout', () => {
    const mockProjectDetail: ProjectDetail = {
      id: 'proj-456',
      title: 'Autonomous Rover OS',
      slug: 'autonomous-rover-os',
      tagline: 'Real-time ROS2 navigation daemon for terrain rovers.',
      description: 'Engineered a low-latency navigation and obstacle avoidance stack for field robotics.',
      problem_statement: 'Off-the-shelf navigation stacks experience severe drift over rough terrain.',
      solution: 'Implemented visual-inertial odometry fused with Kalman-filtered wheel encoders.',
      implementation_details: 'C++20 node graph running on Jetson Orin Nano with CUDA acceleration.',
      personal_contribution: 'Designed the visual odometry algorithm and sensor fusion pipeline.',
      whats_next: 'Benchmarking on outdoors obstacle course.',
      category: 'AI / Machine Learning',
      tags: ['cpp', 'ros2', 'cuda', 'robotics'],
      project_type: 'CAPSTONE',
      development_status: 'COMPLETED',
      visibility: 'PUBLISHED',
      published_at: '2026-02-15T00:00:00.000Z',
      cover_image_url: 'https://www.shutterstock.com/sample-stock.jpg', // Watermarked stock
      gallery_image_urls: [],
      like_count: 14,
      view_count: 88,
      owner_id: 'user-creator-1',
      author: {
        name: 'Arjun Mehta',
        avatar_url: null,
        slug: 'arjun-mehta',
      },
      links: [
        {
          type: 'DEMO',
          url: 'https://rover-demo.nstsdc.org',
          label: 'Live Telemetry Demo',
        },
        {
          type: 'REPOSITORY',
          url: 'https://github.com/nst/rover-os',
          label: 'GitHub Repository',
        },
      ],
      contributors: [
        {
          id: 'contrib-1',
          role: 'Perception Engineer',
          name: 'Priya Sen',
          avatar_url: null,
          slug: 'priya-sen',
          status: 'ACCEPTED',
        },
      ],
    };

    it('connects creator spotlight to student profile and renders accepted contributors without empty gaps', async () => {
      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(mockProjectDetail);
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      } as any);

      const page = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'autonomous-rover-os' }),
      });

      renderWithQuery(page);

      // Verify title & tagline
      expect(screen.getAllByText('Autonomous Rover OS').length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('Real-time ROS2 navigation daemon for terrain rovers.').length
      ).toBeGreaterThanOrEqual(1);

      // Verify Creator Spotlight & Profile Links
      const creatorLinks = screen.getAllByRole('link', { name: /Arjun Mehta/i });
      expect(creatorLinks.length).toBeGreaterThan(0);
      expect(creatorLinks[0]).toHaveAttribute('href', '/students/arjun-mehta');

      // Verify "View Student Portfolio" CTA button
      const portfolioBtn = screen.getByRole('link', { name: /View Student Portfolio/i });
      expect(portfolioBtn).toBeInTheDocument();
      expect(portfolioBtn).toHaveAttribute('href', '/students/arjun-mehta');

      // Verify Accepted Contributor link
      const contributorLink = screen.getByRole('link', { name: /Priya Sen/i });
      expect(contributorLink).toBeInTheDocument();
      expect(contributorLink).toHaveAttribute('href', '/students/priya-sen');

      // Verify Problem & Solution narrative
      expect(screen.getByText('The Problem Solved')).toBeInTheDocument();
      expect(
        screen.getByText('Off-the-shelf navigation stacks experience severe drift over rough terrain.')
      ).toBeInTheDocument();
      expect(screen.getByText('The Engineered Solution')).toBeInTheDocument();

      // Verify Showcase Artifacts (Demo & Repo)
      expect(screen.getByText('Live Telemetry Demo')).toBeInTheDocument();
      expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
    });

    it('does not render empty problem/solution containers when fields are null', async () => {
      const minimalProject: ProjectDetail = {
        ...mockProjectDetail,
        problem_statement: null,
        solution: null,
        implementation_details: null,
        personal_contribution: null,
        whats_next: null,
        tags: [],
        links: [],
        contributors: [],
      };

      vi.spyOn(projectsApi, 'getPublicBySlug').mockResolvedValue(minimalProject);
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      } as any);

      const page = await PublicProjectDetailPage({
        params: Promise.resolve({ slug: 'autonomous-rover-os' }),
      });

      renderWithQuery(page);

      // Should not contain problem/solution containers
      expect(screen.queryByText('The Problem Solved')).toBeNull();
      expect(screen.queryByText('The Engineered Solution')).toBeNull();
      expect(screen.queryByText('Technical Architecture & Key Decisions')).toBeNull();

      // Should render description and solo project note
      expect(screen.getByText('Solo project submission')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Navigation & Route Responsibilities
  // =========================================================================
  describe('Page Responsibilities & Global Navigation', () => {
    it('StudentAppShell renders Students directory link and links profile to /my/profile', () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: {
          id: 'user-1',
          full_name: 'Soham Dhande',
          email: 'soham@adypu.edu.in',
          global_role: 'STUDENT',
        },
        isLoading: false,
        isError: false,
      } as any);

      renderWithQuery(
        <StudentAppShell>
          <div>Page content</div>
        </StudentAppShell>
      );

      // Verifies Students directory link is present
      const studentDirLinks = screen.getAllByRole('link', { name: /Students/i });
      expect(studentDirLinks.some((l) => l.getAttribute('href') === '/students')).toBe(true);

      // Verifies Profile link points to /my/profile
      const profileLinks = screen.getAllByRole('link', { name: /Profile/i });
      expect(profileLinks.some((l) => l.getAttribute('href') === '/my/profile')).toBe(true);
    });
  });
});
