import { describe, it, expect, beforeEach } from 'vitest';
import {
  errorTracker,
  scrubSensitiveData,
  initErrorTracking,
  captureException,
  captureMessage,
} from '../src/errors/tracker.js';

describe('Error Tracking Wrapper & Data Sanitization', () => {
  beforeEach(() => {
    errorTracker.clearCapturedEvents();
    errorTracker.clearUser();
    initErrorTracking({
      serviceName: 'test-service',
      environment: 'test',
    });
  });

  describe('Sensitive Data Scrubbing', () => {
    it('deeply scrubs sensitive keys (qr_secret, totp, tokens, cookies, passwords)', () => {
      const raw = {
        userId: 'usr-123',
        password: 'super-secret-password',
        authorization: 'Bearer jwt.token.here',
        qr_secret: 'base32secretkey',
        qrSecret: 'camelCaseSecret',
        totp: '123456',
        nested: {
          refreshToken: 'refresh-abc-xyz',
          normalKey: 'visible-value',
          subNested: {
            authCookie: 'cookie_val',
            secretCode: '9999',
          },
        },
        items: [
          { token: 'tok_1' },
          { harmless: 'ok' },
        ],
      };

      const cleaned = scrubSensitiveData(raw);

      expect(cleaned.userId).toBe('usr-123');
      expect(cleaned.password).toBe('[REDACTED]');
      expect(cleaned.authorization).toBe('[REDACTED]');
      expect(cleaned.qr_secret).toBe('[REDACTED]');
      expect(cleaned.qrSecret).toBe('[REDACTED]');
      expect(cleaned.totp).toBe('[REDACTED]');
      expect(cleaned.nested.refreshToken).toBe('[REDACTED]');
      expect(cleaned.nested.normalKey).toBe('visible-value');
      expect(cleaned.nested.subNested.secretCode).toBe('[REDACTED]');
      expect(cleaned.items[0].token).toBe('[REDACTED]');
      expect(cleaned.items[1].harmless).toBe('ok');
    });

    it('handles null, undefined, and non-object primitives gracefully', () => {
      expect(scrubSensitiveData(null)).toBeNull();
      expect(scrubSensitiveData(undefined)).toBeUndefined();
      expect(scrubSensitiveData('plain-string')).toBe('plain-string');
      expect(scrubSensitiveData(42)).toBe(42);
    });
  });

  describe('Exception Capture & Context Enrichment', () => {
    it('captures Error instance and redacts sensitive tags and extra data', () => {
      const err = new Error('Database connection timeout');
      const eventId = captureException(err, {
        userId: 'user-88',
        requestId: 'req-99',
        tags: {
          endpoint: '/v1/attendance/mark',
          cookie: 'session_secret_data',
        },
        extra: {
          payload: { qr_secret: 'secret-seed-xyz', count: 5 },
        },
      });

      expect(eventId).toMatch(/^err_/);
      const events = errorTracker.getCapturedEvents();
      expect(events).toHaveLength(1);

      const captured = events[0];
      expect(captured.message).toBe('Database connection timeout');
      expect(captured.service).toBe('test-service');
      expect(captured.userId).toBe('user-88');
      expect(captured.requestId).toBe('req-99');
      expect(captured.tags.endpoint).toBe('/v1/attendance/mark');
      expect(captured.tags.cookie).toBe('[REDACTED]');
      expect((captured.extra.payload as any).qr_secret).toBe('[REDACTED]');
      expect((captured.extra.payload as any).count).toBe(5);
    });

    it('enriches events with active user and records breadcrumbs', () => {
      errorTracker.setUser({ id: 'usr-global-1', email: 'test@nst.edu' });
      errorTracker.addBreadcrumb({
        category: 'navigation',
        message: 'Opened scanner screen',
        level: 'info',
        data: { token: 'sensitive-token' },
      });

      captureMessage('Warning message', 'warning', {
        requestId: 'req-abc',
      });

      const events = errorTracker.getCapturedEvents();
      expect(events).toHaveLength(1);
      const captured = events[0];
      expect(captured.level).toBe('warning');
      expect(captured.userId).toBe('usr-global-1');
      expect(captured.breadcrumbs).toHaveLength(1);
      expect(captured.breadcrumbs[0].data?.token).toBe('[REDACTED]');
    });
  });
});
