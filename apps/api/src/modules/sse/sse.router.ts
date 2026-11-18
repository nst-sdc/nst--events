import { EventEmitter } from 'events';
import { NextFunction, Request, Response, Router } from 'express';
import { sseEventBus } from './event-bus';
import { sseConnectionManager } from './sse-connection-manager';
import { authenticate } from '../../middleware/authenticate';
import { sseActiveConnections } from '../../lib/metrics';
import { logger } from '../../lib/logger';
import { buildEventChannel, buildUserNotificationChannel } from './sse.utils';
import * as eventsService from '../events/events.service';

/**
 * Per-client backpressure policy:
 * Each SSE client maintains an independent bounded pending-chunk buffer (no global queue).
 * When `res.write()` returns `false`, subsequent events are buffered up to `maxPendingChunks`
 * and flushed on `'drain'`. Redundant heartbeats are skipped while congested. If a slow client's
 * buffer exceeds `maxPendingChunks`, that slow client is disconnected so memory stays bounded
 * and healthy subscribers are never impacted; EventSource reconnects cleanly.
 */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
export const DEFAULT_MAX_PENDING_CHUNKS = 32;

export interface SseRouterDeps {
  connectionManager?: Pick<
    typeof sseConnectionManager,
    'subscribe' | 'unsubscribe' | 'subscribeUserNotifications' | 'unsubscribeUserNotifications'
  >;
  eventBus?: Pick<EventEmitter, 'on' | 'off'>;
  checkEventReadAuthorization?: typeof eventsService.checkEventReadAuthorization;
  authMiddleware?: (req: Request, res: Response, next: NextFunction) => unknown;
  heartbeatIntervalMs?: number;
  maxPendingChunks?: number;
}

// Middleware to support query param 'token' as Bearer token for EventSource
const defaultSseAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (typeof req.query.token === 'string' && req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticate(req, res, next);
};

interface StreamSetupOptions {
  req: Request;
  res: Response;
  next: NextFunction;
  streamType: 'event_live' | 'notifications_live';
  channel: string;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  eventBus: Pick<EventEmitter, 'on' | 'off'>;
  heartbeatIntervalMs: number;
  maxPendingChunks: number;
}

function isResponseClosed(res: Response): boolean {
  return Boolean(res.writableEnded || res.destroyed || (res as any).writableFinished);
}

async function handleSseStream(opts: StreamSetupOptions): Promise<void> {
  const {
    req,
    res,
    next,
    streamType,
    channel,
    subscribe,
    unsubscribe,
    eventBus,
    heartbeatIntervalMs,
    maxPendingChunks,
  } = opts;

  let clientClosedBeforeInit = false;
  let subscribed = false;
  let cleanedUp = false;
  let metricIncremented = false;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let isDraining = false;
  const pendingChunks: string[] = [];

  const onEarlyClose = () => {
    clientClosedBeforeInit = true;
  };
  req.once('close', onEarlyClose);
  res.once('close', onEarlyClose);

  const onDrain = () => {
    if (cleanedUp || isResponseClosed(res)) {
      pendingChunks.length = 0;
      isDraining = false;
      return;
    }

    while (pendingChunks.length > 0) {
      const nextChunk = pendingChunks.shift()!;
      try {
        const ok = res.write(nextChunk);
        if (!ok) {
          res.once('drain', onDrain);
          return;
        }
      } catch (writeErr) {
        logger.warn(
          { stream_type: streamType, err: writeErr instanceof Error ? writeErr.message : 'write_failed' },
          '[SSE] Stream write failed during drain; closing connection'
        );
        void cleanup(true);
        return;
      }
    }

    isDraining = false;
  };

  const safeWrite = (chunk: string, isHeartbeat: boolean) => {
    if (cleanedUp || isResponseClosed(res)) {
      return;
    }

    if (isDraining) {
      if (isHeartbeat) {
        // Do not queue stale heartbeats behind pending real events
        return;
      }
      if (pendingChunks.length >= maxPendingChunks) {
        logger.warn(
          { stream_type: streamType, max_pending_chunks: maxPendingChunks },
          '[SSE] Evicting slow client due to backpressure buffer limit'
        );
        void cleanup(true);
        return;
      }
      pendingChunks.push(chunk);
      return;
    }

    try {
      const ok = res.write(chunk);
      if (!ok) {
        isDraining = true;
        res.once('drain', onDrain);
      }
    } catch (writeErr) {
      logger.warn(
        { stream_type: streamType, err: writeErr instanceof Error ? writeErr.message : 'write_failed' },
        '[SSE] Stream write failed; closing connection'
      );
      void cleanup(true);
    }
  };

  const onEvent = (payload: unknown) => {
    safeWrite(`data: ${JSON.stringify(payload)}\n\n`, false);
  };

  const onSystemDisconnect = () => {
    // End stream cleanly so EventSource clients reconnect and resync
    void cleanup(true);
  };

  const onStreamError = (err: Error) => {
    logger.warn(
      { stream_type: streamType, err: err?.message || 'stream_error' },
      '[SSE] Response stream error'
    );
    void cleanup(true);
  };

  const onDisconnect = () => {
    void cleanup(false);
  };

  const cleanup = async (terminateResponse: boolean) => {
    if (cleanedUp) return;
    cleanedUp = true;

    req.off('close', onEarlyClose);
    res.off('close', onEarlyClose);
    req.off('close', onDisconnect);
    res.off('close', onDisconnect);
    res.off('error', onStreamError);
    res.off('drain', onDrain);

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    pendingChunks.length = 0;
    isDraining = false;

    eventBus.off(channel, onEvent);
    eventBus.off('system:disconnect', onSystemDisconnect);

    if (metricIncremented) {
      sseActiveConnections.dec({ stream_type: streamType });
      metricIncremented = false;
    }

    if (terminateResponse && !isResponseClosed(res)) {
      try {
        res.end();
      } catch {
        if (!res.destroyed) {
          res.destroy();
        }
      }
    }

    if (subscribed) {
      subscribed = false;
      try {
        await unsubscribe();
      } catch (unsubErr) {
        logger.error(
          { stream_type: streamType, err: unsubErr instanceof Error ? unsubErr.message : 'unsubscribe_failed' },
          '[SSE] Error during subscription cleanup'
        );
      }
    }

    logger.debug({ stream_type: streamType }, '[SSE] Connection closed');
  };

  try {
    // Perform subscription initialization BEFORE committing SSE headers
    // so failures can still return a proper HTTP error response.
    await subscribe();
    subscribed = true;

    // If the client disconnected while subscription was initializing, clean up immediately
    if (clientClosedBeforeInit || req.destroyed || isResponseClosed(res)) {
      await cleanup(false);
      return;
    }

    req.off('close', onEarlyClose);
    res.off('close', onEarlyClose);

    // Disable socket idle timeout for long-lived SSE streams without altering REST timeouts
    req.setTimeout(0);
    res.setTimeout(0);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseActiveConnections.inc({ stream_type: streamType });
    metricIncremented = true;
    logger.debug({ stream_type: streamType }, '[SSE] Connection established');

    eventBus.on(channel, onEvent);
    eventBus.on('system:disconnect', onSystemDisconnect);

    heartbeatInterval = setInterval(() => {
      safeWrite(
        `data: ${JSON.stringify({ type: 'heartbeat', payload: { timestamp: new Date().toISOString() } })}\n\n`,
        true
      );
    }, heartbeatIntervalMs);
    heartbeatInterval.unref?.();

    req.once('close', onDisconnect);
    res.once('close', onDisconnect);
    res.once('error', onStreamError);
  } catch (err) {
    await cleanup(res.headersSent);

    if (res.headersSent) {
      logger.error(
        { stream_type: streamType, err: err instanceof Error ? err.message : 'unknown_error' },
        '[SSE] Error after headers were committed; terminated stream'
      );
      return;
    }

    next(err);
  }
}

export function createSseRouter(deps: SseRouterDeps = {}): Router {
  const router = Router();
  const connectionManager = deps.connectionManager ?? sseConnectionManager;
  const eventBus = deps.eventBus ?? sseEventBus;
  const checkEventReadAuthorization =
    deps.checkEventReadAuthorization ?? eventsService.checkEventReadAuthorization;
  const authMiddleware = deps.authMiddleware ?? defaultSseAuthMiddleware;
  const heartbeatIntervalMs = deps.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const maxPendingChunks = deps.maxPendingChunks ?? DEFAULT_MAX_PENDING_CHUNKS;

  router.get('/events/:id/live', authMiddleware, async (req, res, next) => {
    try {
      const eventId = req.params.id;
      // Validate eventId UUID & construct canonical channel before auth/subscribe
      const channel = buildEventChannel(eventId);

      // Enforce Event Read Authorization before subscribing or sending headers
      await checkEventReadAuthorization(req.user!.id, eventId);

      await handleSseStream({
        req,
        res,
        next,
        streamType: 'event_live',
        channel,
        subscribe: () => connectionManager.subscribe(eventId),
        unsubscribe: () => connectionManager.unsubscribe(eventId),
        eventBus,
        heartbeatIntervalMs,
        maxPendingChunks,
      });
    } catch (err) {
      if (res.headersSent) {
        logger.error(
          { stream_type: 'event_live', err: err instanceof Error ? err.message : 'unknown_error' },
          '[SSE] Error after headers were committed'
        );
        if (!isResponseClosed(res)) {
          res.end();
        }
        return;
      }
      next(err);
    }
  });

  router.get('/notifications/live', authMiddleware, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const channel = buildUserNotificationChannel(userId);

      await handleSseStream({
        req,
        res,
        next,
        streamType: 'notifications_live',
        channel,
        subscribe: () => connectionManager.subscribeUserNotifications(userId),
        unsubscribe: () => connectionManager.unsubscribeUserNotifications(userId),
        eventBus,
        heartbeatIntervalMs,
        maxPendingChunks,
      });
    } catch (err) {
      if (res.headersSent) {
        logger.error(
          { stream_type: 'notifications_live', err: err instanceof Error ? err.message : 'unknown_error' },
          '[SSE] Error after headers were committed'
        );
        if (!isResponseClosed(res)) {
          res.end();
        }
        return;
      }
      next(err);
    }
  });

  return router;
}

export const sseRouter: Router = createSseRouter();
