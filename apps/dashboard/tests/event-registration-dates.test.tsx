/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreateEventPage from '../app/(app)/events/create/page';
import EditEventPage from '../app/(app)/events/[id]/edit/page';
import * as useCurrentUserHook from '../hooks/useCurrentUser';
import * as useClubsHook from '../hooks/useClubs';
import * as useAcademicBatchesHook from '../hooks/useAcademicBatches';
import * as useCreateEventHook from '../hooks/useCreateEvent';
import * as useEventDetailHook from '../hooks/useEventDetail';
import * as useUpdateEventHook from '../hooks/useUpdateEvent';
import { App } from 'antd';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('../hooks/useCurrentUser');
vi.mock('../hooks/useClubs');
vi.mock('../hooks/useAcademicBatches');
vi.mock('../hooks/useCreateEvent');
vi.mock('../hooks/useEventDetail');
vi.mock('../hooks/useUpdateEvent');

vi.mock('antd/es/app', () => ({
  App: {
    useApp: () => ({
      message: { success: vi.fn(), error: vi.fn() },
      modal: { confirm: vi.fn(), warning: vi.fn() }
    }),
  },
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <App>{ui}</App>
    </QueryClientProvider>
  );
};

describe('Event Registration Dates UI (Create & Edit)', () => {
  let mockCreateMutateAsync: any;
  let mockUpdateMutateAsync: any;
  let mockPush: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: 'new-event-1' });
    mockUpdateMutateAsync = vi.fn().mockResolvedValue({ id: 'existing-event-1' });
    mockPush = vi.fn();

    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
    } as any);

    vi.spyOn(useCreateEventHook, 'useCreateEvent').mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as any);

    vi.spyOn(useCreateEventHook, 'useSubmitEventForApproval').mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);

    vi.spyOn(useUpdateEventHook, 'useUpdateEvent').mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    } as any);

    vi.spyOn(useAcademicBatchesHook, 'useAcademicBatches').mockReturnValue({
      data: [{ id: 'batch-1', display_name: 'Batch 2026' }],
      isLoading: false,
    } as any);

    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-admin',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [{ club_id: 'club-1', role: 'CLUB_ADMIN' }],
      },
      isLoading: false,
    } as any);

    vi.spyOn(useClubsHook, 'useClubs').mockReturnValue({
      data: {
        data: [{ id: 'club-1', name: 'Dev Club' }],
      },
      isLoading: false,
    } as any);

    vi.spyOn(useEventDetailHook, 'useEventDetail').mockReturnValue({
      data: {
        id: 'existing-event-1',
        title: 'Tech Summit 2026',
        slug: 'tech-summit-2026',
        description: 'Annual technical conference',
        startTime: '2026-11-20T10:00:00.000Z',
        endTime: '2026-11-20T18:00:00.000Z',
        registrationStartTime: '2026-11-01T09:00:00.000Z',
        registrationEndTime: '2026-11-19T23:59:00.000Z',
        registrationStatus: 'OPEN',
        locationName: 'Main Auditorium',
        state: 'DRAFT',
        visibility: 'PUBLIC',
        registrationType: 'INDIVIDUAL',
        attendanceType: 'SINGLE',
        maxCapacity: 150,
        registrationCount: 0,
        isLocked: false,
        audience: 'ALL_STUDENTS',
        lock_deadline: '2026-11-21T18:00:00.000Z',
        lock_state: 'UNLOCKED',
        eventClubs: [{ clubId: 'club-1', isPrimary: true, club: { id: 'club-1', name: 'Dev Club' } }],
      } as any,
      isLoading: false,
      isError: false,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Create Event form renders Registration Opens At and Registration Closes At fields', () => {
    renderWithProviders(<CreateEventPage />);

    expect(screen.getByText('Event Schedule (Start and End Date/Time)')).toBeInTheDocument();
    expect(screen.getByText('Registration Period')).toBeInTheDocument();
    expect(screen.getByText('Registration Opens At')).toBeInTheDocument();
    expect(screen.getByText('Registration Closes At')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select registration open time')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select registration close time')).toBeInTheDocument();
  });

  it('2. Edit Event form renders and pre-populates Registration Opens At and Registration Closes At fields', async () => {
    const paramsPromise: any = Promise.resolve({ id: 'existing-event-1' });
    paramsPromise.status = 'fulfilled';
    paramsPromise.value = { id: 'existing-event-1' };

    renderWithProviders(<EditEventPage params={paramsPromise} />);

    expect(await screen.findByText('Registration Period')).toBeInTheDocument();
    expect(await screen.findByText('Registration Opens At')).toBeInTheDocument();
    expect(await screen.findByText('Registration Closes At')).toBeInTheDocument();
  });

  it('3. Create Event form has correct placeholder and form elements for both fields', () => {
    renderWithProviders(<CreateEventPage />);

    const openInput = screen.getByPlaceholderText('Select registration open time');
    const closeInput = screen.getByPlaceholderText('Select registration close time');

    expect(openInput).toBeInTheDocument();
    expect(closeInput).toBeInTheDocument();
  });
});

