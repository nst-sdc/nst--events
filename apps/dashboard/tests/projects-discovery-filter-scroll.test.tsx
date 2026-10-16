// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectsDiscoveryBar } from '../components/projects/ProjectsDiscoveryBar';
import SubmitProjectPage from '../app/(public)/projects/submit/page';
import { useRouter, useSearchParams } from 'next/navigation';
import { getWebAuthStore } from '../lib/auth-store';
import * as api from '../lib/api';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(() => '/projects/submit'),
}));

describe('NST Projects: Filter Scroll Prevention & Submission Auth Tests', () => {
  const mockPush = vi.fn();
  const mockReplace = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    (useRouter as any).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
    (useSearchParams as any).mockReturnValue(new URLSearchParams());
  });

  describe('ProjectsDiscoveryBar Scroll Preservation', () => {
    it('passes { scroll: false } to router.push when clicking view tabs', () => {
      render(
        <ProjectsDiscoveryBar
          currentView="explore"
          categories={[]}
        />
      );

      const trendingTab = screen.getByRole('button', { name: /trending/i });
      fireEvent.click(trendingTab);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/projects?view=trending', { scroll: false });
    });

    it('passes { scroll: false } to router.push when selecting a category pill', () => {
      render(
        <ProjectsDiscoveryBar
          currentView="explore"
          categories={[]}
        />
      );

      const webDevPill = screen.getByRole('button', { name: /web development/i });
      fireEvent.click(webDevPill);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('category=Web+Development'),
        { scroll: false }
      );
    });

    it('passes { scroll: false } to router.push when changing development status dropdown', () => {
      render(
        <ProjectsDiscoveryBar
          currentView="explore"
          categories={[]}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'LIVE' } });

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('status=LIVE'),
        { scroll: false }
      );
    });

    it('passes { scroll: false } to router.push when submitting search query', () => {
      render(
        <ProjectsDiscoveryBar
          currentView="explore"
          categories={[]}
        />
      );

      const input = screen.getByPlaceholderText(/search projects/i);
      fireEvent.change(input, { target: { value: 'autonomous shuttle' } });
      fireEvent.submit(input.closest('form')!);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('search=autonomous+shuttle'),
        { scroll: false }
      );
    });

    it('passes { scroll: false } to router.push when selecting Most Liked time-range filter', () => {
      render(
        <ProjectsDiscoveryBar
          currentView="most_liked"
          currentTimeRange="all"
          categories={[]}
        />
      );

      const thisWeekBtn = screen.getByRole('button', { name: /this week/i });
      fireEvent.click(thisWeekBtn);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('timeRange=week'),
        { scroll: false }
      );
    });
  });

  describe('SubmitProjectPage Authentication Enforcement', () => {
    it('redirects unauthenticated users to login with return_to=/projects/submit when refresh token fails', async () => {
      const authStore = getWebAuthStore();
      authStore.setAccessToken(null);

      // Mock refreshToken to fail (SESSION_DEAD)
      vi.spyOn(api, 'refreshToken').mockResolvedValue({ status: 'SESSION_DEAD' });

      render(<SubmitProjectPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login?return_to=/projects/submit');
      });
    });

    it('allows authenticated students with valid token to remain on the page without redirection', async () => {
      const authStore = getWebAuthStore();
      authStore.setAccessToken('valid-institutional-student-jwt');

      render(<SubmitProjectPage />);

      await waitFor(() => {
        expect(screen.getByText(/submit a project/i)).toBeInTheDocument();
      });
      expect(mockPush).not.toHaveBeenCalledWith('/login?return_to=/projects/submit');
    });
  });
});
