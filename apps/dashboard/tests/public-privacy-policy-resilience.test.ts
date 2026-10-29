import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../app/(public)/privacy-policy/route';

describe('Public Privacy Policy Route Resilience & Wire-Level 503 Suite', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('returns wire-level HTTP 503 and Cache-Control: no-store upon upstream API connection error', async () => {
    // Simulate upstream connection failure (ECONNREFUSED / timeout)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3001'));

    const req = new NextRequest('https://events.nstsdc.org/privacy-policy', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const response = await GET(req);

    // 1. Assert wire-level HTTP 503 status
    expect(response.status).toBe(503);

    // 2. Assert strictly anti-caching Cache-Control header
    const cacheControl = response.headers.get('Cache-Control');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('must-revalidate');

    // 3. Inspect body content
    const html = await response.text();
    expect(html).toContain('CAMPUS LEGAL REPOSITORY // SERVICE NOTICE');
    expect(html).toContain('LEGAL DOCUMENT TEMPORARILY UNAVAILABLE');
    expect(html).toContain('RETRY CONNECTION ↻');

    // 4. Assert ZERO bundled static fallback text exists in the response
    expect(html).not.toContain('September 9, 2026');
    expect(html).not.toContain('NST Student Developer Club (nst-sdc) ("we," "us," "our")');
    expect(html).not.toContain('Who Can Use This Service');
  });

  it('returns wire-level HTTP 503 and Cache-Control: no-store upon upstream HTTP 500 error', async () => {
    // Simulate upstream API returning 500
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Database failure' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const req = new NextRequest('https://events.nstsdc.org/privacy-policy');
    const response = await GET(req);

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    const html = await response.text();
    expect(html).toContain('CAMPUS LEGAL REPOSITORY // SERVICE NOTICE');
  });

  it('returns wire-level HTTP 503 JSON with Cache-Control: no-store when JSON is requested', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const req = new NextRequest('https://events.nstsdc.org/privacy-policy', {
      headers: {
        'Accept': 'application/json',
      },
    });

    const response = await GET(req);

    expect(response.status).toBe(503);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toContain('no-store');

    const json = await response.json();
    expect(json.error).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns HTTP 200 with Cache-Control: public upon upstream success', async () => {
    const publishedPolicy = {
      slug: 'privacy-policy',
      title: 'Privacy Policy — NST Events',
      content: '# Privacy Policy\n\nThis is the authoritative university policy.',
      published_version: 3,
      published_at: '2026-10-29T00:35:00.000Z',
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(publishedPolicy), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const req = new NextRequest('https://events.nstsdc.org/privacy-policy', {
      headers: {
        'Accept': 'text/html',
      },
    });

    const response = await GET(req);

    expect(response.status).toBe(200);
    const cacheControl = response.headers.get('Cache-Control');
    expect(cacheControl).toContain('public');
    expect(cacheControl).toContain('max-age=60');
    expect(response.headers.get('x-nst-origin-timestamp')).toBe('2026-10-29T00:35:00.000Z');

    const html = await response.text();
    expect(html).toContain('Privacy Policy — NST Events');
    expect(html).toContain('Version 3');
    expect(html).toContain('data-origin-timestamp="2026-10-29T00:35:00.000Z"');
    expect(html).toContain('This is the authoritative university policy.');
  });
});
