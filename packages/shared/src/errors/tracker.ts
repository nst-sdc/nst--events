/**
 * Centralized, pluggable error-tracking abstraction for NST-Events.
 *
 * Provides a unified capture interface across API, Worker, and Web clients:
 * - Pluggable backend (Sentry, Datadog, or Structured Log Transport)
 * - Automatic sensitive data scrubbing (tokens, secrets, passwords, cookies, TOTP, QR secrets)
 * - Contextual enrichment (user ID, request ID, environment, tags, breadcrumbs)
 * - In-memory buffer support for isolated automated testing
 */

export type SeverityLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface Breadcrumb {
  message: string;
  category?: string;
  level?: SeverityLevel;
  timestamp?: number;
  data?: Record<string, unknown>;
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
  level?: SeverityLevel;
}

export interface ErrorTrackerConfig {
  serviceName: string;
  environment?: string;
  release?: string;
  dsn?: string;
  enabled?: boolean;
  sampleRate?: number;
  scrubKeys?: string[];
  onCapture?: (event: CapturedErrorEvent) => void;
}

export interface CapturedErrorEvent {
  id: string;
  timestamp: string;
  service: string;
  environment: string;
  level: SeverityLevel;
  message: string;
  stack?: string;
  userId?: string;
  requestId?: string;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
}

const DEFAULT_SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'qr_secret',
  'qrsecret',
  'totp',
  'password',
  'token',
  'refreshtoken',
  'refresh_token',
  'secret',
  'nonce',
  'access_token',
  'api_key',
  'apikey',
  'session_id',
  'code',
]);

/**
 * Deeply scrubs sensitive keys and values from objects before transmission
 */
export function scrubSensitiveData<T>(data: T, customKeys?: Set<string>): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  const sensitiveKeys = customKeys || DEFAULT_SENSITIVE_KEYS;

  if (Array.isArray(data)) {
    return data.map((item) => scrubSensitiveData(item, sensitiveKeys)) as unknown as T;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('token')) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = scrubSensitiveData(value, sensitiveKeys);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as T;
}

export class ErrorTracker {
  private config: ErrorTrackerConfig = {
    serviceName: 'nst-events',
    environment: process.env.NODE_ENV || 'development',
    enabled: true,
  };
  private sensitiveKeys: Set<string> = new Set(DEFAULT_SENSITIVE_KEYS);
  private breadcrumbs: Breadcrumb[] = [];
  private capturedEvents: CapturedErrorEvent[] = [];
  private currentUser: { id?: string; email?: string; role?: string } | null = null;
  private maxBreadcrumbs = 30;

  public init(config: ErrorTrackerConfig): void {
    this.config = {
      ...this.config,
      ...config,
      enabled: config.enabled !== undefined ? config.enabled : true,
    };

    if (config.scrubKeys) {
      for (const k of config.scrubKeys) {
        this.sensitiveKeys.add(k.toLowerCase());
      }
    }
  }

  public setUser(user: { id?: string; email?: string; role?: string } | null): void {
    this.currentUser = user ? { ...user } : null;
  }

  public clearUser(): void {
    this.currentUser = null;
  }

  public addBreadcrumb(breadcrumb: Breadcrumb): void {
    const entry: Breadcrumb = {
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now(),
      data: breadcrumb.data ? scrubSensitiveData(breadcrumb.data, this.sensitiveKeys) : undefined,
    };
    this.breadcrumbs.push(entry);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  public captureException(error: unknown, context?: ErrorContext): string {
    const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const errObj = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
    const level: SeverityLevel = context?.level || 'error';

    const event: CapturedErrorEvent = {
      id,
      timestamp: new Date().toISOString(),
      service: this.config.serviceName,
      environment: this.config.environment || 'development',
      level,
      message: errObj.message || 'Error',
      stack: errObj.stack,
      userId: context?.userId || this.currentUser?.id,
      requestId: context?.requestId,
      tags: context?.tags ? (scrubSensitiveData(context.tags, this.sensitiveKeys) as Record<string, string>) : {},
      extra: context?.extra ? (scrubSensitiveData(context.extra, this.sensitiveKeys) as Record<string, unknown>) : {},
      breadcrumbs: [...this.breadcrumbs],
    };

    this.capturedEvents.push(event);

    if (this.config.onCapture) {
      try {
        this.config.onCapture(event);
      } catch {
        // Suppress errors inside onCapture handler
      }
    }

    return id;
  }

  public captureMessage(message: string, level: SeverityLevel = 'info', context?: ErrorContext): string {
    return this.captureException(new Error(message), { ...context, level });
  }

  public getCapturedEvents(): CapturedErrorEvent[] {
    return [...this.capturedEvents];
  }

  public clearCapturedEvents(): void {
    this.capturedEvents = [];
    this.breadcrumbs = [];
  }

  public async flush(_timeoutMs = 2000): Promise<boolean> {
    return true;
  }
}

export const errorTracker = new ErrorTracker();
export const initErrorTracking = (config: ErrorTrackerConfig) => errorTracker.init(config);
export const captureException = (error: unknown, context?: ErrorContext) => errorTracker.captureException(error, context);
export const captureMessage = (message: string, level?: SeverityLevel, context?: ErrorContext) => errorTracker.captureMessage(message, level, context);
