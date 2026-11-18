import { Client, Notification } from 'pg';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { sseEventBus } from './event-bus';

export interface PGClientLike {
  connect(): Promise<unknown>;
  query(sql: string): Promise<unknown>;
  end(): Promise<unknown>;
  on(event: 'notification', listener: (msg: Notification) => void): unknown;
  on(event: 'error', listener: (err: Error) => void): unknown;
  on(event: 'end', listener: () => void): unknown;
}

/**
 * Manages a single shared PostgreSQL LISTEN/NOTIFY client with:
 * - Generation-guarded connect()/disconnect() lifecycle:
 *   - Concurrent connect() calls share `connectPromise`.
 *   - Concurrent disconnect() calls share `disconnectPromise` and bump `lifecycleGen`.
 *   - If disconnect() runs while client.connect() is pending, the invalidated client is
 *     closed immediately on resolution and never published to `this.client`.
 * - Strictly serialized query queue (`opChain`) for LISTEN/UNLISTEN operations.
 */
export class PGListener {
  private client: PGClientLike | null = null;
  private connectPromise: Promise<void> | null = null;
  private disconnectPromise: Promise<void> | null = null;
  private lifecycleGen = 0;
  private isDisconnecting = false;
  private desiredChannels: Set<string> = new Set();
  private listenedChannels: Set<string> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private opChain: Promise<void> = Promise.resolve();
  private readonly clientFactory: () => PGClientLike;

  constructor(clientFactory?: () => PGClientLike) {
    this.clientFactory =
      clientFactory ||
      (() =>
        new Client({
          connectionString: env.DATABASE_URL,
        }));
  }

  /**
   * Serializes all queries sent through the shared pg.Client so concurrent
   * LISTEN/UNLISTEN operations never overlap (avoids node-postgres concurrent query
   * deprecation warnings and preserves causal LISTEN/UNLISTEN ordering).
   * A failed operation propagates to its caller without poisoning subsequent operations.
   */
  private enqueueOp<T>(task: () => Promise<T>): Promise<T> {
    const run = this.opChain.then(task);
    this.opChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async connect(): Promise<void> {
    // Wait for any in-flight disconnect to complete before initiating a fresh connection
    if (this.disconnectPromise) {
      await this.disconnectPromise;
    }

    if (this.client) return;
    if (this.connectPromise) return this.connectPromise;

    const myGen = this.lifecycleGen;
    const client = this.clientFactory();

    const p = (async () => {
      try {
        client.on('notification', (msg: Notification) => {
          if (this.client !== client || !msg.channel) return;
          try {
            const parsed = msg.payload ? JSON.parse(msg.payload) : {};
            sseEventBus.emit(msg.channel, parsed);
          } catch {
            sseEventBus.emit(msg.channel, { raw: msg.payload });
          }
        });

        client.on('error', (err: Error) => {
          logger.error({ err: err.message }, '[PGListener] Client error');
          if (this.client === client && this.lifecycleGen === myGen) {
            this.handleDisconnect();
          }
        });

        client.on('end', () => {
          if (!this.isDisconnecting && this.lifecycleGen === myGen) {
            logger.warn('[PGListener] Connection ended unexpectedly');
          }
          if (this.client === client && this.lifecycleGen === myGen) {
            this.handleDisconnect();
          }
        });

        await client.connect();

        // Guard against disconnect() having invalidated this connection attempt while pending
        if (this.lifecycleGen !== myGen || this.isDisconnecting) {
          try {
            await client.end();
          } catch (closeErr) {
            logger.warn(
              { err: closeErr instanceof Error ? closeErr.message : 'unknown_error' },
              '[PGListener] Error closing invalidated client after disconnect'
            );
          }
          return;
        }

        this.client = client;
        this.listenedChannels.clear();

        // Restore all currently desired channels sequentially on the shared client
        const channelsToRestore = Array.from(this.desiredChannels);
        for (const channel of channelsToRestore) {
          if (this.lifecycleGen !== myGen || this.isDisconnecting) break;
          await this.enqueueOp(async () => {
            if (this.lifecycleGen !== myGen || this.client !== client || this.isDisconnecting) return;
            if (!this.desiredChannels.has(channel) || this.listenedChannels.has(channel)) return;
            await client.query(`LISTEN "${channel}"`);
            this.listenedChannels.add(channel);
          });
        }
      } catch (error) {
        logger.error(
          { err: error instanceof Error ? error.message : 'unknown_error' },
          '[PGListener] Connection error'
        );
        // Only handle disconnect / schedule reconnect if this generation is still active
        if (this.lifecycleGen === myGen && !this.isDisconnecting) {
          if (this.client === client) {
            this.handleDisconnect();
          } else {
            this.scheduleReconnect();
          }
        }
      }
    })().finally(() => {
      if (this.connectPromise === p) {
        this.connectPromise = null;
      }
    });

    this.connectPromise = p;
    return p;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.isDisconnecting) return;
    this.reconnectTimeout = setTimeout(() => {
      void this.connect();
    }, 5000);
    this.reconnectTimeout.unref();
  }

  private handleDisconnect(): void {
    sseEventBus.emit('system:disconnect', {});
    this.client = null;
    this.listenedChannels.clear();
    this.scheduleReconnect();
  }

  async listen(channel: string): Promise<void> {
    this.desiredChannels.add(channel);

    return this.enqueueOp(async () => {
      const client = this.client;
      if (!client || this.isDisconnecting) return;
      // An unlisten arrived before this queued listen ran
      if (!this.desiredChannels.has(channel)) return;
      // Already actively listened on this connection
      if (this.listenedChannels.has(channel)) return;

      try {
        await client.query(`LISTEN "${channel}"`);
        this.listenedChannels.add(channel);
      } catch (err) {
        this.desiredChannels.delete(channel);
        this.listenedChannels.delete(channel);
        logger.error(
          { err: err instanceof Error ? err.message : 'unknown_error' },
          '[PGListener] LISTEN query failed'
        );
        throw err;
      }
    });
  }

  async unlisten(channel: string): Promise<void> {
    this.desiredChannels.delete(channel);

    return this.enqueueOp(async () => {
      const client = this.client;
      if (!client || this.isDisconnecting) {
        this.listenedChannels.delete(channel);
        return;
      }
      // A newer listen() re-claimed this channel before this queued unlisten ran
      if (this.desiredChannels.has(channel)) return;
      // Not currently listened on this connection
      if (!this.listenedChannels.has(channel)) return;

      try {
        await client.query(`UNLISTEN "${channel}"`);
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : 'unknown_error' },
          '[PGListener] UNLISTEN query failed'
        );
        throw err;
      } finally {
        this.listenedChannels.delete(channel);
      }
    });
  }

  isListening(channel: string): boolean {
    return this.listenedChannels.has(channel);
  }

  hasActiveClient(): boolean {
    return this.client !== null;
  }

  async disconnect(): Promise<void> {
    // Share an in-flight disconnect across concurrent callers so client.end() runs at most once
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    this.lifecycleGen += 1;
    this.isDisconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const p = (async () => {
      // Wait for any pending connect() to observe the bumped lifecycleGen and close its client
      const pendingConnect = this.connectPromise;
      if (pendingConnect) {
        await pendingConnect.catch(() => undefined);
      }

      // Drain any in-flight serialized LISTEN/UNLISTEN queries before closing the socket
      await this.opChain;

      const client = this.client;
      this.client = null;
      this.listenedChannels.clear();
      this.desiredChannels.clear();

      if (client) {
        try {
          await client.end();
        } catch (err) {
          logger.warn(
            { err: err instanceof Error ? err.message : 'unknown_error' },
            '[PGListener] Error closing client during disconnect'
          );
        }
      }
    })().finally(() => {
      this.isDisconnecting = false;
      if (this.disconnectPromise === p) {
        this.disconnectPromise = null;
      }
    });

    this.disconnectPromise = p;
    return p;
  }
}

export const pgListener = new PGListener();
