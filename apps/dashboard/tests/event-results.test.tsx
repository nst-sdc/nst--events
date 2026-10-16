// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { eventResultsApi } from '../lib/event-results-api';
import { ResultReportModal } from '../components/results/ResultReportModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Event Results API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches public results with slug and handles 200 response', async () => {
    const mockData = {
      status: 'PUBLISHED',
      event: {
        id: 'event-1',
        title: 'Hackathon 2026',
        slug: 'hackathon-2026',
      },
      results: {
        revision_number: 1,
        published_at: new Date().toISOString(),
        is_correction: false,
        podium: [
          {
            id: 'award-1',
            title: '1st Place Winner',
            award_type: 'RANKED_PLACEMENT',
            placement: 1,
            is_tied: false,
            recipients: [
              {
                recipient_type: 'INDIVIDUAL',
                student: { id: 'u1', name: 'Alice Smith' },
              },
            ],
          },
        ],
        additional_ranked: [],
        special_awards: [],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await eventResultsApi.getPublicResultsBySlug('hackathon-2026');
    expect(data.status).toBe('PUBLISHED');
    expect(data.results?.podium[0].title).toBe('1st Place Winner');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/events/public/hackathon-2026/results'),
      expect.any(Object)
    );
  });

  it('handles restricted event response when unauthenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        status: 'UNAUTHENTICATED_RESTRICTED',
        event: { id: 'e1', title: 'Private Event', slug: 'private-event' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await eventResultsApi.getPublicResultsBySlug('private-event');
    expect(data.status).toBe('UNAUTHENTICATED_RESTRICTED');
  });
});

describe('ResultReportModal Component', () => {
  it('renders modal when open and submits inaccuracy report', async () => {
    const submitSpy = vi.spyOn(eventResultsApi, 'submitReport').mockResolvedValue({
      success: true,
      report_id: 'report-123',
    });

    render(
      <ResultReportModal
        eventId="event-test-id"
        eventTitle="Campus Coding Clash"
      />
    );

    // Click trigger button to open modal
    const triggerBtn = screen.getByRole('button', { name: /Report Inaccuracy or Dispute/i });
    expect(triggerBtn).toBeInTheDocument();
    fireEvent.click(triggerBtn);

    expect(screen.getByText(/Report Result Inaccuracy/i)).toBeInTheDocument();

    const subjectInput = screen.getByPlaceholderText(/e.g. Unrecognized team member/i);
    fireEvent.change(subjectInput, { target: { value: 'Missing teammate' } });

    const detailsTextarea = screen.getByPlaceholderText(/Provide full details/i);
    fireEvent.change(detailsTextarea, {
      target: { value: 'My teammate was not listed in the 2nd place team members.' },
    });

    const form = screen.getByRole('button', { name: /SUBMIT REPORT/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith('event-test-id', {
        reason: 'Missing teammate',
        details: 'My teammate was not listed in the 2nd place team members.',
      });
      expect(screen.getByText(/Report Submitted/i)).toBeInTheDocument();
    });
  });

  it('validates empty inputs before submission', async () => {
    const submitSpy = vi.spyOn(eventResultsApi, 'submitReport');
    render(
      <ResultReportModal
        eventId="event-test-id"
        eventTitle="Campus Coding Clash"
      />
    );

    const triggerBtn = screen.getByRole('button', { name: /Report Inaccuracy or Dispute/i });
    fireEvent.click(triggerBtn);

    const form = screen.getByRole('button', { name: /SUBMIT REPORT/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Please provide both a reason and detailed description/i)).toBeInTheDocument();
    });
    expect(submitSpy).not.toHaveBeenCalled();
  });
});
