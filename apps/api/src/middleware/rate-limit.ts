import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator, RateLimitRequestHandler, Options } from 'express-rate-limit';
import { env } from '../config/env';
import { verifyJwt } from '../lib/jwt';
import { REFRESH_TOKEN_COOKIE_NAME } from '../lib/cookies';
import { rateLimitSettingsCache } from '../lib/rate-limit-settings';
import { rateLimitExceededTotal } from '../lib/metrics';

/**
 * ARCHITECTURAL DECISION: RATE LIMIT STORE (TASK P3)
 *
 * Stack Evaluation:
 * 1. Redis is not part of the active or planned deployment stack (the architecture
 *    relies strictly on PostgreSQL + pgmq without Redis containers).
 * 2. A PostgreSQL-backed rate limit store (executing SELECT/INSERT/UPDATE on every
 *    incoming HTTP request) would introduce 5-20ms latency per request, cause row lock
 *    contention, generate extreme table bloat, and exhaust connection pool quotas during
 *    campus-wide check-in events with 3,000+ concurrent students.
 * 3. Therefore, an in-memory store (MemoryStore) is used, with rate limits mathematically
 *    partitioned across API replicas:
 *        Effective Per-Replica Limit = TotalTargetLimit / RATE_LIMIT_REPLICAS
 *    With Traefik ingress balancing requests evenly across 2-3 replicas via round-robin,
 *    in-memory stores provide zero-latency, sub-microsecond in-RAM enforcement with zero
 *    database amplification and no single point of failure.
 */

export function extractUserIdFromRequest(req: Request): string | null {
  if (req.user?.id) {
    return req.user.id;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const payload = verifyJwt(token);
        if (payload?.sub) {
          return payload.sub;
        }
      } catch {
        // Token is invalid/expired; treat as unauthenticated
      }
    }
  }
  return null;
}

export function isAttendanceCheckInOrSync(path: string): boolean {
  return (
    path === '/v1/attendance/mark' ||
    path === '/v1/attendance/sync-offline' ||
    path === '/v1/attendance/generate-qr' ||
    path === '/attendance/mark' ||
    path === '/attendance/sync-offline' ||
    path === '/attendance/generate-qr'
  );
}

export function isExemptRoute(path: string): boolean {
  if (path === '/health' || path === '/ready' || path === '/metrics') return true;
  if (/^\/v1\/events\/[^/]+\/live$/.test(path)) return true;
  if (/^\/v1\/notifications\/live$/.test(path)) return true;
  return false;
}

export function handleRfc7807RateLimit(
  req: Request,
  res: Response,
  _next: NextFunction,
  options: { windowMs: number; message?: any }
): void {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  if (!res.getHeader('Retry-After')) {
    res.setHeader('Retry-After', retryAfterSeconds);
  }
  const instance = req.originalUrl || req.url;
  const requestId = (req as any).id;
  const detail =
    typeof options.message === 'string'
      ? options.message
      : options.message?.detail || 'Too many requests, please try again later.';

  res.status(429).json({
    type: 'https://api.nstsdc.org/errors/too-many-requests',
    title: 'Too Many Requests',
    status: 429,
    detail,
    instance,
    request_id: requestId,
  });
}

export function createRateLimitHandler(bucket: string) {
  return (req: Request, res: Response, next: NextFunction, options: { windowMs: number; message?: any }) => {
    rateLimitExceededTotal.inc({ bucket });
    handleRfc7807RateLimit(req, res, next, options);
  };
}

export interface GeneralRateLimiterOptions extends Partial<Options> {
  userMax?: number;
  unauthMax?: number;
}

/**
 * 1. General Application Rate Limiter
 * - Authenticated requests: Keyed by user ID (from verified JWT), with generous per-user limit.
 * - Unauthenticated requests: Keyed by client IP (via ipKeyGenerator), sized for shared NAT.
 * - Skips exempt routes, auth endpoints (handled by authRateLimiter), and attendance check-in/sync
 *   (handled by attendanceRateLimiter).
 */
export function createGeneralRateLimiter(overrides?: GeneralRateLimiterOptions): RateLimitRequestHandler {
  const { userMax: customUserMax, unauthMax: customUnauthMax, ...rest } = overrides || {};
  const windowMs = rest.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const userMax = customUserMax ?? Math.ceil(env.RATE_LIMIT_USER_MAX / env.RATE_LIMIT_REPLICAS);
  const unauthMax = customUnauthMax ?? Math.ceil(env.RATE_LIMIT_UNAUTH_MAX / env.RATE_LIMIT_REPLICAS);

  return rateLimit({
    windowMs,
    max: (req) => {
      const userId = extractUserIdFromRequest(req);
      const ip = req.ip || '127.0.0.1';
      if (customUserMax !== undefined && userId) return customUserMax;
      if (customUnauthMax !== undefined && !userId) return customUnauthMax;
      const bucket = userId ? 'user' : 'unauth';
      const quota = rateLimitSettingsCache.resolveQuota(bucket, { userId, ip });
      return quota.max;
    },
    keyGenerator: (req) => {
      const userId = extractUserIdFromRequest(req);
      if (userId) {
        return `user:${userId}`;
      }
      return `ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`;
    },
    skip: (req) => {
      if (process.env.NODE_ENV === 'development') return true;
      if (isExemptRoute(req.path)) return true;
      if (req.path.startsWith('/auth')) return true;
      if (isAttendanceCheckInOrSync(req.path)) return true;
      const userId = extractUserIdFromRequest(req);
      const ip = req.ip || '127.0.0.1';
      const bucket = userId ? 'user' : 'unauth';
      const quota = rateLimitSettingsCache.resolveQuota(bucket, { userId, ip });
      if (quota.skip) return true;
      return false;
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response, next: NextFunction, options: any) => {
      const userId = extractUserIdFromRequest(req);
      rateLimitExceededTotal.inc({ bucket: userId ? 'user' : 'unauth' });
      handleRfc7807RateLimit(req, res, next, options);
    },
    ...rest,
  });
}

export function extractRefreshTokenFromRequest(req: Request): string | null {
  const token =
    req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
    req.cookies?.refreshToken ||
    req.cookies?.refresh_token ||
    req.cookies?.nst_refresh_token ||
    req.signedCookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
    req.signedCookies?.refreshToken ||
    req.signedCookies?.refresh_token ||
    req.signedCookies?.nst_refresh_token ||
    req.body?.refresh_token ||
    req.body?.refreshToken;

  if (typeof token === 'string' && token.trim().length > 0) {
    return token.trim();
  }
  return null;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isAuthTokenEndpoint(pathOrUrl: string): boolean {
  return (
    pathOrUrl === '/refresh' ||
    pathOrUrl === '/logout' ||
    pathOrUrl === '/auth/refresh' ||
    pathOrUrl === '/auth/logout' ||
    pathOrUrl.startsWith('/auth/refresh') ||
    pathOrUrl.startsWith('/auth/logout') ||
    pathOrUrl.endsWith('/refresh') ||
    pathOrUrl.endsWith('/logout')
  );
}

export interface AuthTokenRateLimiterOptions extends Partial<Options> {
  tokenMax?: number;
  unauthMax?: number;
  ipCeilingMax?: number;
}

/**
 * 2a. Dedicated Auth Token Rate Limiter (/auth/refresh and /auth/logout)
 * - Keyed by SHA-256 hash of the refresh token (from HttpOnly cookie or body).
 * - Per-token limit prevents a single compromised or looping client from hammering refresh.
 * - When refresh token is absent (unauthenticated / malformed probe), falls back to client IP
 *   with a generous unauth limit so legitimate students sharing campus NAT IP are never locked out.
 * - An overall per-IP ceiling (default 5000 cluster-wide, divided by replicas) is applied to all
 *   requests regardless of token presence, preventing rotating random tokens from bypassing limits.
 */
export function createAuthTokenRateLimiter(overrides?: AuthTokenRateLimiterOptions): RateLimitRequestHandler {
  const {
    tokenMax: customTokenMax,
    unauthMax: customUnauthMax,
    ipCeilingMax: customIpCeilingMax,
    ...rest
  } = overrides || {};
  const windowMs = rest.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const tokenMax = customTokenMax ?? Math.ceil(env.RATE_LIMIT_AUTH_TOKEN_MAX / env.RATE_LIMIT_REPLICAS);
  const unauthMax = customUnauthMax ?? Math.ceil(env.RATE_LIMIT_AUTH_UNAUTH_MAX / env.RATE_LIMIT_REPLICAS);
  const ipCeilingMax =
    customIpCeilingMax ?? Math.ceil(env.RATE_LIMIT_AUTH_IP_CEILING_MAX / env.RATE_LIMIT_REPLICAS);

  const ipCeilingLimiter = rateLimit({
    windowMs,
    max: (req) => {
      if (customIpCeilingMax !== undefined) return customIpCeilingMax;
      const ip = req.ip || '127.0.0.1';
      const quota = rateLimitSettingsCache.resolveQuota('auth_ip_ceiling', { ip });
      return quota.max;
    },
    keyGenerator: (req) => `auth:token:ip-ceiling:${ipKeyGenerator(req.ip || '127.0.0.1')}`,
    skip: (req) => {
      if (process.env.NODE_ENV === 'development') return true;
      if (isExemptRoute(req.path)) return true;
      const ip = req.ip || '127.0.0.1';
      const quota = rateLimitSettingsCache.resolveQuota('auth_ip_ceiling', { ip });
      if (quota.skip) return true;
      return false;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many refresh/logout attempts from this IP, please try again later.',
    handler: createRateLimitHandler('auth_ip_ceiling'),
    ...rest,
  });

  const perTokenLimiter = rateLimit({
    windowMs,
    max: (req) => {
      const token = extractRefreshTokenFromRequest(req);
      const ip = req.ip || '127.0.0.1';
      if (customTokenMax !== undefined && token) return customTokenMax;
      if (customUnauthMax !== undefined && !token) return customUnauthMax;
      const bucket = token ? 'auth_token' : 'unauth';
      const quota = rateLimitSettingsCache.resolveQuota(bucket, { ip });
      return quota.max;
    },
    keyGenerator: (req) => {
      const token = extractRefreshTokenFromRequest(req);
      if (token) {
        return `auth:token:${hashRefreshToken(token)}`;
      }
      return `auth:token:ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`;
    },
    skip: (req) => {
      if (process.env.NODE_ENV === 'development') return true;
      if (isExemptRoute(req.path)) return true;
      const token = extractRefreshTokenFromRequest(req);
      const ip = req.ip || '127.0.0.1';
      const bucket = token ? 'auth_token' : 'unauth';
      const quota = rateLimitSettingsCache.resolveQuota(bucket, { ip });
      if (quota.skip) return true;
      return false;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many refresh/logout attempts, please try again later.',
    handler: (req: Request, res: Response, next: NextFunction, options: any) => {
      const token = extractRefreshTokenFromRequest(req);
      rateLimitExceededTotal.inc({ bucket: token ? 'auth_token' : 'unauth' });
      handleRfc7807RateLimit(req, res, next, options);
    },
    ...rest,
  });

  return ((req: Request, res: Response, next: NextFunction) => {
    ipCeilingLimiter(req, res, (err) => {
      if (err) return next(err);
      if (res.headersSent) return;
      perTokenLimiter(req, res, next);
    });
  }) as RateLimitRequestHandler;
}

/**
 * 2b. Dedicated Auth OAuth & Login Limiter (/auth/google, /auth/google/callback, /mobile/login-id-token, /mobile/exchange)
 * - Keyed by client IP.
 * - Sized for 3,000+ students logging in concurrently during peak morning check-ins or event registrations.
 * - skipSuccessfulRequests: true ensures that successful logins (302/303 redirects, 200 OK) do NOT consume quota.
 * - Only failed or rejected requests (HTTP >= 400: e.g. invalid state/nonce, wrong institutional domain) count,
 *   with a modest per-IP cap applied solely against abusive volume.
 */
export function createAuthOAuthRateLimiter(overrides?: Partial<Options>): RateLimitRequestHandler {
  const windowMs = overrides?.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const max =
    overrides?.max ??
    Math.ceil((env.RATE_LIMIT_AUTH_FAILED_MAX ?? env.RATE_LIMIT_AUTH_MAX) / env.RATE_LIMIT_REPLICAS);

  return rateLimit({
    windowMs,
    max: (req) => {
      if (overrides?.max !== undefined) return overrides.max as number;
      const ip = req.ip || '127.0.0.1';
      const quota = rateLimitSettingsCache.resolveQuota('auth_oauth_failed', { ip });
      return quota.max;
    },
    keyGenerator: (req) => `auth:oauth:ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`,
    skipSuccessfulRequests: true,
    skip: (req) => {
      if (process.env.NODE_ENV === 'development') return true;
      if (isExemptRoute(req.path)) return true;
      const ip = req.ip || '127.0.0.1';
      const quota = rateLimitSettingsCache.resolveQuota('auth_oauth_failed', { ip });
      if (quota.skip) return true;
      return false;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many failed authentication attempts, please try again later.',
    handler: createRateLimitHandler('auth_oauth_failed'),
    ...overrides,
  });
}

export interface AuthRateLimiterOptions {
  windowMs?: number;
  max?: number;
  token?: AuthTokenRateLimiterOptions;
  oauth?: Partial<Options>;
}

/**
 * 2. Unified Auth Rate Limiter Router / Dispatcher
 * - Intelligently multiplexes incoming /auth requests:
 *   - /auth/refresh & /auth/logout -> dispatched to SHA-256 token-keyed limiter
 *   - /auth/google, callback, & mobile exchange -> dispatched to failure-only OAuth limiter
 */
export function createAuthRateLimiter(overrides?: AuthRateLimiterOptions | Partial<Options>): RateLimitRequestHandler {
  const isFlat = overrides && !('token' in overrides || 'oauth' in overrides);
  const tokenOpts: AuthTokenRateLimiterOptions | undefined = isFlat
    ? {
        windowMs: overrides?.windowMs,
        tokenMax: typeof (overrides as any)?.max === 'number' ? (overrides as any).max : undefined,
      }
    : (overrides as AuthRateLimiterOptions)?.token;
  const oauthOpts: Partial<Options> | undefined = isFlat
    ? overrides
    : (overrides as AuthRateLimiterOptions)?.oauth;

  const tokenLimiter = createAuthTokenRateLimiter(tokenOpts);
  const oauthLimiter = createAuthOAuthRateLimiter(oauthOpts);

  return ((req: Request, res: Response, next: NextFunction) => {
    const candidatePath = req.path || '';
    const candidateUrl = req.originalUrl || req.url || '';
    if (isAuthTokenEndpoint(candidatePath) || isAuthTokenEndpoint(candidateUrl)) {
      return tokenLimiter(req, res, next);
    }
    return oauthLimiter(req, res, next);
  }) as RateLimitRequestHandler;
}

/**
 * 3. Dedicated Attendance Check-in & Sync Bucket
 * - Separated from general web/mobile traffic so check-ins and sync operations are never
 *   starved by users browsing events, portfolios, or clubs.
 * - Keyed by user ID (or client IP fallback).
 */
export function createAttendanceRateLimiter(overrides?: Partial<Options>): RateLimitRequestHandler {
  const windowMs = overrides?.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const max = overrides?.max ?? Math.ceil(env.RATE_LIMIT_ATTENDANCE_MAX / env.RATE_LIMIT_REPLICAS);

  return rateLimit({
    windowMs,
    max: (req) => {
      if (overrides?.max !== undefined) return overrides.max as number;
      const userId = extractUserIdFromRequest(req);
      const ip = req.ip || '127.0.0.1';
      const quota = rateLimitSettingsCache.resolveQuota('attendance', { userId, ip });
      return quota.max;
    },
    keyGenerator: (req) => {
      const userId = extractUserIdFromRequest(req);
      if (userId) {
        return `attendance:user:${userId}`;
      }
      return `attendance:ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`;
    },
    skip: (req) => {
      if (process.env.NODE_ENV === 'development') return true;
      if (isExemptRoute(req.path)) return true;
      const userId = extractUserIdFromRequest(req);
      const ip = req.ip || '127.0.0.1';
      const quota = rateLimitSettingsCache.resolveQuota('attendance', { userId, ip });
      if (quota.skip) return true;
      return false;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many attendance operations, please try again later.',
    handler: createRateLimitHandler('attendance'),
    ...overrides,
  });
}

export const generalRateLimiter = createGeneralRateLimiter();
export const authTokenRateLimiter = createAuthTokenRateLimiter();
export const authOAuthRateLimiter = createAuthOAuthRateLimiter();
export const authRateLimiter = createAuthRateLimiter();
export const attendanceRateLimiter = createAttendanceRateLimiter();
