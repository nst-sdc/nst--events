import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

const UUID_SEGMENT_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Produces a safe, query-free request path for logs and RFC 7807 `instance` fields:
 * - Strips all query-string parameters and fragments (never logs `?token=<JWT>` or query secrets).
 * - Prefers Express route templates (e.g. `/v1/events/:id/live`) when a route matched so raw
 *   dynamic identifiers are not exposed in routine logs.
 * - Normalizes UUID segments in unmatched/pre-routing paths to `:id`.
 */
export function getSafeRequestPath(req: Request): string {
  const raw = req.originalUrl || req.url || '/';
  const pathname = raw.split('?')[0].split('#')[0] || '/';
  const routePath = typeof req.route?.path === 'string' ? req.route.path : null;

  if (routePath) {
    const base = typeof req.baseUrl === 'string' && req.baseUrl ? req.baseUrl : '';
    if (base) {
      const combined = `${base}${routePath}`;
      return combined.length > 1 && combined.endsWith('/') ? combined.slice(0, -1) : combined;
    }

    // Express resets req.baseUrl to '' when bubbling errors out of mounted sub-routers
    // into root errorHandler; reconstruct the mount prefix (e.g. /v1) from the query-free pathname.
    const pathSegments = pathname.split('/').filter(Boolean);
    const routeSegments = routePath.split('/').filter(Boolean);
    if (pathSegments.length > routeSegments.length) {
      const prefix = '/' + pathSegments.slice(0, pathSegments.length - routeSegments.length).join('/');
      const normalizedPrefix = prefix.replace(UUID_SEGMENT_RE, ':id');
      return `${normalizedPrefix}${routePath}`;
    }
    return routePath;
  }

  return pathname.replace(UUID_SEGMENT_RE, ':id');
}

// Lightweight in-memory tracking for 401/403 alerting
interface ViolationWindow {
  count: number;
  resetAt: number;
}
const violationCounts = new Map<string, ViolationWindow>();
const THRESHOLD = 20;
const WINDOW_MS = 5 * 60 * 1000;

// Periodic cleanup to prevent unbounded memory growth (OOM protection)
setInterval(() => {
  const now = Date.now();
  for (const [identifier, window] of violationCounts.entries()) {
    if (now > window.resetAt) {
      violationCounts.delete(identifier);
    }
  }
}, 10 * 60 * 1000).unref(); // unref so it doesn't block process exit

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method } = req;
    const safePath = getSafeRequestPath(req);
    const { statusCode } = res;

    // Never log raw query parameters (e.g., ?token=...) or sensitive headers/bodies.
    logger.info(
      {
        request_id: req.id,
        method,
        route: safePath,
        url: safePath,
        status: statusCode,
        duration_ms: duration,
      },
      `${method} ${safePath} ${statusCode}`
    );

    // Track 401/403 responses
    if (statusCode === 401 || statusCode === 403) {
      const identifier = (req as any).user?.id || req.ip || 'unknown';
      const now = Date.now();

      let window = violationCounts.get(identifier);
      if (!window || now > window.resetAt) {
        window = { count: 0, resetAt: now + WINDOW_MS };
      }

      window.count++;
      violationCounts.set(identifier, window);

      if (window.count >= THRESHOLD) {
        logger.warn(
          {
            suspicious_identifier: identifier,
            violation_count: window.count,
            time_window_ms: WINDOW_MS,
            triggering_url: safePath,
            event: 'HIGH_AUTH_FAILURE_RATE',
          },
          `High rate of 401/403 responses detected on ${method} ${safePath}`
        );
        // Reset count to avoid log spam for the remainder of the window
        window.count = 0;
      }
    }
  });

  next();
}
