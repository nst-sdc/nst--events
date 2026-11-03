import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma';

export const apiMetricsRegistry = new client.Registry();

// Collect standard Node.js & runtime metrics with prefix
client.collectDefaultMetrics({
  register: apiMetricsRegistry,
  prefix: 'nst_api_',
});

// Canonical Application Metrics
export const httpRequestsTotal = new client.Counter({
  name: 'nst_api_http_requests_total',
  help: 'Total number of HTTP requests processed by API replicas',
  labelNames: ['method', 'route', 'status_code', 'status_class'],
  registers: [apiMetricsRegistry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'nst_api_http_request_duration_seconds',
  help: 'HTTP request latency distribution in seconds',
  labelNames: ['method', 'route', 'status_class'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [apiMetricsRegistry],
});

export const rateLimitExceededTotal = new client.Counter({
  name: 'nst_api_rate_limit_exceeded_total',
  help: 'Total number of requests rejected by rate limiters (429 Too Many Requests)',
  labelNames: ['bucket'],
  registers: [apiMetricsRegistry],
});

export const sseActiveConnections = new client.Gauge({
  name: 'nst_api_sse_active_connections',
  help: 'Current active persistent Server-Sent Events (SSE) connections',
  labelNames: ['stream_type'],
  registers: [apiMetricsRegistry],
});

/**
 * Normalizes route path to route template (e.g. /v1/events/:id) to prevent high-cardinality explosion.
 * Unmatched routes (404) must strictly use a single label value "unmatched" (never raw path).
 */
export function getNormalizedRoute(req: Request, res?: Response): string {
  // If response is 404 and route is unmatched (or catch-all wildcard), collapse strictly to "unmatched"
  if (res && res.statusCode === 404 && (!req.route || !req.route.path || req.route.path === '*')) {
    return 'unmatched';
  }

  if (req.route?.path && req.route.path !== '*') {
    const basePath = req.baseUrl || '';
    const routePath = typeof req.route.path === 'string' ? req.route.path : String(req.route.path);
    return `${basePath}${routePath}` || '/';
  }

  if (req.path === '/health' || req.path === '/ready' || req.path === '/metrics') {
    return req.path;
  }

  return 'unmatched';
}

/**
 * Express middleware measuring request count, response status class, and latency distribution.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTimer = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    const route = getNormalizedRoute(req, res);

    const method = req.method;
    const statusCode = String(res.statusCode);
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;

    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
      status_class: statusClass,
    });

    startTimer({
      method,
      route,
      status_class: statusClass,
    });
  });

  next();
}

/**
 * Collects and concatenates both application Prom-client metrics and Prisma connection pool metrics.
 */
export async function getMergedMetrics(): Promise<string> {
  let appMetrics = await apiMetricsRegistry.metrics();
  try {
    if (typeof (prisma as any).$metrics?.prometheus === 'function') {
      const dbMetrics = await (prisma as any).$metrics.prometheus();
      appMetrics += `\n${dbMetrics}`;
    }
  } catch {
    // Graceful fallback if database is currently unreachable
  }
  return appMetrics;
}
