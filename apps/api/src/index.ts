/**
 * ARCHITECTURE ENFORCEMENT NOTICE:
 * Allowed deps: @nst/database, @nst/shared only.
 * NEVER import from apps/mobile or apps/dashboard.
 */
/// <reference path="./types/express.d.ts" />
import { createApp } from './app';
import { logger } from './lib/logger';

import { Server } from 'http';
import { prisma } from './lib/prisma';
import { pgListener } from './modules/sse/pg-listener';
import { rateLimitSettingsCache } from './lib/rate-limit-settings';
import { env, assertProductionConfig } from './config/env';
import { authEventsService } from './modules/auth/auth-events.service';


const PORT = process.env.PORT || 3001;

let server: Server | null = null;
let isShuttingDown = false;

export async function bootstrap(): Promise<Server> {
  assertProductionConfig(env);

  await prisma.$connect();
  logger.info('[nst-api] Database connected successfully');

  pgListener.connect().catch((err) => {
    logger.error({ err }, '[nst-api] Failed to initialize Postgres SSE listener bridge');
  });

  rateLimitSettingsCache.init().catch((err) => {
    logger.error({ err }, '[nst-api] Failed to initialize rate limit settings cache');
  });

  const app = createApp();
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      logger.info(`[nst-api] Server running on port ${PORT}`);
      resolve(server!);
    });
  });
}

export async function gracefulShutdown(signal: string, shouldExit = true) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[nst-api] Received ${signal}, starting graceful shutdown...`);

  const timeout = setTimeout(() => {
    logger.error('[nst-api] Shutdown timed out. Forcing exit.');
    if (shouldExit) process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err && (err as any).code !== 'ERR_SERVER_NOT_RUNNING') {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      logger.info('[nst-api] HTTP server closed');
    }

    // Flush and stop asynchronous auth events buffer before database teardown
    authEventsService.stop();
    await authEventsService.flushSync();
    logger.info('[nst-api] Auth events in-memory buffer flushed cleanly');

    rateLimitSettingsCache.stop();
    await pgListener.disconnect();
    logger.info('[nst-api] PG listener disconnected');

    await prisma.$disconnect();
    logger.info('[nst-api] Prisma disconnected');

    clearTimeout(timeout);
    logger.info('[nst-api] Graceful shutdown completed cleanly');
    if (shouldExit) process.exit(0);
  } catch (err) {

    logger.error({ err }, '[nst-api] Error during graceful shutdown');
    clearTimeout(timeout);
    if (shouldExit) process.exit(1);
  }
}

// Only start automatically if this file is run directly (not imported in tests)
if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error({ err }, '[nst-api] Failed to start server');
    process.exit(1);
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
