// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { projectsApi } from '../lib/projects-api';
import MyProjectsPage from '../app/(public)/my/projects/page';
import { getWebAuthStore } from '../lib/auth-store';
import * as useCurrentUserModule from '../hooks/useCurrentUser';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('../components/layout/StudentAppShell', () => ({
  StudentAppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="student-app-shell">{children}</div>,
}));

vi.mock('../components/layout/ClubAdminProvider', () => ({
  ClubAdminProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="club-admin-provider">{children}</div>,
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    refreshToken: vi.fn().mockResolvedValue({ status: 'SUCCESS', token: 'mock-token' }),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe('Collaborator Invitation Workflow UI & Client API Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWebAuthStore().setAccessToken('mock-token');
  });

  describe('Client API contracts & validation', () => {
    it('projectsApi.inviteContributor sends correct payload', async () => {
      const inviteSpy = vi.spyOn(projectsApi, 'inviteContributor').mockResolvedValue({
        id: 'c-1',
        projectId: 'proj-1',
        role: 'Frontend Engineer',
        status: 'PENDING',
      } as any);

      const result = await projectsApi.inviteContributor('proj-1', 'bob@adypu.edu.in', 'Frontend Engineer');
      expect(result.id).toBe('c-1');
      expect(inviteSpy).toHaveBeenCalledWith('proj-1', 'bob@adypu.edu.in', 'Frontend Engineer');
    });

    it('projectsApi.respondContributor sends acceptance and rejection payloads', async () => {
      const respondSpy = vi.spyOn(projectsApi, 'respondContributor').mockResolvedValue({
        id: 'c-1',
        status: 'ACCEPTED',
      } as any);

      await projectsApi.respondContributor('c-1', 'ACCEPTED');
      expect(respondSpy).toHaveBeenCalledWith('c-1', 'ACCEPTED');

      await projectsApi.respondContributor('c-1', 'DECLINED');
      expect(respondSpy).toHaveBeenCalledWith('c-1', 'DECLINED');
    });

    it('projectsApi.removeContributor calls DELETE endpoint', async () => {
      const removeSpy = vi.spyOn(projectsApi, 'removeContributor').mockResolvedValue({
        success: true,
        message: 'Contributor removed',
      });

      const res = await projectsApi.removeContributor('proj-1', 'c-1');
      expect(removeSpy).toHaveBeenCalledWith('proj-1', 'c-1');
      expect(res.success).toBe(true);
    });
  });

  describe('My Projects Page Collaborator & Invitation Rendering', () => {
    const mockOwnedProjects = [
      {
        id: 'proj-owned-1',
        title: 'Campus Transit App',
        slug: 'campus-transit-app',
        tagline: 'Track campus shuttles in real-time',
        visibility: 'PUBLISHED',
        likeCount: 12,
        viewCount: 45,
        updatedAt: '2026-10-18T10:00:00Z',
        contributors: [
          {
            id: 'c-owned-1',
            role: 'Lead Architect',
            status: 'ACCEPTED',
            name: 'Bob Collaborator',
            avatar_url: null,
          },
        ],
      },
    ];

    const mockContributingProjects = [
      {
        id: 'c-inv-1',
        contributor_id: 'c-inv-1',
        role: 'ML Engineer',
        status: 'PENDING',
        created_at: '2026-10-19T12:00:00Z',
        project: {
          id: 'proj-other-1',
          title: 'NST AI Research Hub',
          slug: 'nst-ai-research-hub',
          tagline: 'Collaborative ML papers',
          owner_name: 'Carol Supervisor',
        },
      },
    ];

    it('displays pending invitations under Contributing tab with Accept and Decline actions', async () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        user: { id: 'user-bob', email: 'bob@newtonschool.co', fullName: 'Bob Student', role: 'STUDENT' },
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(projectsApi, 'getMyProjects').mockResolvedValue({
        owned: mockOwnedProjects as any,
        contributing: mockContributingProjects as any,
        stats: { total: 1, published: 1, drafts: 0, unpublished: 0, totalLikes: 12, totalViews: 45 },
      });

      render(<MyProjectsPage />);

      await waitForElementToBeRemoved(() => screen.queryByText(/Loading your projects/i));

      const collaborationsTab = screen.getByRole('button', { name: /collaborations/i });
      fireEvent.click(collaborationsTab);

      await waitFor(() => {
        expect(screen.getByText('NST AI Research Hub')).toBeInTheDocument();
      });

      expect(screen.getByText(/Carol Supervisor/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument();
    });

    it('clicking Accept calls projectsApi.respondContributor with ACCEPTED', async () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        user: { id: 'user-bob', email: 'bob@newtonschool.co', fullName: 'Bob Student', role: 'STUDENT' },
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      const respondSpy = vi.spyOn(projectsApi, 'respondContributor').mockResolvedValue({
        id: 'c-inv-1',
        projectId: 'proj-other-1',
        status: 'ACCEPTED',
      } as any);

      vi.spyOn(projectsApi, 'getMyProjects').mockResolvedValue({
        owned: mockOwnedProjects as any,
        contributing: mockContributingProjects as any,
        stats: { total: 1, published: 1, drafts: 0, unpublished: 0, totalLikes: 12, totalViews: 45 },
      });

      render(<MyProjectsPage />);

      await waitForElementToBeRemoved(() => screen.queryByText(/Loading your projects/i));

      const collaborationsTab = screen.getByRole('button', { name: /collaborations/i });
      fireEvent.click(collaborationsTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Accept/i }));

      await waitFor(() => {
        expect(respondSpy).toHaveBeenCalledWith('c-inv-1', 'ACCEPTED');
      });
    });

    it('renders Collaborators button on owned project and opens management modal', async () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        user: { id: 'user-alice', email: 'alice@adypu.edu.in', fullName: 'Alice Student', role: 'STUDENT' },
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(projectsApi, 'getMyProjects').mockResolvedValue({
        owned: mockOwnedProjects as any,
        contributing: [] as any,
        stats: { total: 1, published: 1, drafts: 0, unpublished: 0, totalLikes: 12, totalViews: 45 },
      });

      vi.spyOn(projectsApi, 'listContributors').mockResolvedValue([
        {
          id: 'c-owned-1',
          role: 'Lead Architect',
          status: 'ACCEPTED',
          name: 'Bob Collaborator',
          avatar_url: null,
          email: 'bob@newtonschool.co',
          user_id: 'user-bob',
          created_at: '2026-10-18T10:00:00Z',
        },
      ]);

      render(<MyProjectsPage />);

      await waitForElementToBeRemoved(() => screen.queryByText(/Loading your projects/i));

      const collabBtn = screen.getByTitle('Manage Project Collaborators');
      expect(collabBtn).toBeInTheDocument();
      fireEvent.click(collabBtn);

      await waitFor(() => {
        expect(screen.getByText('Project Collaborators')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Bob Collaborator')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Lead Architect/i)).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText(/peer\.name@adypu\.edu\.in/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Lead Designer/i)).toBeInTheDocument();
    });

    it('displays prominent pending invitations banner on default All tab', async () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        user: { id: 'user-bob', email: 'bob@newtonschool.co', fullName: 'Bob Student', role: 'STUDENT' },
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(projectsApi, 'getMyProjects').mockResolvedValue({
        owned: mockOwnedProjects as any,
        contributing: mockContributingProjects as any,
        stats: { total: 1, published: 1, drafts: 0, unpublished: 0, totalLikes: 12, totalViews: 45 },
      });

      render(<MyProjectsPage />);

      await waitForElementToBeRemoved(() => screen.queryByText(/Loading your projects/i));

      // Banner should be visible on the default tab
      expect(screen.getByText(/You have 1 pending collaborator invitation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View Invitations \(1\)/i })).toBeInTheDocument();

      // Clicking View Invitations switches to Collaborations tab
      fireEvent.click(screen.getByRole('button', { name: /View Invitations \(1\)/i }));

      await waitFor(() => {
        expect(screen.getByText('NST AI Research Hub')).toBeInTheDocument();
      });
    });

    it('displays a real error state with Retry button when listContributors fails in the modal', async () => {
      vi.spyOn(useCurrentUserModule, 'useCurrentUser').mockReturnValue({
        user: { id: 'user-alice', email: 'alice@adypu.edu.in', fullName: 'Alice Student', role: 'STUDENT' },
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(projectsApi, 'getMyProjects').mockResolvedValue({
        owned: mockOwnedProjects as any,
        contributing: [] as any,
        stats: { total: 1, published: 1, drafts: 0, unpublished: 0, totalLikes: 12, totalViews: 45 },
      });

      vi.spyOn(projectsApi, 'listContributors').mockRejectedValueOnce(new Error('Network connection timeout'));

      render(<MyProjectsPage />);

      await waitForElementToBeRemoved(() => screen.queryByText(/Loading your projects/i));

      const collabBtn = screen.getByTitle('Manage Project Collaborators');
      fireEvent.click(collabBtn);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load collaborators: Network connection timeout/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      expect(screen.queryByText(/No collaborators invited yet/i)).not.toBeInTheDocument();
    });
  });
});
