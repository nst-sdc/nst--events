// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { studentsApi } from '../lib/students-api';
import { projectsApi, ProjectDetail } from '../lib/projects-api';
import { ProjectForm } from '../components/projects/ProjectForm';
import { ProjectOwnerActions, ProjectOwnerStatusBanner } from '../components/projects/ProjectOwnerActions';
import PublicStudentProfilePage from '../app/(public)/students/[slug]/page';
import * as authStoreModule from '../lib/auth-store';
import * as useCurrentUserModule from '../hooks/useCurrentUser';

// Mock Next.js navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({
    slug: 'alice-slug',
  }),
  notFound: vi.fn(),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

// Mock Layout components
vi.mock('../components/layout/StudentAppShell', () => ({
  StudentAppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="student-app-shell">{children}</div>,
}));

vi.mock('../components/layout/ClubAdminProvider', () => ({
  ClubAdminProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="club-admin-provider">{children}</div>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe('Student Portfolio & Project Management Experience Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Data Normalization & Privacy Settings
  // =========================================================================
  describe('Public Portfolio Data Normalization & Privacy Settings', () => {
    it('normalizes backend snake_case response into PublicStudentProfile camelCase structure', async () => {
      const backendSnakeCaseResponse = {
        id: 'std-1',
        full_name: 'Aditi Sharma',
        slug: 'aditi-sharma',
        avatar_url: 'https://images.unsplash.com/aditi.jpg',
        headline: 'AI Systems Engineer',
        bio: 'Focusing on distributed deep learning',
        academic: {
          program: 'B.Tech AI & Data Science',
          graduation_year: 2026,
        },
        campus: 'Pune',
        skills: ['python', 'pytorch', 'distributed-systems'],
        interests: ['mlops'],
        external_links: [
          { platform: 'GITHUB', url: 'https://github.com/aditi-sharma' },
          { platform: 'LINKEDIN', url: 'https://linkedin.com/in/aditi-sharma' },
        ],
        projects: [
          {
            id: 'p-1',
            title: 'Neural Quantizer',
            slug: 'neural-quantizer',
            tagline: '8-bit model quantization for edge TPU',
            category: 'AI / Machine Learning',
            tags: ['pytorch', 'cuda'],
            cover_image_url: 'https://images.unsplash.com/quant.jpg',
            role: 'LEAD',
            is_featured: true,
            published_at: '2026-03-01T12:00:00.000Z',
          },
        ],
        achievements: [
          {
            id: 'ach-1',
            award_title: 'National ML Challenge Champion',
            tier: 'GOLD',
            awarded_at: '2026-02-15T12:00:00.000Z',
            event: {
              id: 'ev-1',
              title: 'NST AI Summit 2026',
              slug: 'nst-ai-summit-2026',
            },
          },
        ],
        clubs: [
          {
            id: 'clb-1',
            club_id: 'nst-ai-club',
            club_name: 'NST AI Club',
            role: 'Lead Researcher',
            joined_at: '2025-08-01T00:00:00.000Z',
          },
        ],
        is_minimal: false,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => backendSnakeCaseResponse,
      });
      vi.stubGlobal('fetch', fetchMock);

      const profile = await studentsApi.getPublicProfile('aditi-sharma');

      expect(profile.fullName).toBe('Aditi Sharma');
      expect(profile.avatarUrl).toBe('https://images.unsplash.com/aditi.jpg');
      expect(profile.program).toBe('B.Tech AI & Data Science');
      expect(profile.batch).toBe('2026');
      expect(profile.externalLinks.github).toBe('https://github.com/aditi-sharma');
      expect(profile.externalLinks.linkedin).toBe('https://linkedin.com/in/aditi-sharma');
      expect(profile.projects.length).toBe(1);
      expect(profile.projects[0].featured).toBe(true);
      expect(profile.achievements.length).toBe(1);
      expect(profile.achievements[0].award_name).toBe('National ML Challenge Champion');
      expect(profile.clubs.length).toBe(1);
      expect(profile.isMinimal).toBe(false);
    });

    it('respects minimal profile and identity-privacy settings', async () => {
      const minimalProfileResponse = {
        id: 'std-anon',
        full_name: null,
        slug: 'student-hidden-id',
        avatar_url: null,
        headline: null,
        bio: null,
        academic: {
          program: 'B.Tech CS',
          graduation_year: 2027,
        },
        campus: 'Pune',
        skills: [],
        interests: [],
        external_links: [],
        projects: [],
        achievements: [],
        clubs: [],
        is_minimal: true,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => minimalProfileResponse,
      });
      vi.stubGlobal('fetch', fetchMock);

      const profile = await studentsApi.getPublicProfile('student-hidden-id');

      expect(profile.fullName).toBeNull();
      expect(profile.avatarUrl).toBeNull();
      expect(profile.isMinimal).toBe(true);
      expect(profile.projects.length).toBe(0);
      expect(profile.achievements.length).toBe(0);
      expect(profile.clubs.length).toBe(0);
    });
  });

  // =========================================================================
  // 2. Public Portfolio Empty States & Owner Banner
  // =========================================================================
  describe('Public Portfolio Empty States & Owner Banner', () => {
    it('renders branded empty states when student has no projects, achievements, or clubs configured', async () => {
      const profileWithoutItems = {
        id: 'std-2',
        fullName: 'Devansh Verma',
        slug: 'devansh-verma',
        avatarUrl: null,
        headline: 'Frontend Explorer',
        bio: 'Learning modern web engineering',
        batch: '2027',
        program: 'B.Tech IT',
        campus: 'Pune',
        skills: ['javascript', 'react'],
        interests: ['css', 'animation'],
        externalLinks: {},
        projects: [],
        achievements: [],
        clubs: [],
        isMinimal: false,
      };

      vi.spyOn(studentsApi, 'getPublicProfile').mockResolvedValue(profileWithoutItems as any);
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      } as any);

      const page = await PublicStudentProfilePage({
        params: Promise.resolve({ slug: 'devansh-verma' }),
      });

      render(page);

      // Verify student identity is displayed
      expect(screen.getByText('Devansh Verma')).toBeInTheDocument();
      expect(screen.getByText('Frontend Explorer')).toBeInTheDocument();

      // Verify empty states for each section are rendered rather than leaving a blank gap
      expect(screen.getByText(/NO PUBLIC PROJECTS PUBLISHED/i)).toBeInTheDocument();
      expect(screen.getByText(/NO EVENT HONORS RECORDED/i)).toBeInTheDocument();
      expect(screen.getByText(/NO CAMPUS ROLES LISTED/i)).toBeInTheDocument();
    });

    it('renders items properly when projects and achievements are present', async () => {
      const profileWithItems = {
        id: 'std-3',
        fullName: 'Kavita Reddy',
        slug: 'kavita-reddy',
        avatarUrl: 'https://images.unsplash.com/kavita.jpg',
        headline: 'Systems Researcher',
        bio: 'Operating systems enthusiast',
        batch: '2026',
        program: 'B.Tech CS',
        campus: 'Pune',
        skills: ['c++', 'linux'],
        interests: ['kernels'],
        externalLinks: { github: 'https://github.com/kavita' },
        projects: [
          {
            id: 'p-1',
            title: 'Custom Microkernel OS',
            slug: 'custom-microkernel-os',
            tagline: 'x86_64 microkernel with capability-based security',
            category: 'Systems',
            tags: ['c++', 'kernel', 'x86'],
            cover_image_url: 'https://images.unsplash.com/os.jpg',
            role: 'ARCHITECT',
            published_at: '2026-01-10T00:00:00.000Z',
            featured: true,
            display_order: 1,
          },
        ],
        achievements: [],
        clubs: [],
        isMinimal: false,
      };

      vi.spyOn(studentsApi, 'getPublicProfile').mockResolvedValue(profileWithItems as any);
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      } as any);

      const page = await PublicStudentProfilePage({
        params: Promise.resolve({ slug: 'kavita-reddy' }),
      });

      render(page);

      expect(screen.getByText('Custom Microkernel OS')).toBeInTheDocument();
      expect(screen.getByText('x86_64 microkernel with capability-based security')).toBeInTheDocument();
      expect(screen.getByText(/NO EVENT HONORS RECORDED/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. ProjectForm: Prepopulation, Validation, and Persistence
  // =========================================================================
  describe('ProjectForm Component (Create & Edit Modes)', () => {
    const mockExistingProject: ProjectDetail = {
      id: 'proj-123',
      title: 'Real-time Drone Telemetry',
      slug: 'real-time-drone-telemetry',
      tagline: 'Sub-second drone telemetry over 5G mesh networks.',
      description: 'A full-stack streaming telemetry dashboard and onboard daemon for autonomous aerial vehicles.',
      category: 'Robotics / Hardware',
      tags: ['telemetry', 'drone', 'webrtc'],
      project_type: 'HARDWARE',
      development_status: 'LIVE',
      visibility: 'PUBLISHED',
      published_at: '2026-02-01T00:00:00.000Z',
      cover_image_url: 'https://images.unsplash.com/drone.jpg',
      gallery_image_urls: [],
      like_count: 14,
      view_count: 220,
      has_liked: false,
      is_owner: true,
      owner_id: 'user-alice',
      author: {
        name: 'Alice Creator',
        avatar_url: null,
        slug: 'alice-creator',
      },
      links: [
        { id: 'l-1', type: 'DEMO', url: 'https://drone.live', label: 'Live Demo', order: 0 },
        { id: 'l-2', type: 'REPOSITORY', url: 'https://github.com/alice/drone', label: 'Source', order: 1 },
      ],
      contributors: [],
    };

    it('prepopulates all fields in edit mode', () => {
      authStoreModule.getWebAuthStore().setAccessToken('mock-token');

      render(<ProjectForm mode="edit" initialData={mockExistingProject} />);

      // Verify basic fields are pre-populated
      expect(screen.getByDisplayValue('Real-time Drone Telemetry')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Sub-second drone telemetry over 5G mesh networks.')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A full-stack streaming telemetry dashboard and onboard daemon for autonomous aerial vehicles.')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://images.unsplash.com/drone.jpg')).toBeInTheDocument();

      // Verify link fields pre-populated
      expect(screen.getByDisplayValue('https://drone.live')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://github.com/alice/drone')).toBeInTheDocument();

      // Verify tags
      expect(screen.getByText('#telemetry')).toBeInTheDocument();
      expect(screen.getByText('#drone')).toBeInTheDocument();
      expect(screen.getByText('#webrtc')).toBeInTheDocument();

      // Verify visibility badge
      expect(screen.getByText(/PUBLISHED/)).toBeInTheDocument();
    });

    it('displays validation errors when required fields are empty', async () => {
      authStoreModule.getWebAuthStore().setAccessToken('mock-token');

      render(<ProjectForm mode="create" />);

      // Attempt to save draft without title, tagline, description
      const saveDraftButton = screen.getByText('Save Draft');
      fireEvent.click(saveDraftButton);

      await waitFor(() => {
        expect(screen.getByText(/Please fill in the project title, tagline, and description/i)).toBeInTheDocument();
      });
    });

    it('enforces rights confirmation and showcase link before publishing', async () => {
      authStoreModule.getWebAuthStore().setAccessToken('mock-token');

      render(<ProjectForm mode="create" />);

      // Fill in required basic fields
      fireEvent.change(screen.getByPlaceholderText(/Campus Transit Tracker/i), {
        target: { value: 'My New Project' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Real-time GPS transit tracking/i), {
        target: { value: 'Crisp tagline for testing' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Describe the motivation, capabilities, architecture/i), {
        target: { value: 'Detailed overview of the project and architectural considerations.' },
      });
      fireEvent.change(screen.getByPlaceholderText(/images\.unsplash\.com/i), {
        target: { value: 'https://images.unsplash.com/cover.jpg' },
      });

      // Try to publish without checking confirmation
      const publishButton = screen.getByText('Publish Project');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText(/You must confirm that you have the rights to publish/i)).toBeInTheDocument();
      });
    });

    it('persists changes via projectsApi.update in edit mode', async () => {
      authStoreModule.getWebAuthStore().setAccessToken('mock-token');

      const updateSpy = vi.spyOn(projectsApi, 'update').mockResolvedValue({
        ...mockExistingProject,
        title: 'Real-time Drone Telemetry v2',
        slug: 'real-time-drone-telemetry-v2',
      });

      const onSuccessMock = vi.fn();

      render(<ProjectForm mode="edit" initialData={mockExistingProject} onSuccess={onSuccessMock} />);

      // Modify title
      const titleInput = screen.getByDisplayValue('Real-time Drone Telemetry');
      fireEvent.change(titleInput, { target: { value: 'Real-time Drone Telemetry v2' } });

      // Click save changes
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith('proj-123', expect.objectContaining({
          title: 'Real-time Drone Telemetry v2',
        }));
        expect(onSuccessMock).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 4. Project Owner Actions on Detail Page
  // =========================================================================
  describe('Project Owner Actions & Visibility Banners', () => {
    it('renders Edit Project button when current user is the owner', () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: {
          id: 'user-alice',
          email: 'alice@adypu.edu.in',
          full_name: 'Alice Creator',
          global_role: 'STUDENT',
        },
        isLoading: false,
      } as any);

      render(
        <ProjectOwnerActions
          slug="real-time-drone-telemetry"
          ownerId="user-alice"
          visibility="PUBLISHED"
        />
      );

      const editButton = screen.getByRole('link', { name: /EDIT PROJECT/i });
      expect(editButton).toBeInTheDocument();
      expect(editButton).toHaveAttribute('href', '/projects/real-time-drone-telemetry/edit');
    });

    it('does NOT render Edit Project button when current user is NOT the owner', () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: {
          id: 'user-bob',
          email: 'bob@adypu.edu.in',
          full_name: 'Bob Viewer',
          global_role: 'STUDENT',
        },
        isLoading: false,
      } as any);

      const { container } = render(
        <ProjectOwnerActions
          slug="real-time-drone-telemetry"
          ownerId="user-alice"
          visibility="PUBLISHED"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('does NOT render Edit Project button for anonymous visitors', () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: null,
        isLoading: false,
      } as any);

      const { container } = render(
        <ProjectOwnerActions
          slug="real-time-drone-telemetry"
          ownerId="user-alice"
          visibility="PUBLISHED"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders Owner Preview banner when project is in DRAFT status', () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: {
          id: 'user-alice',
          email: 'alice@adypu.edu.in',
          global_role: 'STUDENT',
        },
        isLoading: false,
      } as any);

      render(
        <ProjectOwnerStatusBanner
          ownerId="user-alice"
          visibility="DRAFT"
        />
      );

      expect(screen.getByText(/Owner Preview \(DRAFT\):/i)).toBeInTheDocument();
      expect(screen.getByText(/Only you and platform administrators can view this page/i)).toBeInTheDocument();
    });

    it('does NOT render Owner Preview banner when project is PUBLISHED', () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        data: {
          id: 'user-alice',
          email: 'alice@adypu.edu.in',
          global_role: 'STUDENT',
        },
        isLoading: false,
      } as any);

      const { container } = render(
        <ProjectOwnerStatusBanner
          ownerId="user-alice"
          visibility="PUBLISHED"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });
});
