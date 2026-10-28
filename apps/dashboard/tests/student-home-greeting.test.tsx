// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StudentHomePage from '../app/(student)/student/home/page';
import dayjs from 'dayjs';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: 'usr-1', email: 'shravani@adypu.edu.in', full_name: 'Shravani Deshmukh', role: 'STUDENT' },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../hooks/useMyRegistrations', () => ({
  useMyRegistrations: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => ({
    data: { eventsAttendedCount: 4, totalPoints: 120 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const mockUseEvents = vi.fn().mockReturnValue({
  data: { data: [] },
  isLoading: false,
  error: null,
});

vi.mock('../hooks/useEvents', () => ({
  useEvents: () => mockUseEvents(),
}));

describe('Student Home Greeting Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEvents.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    });
  });

  it('renders AFTERNOON in a dedicated single-line nowrap greeting element during afternoon hours', () => {
    // Mock hour to be 14:00 (2 PM, afternoon)
    const originalHour = dayjs.prototype.hour;
    dayjs.prototype.hour = () => 14;

    try {
      render(<StudentHomePage />);

      const greetingWord = screen.getByText('AFTERNOON,');
      expect(greetingWord).toBeInTheDocument();
      expect(greetingWord).toHaveClass('hero-greeting-word');

      const goodWord = screen.getByText('GOOD');
      expect(goodWord).toBeInTheDocument();
      expect(goodWord).toHaveClass('hero-good-word');
    } finally {
      dayjs.prototype.hour = originalHour;
    }
  });

  it('does not render hardcoded mock events and shows empty state when backend has no events', () => {
    render(<StudentHomePage />);

    // Mock events must not exist in document
    expect(screen.queryByText(/HACKNST 2026/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LLM FINE-TUNING/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVOPS & CLOUD NATIVE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ALGORITHMIC SPEED RUN/i)).not.toBeInTheDocument();

    // Honest empty state must be shown
    expect(screen.getByText('NO UPCOMING EVENTS SCHEDULED')).toBeInTheDocument();
    expect(screen.getByText(/CAMPUS POSTER WALL \/\/ STATUS: IDLE/i)).toBeInTheDocument();
  });

  it('renders real events from backend on the poster wall', () => {
    mockUseEvents.mockReturnValue({
      data: {
        data: [
          {
            id: 'real-event-1',
            title: 'AUTONOMOUS ROBOTICS WORKSHOP',
            startTime: '2026-11-15T10:00:00Z',
            endTime: '2026-11-15T14:00:00Z',
            eventType: 'WORKSHOP',
            locationName: 'Robotics Lab 3',
            description: 'Hands-on ROS 2 and SLAM robotics workshop.',
            metadata: {},
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    render(<StudentHomePage />);

    expect(screen.getByText('AUTONOMOUS ROBOTICS WORKSHOP')).toBeInTheDocument();
    expect(screen.getByText('Robotics Lab 3')).toBeInTheDocument();
    expect(screen.queryByText('NO UPCOMING EVENTS SCHEDULED')).not.toBeInTheDocument();
    expect(screen.queryByText(/HACKNST 2026/i)).not.toBeInTheDocument();
  });
});
