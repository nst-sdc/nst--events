import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('Public Privacy Policy Next.js Production Server Wire-Level HTTP Test', () => {
  let nextProcess: ChildProcess;
  const testPort = 4455;
  const unreachableApiPort = 59999;
  const dashboardDir = path.resolve(__dirname, '..');

  beforeAll(async () => {
    // Start the production-built Next.js server on testPort with an unreachable API URL
    nextProcess = spawn(
      process.execPath,
      [path.join(dashboardDir, 'node_modules/next/dist/bin/next'), 'start', '-p', String(testPort)],
      {
        cwd: dashboardDir,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: String(testPort),
          INTERNAL_API_URL: `http://127.0.0.1:${unreachableApiPort}`,
          NEXT_PUBLIC_API_URL: `http://127.0.0.1:${unreachableApiPort}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    // Wait for the server to be ready
    const maxWaitMs = 15000;
    const startTime = Date.now();
    let ready = false;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const res = await fetch(`http://127.0.0.1:${testPort}/robots.txt`);
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {
        // Wait and retry
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (!ready) {
      nextProcess.kill('SIGKILL');
      throw new Error(`Next.js production server failed to start within ${maxWaitMs}ms on port ${testPort}`);
    }
  }, 20000);

  afterAll(() => {
    if (nextProcess && !nextProcess.killed) {
      nextProcess.kill('SIGTERM');
    }
  });

  it('serves actual wire-level HTTP 503 and Cache-Control: no-store over TCP when upstream API is unreachable', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/privacy-policy`, {
      headers: {
        'Accept': 'text/html',
      },
    });

    // 1. Assert real wire-level HTTP 503
    expect(res.status).toBe(503);

    // 2. Assert wire-level response headers
    const cacheControl = res.headers.get('cache-control') || '';
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('must-revalidate');

    // 3. Assert content type is HTML
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('text/html');

    // 4. Assert body contains the honest brutalist notice and NO bundled static fallback
    const bodyText = await res.text();
    expect(bodyText).toContain('CAMPUS LEGAL REPOSITORY // SERVICE NOTICE');
    expect(bodyText).toContain('LEGAL DOCUMENT TEMPORARILY UNAVAILABLE');
    expect(bodyText).toContain('RETRY CONNECTION ↻');
    expect(bodyText).not.toContain('September 9, 2026');
    expect(bodyText).not.toContain('NST Student Developer Club (nst-sdc) ("we," "us," "our")');
  });
});
