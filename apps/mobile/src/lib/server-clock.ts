import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Best-effort HTTP Date server-clock synchronization (Prism Mobile Standard v3.6.0).
 *
 * Design principles:
 * - HTTP `Date` headers have 1-second resolution (truncated to whole seconds).
 *   We center the sample at `serverDateMs + 500ms` and explicitly track uncertainty
 *   (`ceil(rttMs / 2) + 500ms`), never treating the estimate as millisecond-accurate.
 * - High-latency samples (RTT > MAX_ACCEPTABLE_RTT_MS) do not overwrite an existing
 *   fresh, lower-uncertainty sample.
 * - Small adjustments are smoothed (EMA + bounded slew) so live countdowns never jump
 *   erratically when background API responses arrive.
 * - If no valid fresh server sample exists, transparently falls back to local device time
 *   (`source: 'device-fallback'`) without ever labeling the user's device as malicious.
 * - On-wire behavior and campus network latency calibration remain subject to native device QA.
 */

export const MAX_ACCEPTABLE_RTT_MS = 5_000;
export const STALE_SAMPLE_MS = 15 * 60 * 1_000; // 15 minutes
export const HTTP_DATE_QUANTIZATION_MS = 500; // Half of 1-second HTTP Date resolution
export const LARGE_DRIFT_RESET_MS = 10_000; // Snap immediately if drift > 10s
export const MAX_SMOOTH_STEP_MS = 1_500; // Clamp routine adjustment per response to avoid countdown jitter
export const MIN_PLAUSIBLE_EPOCH_MS = Date.UTC(2020, 0, 1);
export const MAX_PLAUSIBLE_EPOCH_MS = Date.UTC(2100, 0, 1);

export type ClockSource = 'http-date' | 'device-fallback';

export interface ServerClockSnapshot {
  offsetMs: number;
  uncertaintyMs: number;
  lastSyncedAtMs: number | null;
  lastRttMs: number | null;
  sampleCount: number;
  source: ClockSource;
  isStale: boolean;
}

export interface ClockSampleResult {
  accepted: boolean;
  reason?:
    | 'missing-header'
    | 'malformed-header'
    | 'implausible-date'
    | 'invalid-timestamps'
    | 'high-latency-rejected';
  snapshot: ServerClockSnapshot;
}

export class ServerClockEstimator {
  private offsetMs = 0;
  private uncertaintyMs = Infinity;
  private lastSyncedAtMs: number | null = null;
  private lastRttMs: number | null = null;
  private sampleCount = 0;

  reset(): void {
    this.offsetMs = 0;
    this.uncertaintyMs = Infinity;
    this.lastSyncedAtMs = null;
    this.lastRttMs = null;
    this.sampleCount = 0;
  }

  isStale(nowMs: number = Date.now()): boolean {
    if (this.lastSyncedAtMs === null) return true;
    return nowMs - this.lastSyncedAtMs > STALE_SAMPLE_MS;
  }

  getSnapshot(nowMs: number = Date.now()): ServerClockSnapshot {
    const stale = this.isStale(nowMs);
    const synced = this.lastSyncedAtMs !== null && !stale;
    return {
      offsetMs: synced ? this.offsetMs : 0,
      uncertaintyMs: synced ? this.uncertaintyMs : Infinity,
      lastSyncedAtMs: this.lastSyncedAtMs,
      lastRttMs: this.lastRttMs,
      sampleCount: this.sampleCount,
      source: synced ? 'http-date' : 'device-fallback',
      isStale: stale,
    };
  }

  /**
   * Ingest an HTTP `Date` header sample along with local request-start and response-receive timestamps.
   */
  recordHttpDateSample(
    dateHeader: string | null | undefined,
    requestStartMs: number,
    responseReceiveMs: number
  ): ClockSampleResult {
    if (!dateHeader || typeof dateHeader !== 'string' || !dateHeader.trim()) {
      return { accepted: false, reason: 'missing-header', snapshot: this.getSnapshot(responseReceiveMs) };
    }

    if (
      !Number.isFinite(requestStartMs) ||
      !Number.isFinite(responseReceiveMs) ||
      responseReceiveMs < requestStartMs
    ) {
      return { accepted: false, reason: 'invalid-timestamps', snapshot: this.getSnapshot() };
    }

    const parsedServerMs = Date.parse(dateHeader.trim());
    if (!Number.isFinite(parsedServerMs)) {
      return { accepted: false, reason: 'malformed-header', snapshot: this.getSnapshot(responseReceiveMs) };
    }

    if (parsedServerMs < MIN_PLAUSIBLE_EPOCH_MS || parsedServerMs > MAX_PLAUSIBLE_EPOCH_MS) {
      return { accepted: false, reason: 'implausible-date', snapshot: this.getSnapshot(responseReceiveMs) };
    }

    const rttMs = responseReceiveMs - requestStartMs;
    const sampleUncertaintyMs = Math.ceil(rttMs / 2) + HTTP_DATE_QUANTIZATION_MS;
    const hasFreshSample = this.lastSyncedAtMs !== null && !this.isStale(responseReceiveMs);

    // Reject high-latency samples if they exceed acceptable RTT ceiling
    if (rttMs > MAX_ACCEPTABLE_RTT_MS) {
      return {
        accepted: false,
        reason: 'high-latency-rejected',
        snapshot: this.getSnapshot(responseReceiveMs),
      };
    }

    // Center the 1-second quantized HTTP Date at +500ms against request midpoint
    const localMidpointMs = requestStartMs + rttMs / 2;
    const estimatedOffsetMs = Math.round(parsedServerMs + HTTP_DATE_QUANTIZATION_MS - localMidpointMs);

    if (!hasFreshSample) {
      // First sample or recovery from staleness: adopt immediately
      this.offsetMs = estimatedOffsetMs;
      this.uncertaintyMs = sampleUncertaintyMs;
    } else {
      const delta = estimatedOffsetMs - this.offsetMs;
      if (Math.abs(delta) >= LARGE_DRIFT_RESET_MS) {
        // Large real clock change (e.g., user enabled automatic time or timezone/clock jumped)
        this.offsetMs = estimatedOffsetMs;
        this.uncertaintyMs = sampleUncertaintyMs;
      } else {
        // If new sample has significantly worse RTT than our current estimate, weight it lightly
        const weight = sampleUncertaintyMs <= this.uncertaintyMs ? 0.35 : 0.15;
        const rawStep = Math.round(delta * weight);
        const clampedStep = Math.max(-MAX_SMOOTH_STEP_MS, Math.min(MAX_SMOOTH_STEP_MS, rawStep));
        this.offsetMs += clampedStep;
        this.uncertaintyMs = Math.min(this.uncertaintyMs, sampleUncertaintyMs);
      }
    }

    this.lastSyncedAtMs = responseReceiveMs;
    this.lastRttMs = rttMs;
    this.sampleCount += 1;

    return { accepted: true, snapshot: this.getSnapshot(responseReceiveMs) };
  }

  /**
   * Returns best-effort estimated server time in epoch milliseconds.
   * Falls back cleanly to local device time if unsynced or stale.
   */
  getServerNowMs(deviceNowMs: number = Date.now()): number {
    if (this.isStale(deviceNowMs)) {
      return deviceNowMs;
    }
    return deviceNowMs + this.offsetMs;
  }

  /**
   * Computes remaining milliseconds until `targetTime` using best-effort server time
   * (or local device time fallback). Never returns negative values.
   */
  getRemainingMs(targetTime: string | number | Date, deviceNowMs: number = Date.now()): number {
    const targetMs =
      typeof targetTime === 'number'
        ? targetTime
        : targetTime instanceof Date
        ? targetTime.getTime()
        : Date.parse(targetTime);
    if (!Number.isFinite(targetMs)) return 0;
    const nowMs = this.getServerNowMs(deviceNowMs);
    return Math.max(0, targetMs - nowMs);
  }
}

export const serverClock = new ServerClockEstimator();

export function formatCountdownMMSS(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Triggers a best-effort refresh callback whenever the app transitions back to the foreground.
 */
export function useServerClockForegroundRefresh(
  refreshFn: () => Promise<unknown> | void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled || !AppState || typeof AppState.addEventListener !== 'function') return;
    let lastState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (nextState) => {
      const returnedToForeground =
        (lastState === 'background' || lastState === 'inactive') && nextState === 'active';
      lastState = nextState;
      if (returnedToForeground) {
        try {
          const res = refreshFn();
          if (res && typeof (res as Promise<unknown>).catch === 'function') {
            (res as Promise<unknown>).catch(() => {
              // Best-effort foreground refresh; ignore transient network errors
            });
          }
        } catch {
          // Best-effort foreground refresh; fail silently
        }
      }
    });
    return () => {
      sub.remove();
    };
  }, [refreshFn, enabled]);
}
