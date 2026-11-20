import { describe, it, expect } from 'vitest';
import {
  DISPUTE_WINDOW_MS,
  evaluateDisputeDeadline,
  mapDisputeSubmissionError,
} from '../src/lib/dispute-deadline';

describe('Dispute deadline presentation & backend authority', () => {
  it('1. computes estimated deadline accurately from a valid eventEndTime', () => {
    const eventEndIso = '2026-11-28T12:00:00.000Z';
    const nowMs = Date.parse('2026-11-28T18:00:00.000Z'); // 6h after event end

    const result = evaluateDisputeDeadline(eventEndIso, nowMs, 'UTC');

    expect(result.status).toBe('estimated-open');
    expect(result.expiresAtMs).toBe(Date.parse(eventEndIso) + DISPUTE_WINDOW_MS);
    expect(result.expiresAtIso).toBe('2026-11-29T12:00:00.000Z');
    expect(result.remainingMs).toBe(18 * 60 * 60 * 1_000);
    expect(result.formattedDeadline).toContain('Nov 29, 2026');
    expect(result.message).toContain('Server verifies final eligibility');
  });

  it('2. returns neutral policy message when eventEndTime is missing or invalid (never guesses from session)', () => {
    const missing = evaluateDisputeDeadline(null);
    const empty = evaluateDisputeDeadline('');
    const invalid = evaluateDisputeDeadline('not-a-date');

    for (const res of [missing, empty, invalid]) {
      expect(res.status).toBe('unavailable');
      expect(res.expiresAtMs).toBeNull();
      expect(res.message).toContain('24 hours after the event ends');
      expect(res.message).toContain('verified by the server');
    }
  });

  it('3. handles timezone-aware ISO offsets consistently across timezones', () => {
    // 2026-11-28 23:30:00+05:30 === 2026-11-28 18:00:00Z
    const istEnd = '2026-11-28T23:30:00+05:30';
    const utcEnd = '2026-11-28T18:00:00.000Z';
    const nowMs = Date.parse('2026-11-29T17:00:00.000Z');

    const resIst = evaluateDisputeDeadline(istEnd, nowMs, 'Asia/Kolkata');
    const resUtc = evaluateDisputeDeadline(utcEnd, nowMs, 'UTC');

    expect(resIst.expiresAtMs).toBe(resUtc.expiresAtMs);
    expect(resIst.remainingMs).toBe(60 * 60 * 1_000);
    expect(resIst.formattedDeadline).toContain('Nov 29, 2026');
  });

  it('4. treats exact 24-hour boundary (now === expiresAt) as estimated-open matching SQL NOW() > expires_at', () => {
    const eventEndIso = '2026-11-28T12:00:00.000Z';
    const exactBoundaryMs = Date.parse('2026-11-29T12:00:00.000Z');

    const result = evaluateDisputeDeadline(eventEndIso, exactBoundaryMs, 'UTC');

    expect(result.status).toBe('estimated-open');
    expect(result.remainingMs).toBe(0);
  });

  it('5. marks just after the 24-hour boundary as estimated-expired without blocking submission', () => {
    const eventEndIso = '2026-11-28T12:00:00.000Z';
    const oneMsPastMs = Date.parse('2026-11-29T12:00:00.001Z');

    const result = evaluateDisputeDeadline(eventEndIso, oneMsPastMs, 'UTC');

    expect(result.status).toBe('estimated-expired');
    expect(result.remainingMs).toBe(0);
    expect(result.message).toContain('You may still submit to verify eligibility with the server');
  });

  it('6. displays authoritative backend DISPUTE_WINDOW_EXPIRED / U0048 error even when local estimate was open', () => {
    // Local client thought 10 minutes remained, but authoritative server rejected with U0048
    const localEst = evaluateDisputeDeadline(
      '2026-11-28T12:00:00.000Z',
      Date.parse('2026-11-29T11:50:00.000Z'),
      'UTC'
    );
    expect(localEst.status).toBe('estimated-open');

    const mappedFromDetail = mapDisputeSubmissionError({
      message: 'DISPUTE_WINDOW_EXPIRED',
      body: { detail: 'DISPUTE_WINDOW_EXPIRED' },
    });
    const mappedFromSqlState = mapDisputeSubmissionError({
      message: 'ERROR U0048: window expired',
    });

    expect(mappedFromDetail).toBe('The 24-hour dispute filing window after event end has expired.');
    expect(mappedFromSqlState).toBe('The 24-hour dispute filing window after event end has expired.');
  });
});

