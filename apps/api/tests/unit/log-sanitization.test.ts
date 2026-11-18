import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { randomUUID } from 'crypto';
import express from 'express';
import { logger } from '../../src/lib/logger';
import { requestIdMiddleware } from '../../src/middleware/request-id';
import { requestLogger, getSafeRequestPath } from '../../src/middleware/request-logger';
import { errorHandler } from '../../src/middleware/error-handler';
import { AppError } from '../../src/lib/errors';

interface CapturedLog {
  level: 'info' | 'warn' | 'error';
  args: unknown[];
  serialized: string;
}

function captureLoggerCalls(): { logs: CapturedLog[]; restore: () => void } {
  const logs: CapturedLog[] = [];
  const origInfo = logger.info.bind(logger);
  const origWarn = logger.warn.bind(logger);
  const origError = logger.error.bind(logger);

  const intercept = (level: 'info' | 'warn' | 'error') => (...args: unknown[]) => {
    logs.push({
      level,
      args,
      serialized: JSON.stringify(args, (_k, v) =>
        v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v
      ),
    });
  };

  (logger as any).info = intercept('info');
  (logger as any).warn = intercept('warn');
  (logger as any).error = intercept('error');

  return {
    logs,
    restore: () => {
      (logger as any).info = origInfo;
      (logger as any).warn = origWarn;
      (logger as any).error = origError;
    },
  };
}

function httpGet(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on('error', reject);
  });
}

describe('Log Sanitization — Request Logger & Error Handler Query-Token Protection', () => {
  let restoreLogger: (() => void) | null = null;

  afterEach(() => {
    if (restoreLogger) {
      restoreLogger();
      restoreLogger = null;
    }
  });

  it('1. getSafeRequestPath strips query strings and normalizes dynamic UUID segments', () => {
    const id = randomUUID();
    const matchedReq = {
      baseUrl: '/v1',
      route: { path: '/events/:id/live' },
      originalUrl: `/v1/events/${id}/live?token=secret-test-jwt&extra=leaked`,
    } as any;
    assert.strictEqual(getSafeRequestPath(matchedReq), '/v1/events/:id/live');

    const unmatchedReq = {
      originalUrl: `/v1/events/${id}/live?token=secret-test-jwt&foo=bar#frag`,
    } as any;
    assert.strictEqual(getSafeRequestPath(unmatchedReq), '/v1/events/:id/live');
  });

  it('2. requestLogger never writes ?token= JWT or extra query params to logs while preserving method, route, status, and request_id', async () => {
    const capture = captureLoggerCalls();
    restoreLogger = capture.restore;

    const eventId = randomUUID();
    const syntheticToken = 'secret-test-jwt';
    const extraParam = 'leaked-query-secret-999';

    const app = express();
    app.use(requestIdMiddleware);
    app.use(requestLogger);

    const router = express.Router();
    router.get('/events/:id/live', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use('/v1', router);

    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as any;

    try {
      const res = await httpGet(
        port,
        `/v1/events/${eventId}/live?token=${syntheticToken}&other=${extraParam}`
      );
      assert.strictEqual(res.status, 200);

      assert.ok(capture.logs.length >= 1, 'Expected at least one request log entry');
      const allSerialized = capture.logs.map((l) => l.serialized).join('\n');
      assert.strictEqual(allSerialized.includes(syntheticToken), false, 'JWT token must NEVER appear in serialized logs');
      assert.strictEqual(allSerialized.includes(extraParam), false, 'Extra query params must NEVER appear in serialized logs');
      assert.strictEqual(allSerialized.includes(eventId), false, 'Raw event UUID should be templated to :id');
      assert.ok(allSerialized.includes('/v1/events/:id/live'), 'Sanitized route template must be preserved');
      assert.ok(allSerialized.includes('"method":"GET"'), 'HTTP method must be preserved');
      assert.ok(allSerialized.includes('"status":200'), 'HTTP status must be preserved');
      assert.ok(allSerialized.includes('"request_id":'), 'request_id must be preserved');
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('3. requestLogger 401/403 high-failure-rate warning never logs ?token= or extra query parameters', async () => {
    const capture = captureLoggerCalls();
    restoreLogger = capture.restore;

    const eventId = randomUUID();
    const syntheticToken = 'secret-test-jwt';
    const extraParam = 'extra-401-param';

    const app = express();
    app.use(requestIdMiddleware);
    app.use(requestLogger);

    const router = express.Router();
    router.get('/events/:id/live', (_req, res) => {
      res.status(401).json({ error: 'unauthorized' });
    });
    app.use('/v1', router);

    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as any;

    try {
      // Trigger THRESHOLD=20 401s to exercise the warn branch too
      for (let i = 0; i < 20; i++) {
        const res = await httpGet(
          port,
          `/v1/events/${eventId}/live?token=${syntheticToken}&extra=${extraParam}`
        );
        assert.strictEqual(res.status, 401);
      }

      const warnLogs = capture.logs.filter((l) => l.level === 'warn');
      assert.ok(warnLogs.length >= 1, 'Expected HIGH_AUTH_FAILURE_RATE warn log');
      const allSerialized = capture.logs.map((l) => l.serialized).join('\n');
      assert.strictEqual(allSerialized.includes(syntheticToken), false, 'JWT must NEVER appear in info or warn logs');
      assert.strictEqual(allSerialized.includes(extraParam), false, 'Extra query param must NEVER appear in logs');
      assert.ok(warnLogs[0].serialized.includes('/v1/events/:id/live'));
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('4. errorHandler (pre-headersSent & post-headersSent) never logs ?token= or extra query params and preserves sanitized diagnostics', async () => {
    const capture = captureLoggerCalls();
    restoreLogger = capture.restore;

    const eventId = randomUUID();
    const syntheticToken = 'secret-test-jwt';
    const extraParam = 'error-query-secret';

    const app = express();
    app.use(requestIdMiddleware);
    app.use(requestLogger);

    const router = express.Router();
    router.get('/events/:id/boom-app', (_req, _res, next) => {
      next(new AppError('Synthetic internal failure', 500, 'https://api.nstsdc.org/errors/internal', 'Internal Error'));
    });
    router.get('/events/:id/boom-unhandled', (_req, _res, next) => {
      next(new Error('Unexpected stream failure'));
    });
    router.get('/events/:id/boom-post-headers', (_req, res, next) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.flushHeaders();
      next(new Error('Late post-header failure'));
    });
    app.use('/v1', router);
    app.use(errorHandler);

    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as any;

    try {
      const r1 = await httpGet(port, `/v1/events/${eventId}/boom-app?token=${syntheticToken}&x=${extraParam}`);
      assert.strictEqual(r1.status, 500);
      assert.strictEqual(r1.body.includes(syntheticToken), false, 'RFC 7807 response body must not echo token');
      assert.strictEqual(r1.body.includes(extraParam), false, 'RFC 7807 response body must not echo query params');
      assert.ok(r1.body.includes('/v1/events/:id/boom-app'));

      const r2 = await httpGet(port, `/v1/events/${eventId}/boom-unhandled?token=${syntheticToken}&x=${extraParam}`);
      assert.strictEqual(r2.status, 500);
      assert.strictEqual(r2.body.includes(syntheticToken), false);

      const r3 = await httpGet(port, `/v1/events/${eventId}/boom-post-headers?token=${syntheticToken}&x=${extraParam}`);
      assert.strictEqual(r3.status, 200);

      const errorLogs = capture.logs.filter((l) => l.level === 'error');
      assert.strictEqual(errorLogs.length, 3, 'Expected 3 error logs across all 3 error paths');
      const allSerialized = capture.logs.map((l) => l.serialized).join('\n');
      assert.strictEqual(allSerialized.includes(syntheticToken), false, 'JWT must NEVER appear in error logs');
      assert.strictEqual(allSerialized.includes(extraParam), false, 'Extra query param must NEVER appear in error logs');
      assert.strictEqual(allSerialized.includes(eventId), false, 'Raw event UUID must not appear in error logs');
      assert.ok(allSerialized.includes('/v1/events/:id/boom-app'));
      assert.ok(allSerialized.includes('/v1/events/:id/boom-unhandled'));
      assert.ok(allSerialized.includes('/v1/events/:id/boom-post-headers'));
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
