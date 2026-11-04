import { NextRequest } from 'next/server';
import { renderMarkdownToSafeHtml } from '@/lib/server-markdown';

export const dynamic = 'force-dynamic';

function getApiBaseUrl(): string {
  if (process.env.INTERNAL_API_URL && process.env.INTERNAL_API_URL.startsWith('http')) {
    return process.env.INTERNAL_API_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:3001';
}

function renderUnavailableHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Service Notice — Legal Policy Unavailable | NST Events</title>
  <meta name="robots" content="noindex, nofollow" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background-color: #09090b;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      max-width: 640px;
      width: 100%;
      border: 2px solid #ef4444;
      background: #18181b;
      padding: 2rem;
      border-radius: 0.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #ef4444;
      margin-bottom: 0.75rem;
      border: 1px solid #ef4444;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      color: #ffffff;
      line-height: 1.4;
    }
    p {
      color: #a1a1aa;
      font-size: 0.875rem;
      line-height: 1.6;
      margin-bottom: 1.25rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid #27272a;
    }
    button {
      background: #ef4444;
      color: #ffffff;
      font-family: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      border: none;
      padding: 0.625rem 1.25rem;
      border-radius: 0.25rem;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    button:hover { background: #dc2626; }
    .contact {
      font-size: 0.8125rem;
      color: #71717a;
    }
    .contact a { color: #60a5fa; text-decoration: none; }
    .contact a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card" role="alert" aria-live="assertive">
    <div class="badge">CAMPUS LEGAL REPOSITORY // SERVICE NOTICE</div>
    <h1>LEGAL DOCUMENT TEMPORARILY UNAVAILABLE</h1>
    <p>
      We are currently unable to verify the authoritative, legally binding NST Events privacy policy from the institutional record.
      To protect student data rights, unverified fallback content is not displayed.
    </p>
    <div class="actions">
      <button onclick="window.location.reload()">RETRY CONNECTION ↻</button>
      <div class="contact">Support: <a href="mailto:support@nstsdc.com">support@nstsdc.com</a></div>
    </div>
  </div>
</body>
</html>`;
}

function renderPolicyPageHtml(policy: {
  slug: string;
  title: string;
  content: string;
  published_version: number;
  published_at: string | null;
}): string {
  const renderedContent = renderMarkdownToSafeHtml(policy.content);
  const formattedDate = policy.published_at
    ? new Date(policy.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'September 9, 2026';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${policy.title || 'Privacy Policy — NST Events'}</title>
  <meta name="description" content="NST Events Privacy Policy, data retention, and student privacy rights." />
  <link rel="icon" href="/favicon.ico" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #ffffff;
      color: #09090b;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 48rem;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }
    @media (min-width: 640px) { .container { padding: 4rem 2rem; } }
    .header {
      border-bottom: 1px solid #e4e4e7;
      padding-bottom: 2rem;
      margin-bottom: 2.5rem;
    }
    .badge-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      margin-top: 1rem;
      font-size: 0.875rem;
      color: #71717a;
    }
    .badge-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #f4f4f5;
      color: #27272a;
      border: 1px solid #e4e4e7;
    }
    .badge-live {
      background: #ecfdf5;
      color: #065f46;
      border-color: #a7f3d0;
    }
    .content {
      font-size: 1rem;
      color: #27272a;
    }
    .footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid #e4e4e7;
      font-size: 0.875rem;
      color: #71717a;
      text-align: center;
    }
    #stale-warning-banner {
      display: none;
      position: sticky;
      top: 0;
      z-index: 50;
      background: #f0fdf4;
      border-bottom: 1px solid #bbf7d0;
      color: #166534;
      padding: 0.75rem 1rem;
      font-size: 0.8125rem;
      font-weight: 500;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
  </style>
</head>
<body>
  <div id="stale-warning-banner" role="alert"></div>

  <div id="privacy-policy-root" class="container" data-origin-timestamp="${policy.published_at || ''}">
    <header class="header">
      <h1 style="font-size: 2.25rem; font-weight: 800; letter-spacing: -0.025em; margin: 0 0 0.5rem 0; color: #09090b;">
        ${policy.title || 'Privacy Policy — NST Events'}
      </h1>
      <div class="badge-bar">
        <span class="badge-pill badge-live">● Verified Active</span>
        <span class="badge-pill">Version ${policy.published_version}</span>
        <span><strong>Published:</strong> ${formattedDate}</span>
      </div>
    </header>

    <main class="content">
      ${renderedContent}
    </main>

    <footer class="footer">
      <p>This policy applies to both the NST Events mobile application (Android and iOS) and the NST Events web dashboard.</p>
      <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #a1a1aa;">
        Permanent Institutional Record — NST Student Developer Club
      </p>
    </footer>
  </div>

  <script>
    (function() {
      var root = document.getElementById('privacy-policy-root');
      var banner = document.getElementById('stale-warning-banner');
      if (!root || !banner) return;
      banner.innerHTML = '✓ <strong>Official Document</strong> — You are viewing the verified, active privacy policy for NST Events.';
      banner.style.display = 'block';
    })();
  </script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const accept = request.headers.get('accept') || '';
  const apiBase = getApiBaseUrl();

  try {
    const res = await fetch(`${apiBase}/v1/policies/privacy-policy`, {
      headers: {
        Accept: 'application/json',
      },
      next: {
        revalidate: 60,
        tags: ['policy-privacy-policy'],
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      if (accept.includes('application/json')) {
        return new Response(
          JSON.stringify({
            error: 'SERVICE_UNAVAILABLE',
            message: 'Policy service is currently unavailable',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            },
          }
        );
      }

      return new Response(renderUnavailableHtml(), {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      });
    }

    const data = await res.json();

    if (accept.includes('application/json')) {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=60',
          'x-nst-origin-timestamp': data.published_at || '',
        },
      });
    }

    const html = renderPolicyPageHtml(data);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=60',
        'x-nst-origin-timestamp': data.published_at || '',
      },
    });
  } catch {
    if (accept.includes('application/json')) {
      return new Response(
        JSON.stringify({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Policy service is currently unreachable',
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    return new Response(renderUnavailableHtml(), {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  }
}
