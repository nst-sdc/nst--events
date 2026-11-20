/**
 * Dispute deadline estimation & backend-authority messaging helper (Prism Mobile Standard v3.6.0).
 *
 * Backend ground truth (`packages/database/functions.sql: submit_attendance_dispute`):
 *   v_dispute_window_expires_at := v_event_end_time + INTERVAL '24 hours';
 *   IF NOW() > v_dispute_window_expires_at THEN RAISE EXCEPTION ... USING ERRCODE = 'U0048';
 *
 * Client rules:
 * 1. Only compute an estimated deadline when a verified, parseable `eventEndTime` is present.
 * 2. NEVER compute the filing window from `session.endTime` or `session.closeAt`.
 * 3. NEVER use the client estimate to block or reject submission — backend RPC is authoritative.
 * 4. When `eventEndTime` is absent, show a neutral policy notice and allow submission.
 */

export const DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type DisputeDeadlineState =
  | {
      status: 'estimated-open';
      expiresAtMs: number;
      expiresAtIso: string;
      remainingMs: number;
      formattedDeadline: string;
      message: string;
    }
  | {
      status: 'estimated-expired';
      expiresAtMs: number;
      expiresAtIso: string;
      remainingMs: 0;
      formattedDeadline: string;
      message: string;
    }
  | {
      status: 'unavailable';
      expiresAtMs: null;
      expiresAtIso: null;
      remainingMs: null;
      formattedDeadline: null;
      message: string;
    };

export function formatDeadlineWithTimezone(dateMs: number, timeZone?: string): string {
  const date = new Date(dateMs);
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Computes an informational, non-blocking dispute deadline estimate from the verified
 * event end time (`event.endTime` / `event.end_time`).
 *
 * @param eventEndTime ISO-8601 timestamp string (must include explicit timezone offset or 'Z')
 * @param nowMs Current reference timestamp in epoch milliseconds
 * @param timeZone Optional IANA timezone for display formatting (e.g. 'Asia/Kolkata')
 */
export function evaluateDisputeDeadline(
  eventEndTime: string | null | undefined,
  nowMs: number = Date.now(),
  timeZone?: string
): DisputeDeadlineState {
  if (!eventEndTime || typeof eventEndTime !== 'string' || !eventEndTime.trim()) {
    return {
      status: 'unavailable',
      expiresAtMs: null,
      expiresAtIso: null,
      remainingMs: null,
      formattedDeadline: null,
      message:
        'Disputes are accepted within 24 hours after the event ends. Final eligibility is verified by the server on submission.',
    };
  }

  const trimmed = eventEndTime.trim();
  const parsedEndMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedEndMs)) {
    return {
      status: 'unavailable',
      expiresAtMs: null,
      expiresAtIso: null,
      remainingMs: null,
      formattedDeadline: null,
      message:
        'Disputes are accepted within 24 hours after the event ends. Final eligibility is verified by the server on submission.',
    };
  }

  const expiresAtMs = parsedEndMs + DISPUTE_WINDOW_MS;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const formattedDeadline = formatDeadlineWithTimezone(expiresAtMs, timeZone);

  // Match PostgreSQL: `NOW() > v_dispute_window_expires_at` is expired; exact boundary (`===`) is still open
  if (nowMs <= expiresAtMs) {
    return {
      status: 'estimated-open',
      expiresAtMs,
      expiresAtIso,
      remainingMs: expiresAtMs - nowMs,
      formattedDeadline,
      message: `Estimated filing deadline: ${formattedDeadline} (24 hours after event end). Server verifies final eligibility.`,
    };
  }

  return {
    status: 'estimated-expired',
    expiresAtMs,
    expiresAtIso,
    remainingMs: 0,
    formattedDeadline,
    message: `Estimated 24-hour filing window ended ${formattedDeadline}. You may still submit to verify eligibility with the server.`,
  };
}

/**
 * Maps authoritative backend dispute submission errors to user-facing guidance.
 */
export function mapDisputeSubmissionError(err: { message?: string; body?: { code?: string; detail?: string; error?: string } } | null | undefined): string {
  const combined = [
    err?.body?.code,
    err?.body?.detail,
    err?.body?.error,
    err?.message,
  ]
    .filter(Boolean)
    .join(' ');

  if (combined.includes('DISPUTE_WINDOW_EXPIRED') || combined.includes('U0048')) {
    return 'The 24-hour dispute filing window after event end has expired.';
  }
  if (combined.includes('ATTENDANCE_ALREADY_RECORDED') || combined.includes('U0054')) {
    return 'Attendance or a dispute claim for this session has already been recorded.';
  }
  if (combined.includes('SESSION_CLOSED') || combined.includes('U0049')) {
    return 'This attendance session is closed or no longer accepts claims.';
  }
  if (combined.includes('NOT_REGISTERED') || combined.includes('U0003')) {
    return 'You are not registered for this event.';
  }
  if (combined.includes('P2002') || combined.includes('23505')) {
    return 'A dispute for this session has already been submitted.';
  }
  return err?.message || 'Failed to submit dispute claim.';
}

