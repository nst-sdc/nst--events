/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';

import { cleanup } from '@testing-library/react';
import { FormStudio } from '../components/forms/FormStudio';
import * as useFieldDefsHook from '../hooks/useFieldDefinitions';
import * as useEventFieldsHook from '../hooks/useEventFormFields';
import * as useEventFormsHook from '../hooks/useEventForms';

afterEach(() => {
  cleanup();
});

// Mock matchMedia and ResizeObserver
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/events/evt-test-1/edit',
}));

vi.mock('../hooks/useFieldDefinitions');
vi.mock('../hooks/useEventFormFields');
vi.mock('../hooks/useEventForms');

const renderAntd = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App>{ui}</App>
    </QueryClientProvider>
  );
};

describe('FormStudio: Deferred Persistence & Draft Architecture', () => {
  const mockDefs = [
    {
      id: 'def-github',
      key: 'github_url',
      label: 'GitHub Profile / Repository',
      fieldType: 'URL',
      isReusable: true,
      options: null,
      createdByClubId: null,
      createdAt: '2026-09-01T00:00:00Z',
    },
  ];

  const mockExistingFields = [
    {
      eventId: 'evt-test-1',
      fieldDefinitionId: 'def-github',
      isRequired: true,
      order: 0,
      fieldDefinition: mockDefs[0],
    },
  ];

  const mockCreateDef = vi.fn();
  const mockSaveFields = vi.fn().mockResolvedValue({ data: [] });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useFieldDefsHook.useAttachableFieldDefinitions).mockReturnValue({
      data: mockDefs as any,
      isLoading: false,
    } as any);

    vi.mocked(useFieldDefsHook.useCreateFieldDefinition).mockReturnValue({
      mutateAsync: mockCreateDef,
      isPending: false,
    } as any);

    vi.mocked(useEventFieldsHook.useEventFormFields).mockReturnValue({
      data: mockExistingFields as any,
      isLoading: false,
    } as any);

    vi.mocked(useEventFieldsHook.useUpdateEventFormFields).mockReturnValue({
      mutateAsync: mockSaveFields,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useEventForms).mockReturnValue({
      data: [] as any,
      isLoading: false,
    } as any);

    vi.mocked(useEventFormsHook.useCreateEventForm).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useUpdateEventForm).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useDeleteEventForm).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useDuplicateEventForm).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.usePublishEventForm).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useUnpublishEventForm).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Clicking Quick Question Presets causes zero backend write requests', async () => {
    renderAntd(<FormStudio eventId="evt-test-1" />);

    // Save button is initially disabled because nothing changed
    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    expect(saveButton).toBeDisabled();

    // Click Dietary Requirements preset
    const dietButton = screen.getByRole('button', { name: /Dietary Requirements/i });
    fireEvent.click(dietButton);

    await waitFor(() => {
      // Question appears in UI immediately
      expect(screen.getAllByText('Dietary Requirements').length).toBe(2);
      expect(screen.getByText(/You have unsaved changes to your registration questions/i)).toBeInTheDocument();
    });

    // PROOF: createFieldDefinition was NOT called!
    expect(mockCreateDef).not.toHaveBeenCalled();
    // PROOF: saveEventFields was NOT called!
    expect(mockSaveFields).not.toHaveBeenCalled();

    // Save button is now enabled
    expect(saveButton).not.toBeDisabled();
  });

  it('2. Adding several presets updates local draft without any backend mutation', async () => {
    renderAntd(<FormStudio eventId="evt-test-1" />);

    const dietButton = screen.getByRole('button', { name: /Dietary Requirements/i });
    const tshirtButton = screen.getByRole('button', { name: /T-Shirt Size/i });
    const expButton = screen.getByRole('button', { name: /Experience Level/i });

    fireEvent.click(dietButton);
    fireEvent.click(tshirtButton);
    fireEvent.click(expButton);

    await waitFor(() => {
      expect(screen.getAllByText('Dietary Requirements').length).toBe(2);
      expect(screen.getAllByText('T-Shirt Size').length).toBe(2);
      expect(screen.getAllByText('Experience Level').length).toBe(2);
    });

    // PROOF: Still ZERO backend requests
    expect(mockCreateDef).toHaveBeenCalledTimes(0);
    expect(mockSaveFields).toHaveBeenCalledTimes(0);
  });

  it('3. Removing an unsaved or saved question updates draft only', async () => {
    renderAntd(<FormStudio eventId="evt-test-1" />);

    // Add preset
    const dietButton = screen.getByRole('button', { name: /Dietary Requirements/i });
    fireEvent.click(dietButton);

    await waitFor(() => {
      expect(screen.getAllByText('Dietary Requirements').length).toBe(2);
    });

    // Remove the newly added preset question
    const removeButtons = screen.getAllByRole('button', { name: /Remove question/i });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    const confirmButton = await screen.findByRole('button', { name: /^Remove$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Removed from questionnaire
      expect(screen.getAllByText('Dietary Requirements').length).toBe(1); // Only in presets bar
    });

    // PROOF: Still zero backend calls
    expect(mockSaveFields).toHaveBeenCalledTimes(0);
  });

  it('4. Clicking Save Changes sends single atomic batch request with inline definitions', async () => {
    renderAntd(<FormStudio eventId="evt-test-1" />);

    const dietButton = screen.getByRole('button', { name: /Dietary Requirements/i });
    fireEvent.click(dietButton);

    await waitFor(() => {
      expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveFields).toHaveBeenCalledTimes(1);
    });

    const saveCall = mockSaveFields.mock.calls[0][0];
    expect(saveCall.fields).toHaveLength(2);

    // First field is existing (uses fieldDefinitionId)
    expect(saveCall.fields[0].fieldDefinitionId).toBe('def-github');
    expect(saveCall.fields[0].order).toBe(0);

    // Second field is newly added preset (uses inline definition payload)
    expect(saveCall.fields[1].definition).toBeDefined();
    expect(saveCall.fields[1].definition.key).toBe('dietary_requirements');
    expect(saveCall.fields[1].definition.fieldType).toBe('SELECT');
    expect(saveCall.fields[1].order).toBe(1);
  });

  it('5. Failed save retains the full local draft and displays actionable error', async () => {
    mockSaveFields.mockRejectedValueOnce(new Error('Simulated network error or conflict'));

    renderAntd(<FormStudio eventId="evt-test-1" />);

    const dietButton = screen.getByRole('button', { name: /Dietary Requirements/i });
    fireEvent.click(dietButton);

    await waitFor(() => {
      expect(screen.getAllByText('Dietary Requirements').length).toBe(2);
    });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Local draft must still be present!
      expect(screen.getAllByText('Dietary Requirements').length).toBe(2);
      expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    });
  });

  it('6. Warns before navigating away when draft has unsaved changes', async () => {
    renderAntd(<FormStudio eventId="evt-test-1" />);

    const dietButton = screen.getByRole('button', { name: /Dietary Requirements/i });
    fireEvent.click(dietButton);

    await waitFor(() => {
      expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    });

    const event = new Event('beforeunload', { cancelable: true });
    const prevented = !window.dispatchEvent(event);
    expect(prevented).toBe(true);
  });
});
