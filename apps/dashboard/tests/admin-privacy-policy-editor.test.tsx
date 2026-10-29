// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AdminPrivacyPolicyPage from '../app/(app)/admin/privacy-policy/page';
import * as currentUserHook from '../hooks/useCurrentUser';
import * as apiModule from '../lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Platform Admin Privacy Policy Editor Suite', () => {
  const mockAdminUser: any = {
    id: 'admin-1',
    full_name: 'Jane Admin',
    email: 'jane@nstsdc.org',
    global_role: 'PLATFORM_ADMIN',
  };

  const mockPolicyData = {
    slug: 'privacy-policy',
    title: 'Privacy Policy — NST Events',
    published_content: '# Published Content v1',
    draft_content: '# Draft Content In Progress',
    concurrency_revision: 5,
    published_version: 1,
    published_at: '2026-09-09T00:00:00.000Z',
    updated_at: '2026-10-28T12:00:00.000Z',
    published_by: {
      id: 'admin-1',
      full_name: 'Jane Admin',
      email: 'jane@nstsdc.org',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 403 Forbidden when user is not a PLATFORM_ADMIN', () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'student-1',
        full_name: 'Student User',
        email: 'student@adypu.edu.in',
        globalRole: 'STUDENT',
      } as any,
      isLoading: false,
      isAuthenticated: true,
    } as any);

    render(<AdminPrivacyPolicyPage />);

    expect(screen.getByText('Platform Admin Authorization Required')).toBeInTheDocument();
  });

  it('loads policy data and renders editor with metadata and action buttons', async () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isAuthenticated: true,
    } as any);

    vi.spyOn(apiModule, 'apiClient').mockResolvedValue(mockPolicyData);

    render(<AdminPrivacyPolicyPage />);

    // Initially loading
    expect(screen.getByText(/Loading Institutional Privacy Policy/i)).toBeInTheDocument();

    // After load
    await waitFor(() => {
      expect(screen.getByText('Privacy Policy Management')).toBeInTheDocument();
    });

    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('#5')).toBeInTheDocument();
    expect(screen.getByText('Draft in Sync')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: /privacy policy document/i });
    expect(textarea).toHaveValue('# Draft Content In Progress');

    const saveButton = screen.getByRole('button', { name: /save draft/i });
    expect(saveButton).toBeDisabled(); // Initially clean (not dirty)
  });

  it('marks state dirty on edit and allows saving draft', async () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isAuthenticated: true,
    } as any);

    const apiClientSpy = vi.spyOn(apiModule, 'apiClient').mockImplementation(async (url, options) => {
      if (url === '/v1/admin/policies/privacy-policy' && !options?.method) {
        return mockPolicyData;
      }
      if (url === '/v1/admin/policies/privacy-policy' && options?.method === 'PUT') {
        return {
          status: 'SUCCESS',
          concurrency_revision: 6,
          published_version: 1,
          updated_at: '2026-10-29T10:00:00.000Z',
        };
      }
      throw new Error(`Unexpected call: ${url}`);
    });

    render(<AdminPrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy Management')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox', { name: /privacy policy document/i });
    fireEvent.change(textarea, { target: { value: '# Modified Draft Content by Me' } });

    // Now dirty
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    const saveButton = screen.getByRole('button', { name: /save draft/i });
    expect(saveButton).not.toBeDisabled();

    // Click Save Draft
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiClientSpy).toHaveBeenCalledWith(
        '/v1/admin/policies/privacy-policy',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            action: 'SAVE_DRAFT',
            content: '# Modified Draft Content by Me',
            base_concurrency_revision: 5,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Draft successfully saved at revision 6/i)).toBeInTheDocument();
    });
  });

  it('opens confirmation modal before publishing', async () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isAuthenticated: true,
    } as any);

    const apiClientSpy = vi.spyOn(apiModule, 'apiClient').mockImplementation(async (url, options) => {
      if (url === '/v1/admin/policies/privacy-policy' && !options?.method) {
        return mockPolicyData;
      }
      if (url === '/v1/admin/policies/privacy-policy' && options?.method === 'PUT') {
        return {
          status: 'SUCCESS',
          concurrency_revision: 6,
          published_version: 2,
          published_at: '2026-10-29T11:00:00.000Z',
        };
      }
      throw new Error(`Unexpected call: ${url}`);
    });

    render(<AdminPrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy Management')).toBeInTheDocument();
    });

    const publishButton = screen.getByRole('button', { name: /publish policy/i });
    fireEvent.click(publishButton);

    // Modal opens
    expect(screen.getByText(/Confirm Publication: Version 2/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /confirm & publish live/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(apiClientSpy).toHaveBeenCalledWith(
        '/v1/admin/policies/privacy-policy',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            action: 'PUBLISH',
            content: '# Draft Content In Progress',
            base_concurrency_revision: 5,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Version 2 published live!/i)).toBeInTheDocument();
    });
  });

  it('handles 409 conflict non-destructively with 3-way reconciliation modal', async () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      data: mockAdminUser,
      isLoading: false,
      isAuthenticated: true,
    } as any);

    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (url, options) => {
      if (url === '/v1/admin/policies/privacy-policy' && !options?.method) {
        return mockPolicyData;
      }
      if (url === '/v1/admin/policies/privacy-policy' && options?.method === 'PUT') {
        const error = new apiModule.ApiError(409, 'Conflict', {
          current_concurrency_revision: 9,
          current_published_version: 1,
          server_draft_content: '# Server Draft Modified Concurrently',
          last_modified_by: {
            name: 'Dr. Jane Smith',
            email: 'jane@nstsdc.org',
          },
        });
        throw error;
      }
      throw new Error(`Unexpected call: ${url}`);
    });

    render(<AdminPrivacyPolicyPage />);

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy Management')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox', { name: /privacy policy document/i });
    fireEvent.change(textarea, { target: { value: '# My Local Edits That Must Not Disappear' } });

    const saveButton = screen.getByRole('button', { name: /save draft/i });
    fireEvent.click(saveButton);

    // 409 modal appears
    await waitFor(() => {
      expect(screen.getByText(/Concurrent Modification Detected \(HTTP 409\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Another administrator \(Dr\. Jane Smith <jane@nstsdc\.org>\) updated the policy/i)).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('# My Local Edits That Must Not Disappear')).toHaveLength(2);
    expect(screen.getByDisplayValue('# Server Draft Modified Concurrently')).toBeInTheDocument();

    // Clicking "Keep Local Edits & Review"
    const keepButton = screen.getByRole('button', { name: /keep local edits & review/i });
    fireEvent.click(keepButton);

    // Acknowledged and local text remains intact in the editor!
    await waitFor(() => {
      expect(screen.getByText(/Server revision acknowledged/i)).toBeInTheDocument();
    });

    expect(textarea).toHaveValue('# My Local Edits That Must Not Disappear');
  });
});
