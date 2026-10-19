// @vitest-environment jsdom
import { expect, describe, it, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { EventRegistrationHandoff } from '../components/public/EventRegistrationHandoff';

describe('EventRegistrationHandoff Component Contract Tests', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    eventId: 'test-event-uuid-1',
    eventSlug: 'hackathon-2026',
    eventTitle: 'Hackathon 2026',
    registrationType: 'INDIVIDUAL',
  };

  it('1. Renders non-actionable state when registrationStatus is UPCOMING', () => {
    render(
      <EventRegistrationHandoff
        {...defaultProps}
        registrationStatus="UPCOMING"
      />
    );

    // Header badge
    expect(screen.getByText('REGISTRATION NOT STARTED')).toBeInTheDocument();
    expect(screen.getByText('Registration Opens Soon')).toBeInTheDocument();
    expect(
      screen.getByText('Check back once the registration window officially commences.')
    ).toBeInTheDocument();

    // Critical: Registration actions MUST NOT be rendered
    expect(screen.queryByText('SCAN TO REGISTER')).not.toBeInTheDocument();
    expect(screen.queryByText('REGISTER IN APP')).not.toBeInTheDocument();
    expect(screen.queryByText('CONTINUE ON WEB')).not.toBeInTheDocument();
    expect(screen.queryByText('SECURE YOUR PASS')).not.toBeInTheDocument();
  });

  it('2. Renders non-actionable state when registrationStatus is NOT_STARTED (legacy mapping)', () => {
    render(
      <EventRegistrationHandoff
        {...defaultProps}
        registrationStatus="NOT_STARTED"
      />
    );

    expect(screen.getByText('REGISTRATION NOT STARTED')).toBeInTheDocument();
    expect(screen.getByText('Registration Opens Soon')).toBeInTheDocument();
    expect(screen.queryByText('SCAN TO REGISTER')).not.toBeInTheDocument();
  });

  it('3. Renders actionable registration module when registrationStatus is OPEN', () => {
    render(
      <EventRegistrationHandoff
        {...defaultProps}
        registrationStatus="OPEN"
      />
    );

    expect(screen.getByText('OFFICIAL REGISTRATION')).toBeInTheDocument();
    expect(screen.getByText('SECURE YOUR PASS')).toBeInTheDocument();
    expect(screen.getByText('SCAN TO REGISTER')).toBeInTheDocument();
    expect(screen.getByText('CONTINUE ON WEB')).toBeInTheDocument();
    expect(screen.queryByText('REGISTRATION NOT STARTED')).not.toBeInTheDocument();
    expect(screen.queryByText('REGISTRATION CLOSED')).not.toBeInTheDocument();
  });

  it('4. Renders warning alert badge and actionable registration when registrationStatus is CLOSING_SOON', () => {
    render(
      <EventRegistrationHandoff
        {...defaultProps}
        registrationStatus="CLOSING_SOON"
      />
    );

    // Closing soon banner
    expect(screen.getByText('REGISTRATION CLOSING SOON')).toBeInTheDocument();
    expect(screen.getByText('SECURE YOUR PASS')).toBeInTheDocument();

    // Must still permit active registration
    expect(screen.getByText('SCAN TO REGISTER')).toBeInTheDocument();
    expect(screen.getByText('CONTINUE ON WEB')).toBeInTheDocument();

    // Must not show official registration badge or closed badge
    expect(screen.queryByText('OFFICIAL REGISTRATION')).not.toBeInTheDocument();
    expect(screen.queryByText('REGISTRATION CLOSED')).not.toBeInTheDocument();
  });

  it('5. Renders non-actionable banner when registrationStatus is CLOSED', () => {
    render(
      <EventRegistrationHandoff
        {...defaultProps}
        registrationStatus="CLOSED"
      />
    );

    expect(screen.getByText('REGISTRATION CLOSED')).toBeInTheDocument();
    expect(
      screen.getByText('Registration is no longer accepting submissions')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This event has reached its registration deadline.')
    ).toBeInTheDocument();

    // Critical: Registration actions MUST NOT be rendered
    expect(screen.queryByText('SCAN TO REGISTER')).not.toBeInTheDocument();
    expect(screen.queryByText('REGISTER IN APP')).not.toBeInTheDocument();
    expect(screen.queryByText('CONTINUE ON WEB')).not.toBeInTheDocument();
    expect(screen.queryByText('SECURE YOUR PASS')).not.toBeInTheDocument();
  });
});
