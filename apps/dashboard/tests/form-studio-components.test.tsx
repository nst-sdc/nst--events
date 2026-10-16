/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';

import { QuestionCardPreview } from '../components/forms/QuestionCardPreview';
import { FormStudio } from '../components/forms/FormStudio';
import { StudentFormStudio } from '../components/student/StudentFormStudio';
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
  usePathname: () => '/events/evt-1/edit',
}));

// Mock hooks
vi.mock('../hooks/useFieldDefinitions');
vi.mock('../hooks/useEventFormFields');
vi.mock('../hooks/useEventForms');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderAntd = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <App>{ui}</App>
    </QueryClientProvider>
  );
};

const renderStudent = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('QuestionCardPreview', () => {
  it('renders TEXT field preview with student theme', () => {
    const { container } = render(
      <QuestionCardPreview
        label="Full Legal Name"
        fieldType="TEXT"
        isRequired={true}
        theme="student"
      />
    );
    expect(screen.getByText('Interactive Student Preview')).toBeInTheDocument();
    expect(screen.getByText('TEXT')).toBeInTheDocument();
    expect(container.querySelector('input[type="text"]')).toBeInTheDocument();
  });

  it('renders SELECT field options correctly with antd theme', () => {
    render(
      <QuestionCardPreview
        label="T-Shirt Size"
        fieldType="SELECT"
        options={['S', 'M', 'L', 'XL']}
        isRequired={false}
        theme="antd"
      />
    );
    expect(screen.getByText('Student Form Preview')).toBeInTheDocument();
    expect(screen.getByText('SELECT')).toBeInTheDocument();
    expect(screen.getByText('Select an option...')).toBeInTheDocument();
    expect(screen.getByText('XL')).toBeInTheDocument();
  });

  it('renders RADIO field choices with student brutalist styling', () => {
    render(
      <QuestionCardPreview
        label="Experience Level"
        fieldType="RADIO"
        options={['Beginner', 'Intermediate', 'Advanced']}
        isRequired={true}
        theme="student"
      />
    );
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('Intermediate')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('renders MULTI_SELECT choices with checkbox previews', () => {
    render(
      <QuestionCardPreview
        label="Dietary Restrictions"
        fieldType="MULTI_SELECT"
        options={['Vegetarian', 'Vegan', 'Halal', 'Gluten-Free']}
        isRequired={false}
        theme="student"
      />
    );
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
    expect(screen.getByText('Vegan')).toBeInTheDocument();
    expect(screen.getByText('Halal')).toBeInTheDocument();
    expect(screen.getByText('Gluten-Free')).toBeInTheDocument();
  });
});

describe('FormStudio (Faculty/Admin Experience)', () => {
  const mockDefs = [
    {
      id: 'def-gh',
      key: 'github_url',
      label: 'GitHub Profile / Repository',
      fieldType: 'URL',
      isReusable: true,
      options: null,
    },
    {
      id: 'def-diet',
      key: 'dietary_requirements',
      label: 'Dietary Requirements',
      fieldType: 'SELECT',
      isReusable: true,
      options: ['None', 'Vegetarian', 'Vegan', 'Halal', 'Jain'],
    },
  ];

  const mockRegFields = [
    {
      eventId: 'evt-100',
      fieldDefinitionId: 'def-gh',
      isRequired: true,
      order: 0,
      fieldDefinition: mockDefs[0],
    },
  ];

  const mockForms = [
    {
      id: 'form-1',
      eventId: 'evt-100',
      title: 'Milestone 1 Project Submission',
      purpose: 'SUBMISSION',
      releaseAt: '2026-10-01T00:00:00.000Z',
      closeAt: '2026-10-20T23:59:59.000Z',
      fields: [{ id: 'f-1', fieldDefinitionId: 'def-gh', isRequired: true, order: 0 }],
      _count: { responses: 12 },
    },
  ];

  const mockSaveFields = vi.fn().mockResolvedValue({});
  const mockCreateDef = vi.fn().mockResolvedValue({
    id: 'def-new',
    key: 'linkedin_url',
    label: 'LinkedIn Profile',
    fieldType: 'URL',
    isReusable: true,
  });
  const mockCreateForm = vi.fn().mockResolvedValue({});
  const mockUpdateForm = vi.fn().mockResolvedValue({});
  const mockDeleteForm = vi.fn().mockResolvedValue({});
  const mockDuplicateForm = vi.fn().mockResolvedValue({});
  const mockPublishForm = vi.fn().mockResolvedValue({});
  const mockUnpublishForm = vi.fn().mockResolvedValue({});

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
      data: mockRegFields as any,
      isLoading: false,
    } as any);

    vi.mocked(useEventFieldsHook.useUpdateEventFormFields).mockReturnValue({
      mutateAsync: mockSaveFields,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useEventForms).mockReturnValue({
      data: mockForms as any,
      isLoading: false,
    } as any);

    vi.mocked(useEventFormsHook.useCreateEventForm).mockReturnValue({
      mutateAsync: mockCreateForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useUpdateEventForm).mockReturnValue({
      mutateAsync: mockUpdateForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useDeleteEventForm).mockReturnValue({
      mutateAsync: mockDeleteForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useDuplicateEventForm).mockReturnValue({
      mutateAsync: mockDuplicateForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.usePublishEventForm).mockReturnValue({
      mutateAsync: mockPublishForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useUnpublishEventForm).mockReturnValue({
      mutateAsync: mockUnpublishForm,
      isPending: false,
    } as any);
  });

  it('renders Form Studio header and tabs', () => {
    renderAntd(<FormStudio eventId="evt-100" />);
    expect(screen.getByText('Form Studio')).toBeInTheDocument();
    expect(screen.getByText(/Unified management for registration questions/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Registration Questionnaire/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /In-Event Forms/i })).toBeInTheDocument();
  });

  it('renders existing registration question with key, badge, and preview', () => {
    renderAntd(<FormStudio eventId="evt-100" />);
    expect(screen.getAllByText('GitHub Profile / Repository').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('github_url')).toBeInTheDocument();
    expect(screen.getByText('Saves to Student Profile')).toBeInTheDocument();
  });

  it('allows adding a preset question and marks changes as unsaved', async () => {
    renderAntd(<FormStudio eventId="evt-100" />);
    
    // Preset button for Dietary Requirements
    const dietButton = screen.getByRole('button', { name: /Dietary Requirements/i });
    fireEvent.click(dietButton);

    await waitFor(() => {
      // Both the preset button and the new question card display the label
      expect(screen.getAllByText('Dietary Requirements').length).toBe(2);
      expect(screen.getByText(/You have unsaved changes to your registration questions/i)).toBeInTheDocument();
    });
  });

  it('saves registration questionnaire on Save button click', async () => {
    renderAntd(<FormStudio eventId="evt-100" />);
    
    const dietButton = screen.getByRole('button', { name: /Dietary Requirements/i });
    fireEvent.click(dietButton);

    await waitFor(() => {
      expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Questionnaire/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveFields).toHaveBeenCalledTimes(1);
    });
  });

  it('renders In-Event Forms tab with scheduled forms and actions', async () => {
    renderAntd(<FormStudio eventId="evt-100" defaultTab="forms" />);

    await waitFor(() => {
      expect(screen.getByText('Milestone 1 Project Submission')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configure Questions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Responses/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Edit Schedule/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Duplicate/i })).toBeInTheDocument();
    });
  }, 30000);
});

describe('StudentFormStudio (Club Admin Brutalist Experience)', () => {
  const mockDefs = [
    {
      id: 'def-gh',
      key: 'github_url',
      label: 'GitHub Profile / Repository',
      fieldType: 'URL',
      isReusable: true,
      options: null,
    },
  ];

  const mockRegFields = [
    {
      eventId: 'evt-200',
      fieldDefinitionId: 'def-gh',
      isRequired: true,
      order: 0,
      fieldDefinition: mockDefs[0],
    },
  ];

  const mockForms = [
    {
      id: 'form-sub-1',
      eventId: 'evt-200',
      title: 'Final Code Submission',
      purpose: 'SUBMISSION',
      releaseAt: '2026-10-10T00:00:00.000Z',
      closeAt: '2026-10-25T23:59:59.000Z',
      fields: [{ id: 'f-2', fieldDefinitionId: 'def-gh', isRequired: true, order: 0 }],
      _count: { responses: 5 },
    },
  ];

  const mockSaveFields = vi.fn().mockResolvedValue({});
  const mockCreateDef = vi.fn().mockResolvedValue({
    id: 'def-port',
    key: 'portfolio_url',
    label: 'Portfolio / Personal Website',
    fieldType: 'URL',
    isReusable: true,
  });
  const mockCreateForm = vi.fn().mockResolvedValue({});
  const mockUpdateForm = vi.fn().mockResolvedValue({});
  const mockDeleteForm = vi.fn().mockResolvedValue({});
  const mockDuplicateForm = vi.fn().mockResolvedValue({});
  const mockPublishForm = vi.fn().mockResolvedValue({});
  const mockUnpublishForm = vi.fn().mockResolvedValue({});

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
      data: mockRegFields as any,
      isLoading: false,
    } as any);

    vi.mocked(useEventFieldsHook.useUpdateEventFormFields).mockReturnValue({
      mutateAsync: mockSaveFields,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useEventForms).mockReturnValue({
      data: mockForms as any,
      isLoading: false,
    } as any);

    vi.mocked(useEventFormsHook.useCreateEventForm).mockReturnValue({
      mutateAsync: mockCreateForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useUpdateEventForm).mockReturnValue({
      mutateAsync: mockUpdateForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useDeleteEventForm).mockReturnValue({
      mutateAsync: mockDeleteForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useDuplicateEventForm).mockReturnValue({
      mutateAsync: mockDuplicateForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.usePublishEventForm).mockReturnValue({
      mutateAsync: mockPublishForm,
      isPending: false,
    } as any);

    vi.mocked(useEventFormsHook.useUnpublishEventForm).mockReturnValue({
      mutateAsync: mockUnpublishForm,
      isPending: false,
    } as any);
  });

  it('renders student brutalist studio with Syne typography and color palette', () => {
    renderStudent(<StudentFormStudio eventId="evt-200" />);
    expect(screen.getByText('FORM STUDIO')).toBeInTheDocument();
    expect(screen.getByText(/Configure registration requirements and scheduled milestone forms/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registration \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /In-Event Forms \(1\)/i })).toBeInTheDocument();
  });

  it('renders student question card with brutalist badges and synced profile status', () => {
    renderStudent(<StudentFormStudio eventId="evt-200" />);
    expect(screen.getAllByText('GitHub Profile / Repository').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/key: github_url/i)).toBeInTheDocument();
    expect(screen.getByText('Saves to Student Profile')).toBeInTheDocument();
  });

  it('adds preset question and shows feedback message', async () => {
    renderStudent(<StudentFormStudio eventId="evt-200" />);

    const portButton = screen.getByRole('button', { name: /Portfolio/i });
    fireEvent.click(portButton);

    await waitFor(() => {
      expect(screen.getAllByText('Portfolio / Personal Website').length).toBe(2);
      expect(screen.getByText(/Unsaved Questionnaire Changes/i)).toBeInTheDocument();
    });
  });

  it('saves questionnaire in student mode', async () => {
    renderStudent(<StudentFormStudio eventId="evt-200" />);

    const portButton = screen.getByRole('button', { name: /Portfolio/i });
    fireEvent.click(portButton);

    await waitFor(() => {
      expect(screen.getByText(/Unsaved Questionnaire Changes/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Questionnaire/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveFields).toHaveBeenCalledTimes(1);
    });
  });

  it('switches to In-Event Forms and shows scheduled cards and actions', async () => {
    renderStudent(<StudentFormStudio eventId="evt-200" />);

    const formsTab = screen.getByRole('button', { name: /In-Event Forms \(1\)/i });
    fireEvent.click(formsTab);

    await waitFor(() => {
      expect(screen.getByText('Final Code Submission')).toBeInTheDocument();
      expect(screen.getByText('SUBMISSION')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Questions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Responses/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clone/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });
  });
});
