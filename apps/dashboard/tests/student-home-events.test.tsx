// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StudentHomePage from '../app/(student)/student/home/page';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

const mockUser = {
  id: 'usr-student-1',
  email: 'student@adypu.edu.in',
  full_name: 'Ananya Sharma',
  global_role: 'STUDENT',
};

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: mockUser,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../hooks/useMyRegistrations', () => ({
  useMyRegistrations: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({
    data: { eventsAttendedCount: 2, totalPoints: 50 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

let mockEventsResponse: { data: any[] } | undefined = { data: [] };
let mockIsEventsLoading = false;
let mockIsEventsError = false;
const mockRefetchEvents = vi.fn();

vi.mock('../hooks/useEvents', () => ({
  useEvents: () => ({
    data: mockEventsResponse,
    isLoading: mockIsEventsLoading,
    isError: mockIsEventsError,
    refetch: mockRefetchEvents,
  }),
}));

describe('Student Home: Event Cards Data Flow & Error States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEventsLoading = false;
    mockIsEventsError = false;
    mockEventsResponse = { data: [] };
  });

  it('renders genuine events returned by the backend with proper details', () => {
    mockEventsResponse = {
      data: [
        {
          id: 'evt-real-001',
          title: 'Autonomous Robotics Workshop',
          eventType: 'WORKSHOP',
          startTime: '2026-11-15T10:00:00.000Z',
          locationName: 'Robotics Center B2',
          description: 'Hands-on ROS2 and SLAM robotics development on actual campus hardware.',
          metadata: {
            banner_url: 'https://images.unsplash.com/photo-robotics-banner.jpg',
          },
        },
      ],
    };

    render(<StudentHomePage />);

    expect(screen.getByText('Autonomous Robotics Workshop')).toBeInTheDocument();
    expect(screen.getByText('WORKSHOP')).toBeInTheDocument();
    expect(screen.getByText('Robotics Center B2')).toBeInTheDocument();
    expect(screen.getByText('Hands-on ROS2 and SLAM robotics development on actual campus hardware.')).toBeInTheDocument();

    // Verify image is rendered with the genuine banner URL
    const img = screen.getByAltText('Autonomous Robotics Workshop');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://images.unsplash.com/photo-robotics-banner.jpg');

    // Click card navigates to genuine event detail route
    fireEvent.click(screen.getByText('Autonomous Robotics Workshop'));
    expect(mockPush).toHaveBeenCalledWith('/student/events/evt-real-001');

    // Ensure NO mock events from the removed array appear
    expect(screen.queryByText(/HACKNST 2026: AI SYSTEMS FLAGSHIP/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LLM FINE-TUNING & AGENTIC WORKSHOP/i)).not.toBeInTheDocument();
  });

  it('renders empty state when backend returns empty list, with NO fabricated fallback events', () => {
    mockEventsResponse = { data: [] };

    render(<StudentHomePage />);

    // Must show genuine empty state
    expect(screen.getByText('NO UPCOMING EVENTS SCHEDULED')).toBeInTheDocument();
    expect(screen.getByText(/There are currently no upcoming events on the campus schedule/i)).toBeInTheDocument();
    expect(screen.getByText('EXPLORE CAMPUS ↗')).toBeInTheDocument();

    // Must NOT render any hard-coded sample events
    expect(screen.queryByText(/HACKNST 2026: AI SYSTEMS FLAGSHIP/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LLM FINE-TUNING & AGENTIC WORKSHOP/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVOPS & CLOUD NATIVE INFRASTRUCTURE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ALGORITHMIC SPEED RUN 2026/i)).not.toBeInTheDocument();
  });

  it('renders error state when events API request fails, without falling back to mock events', () => {
    mockEventsResponse = undefined;
    mockIsEventsError = true;

    render(<StudentHomePage />);

    expect(screen.getByText('FAILED TO LOAD UPCOMING EVENTS')).toBeInTheDocument();
    expect(screen.getByText(/We could not retrieve the latest campus event schedule/i)).toBeInTheDocument();
    expect(screen.getByText('RETRY CONNECTION ↻')).toBeInTheDocument();

    // Clicking retry calls refetchEvents
    fireEvent.click(screen.getByText('RETRY CONNECTION ↻'));
    expect(mockRefetchEvents).toHaveBeenCalled();

    // Absolutely no mock events must leak on error
    expect(screen.queryByText(/HACKNST 2026: AI SYSTEMS FLAGSHIP/i)).not.toBeInTheDocument();
  });

  it('renders neutral placeholder when event has no banner image', () => {
    mockEventsResponse = {
      data: [
        {
          id: 'evt-no-image',
          title: 'Open Source Fireside Chat',
          eventType: 'SEMINAR',
          startTime: '2026-11-20T14:00:00.000Z',
          locationName: 'Seminar Room 3',
          description: 'Panel discussion on contributing to open source.',
          metadata: {},
        },
      ],
    };

    const { container } = render(<StudentHomePage />);

    expect(screen.getByText('Open Source Fireside Chat')).toBeInTheDocument();
    // No img element rendered
    expect(screen.queryByAltText('Open Source Fireside Chat')).not.toBeInTheDocument();
    // Typographic watermark placeholder rendered
    const placeholder = container.querySelector('.poster-photo-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder?.textContent).toContain('SEMI');
  });

  it('gracefully falls back to neutral placeholder when banner image fails to load (onError)', () => {
    mockEventsResponse = {
      data: [
        {
          id: 'evt-broken-img',
          title: 'Cloud Native Summit',
          eventType: 'CONFERENCE',
          startTime: '2026-11-25T09:00:00.000Z',
          locationName: 'Auditorium 1',
          description: 'Keynotes on Kubernetes and serverless.',
          metadata: {
            banner_url: 'https://broken-domain.invalid/missing.jpg',
          },
        },
      ],
    };

    render(<StudentHomePage />);

    const img = screen.getByAltText('Cloud Native Summit') as HTMLImageElement;
    expect(img).toBeInTheDocument();

    // Trigger image error
    fireEvent.error(img);

    // img should be hidden
    expect(img.style.display).toBe('none');
  });
});
