/**
 * Leveled logger for NST Events Mobile App
 *
 * Guarantees:
 * - Leveled logging: debug, info, warn, error
 * - Never prints raw QR payloads or TOTP tokens
 * - Respects __DEV__ environment gating for high-frequency logs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'token',
  'refreshtoken',
  'qr_payload',
  'rawpayload',
  'totp',
  'qr_secret',
  'qrsecret',
  'password',
  'secret',
  'cookie',
  'authorization',
]);

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('payload')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeMeta(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

class MobileLogger {
  private isDev = typeof __DEV__ !== 'undefined' && __DEV__;

  public debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.isDev) return;
    const clean = sanitizeMeta(meta);
    if (clean) {
      console.debug(`[DEBUG] ${message}`, clean);
    } else {
      console.debug(`[DEBUG] ${message}`);
    }
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    if (!this.isDev) return;
    const clean = sanitizeMeta(meta);
    if (clean) {
      console.info(`[INFO] ${message}`, clean);
    } else {
      console.info(`[INFO] ${message}`);
    }
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    const clean = sanitizeMeta(meta);
    if (clean) {
      console.warn(`[WARN] ${message}`, clean);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const clean = sanitizeMeta(meta);
    const errMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
    const payload = {
      ...(clean || {}),
      ...(errMessage ? { error: errMessage } : {}),
    };
    console.error(`[ERROR] ${message}`, payload);
  }
}

export const logger = new MobileLogger();
