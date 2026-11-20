// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react-native';

const appStateListeners: Array<(state: string) => void> = [];
const removeSpy = vi.fn();
const addEventListenerMock = vi.fn((_type: string, cb: (state: string) => void) => {
  appStateListeners.push(cb);
  return { remove: removeSpy };
});

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (...args: any[]) => addEventListenerMock(...(args as [string, (s: string) => void])),
  },
}));

import {
  ServerClockEstimator,
  MAX_ACCEPTABLE_RTT_MS,
  STALE_SAMPLE_MS,
  HTTP_DATE_QUANTIZATION_MS,
  formatCountdownMMSS,
  useServerClockForegroundRefresh,
} from '../src/lib/server-clock';

describe('ServerClockEstimator — HTTP Date best-effort synchronization', () => {
  let clock: ServerClockEstimator;

  beforeEach(() => {
    clock = new ServerClockEstimator();
  });

  it('1. accepts a valid HTTP Date header, accounts for RTT midpoint, and tracks 1s quantization uncertainty', () => {
    const serverSecMs = Date.UTC(2026, 10, 18, 10, 0, 0);
    const header = new Date(serverSecMs).toUTCString();
    // Device is 2000ms behind true server midpoint; RTT is 200ms (start=T-2100, end=T-1900, midpoint=T-2000)
    const startMs = serverSecMs + HTTP_DATE_QUANTIZATION_MS - 2100;
    const endMs = serverSecMs + HTTP_DATE_QUANTIZATION_MS - 1900;

    const result = clock.recordHttpDateSample(header, startMs, endMs);

    expect(result.accepted).toBe(true);
    expect(result.snapshot.source).toBe('http-date');
    expect(result.snapshot.offsetMs).toBe(2000);
    // Uncertainty = ceil(200/2) + 500 = 600ms (never pretends millisecond accuracy)
    expect(result.snapshot.uncertaintyMs).toBe(600);
    expect(result.snapshot.lastRttMs).toBe(200);
    expect(result.snapshot.isStale).toBe(false);
    expect(clock.getServerNowMs(endMs)).toBe(endMs + 2000);
  });

  it('2. handles missing Date header cleanly without corrupting state', () => {
    const now = Date.UTC(2026, 10, 18, 10, 0, 0);
    const resNull = clock.recordHttpDateSample(null, now - 100, now);
    const resEmpty = clock.recordHttpDateSample('   ', now - 100, now);

    expect(resNull.accepted).toBe(false);
    expect(resNull.reason).toBe('missing-header');
    expect(resEmpty.accepted).toBe(false);
    expect(resEmpty.reason).toBe('missing-header');
    expect(clock.getSnapshot(now).source).toBe('device-fallback');
    expect(clock.getServerNowMs(now)).toBe(now);
  });

  it('3. rejects malformed and implausible Date headers gracefully', () => {
    const now = Date.UTC(2026, 10, 18, 10, 0, 0);
    const malformed = clock.recordHttpDateSample('not-a-valid-http-date', now - 50, now);
    expect(malformed.accepted).toBe(false);
    expect(malformed.reason).toBe('malformed-header');

    const implausible = clock.recordHttpDateSample('Thu, 01 Jan 1970 00:00:00 GMT', now - 50, now);
    expect(implausible.accepted).toBe(false);
    expect(implausible.reason).toBe('implausible-date');
    expect(clock.getSnapshot(now).source).toBe('device-fallback');
  });

  it('4. rejects high-latency samples exceeding RTT ceiling and preserves existing fresh estimate', () => {
    const serverSecMs = Date.UTC(2026, 10, 18, 10, 0, 0);
    const goodHeader = new Date(serverSecMs).toUTCString();
    const goodStart = serverSecMs + HTTP_DATE_QUANTIZATION_MS - 1050;
    const goodEnd = serverSecMs + HTTP_DATE_QUANTIZATION_MS - 950;
    expect(clock.recordHttpDateSample(goodHeader, goodStart, goodEnd).accepted).toBe(true);
    expect(clock.getSnapshot(goodEnd).offsetMs).toBe(1000);

    // Slow request (RTT = MAX_ACCEPTABLE_RTT_MS + 1000) must be rejected
    const slowStart = goodEnd + 1000;
    const slowEnd = slowStart + MAX_ACCEPTABLE_RTT_MS + 1000;
    const slowRes = clock.recordHttpDateSample(new Date(serverSecMs + 20_000).toUTCString(), slowStart, slowEnd);

    expect(slowRes.accepted).toBe(false);
    expect(slowRes.reason).toBe('high-latency-rejected');
    expect(clock.getSnapshot(slowEnd).offsetMs).toBe(1000);
  });

  it('5. marks stale server-time samples and reverts to local device fallback until refreshed', () => {
    const serverSecMs = Date.UTC(2026, 10, 18, 10, 0, 0);
    const startMs = serverSecMs + HTTP_DATE_QUANTIZATION_MS - 5100;
    const endMs = serverSecMs + HTTP_DATE_QUANTIZATION_MS - 4900;
    clock.recordHttpDateSample(new Date(serverSecMs).toUTCString(), startMs, endMs);

    expect(clock.isStale(endMs + STALE_SAMPLE_MS - 1)).toBe(false);
    expect(clock.getSnapshot(endMs + STALE_SAMPLE_MS - 1).source).toBe('http-date');

    const staleNow = endMs + STALE_SAMPLE_MS + 1;
    expect(clock.isStale(staleNow)).toBe(true);
    expect(clock.getSnapshot(staleNow).source).toBe('device-fallback');
    expect(clock.getServerNowMs(staleNow)).toBe(staleNow);
  });

  it('6. handles device clock significantly ahead (+120s) or behind (-120s) and smooths routine jitter', () => {
    const serverSecMs = Date.UTC(2026, 10, 18, 12, 0, 0);

    // Device 120s ahead of server
    const aheadStart = serverSecMs + HTTP_DATE_QUANTIZATION_MS + 119_950;
    const aheadEnd = serverSecMs + HTTP_DATE_QUANTIZATION_MS + 120_050;
    clock.recordHttpDateSample(new Date(serverSecMs).toUTCString(), aheadStart, aheadEnd);
    expect(clock.getSnapshot(aheadEnd).offsetMs).toBe(-120_000);

    // Routine small fluctuation (+4000ms difference) should be smoothed (bounded <= MAX_SMOOTH_STEP_MS = 1500ms)
    const nextStart = aheadEnd + 1000;
    const nextEnd = nextStart + 100;
    clock.recordHttpDateSample(new Date(serverSecMs + 5050).toUTCString(), nextStart, nextEnd);
    const smoothedOffset = clock.getSnapshot(nextEnd).offsetMs;
    expect(Math.abs(smoothedOffset - -120_000)).toBeLessThanOrEqual(1500);

    // Fresh estimator with device 120s behind server
    const behindClock = new ServerClockEstimator();
    const behindStart = serverSecMs + HTTP_DATE_QUANTIZATION_MS - 120_050;
    const behindEnd = serverSecMs + HTTP_DATE_QUANTIZATION_MS - 119_950;
    behindClock.recordHttpDateSample(new Date(serverSecMs).toUTCString(), behindStart, behindEnd);
    expect(behindClock.getSnapshot(behindEnd).offsetMs).toBe(120_000);
  });

  it('7. refreshes offset when app returns to foreground via AppState listener', async () => {
    appStateListeners.length = 0;
    addEventListenerMock.mockClear();
    removeSpy.mockClear();
    const refreshFn = vi.fn();

    function TestComp() {
      useServerClockForegroundRefresh(refreshFn, true);
      return null;
    }

    const { unmount } = await render(React.createElement(TestComp));
    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    const listener = appStateListeners[0];

    // Going to background does NOT trigger refresh
    listener?.('background');
    expect(refreshFn).not.toHaveBeenCalled();

    // Returning from background to active triggers refresh
    listener?.('active');
    expect(refreshFn).toHaveBeenCalledTimes(1);

    await unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('8. falls back cleanly to local device clock for countdowns when sync is unavailable', () => {
    const deviceNow = Date.UTC(2026, 10, 18, 10, 0, 0);
    const targetIso = new Date(deviceNow + 185_000).toISOString(); // 3m 05s ahead

    expect(clock.getSnapshot(deviceNow).source).toBe('device-fallback');
    const remainingMs = clock.getRemainingMs(targetIso, deviceNow);
    expect(remainingMs).toBe(185_000);
    expect(formatCountdownMMSS(remainingMs)).toBe('03:05');
    // Past target never returns negative
    expect(clock.getRemainingMs(deviceNow - 10_000, deviceNow)).toBe(0);
    expect(formatCountdownMMSS(0)).toBe('00:00');
  });
});
