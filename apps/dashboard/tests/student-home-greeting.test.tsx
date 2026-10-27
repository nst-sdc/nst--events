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

vi.mock('../hooks/useEvents', () => ({
  useEvents: () => ({
    data: { data: [] },
    isLoading: false,
    error: null,
  }),
}));

describe('Student Home Greeting Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
