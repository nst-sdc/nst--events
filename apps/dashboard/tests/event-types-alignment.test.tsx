/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { expect, describe, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentCreateEventPage from '../app/(student)/student/manage/events/create/page';
import { EVENT_TYPES, EventTypeEnum, EventType } from '@nst/shared';
import * as useClubAdminHook from '../components/layout/ClubAdminProvider';
import * as useCreateEventHook from '../hooks/useCreateEvent';
import * as useAcademicBatchesHook from '../hooks/useAcademicBatches';
import * as useClubsHook from '../hooks/useClubs';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/student/manage/events/create',
}));

vi.mock('../components/layout/ClubAdminProvider');
vi.mock('../hooks/useCreateEvent');
vi.mock('../hooks/useAcademicBatches');
vi.mock('../hooks/useClubs');

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

describe('TASK P4: Event Type Alignment & SOCIAL Enum Elimination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useClubAdminHook.useClubAdmin as any).mockReturnValue({
      activeClubId: 'club-1',
      managedClubs: [{ id: 'club-1', name: 'NST Code Club', role: 'PRESIDENT' }],
      isHydrated: true,
      isLoading: false,
    });
    (useCreateEventHook.useCreateEvent as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ id: 'new-event-id' }),
      isPending: false,
    });
    (useCreateEventHook.useSubmitEventForApproval as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    });
    (useAcademicBatchesHook.useAcademicBatches as any).mockReturnValue({
      data: [],
      isLoading: false,
    });
    (useClubsHook.useClubs as any).mockReturnValue({
      data: [{ id: 'club-1', name: 'NST Code Club' }],
      isLoading: false,
    });
  });

  it('shared EVENT_TYPES contains all 8 canonical types and strictly excludes SOCIAL', () => {
    const canonicalValues = [
      'WORKSHOP',
      'SEMINAR',
      'COMPETITION',
      'MEETUP',
      'HACKATHON',
      'OTHER',
      'CULTURAL',
      'SPORTS',
    ];

    expect(EVENT_TYPES).toHaveLength(8);
    const sharedValues = EVENT_TYPES.map(t => t.value);

    for (const val of canonicalValues) {
      expect(sharedValues).toContain(val);
    }

    expect(sharedValues).not.toContain('SOCIAL');
  });

  it('validates event creation payload for each canonical event type', () => {
    const canonicalValues: EventType[] = [
      'WORKSHOP',
      'SEMINAR',
      'COMPETITION',
      'MEETUP',
      'HACKATHON',
      'OTHER',
      'CULTURAL',
      'SPORTS',
    ];

    for (const type of canonicalValues) {
      // Validate with Zod enum
      const parsed = EventTypeEnum.safeParse(type);
      expect(parsed.success).toBe(true);

      // Validate mock creation payload structure
      const payload = {
        title: `Test ${type} Event`,
        description: `Description for ${type}`,
        start_time: '2026-11-15T10:00:00.000Z',
        end_time: '2026-11-15T13:00:00.000Z',
        event_type: type,
        visibility: 'PUBLIC' as const,
        registration_type: 'INDIVIDUAL' as const,
        attendance_type: 'SINGLE' as const,
      };

      expect(payload.event_type).toBe(type);
      expect(EventTypeEnum.parse(payload.event_type)).toBe(type);
    }

    // Creating with 'SOCIAL' must fail validation
    const invalidPayload = {
      event_type: 'SOCIAL',
    };
    expect(EventTypeEnum.safeParse(invalidPayload.event_type).success).toBe(false);
  });

  it('student event creation form renders 8 canonical event type cards and excludes SOCIAL', () => {
    renderWithProviders(<StudentCreateEventPage />);

    // Check all 8 canonical labels are rendered
    expect(screen.getByText('Hackathon')).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
    expect(screen.getByText('Seminar')).toBeInTheDocument();
    expect(screen.getByText('Competition')).toBeInTheDocument();
    expect(screen.getByText('Meetup')).toBeInTheDocument();
    expect(screen.getByText('Cultural')).toBeInTheDocument();
    expect(screen.getByText('Sports')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();

    // Verify invented "Social" is NOT present anywhere in choices
    expect(screen.queryByText('Social')).not.toBeInTheDocument();
    expect(screen.queryByText('Mixers & gaming')).not.toBeInTheDocument();

    // Verify descriptions for new types
    expect(screen.getByText('Community & networking')).toBeInTheDocument();
    expect(screen.getByText('Arts, music & performance')).toBeInTheDocument();
    expect(screen.getByText('Athletics & fitness')).toBeInTheDocument();

    // Selecting an event type updates the choice card
    const meetupCard = screen.getByText('Meetup').closest('.ce-choice-card');
    expect(meetupCard).toBeInTheDocument();
    fireEvent.click(meetupCard!);
    expect(meetupCard).toHaveClass('active');
  });
});
