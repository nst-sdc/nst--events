/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentEventDetailPage from '../app/(student)/student/events/[id]/page';
import TeamHubPage from '../app/(student)/student/events/[id]/team/page';
import CreateEventPage from '../app/(student)/student/manage/events/create/page';
import * as useCurrentUserHook from '../hooks/useCurrentUser';
import * as useEventDetailHook from '../hooks/useEventDetail';
import * as useRegisterForEventHook from '../hooks/useRegisterForEvent';
import * as useTeamsHook from '../hooks/useTeams';
import * as useClubAdminHook from '../components/layout/ClubAdminProvider';
import * as useClubsHook from '../hooks/useClubs';
import * as useAcademicBatchesHook from '../hooks/useAcademicBatches';
import * as useEventFormFieldsHook from '../hooks/useEventFormFields';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn().mockReturnValue('/student/events/evt-test-1'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

vi.mock('../hooks/useCurrentUser');
vi.mock('../hooks/useEventDetail');
vi.mock('../hooks/useRegisterForEvent');
vi.mock('../hooks/useTeams');
vi.mock('../components/layout/ClubAdminProvider');
vi.mock('../hooks/useClubs');
vi.mock('../hooks/useAcademicBatches');
vi.mock('../hooks/useCreateEvent', () => ({
  useCreateEvent: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
  useSubmitEventForApproval: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../hooks/useEventForms', () => ({
  useEventForms: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));
vi.mock('../hooks/useAttendance', () => ({
  useAttendanceDisputes: vi.fn().mockReturnValue({ data: { pages: [{ data: [] }] }, isLoading: false }),
  useMyAttendance: vi.fn().mockReturnValue({ data: { pages: [{ data: [] }] }, isLoading: false }),
}));
vi.mock('../hooks/useEventLifecycle', () => ({
  useEventLifecycle: vi.fn().mockReturnValue({ data: null, isLoading: false }),
}));
vi.mock('../hooks/useEventFormFields', () => ({
  useEventFormFields: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));
vi.mock('../hooks/useProfileValues', () => ({
  useProfileValues: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

const mockEvent: any = {
  id: 'evt-test-1',
  title: 'Annual Campus Hackathon',
  slug: 'annual-campus-hackathon',
  description: 'Test event description for security verification',
  startTime: '2026-11-20T10:00:00.000Z',
  endTime: '2026-11-20T18:00:00.000Z',
  registrationStartTime: '2026-11-01T09:00:00.000Z',
  registrationEndTime: '2026-11-19T23:59:00.000Z',
  registrationStatus: 'OPEN',
  locationName: 'Main Audi',
  state: 'PUBLISHED',
  visibility: 'PUBLIC',
  registrationType: 'INDIVIDUAL',
  attendanceType: 'SINGLE',
  maxCapacity: 100,
  registrationCount: 10,
  lock_state: 'UNLOCKED',
  eventClubs: [
    {
      isPrimary: true,
      club: { id: 'club-1', name: 'Tech Club' },
    },
  ],
};

describe('Admin Registration Guarding & Validation UI Tests', () => {
  let mockPush: any;
  let mockRegisterMutate: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPush = vi.fn();
    mockRegisterMutate = vi.fn();

    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
    } as any);

    vi.spyOn(useEventDetailHook, 'useEventDetail').mockReturnValue({
      data: mockEvent,
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(useEventDetailHook, 'useMyRegistration').mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    vi.spyOn(useRegisterForEventHook, 'useRegisterForEvent').mockReturnValue({
      mutate: mockRegisterMutate,
      isPending: false,
    } as any);

    vi.spyOn(useRegisterForEventHook, 'useCancelRegistration').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useTeamLookup').mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useLeaveTeam').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useCreateTeam').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useJoinTeam').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.spyOn(useTeamsHook, 'useTeamsList').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.spyOn(useClubAdminHook, 'useClubAdmin').mockReturnValue({
      activeClubId: 'club-1',
      setActiveClubId: vi.fn(),
      setClubAdminMode: vi.fn(),
      managedClubs: [{ id: 'club-1', name: 'Tech Club', role: 'CLUB_ADMIN' }],
      adminClubs: [{ id: 'club-1', name: 'Tech Club', role: 'CLUB_ADMIN' }],
      isHydrated: true,
    } as any);

    vi.spyOn(useClubsHook, 'useClubs').mockReturnValue({
      data: { data: [{ id: 'club-1', name: 'Tech Club' }] },
      isLoading: false,
    } as any);

    vi.spyOn(useAcademicBatchesHook, 'useAcademicBatches').mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  // -------------------------------------------------------------------------
  // 1. Event Detail Page: Administrators cannot register
  // -------------------------------------------------------------------------
  it('1a. Platform Admin sees access restricted banner and no registration button', () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-plat-admin',
        email: 'padmin@newtonschool.co',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      },
      isLoading: false,
    } as any);

    renderWithProviders(<StudentEventDetailPage params={{ id: 'evt-test-1' }} />);

    expect(screen.getByText(/ACCESS RESTRICTED \/\/ ADMINISTRATOR ACCOUNT/i)).toBeInTheDocument();
    expect(screen.getByText(/Administrator accounts cannot register for events/i)).toBeInTheDocument();
    expect(screen.queryByText(/CONFIRM REGISTRATION PASS/i)).not.toBeInTheDocument();
  });

  it('1b. Faculty Admin sees access restricted banner and no registration button', () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-fac-admin',
        email: 'fadmin@adypu.edu.in',
        global_role: 'FACULTY_ADMIN',
        club_memberships: [],
      },
      isLoading: false,
    } as any);

    renderWithProviders(<StudentEventDetailPage params={{ id: 'evt-test-1' }} />);

    expect(screen.getByText(/ACCESS RESTRICTED \/\/ ADMINISTRATOR ACCOUNT/i)).toBeInTheDocument();
    expect(screen.getByText(/Administrator accounts cannot register for events/i)).toBeInTheDocument();
    expect(screen.queryByText(/CONFIRM REGISTRATION PASS/i)).not.toBeInTheDocument();
  });

  it('1c. Club Admin sees access restricted banner and no registration button', () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-club-admin',
        email: 'cadmin@adypu.edu.in',
        global_role: 'STUDENT',
        club_memberships: [{ club_id: 'club-other', club_name: 'Other Club', role: 'CLUB_ADMIN' }],
      },
      isLoading: false,
    } as any);

    renderWithProviders(<StudentEventDetailPage params={{ id: 'evt-test-1' }} />);

    expect(screen.getByText(/ACCESS RESTRICTED \/\/ ADMINISTRATOR ACCOUNT/i)).toBeInTheDocument();
    expect(screen.getByText(/Administrator accounts cannot register for events/i)).toBeInTheDocument();
    expect(screen.queryByText(/CONFIRM REGISTRATION PASS/i)).not.toBeInTheDocument();
  });

  it('1d. Eligible student sees normal registration pass action and no restriction banner', () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-student',
        email: 'student@adypu.edu.in',
        global_role: 'STUDENT',
        club_memberships: [],
      },
      isLoading: false,
    } as any);

    renderWithProviders(<StudentEventDetailPage params={{ id: 'evt-test-1' }} />);

    expect(screen.queryByText(/ACCESS RESTRICTED \/\/ ADMINISTRATOR ACCOUNT/i)).not.toBeInTheDocument();
    expect(screen.getByText(/CONFIRM REGISTRATION PASS ↗/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Direct URL Access to Team Registration (/student/events/[id]/team)
  // -------------------------------------------------------------------------
  it('2a. Direct URL access to team hub blocks administrator and shows return link', () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-plat-admin',
        email: 'padmin@newtonschool.co',
        global_role: 'PLATFORM_ADMIN',
        club_memberships: [],
      },
      isLoading: false,
    } as any);

    renderWithProviders(<TeamHubPage params={{ id: 'evt-test-1' }} />);

    expect(screen.getByText(/ACCESS RESTRICTED \/\/ ADMINISTRATOR ACCOUNT/i)).toBeInTheDocument();
    expect(screen.getByText(/Administrator accounts cannot register for events or access squad registration command/i)).toBeInTheDocument();

    const returnLink = screen.getByRole('link', { name: /Return to Event Dossier/i });
    expect(returnLink).toBeInTheDocument();
    expect(returnLink).toHaveAttribute('href', '/student/events/evt-test-1');
  });

  // -------------------------------------------------------------------------
  // 3. Compulsory Registration Window for Club Admins (Form Validation)
  // -------------------------------------------------------------------------
  it('3a. Create Event form marks registration window fields with required asterisks', () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-club-admin',
        email: 'cadmin@adypu.edu.in',
        global_role: 'STUDENT',
        club_memberships: [{ club_id: 'club-1', club_name: 'Tech Club', role: 'CLUB_ADMIN' }],
      },
      isLoading: false,
    } as any);

    renderWithProviders(<CreateEventPage />);

    expect(screen.getByText('REGISTRATION START DATE *')).toBeInTheDocument();
    expect(screen.getByText('REGISTRATION START TIME *')).toBeInTheDocument();
    expect(screen.getByText('REGISTRATION END DATE *')).toBeInTheDocument();
    expect(screen.getByText('REGISTRATION END TIME *')).toBeInTheDocument();
  });

  it('3b. Submitting event creation without registration opening time displays clear error message', async () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-club-admin',
        email: 'cadmin@adypu.edu.in',
        global_role: 'STUDENT',
        club_memberships: [{ club_id: 'club-1', club_name: 'Tech Club', role: 'CLUB_ADMIN' }],
      },
      isLoading: false,
    } as any);

    const { container } = renderWithProviders(<CreateEventPage />);

    // Fill event required fields except registration window
    const titleInput = container.querySelector('input[name="title"]')!;
    const bannerInput = container.querySelector('input[name="banner_url"]')!;

    fireEvent.change(titleInput, { target: { value: 'Tech Innovation Summit' } });
    fireEvent.change(bannerInput, { target: { value: 'https://example.com/banner.png' } });

    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Registration opening date and time are required for Club Admins/i)).toBeInTheDocument();
    });

    // Verify user other form inputs are preserved
    expect(screen.getByDisplayValue('Tech Innovation Summit')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.com/banner.png')).toBeInTheDocument();
  });

  it('3c. Submitting event creation with reversed registration window displays clear error message', async () => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: {
        id: 'user-club-admin',
        email: 'cadmin@adypu.edu.in',
        global_role: 'STUDENT',
        club_memberships: [{ club_id: 'club-1', club_name: 'Tech Club', role: 'CLUB_ADMIN' }],
      },
      isLoading: false,
    } as any);

    const { container } = renderWithProviders(<CreateEventPage />);

    const titleInput = container.querySelector('input[name="title"]')!;
    const bannerInput = container.querySelector('input[name="banner_url"]')!;

    fireEvent.change(titleInput, { target: { value: 'Reverse Window Event' } });
    fireEvent.change(bannerInput, { target: { value: 'https://example.com/banner.png' } });

    // Set reversed registration window
    const regStartDateInput = container.querySelector('input[name="registrationStartDate"]')!;
    const regStartTimeInput = container.querySelector('input[name="registrationStartTime"]')!;
    const regEndDateInput = container.querySelector('input[name="registrationEndDate"]')!;
    const regEndTimeInput = container.querySelector('input[name="registrationEndTime"]')!;

    fireEvent.change(regStartDateInput, { target: { value: '2026-11-20' } });
    fireEvent.change(regStartTimeInput, { target: { value: '18:00' } });
    fireEvent.change(regEndDateInput, { target: { value: '2026-11-10' } });
    fireEvent.change(regEndTimeInput, { target: { value: '10:00' } });

    const submitBtn = screen.getByRole('button', { name: /SUBMIT FOR APPROVAL ↗/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Registration closing time must be strictly after registration opening time/i)).toBeInTheDocument();
    });

    // Inputs are preserved
    expect(screen.getByDisplayValue('Reverse Window Event')).toBeInTheDocument();
  });

  it('displays in-UI validation banner and inline field errors instead of window.alert when required custom field is empty', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      data: { id: 'u-eligible-student', global_role: 'STUDENT', club_memberships: [] },
      isLoading: false,
    } as any);

    vi.spyOn(useEventFormFieldsHook, 'useEventFormFields').mockReturnValue({
      data: [
        {
          id: 'field-1',
          eventId: 'evt-test-1',
          fieldDefinitionId: 'def-1',
          isRequired: true,
          fieldDefinition: {
            id: 'def-1',
            label: 'What interests you here',
            fieldType: 'TEXT',
            options: null,
          },
        },
      ],
      isLoading: false,
    } as any);

    renderWithProviders(<StudentEventDetailPage params={{ id: 'evt-test-1' }} />);

    // Click register button to open registration modal
    const registerBtn = screen.getByRole('button', { name: /CONFIRM REGISTRATION PASS ↗/i });
    fireEvent.click(registerBtn);

    // Modal opens with form field
    expect(screen.getByText(/CONFIRM EVENT PASS/i)).toBeInTheDocument();
    expect(screen.getByText('What interests you here')).toBeInTheDocument();

    // Click confirm without filling the field
    const authorizeBtn = screen.getByRole('button', { name: /AUTHORIZE PASS ↗/i });
    fireEvent.click(authorizeBtn);

    // Verify window.alert was NOT called
    expect(alertSpy).not.toHaveBeenCalled();

    // In-UI validation banner is shown
    expect(screen.getByText(/VALIDATION NOTICE/i)).toBeInTheDocument();
    expect(screen.getByText(/Please fill in required field: What interests you here/i)).toBeInTheDocument();

    // Inline field error is also visible under the input
    expect(screen.getByText(/"What interests you here" is required\./i)).toBeInTheDocument();

    // Fill in field
    const input = screen.getByPlaceholderText(/Type your response\.\.\./i);
    fireEvent.change(input, { target: { value: 'Learning about Web3 and Rust' } });

    // Validation banner clears
    expect(screen.queryByText(/Please fill in required field: What interests you here/i)).not.toBeInTheDocument();

    alertSpy.mockRestore();
  });
});
