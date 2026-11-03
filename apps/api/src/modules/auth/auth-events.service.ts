import crypto from 'crypto';
import { Request } from 'express';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export type AuthEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'REFRESH_FAILED'
  | 'REUSE_DETECTED'
  | 'LOGOUT'
  | 'SESSION_REVOKED';

export type AuthPlatform = 'web' | 'mobile';
export type NetworkClass = 'campus' | 'off_campus' | 'unknown';
export type DeviceClass = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface LogAuthEventOptions {
  eventType: AuthEventType;
  userId?: string | null;
  req?: Request;
  platform?: AuthPlatform;
  appVersion?: string | null;
  ip?: string;
  userAgent?: string;
  failureReason?: string | null;
}

/**
 * Normalizes an IPv4 or IPv6-mapped IPv4 address to standard IPv4.
 */
export function normalizeIp(rawIp?: string | null): string {
  if (!rawIp) return 'unknown';
  let ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

/**
 * Converts standard IPv4 string into 32-bit unsigned integer.
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let res = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return null;
    res = ((res << 8) + num) >>> 0;
  }
  return res;
}

/**
 * Checks whether an IPv4 address falls within a specified CIDR block.
 */
export function ipMatchesCidr(ipStr: string, cidr: string): boolean {
  const normalized = normalizeIp(ipStr);
  const ipInt = ipv4ToInt(normalized);
  if (ipInt === null) return false;

  const [cidrBase, prefixStr] = cidr.trim().split('/');
  const baseInt = ipv4ToInt(cidrBase);
  if (baseInt === null) return false;

  const prefix = prefixStr !== undefined ? parseInt(prefixStr, 10) : 32;
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  if (prefix === 0) return true;

  const mask = ((0xffffffff << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (baseInt & mask);
}

/**
 * Classifies network as campus, off_campus, or unknown based on configured campus CIDR blocks.
 * If no campus CIDRs are configured (default empty), network_class is classified as 'unknown'.
 * Real campus public egress IPs must be set in CAMPUS_CIDR_BLOCKS (e.g. '103.21.124.0/24').
 * RFC 1918 private ranges must not be used as defaults because student traffic via campus NAT arrives from real public egress IPs.
 */
export function classifyNetwork(
  ipStr?: string | null,
  overrideCidrs?: string
): NetworkClass {
  const ip = normalizeIp(ipStr);
  if (ip === 'unknown' || ip === '') return 'unknown';

  const rawConfig =
    overrideCidrs !== undefined
      ? overrideCidrs
      : (env.CAMPUS_CIDR_BLOCKS || env.CAMPUS_EGRESS_CIDRS || '');

  const cidrList = rawConfig.split(',').map((c) => c.trim()).filter(Boolean);
  if (cidrList.length === 0) {
    return 'unknown';
  }

  for (const cidr of cidrList) {
    if (ipMatchesCidr(ip, cidr)) {
      return 'campus';
    }
  }

  return 'off_campus';
}


/**
 * Computes deterministic HMAC SHA-256 hash using the server-side pepper.
 */
export function hashIp(ipStr?: string | null): string {
  const ip = normalizeIp(ipStr);
  return crypto.createHmac('sha256', env.AUTH_EVENTS_IP_PEPPER).update(ip).digest('hex');
}

/**
 * Extracts user-agent family and device class from raw User-Agent header.
 */
export function parseUserAgent(ua?: string | null): { userAgentFamily: string; deviceClass: DeviceClass } {
  if (!ua) {
    return { userAgentFamily: 'Unknown', deviceClass: 'unknown' };
  }

  let deviceClass: DeviceClass = 'desktop';
  if (/mobile|android|iphone|ipod/i.test(ua)) {
    deviceClass = 'mobile';
  } else if (/ipad|tablet/i.test(ua)) {
    deviceClass = 'tablet';
  } else if (/bot|crawler|spider|curl|postman|python|axios/i.test(ua)) {
    deviceClass = 'bot';
  }

  let userAgentFamily = 'Other';
  if (/Edg\//i.test(ua)) {
    userAgentFamily = 'Edge';
  } else if (/Chrome\//i.test(ua)) {
    userAgentFamily = 'Chrome';
  } else if (/Firefox\//i.test(ua)) {
    userAgentFamily = 'Firefox';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    userAgentFamily = 'Safari';
  } else if (/Expo|okhttp|CFNetwork/i.test(ua)) {
    userAgentFamily = 'Expo/MobileApp';
  }

  return { userAgentFamily, deviceClass };
}

/**
 * Sanitizes failure reason to strictly avoid persisting email addresses or tokens.
 * For rejected email domains, retains only the domain name.
 */
export function sanitizeFailureReason(reason?: string | null): string | null {
  if (!reason) return null;
  let sanitized = reason;

  // Mask any email address to retain domain only: "foo@gmail.com" -> "@gmail.com"
  sanitized = sanitized.replace(/[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, '@$1');

  // Strip anything that resembles a JWT or Bearer token (three base64 segments)
  sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]');

  // Truncate to reasonable length
  return sanitized.slice(0, 255);
}

interface QueuedAuthEvent {
  userId: string | null;
  eventType: string;
  platform: string;
  appVersion: string | null;
  userAgentFamily: string;
  deviceClass: string;
  ipHash: string;
  rawIp: string | null;
  networkClass: string;
  failureReason: string | null;
  createdAt: Date;
}

export class AuthEventsService {
  private queue: QueuedAuthEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly BATCH_FLUSH_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 3000;

  constructor() {
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        logger.error({ err }, '[AuthEventsService] Error during periodic flush');
      });
    }, this.FLUSH_INTERVAL_MS);
    this.flushTimer.unref();
  }

  private buildEvent(opts: LogAuthEventOptions): QueuedAuthEvent {

    const rawIp = opts.ip ?? opts.req?.ip ?? '127.0.0.1';
    const rawUa = opts.userAgent ?? opts.req?.headers['user-agent'] ?? null;
    const { userAgentFamily, deviceClass } = parseUserAgent(rawUa);

    let platform: AuthPlatform = opts.platform ?? 'web';
    if (!opts.platform && opts.req) {
      const headerPlatform = opts.req.headers['x-client-platform'];
      if (headerPlatform === 'mobile' || opts.req.query?.platform === 'mobile') {
        platform = 'mobile';
      }
    }

    const appVersion = opts.appVersion ?? (opts.req?.headers['x-app-version'] as string) ?? null;
    const networkClass = classifyNetwork(rawIp);
    const ipHash = hashIp(rawIp);
    const rawIpStored = env.AUTH_EVENTS_STORE_RAW_IP ? normalizeIp(rawIp) : null;
    const failureReason = sanitizeFailureReason(opts.failureReason);

    return {
      userId: opts.userId ?? null,
      eventType: opts.eventType,
      platform,
      appVersion,
      userAgentFamily,
      deviceClass,
      ipHash,
      rawIp: rawIpStored,
      networkClass,
      failureReason,
      createdAt: new Date(),
    };
  }

  /**
   * Writes critical security events (REUSE_DETECTED, SESSION_REVOKED) synchronously directly to the database.
   * Guarantees immediate persistence without waiting for in-memory batch flushes.
   * Resilient and non-blocking for HTTP response if the database write throws.
   */
  public async logSynchronousEvent(opts: LogAuthEventOptions): Promise<void> {
    try {
      const item = this.buildEvent(opts);
      await prisma.authEvent.createMany({
        data: [
          {
            userId: item.userId,
            eventType: item.eventType,
            platform: item.platform,
            appVersion: item.appVersion,
            userAgentFamily: item.userAgentFamily,
            deviceClass: item.deviceClass,
            ipHash: item.ipHash,
            rawIp: item.rawIp,
            networkClass: item.networkClass,
            failureReason: item.failureReason,
            createdAt: item.createdAt,
          },
        ],
      });
    } catch (err) {
      // Non-blocking: write error is logged, caller's auth response remains intact
      logger.error(
        { err, eventType: opts.eventType },
        '[AuthEventsService] Failed to record synchronous auth event'
      );
    }
  }


  /**
   * Main asynchronous entrypoint for recording auth events.
   * Security events REUSE_DETECTED and SESSION_REVOKED are immediately written synchronously.
   * Guarantees that logging never slows or fails the primary auth flow.
   */
  public log(opts: LogAuthEventOptions): void {
    try {
      // Security events REUSE_DETECTED and SESSION_REVOKED must be written synchronously
      if (opts.eventType === 'REUSE_DETECTED' || opts.eventType === 'SESSION_REVOKED') {
        this.logSynchronousEvent(opts).catch((err) => {
          logger.error({ err }, '[AuthEventsService] Unexpected async failure in synchronous log execution');
        });
        return;
      }

      const eventItem = this.buildEvent(opts);

      if (this.queue.length >= this.MAX_QUEUE_SIZE) {
        // Drop oldest to prevent unbounded heap growth under extreme attack
        this.queue.shift();
      }

      this.queue.push(eventItem);

      // Trigger immediate async flush if batch size threshold reached
      if (this.queue.length >= this.BATCH_FLUSH_SIZE) {
        setImmediate(() => {
          this.flush().catch((err) => {
            logger.error({ err }, '[AuthEventsService] Error during batch size flush');
          });
        });
      }
    } catch (err) {
      // Non-blocking: auth must never fail if logger throws
      logger.error({ err }, '[AuthEventsService] Unexpected error building auth event');
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }


  /**
   * Flushes queued events to PostgreSQL in batches.
   */
  public async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const itemsToInsert = this.queue.splice(0, this.BATCH_FLUSH_SIZE);
    try {
      await prisma.authEvent.createMany({
        data: itemsToInsert.map((item) => ({
          userId: item.userId,
          eventType: item.eventType,
          platform: item.platform,
          appVersion: item.appVersion,
          userAgentFamily: item.userAgentFamily,
          deviceClass: item.deviceClass,
          ipHash: item.ipHash,
          rawIp: item.rawIp,
          networkClass: item.networkClass,
          failureReason: item.failureReason,
          createdAt: item.createdAt,
        })),
      });
    } catch (err) {
      logger.error({ err, count: itemsToInsert.length }, '[AuthEventsService] Failed to write auth events batch');
    }
  }

  /**
   * Synchronous flush for test harnesses to await all writes before assertions.
   */
  public async flushSync(): Promise<void> {
    while (this.queue.length > 0) {
      await this.flush();
    }
  }

  public stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

export const authEventsService = new AuthEventsService();
