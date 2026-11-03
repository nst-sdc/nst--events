import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import {
  generalRateLimiter,
  authRateLimiter,
  attendanceRateLimiter,
} from './middleware/rate-limit';
import { prisma } from './lib/prisma';
import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { clubsRouter } from './modules/clubs/clubs.router';
import { eventsRouter } from './modules/events/events.router';
import { attendanceRouter } from './modules/attendance/attendance.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { adminQueueRouter } from './modules/admin/queue.router';
import { adminUsersRouter } from './modules/admin/users.router';
import { adminAuditLogsRouter } from './modules/admin/audit-logs.router';
import { adminStudentsRouter } from './modules/admin/students.router';
import { adminTeamsRouter } from './modules/admin/teams.router';
import { adminAcademicProgramsRouter } from './modules/admin/academic-programs.router';
import { adminAcademicBatchesRouter } from './modules/admin/academic-batches.router';
import { adminAnalyticsRouter } from './modules/admin/analytics.router';
import { teamsRouter } from './modules/teams/teams.router';
import { registrationsRouter } from './modules/registrations/registrations.router';
import { dashboardRouter } from './modules/dashboard/dashboard.router';
import { errorHandler } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { appVersionMiddleware } from './middleware/version-check';
import { sseRouter } from './modules/sse/sse.router';
import { pgListener } from './modules/sse/pg-listener';
import { academicBatchesRouter } from './modules/academic-batches/academic-batches.router';
import { academicProgramsRouter } from './modules/academic-programs/academic-programs.router';
import fieldDefinitionsRouter from './modules/field-definitions/field-definitions.router';
import { eventFormsRouter } from './modules/event-forms/event-forms.router';
import { projectsRouter } from './modules/projects/projects.router';
import { adminProjectsRouter } from './modules/projects/admin-projects.router';
import { eventResultsRouter } from './modules/event-results/event-results.router';
import { studentsRouter } from './modules/students/students.router';
import { policiesRouter, adminPoliciesRouter } from './modules/policies/policies.router';
import { adminRateLimitsRouter } from './modules/admin/rate-limits.router';
import { adminAuthAnalyticsRouter } from './modules/admin/auth-analytics.router';
import { metricsMiddleware, getMergedMetrics } from './lib/metrics';
import { verifyJwt } from './lib/jwt';
import crypto from 'crypto';

export function timingSafeTokenCompare(
  provided?: string | null,
  expected?: string | null
): boolean {
  if (!provided || !expected) return false;
  const hashProvided = crypto.createHash('sha256').update(provided).digest();
  const hashExpected = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

export function createApp(): Express {

  const app = express();

  // SECURITY [TRUST PROXY]: Trust internal K3s cluster overlay networks (cloudflared tunnels, NGINX ingress).
  // This explicitly prevents IP spoofing in our multi-hop Cloudflare -> K3s topology.
  // Express will strip these trusted internal IPs from X-Forwarded-For right-to-left
  // to resolve the true public client IP.
  // Do NOT simplify this to `trust proxy: 1` or `trust proxy: true`, as that will
  // either rate-limit Cloudflare's own IPs or allow attackers to spoof client IPs.
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);

  app.use(helmet());
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Client-Platform',
        'X-App-Version',
        'X-Request-ID',
        'Accept',
      ],
    })
  );
  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(metricsMiddleware);
  // Route-scoped JSON parser for policy write endpoints (256 KiB limit to accommodate 102,400 bytes UTF-8 Markdown + JSON envelope)
  // Registered before general parser so /v1/admin/policies requests are parsed once with 256kb limit,
  // setting req._body = true so the general parser skips it without double-parsing.
  app.use('/v1/admin/policies', express.json({ limit: '256kb' }));
  // Explicit body parsers with strict 100kb limit (DoS prevention against oversized payload attacks)
  // Oversized requests trigger body-parser 'entity.too.large' returning HTTP 413 RFC 7807 problem details
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // Exempt cluster health & readiness checks from all rate limiters
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch (err) {
      res.status(503).json({ status: 'error', message: 'Database connection failed' });
    }
  });

  // Non-public Prometheus metrics endpoint (accessible internally or with token)
  app.get('/metrics', async (req, res) => {
    const isProduction = env.NODE_ENV === 'production';
    const expectedToken = env.METRICS_TOKEN;

    const authHeader = req.headers.authorization;
    let providedToken: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.slice(7).trim();
    } else if (typeof req.headers['x-metrics-token'] === 'string') {
      providedToken = req.headers['x-metrics-token'].trim();
    } else if (typeof req.headers['x-internal-token'] === 'string') {
      providedToken = req.headers['x-internal-token'].trim();
    }

    const isTokenValid = timingSafeTokenCompare(providedToken, expectedToken);

    if (isProduction || expectedToken) {
      // In production, or whenever METRICS_TOKEN is configured:
      // - METRICS_TOKEN is strictly required.
      // - Loopback IP bypass and PLATFORM_ADMIN bypass are completely removed.
      // - Missing or invalid token returns 401 Unauthorized even if X-Forwarded-For is 127.0.0.1.
      if (!isTokenValid) {
        res.status(401).json({
          type: 'https://api.nstsdc.org/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Valid metrics authorization token required',
        });
        return;
      }
    } else {
      // Non-production without configured METRICS_TOKEN:
      const clientIp = req.ip || req.socket.remoteAddress || '';
      const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
      if (!isLoopback) {

          const authHeader = req.headers.authorization;
          let isPlatformAdmin = false;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
              const token = authHeader.slice(7).trim();
              const payload = verifyJwt(token);
              if (payload?.sub) {
                const user = await prisma.user.findUnique({
                  where: { id: payload.sub },
                  select: { globalRole: true, deletedAt: true },
                });
                if (user && !user.deletedAt && user.globalRole === 'PLATFORM_ADMIN') {
                  isPlatformAdmin = true;
                }
              }
            } catch {
              // Unauthenticated
            }
          }
          if (!isPlatformAdmin) {
            res.status(403).json({
              type: 'https://api.nstsdc.org/errors/forbidden',
              title: 'Forbidden',
              status: 403,
              detail: 'External access to metrics is prohibited',
            });
            return;
        }
      }
    }

    try {

      const metrics = await getMergedMetrics();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);
    } catch (err: any) {
      res.status(500).send(`Error collecting metrics: ${err.message}`);
    }
  });

  // Dedicated stricter rate limiter for authentication routes against brute-force
  app.use('/auth', authRateLimiter);

  // Dedicated rate limiter bucket for attendance check-in and offline sync
  app.use('/v1/attendance/mark', attendanceRateLimiter);
  app.use('/v1/attendance/sync-offline', attendanceRateLimiter);
  app.use('/v1/attendance/generate-qr', attendanceRateLimiter);
  app.use('/attendance/mark', attendanceRateLimiter);
  app.use('/attendance/sync-offline', attendanceRateLimiter);
  app.use('/attendance/generate-qr', attendanceRateLimiter);

  // General application limiter (keyed by JWT userId for authenticated users, IP for unauthenticated)
  app.use(generalRateLimiter);
  app.use(appVersionMiddleware);

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/v1/users', usersRouter);
  app.use('/clubs', clubsRouter);
  app.use('/v1', sseRouter); // Mounted at /v1 (handles /events/:id/live and /notifications/live)
  app.use('/v1/events', eventsRouter);
  app.use('/v1/events', eventFormsRouter);
  app.use('/v1/events', eventResultsRouter);
  app.use('/v1/teams', teamsRouter);
  app.use('/v1/dashboard', dashboardRouter);
  app.use('/v1', registrationsRouter);
  app.use('/v1', attendanceRouter);
  app.use('/v1/admin/users', adminUsersRouter);
  app.use('/v1/admin/audit-logs', adminAuditLogsRouter);
  app.use('/v1/admin/students', adminStudentsRouter);
  app.use('/v1/admin/teams', adminTeamsRouter);
  app.use('/v1/admin/academic-programs', adminAcademicProgramsRouter);
  app.use('/v1/admin/academic-batches', adminAcademicBatchesRouter);
  app.use('/v1/admin/analytics', adminAnalyticsRouter);
  app.use('/v1/admin', adminQueueRouter);
  app.use('/v1/notifications', notificationsRouter);
  app.use('/v1/academic-batches', academicBatchesRouter);
  app.use('/v1/academic-programs', academicProgramsRouter);
  app.use('/v1/field-definitions', fieldDefinitionsRouter);
  app.use('/v1/projects', projectsRouter);
  app.use('/v1/admin/projects', adminProjectsRouter);
  app.use('/v1/students', studentsRouter);
  app.use('/v1/policies', policiesRouter);
  app.use('/v1/admin/policies', adminPoliciesRouter);
  app.use('/v1/admin/rate-limits', adminRateLimitsRouter);
  app.use('/v1/admin', adminAuthAnalyticsRouter);

  app.use(errorHandler);

  return app;
}
