// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import LoginPage from '../app/(auth)/login/page';
import { formatErrorMessage, ERROR_MESSAGES } from '../lib/error-utils';

// Mock window.matchMedia for Antd
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

let mockSearchParams = new URLSearchParams();
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

describe('Web Error Handling Utilities', () => {
  it('translates known backend semantic codes to clear messages', () => {
    expect(formatErrorMessage('INSTITUTIONAL_DOMAIN_NOT_ALLOWED')).toBe(
      ERROR_MESSAGES.INSTITUTIONAL_DOMAIN_NOT_ALLOWED
    );
    expect(formatErrorMessage('STUDENT_ACCESS_NOT_AUTHORIZED')).toBe(
      ERROR_MESSAGES.STUDENT_ACCESS_NOT_AUTHORIZED
    );
    expect(formatErrorMessage('EVENT_LOCKED')).toBe(
      'This event is locked. No further modifications, registrations, or attendance can be changed.'
    );
    expect(formatErrorMessage('U0006')).toBe(
      'This event is locked against further changes.'
    );
  });

  it('extracts nested error messages from error object with detail', () => {
    const errorWithDetail = {
      status: 422,
      data: { detail: 'AUDIENCE_NOT_ELIGIBLE' },
    };
    expect(formatErrorMessage(errorWithDetail)).toBe(
      'You are not academically eligible for this event.'
    );
  });

  it('extracts nested message property if no code matched', () => {
    const customError = {
      message: 'Network connection was interrupted',
    };
    expect(formatErrorMessage(customError)).toBe(
      'Network connection was interrupted'
    );
  });

  it('falls back to custom fallback if error is empty', () => {
    expect(formatErrorMessage(null, 'Custom Fallback')).toBe('Custom Fallback');
    expect(formatErrorMessage(undefined, 'Custom Fallback')).toBe('Custom Fallback');
  });
});

describe('Web Login Page Error Presentation Parity', () => {
  beforeEach(() => {
    cleanup();
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
  });

  it('renders default state without error card when no error param exists', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument();
    expect(screen.queryByText(/AUTH FAILED/i)).not.toBeInTheDocument();
  });

  it('renders rich error card on authentication_failed with domain advice & coordinator action', () => {
    mockSearchParams = new URLSearchParams('error=authentication_failed');
    render(<LoginPage />);

    expect(screen.getByText('AUTH FAILED // SEC-02')).toBeInTheDocument();
    expect(screen.getByText('AUTHENTICATION FAILED')).toBeInTheDocument();
    expect(
      screen.getByText(/NST Events requires an active institutional Google account/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch Google Account/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Contact Academic Coordinator/i })
    ).toBeInTheDocument();
  });

  it('renders specific guidance for INSTITUTIONAL_DOMAIN_NOT_ALLOWED', () => {
    mockSearchParams = new URLSearchParams('error=INSTITUTIONAL_DOMAIN_NOT_ALLOWED');
    render(<LoginPage />);

    expect(screen.getByText('RESTRICTED DOMAIN')).toBeInTheDocument();
    expect(screen.getByText('INSTITUTIONAL DOMAIN NOT ALLOWED')).toBeInTheDocument();
    expect(
      screen.getByText(/Please sign in with your official @adypu.edu.in/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch Google Account/i })).toBeInTheDocument();
  });

  it('renders specific guidance and coordinator action for STUDENT_ACCESS_NOT_AUTHORIZED', () => {
    mockSearchParams = new URLSearchParams('error=STUDENT_ACCESS_NOT_AUTHORIZED');
    render(<LoginPage />);

    expect(screen.getByText('DIRECTORY STATUS')).toBeInTheDocument();
    expect(screen.getByText('STUDENT NOT ENROLLED IN DIRECTORY')).toBeInTheDocument();
    expect(
      screen.getByText(/Account recognized, but not enrolled in the active NST Student Directory/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Contact Academic Coordinator/i })
    ).toBeInTheDocument();
  });

  it('dismisses error card immediately and updates history when DISMISS button is clicked', () => {
    mockSearchParams = new URLSearchParams('error=authentication_failed');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

    render(<LoginPage />);

    expect(screen.getByText('AUTH FAILED // SEC-02')).toBeInTheDocument();
    expect(screen.getByText('AUTHENTICATION FAILED')).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /Dismiss error/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('AUTH FAILED // SEC-02')).not.toBeInTheDocument();
    expect(screen.queryByText('AUTHENTICATION FAILED')).not.toBeInTheDocument();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/login');
    expect(mockRouter.replace).toHaveBeenCalledWith('/login');

    replaceStateSpy.mockRestore();
  });
});
