import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import http from 'http';
import { randomUUID } from 'crypto';
import express from 'express';
import { SSEConnectionManager, ChannelListener } from '../../src/modules/sse/sse-connection-manager';
import { PGListener, PGClientLike } from '../../src/modules/sse/pg-listener';
import { createSseRouter } from '../../src/modules/sse/sse.router';
import { buildEventChannel, buildUserNotificationChannel } from '../../src/modules/sse/sse.utils';
import { errorHandler } from '../../src/middleware/error-handler';

interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class MockPGClient extends EventEmitter implements PGClientLike {
  public queries: string[] = [];
  public inFlight = 0;
  public maxInFlight = 0;
  public ended = false;
  public endCalls = 0;
  public connectCalls = 0;
  public connectImpl: () => Promise<unknown>;
  public queryImpl: (sql: string) => Promise<unknown>;

  constructor(
    queryImpl?: (sql: string) => Promise<unknown>,
    connectImpl?: () => Promise<unknown>
  ) {
    super();
    this.queryImpl = queryImpl ?? (async () => ({ rows: [] }));
    this.connectImpl = connectImpl ?? (async () => {});
  }

  async connect(): Promise<void> {
    this.connectCalls += 1;
    await this.connectImpl();
  }

  async query(sql: string): Promise<unknown> {
    if (this.ended) {
      throw new Error('Client was closed and is not queryable');
    }
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    this.queries.push(sql);
    try {
      return await this.queryImpl(sql);
    } finally {
      this.inFlight -= 1;
    }
  }

  async end(): Promise<void> {
    this.endCalls += 1;
    this.ended = true;
    this.emit('end');
  }
}

class MockResponse extends EventEmitter {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public headersSent = false;
  public writableEnded = false;
  public destroyed = false;
  public writtenChunks: string[] = [];
  public writeReturnValue = true;
  public throwOnWrite = false;
  public timeoutValue: number | null = null;

  setTimeout(ms: number) {
    this.timeoutValue = ms;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  flushHeaders() {
    this.headersSent = true;
  }

  write(chunk: string): boolean {
    if (this.throwOnWrite) {
      throw new Error('EPIPE simulated write failure');
    }
    this.writtenChunks.push(chunk);
    return this.writeReturnValue;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: unknown) {
    if (this.headersSent) {
      const err: any = new Error('Cannot set headers after they are sent to the client');
      err.code = 'ERR_HTTP_HEADERS_SENT';
      throw err;
    }
    this.headersSent = true;
    this.writableEnded = true;
    this.writtenChunks.push(JSON.stringify(body));
    return this;
  }

  end() {
    if (!this.writableEnded) {
      this.writableEnded = true;
      this.emit('close');
    }
    return this;
  }

  destroy() {
    if (!this.destroyed) {
      this.destroyed = true;
      this.writableEnded = true;
      this.emit('close');
    }
    return this;
  }
}

describe('SSEConnectionManager — Deterministic Concurrency & Refcount Lifecycle', () => {
  it('1. shares a single LISTEN across simultaneous first-time subscribers and keeps channel active until final disconnect', async () => {
    const eventId = randomUUID();
    const channel = buildEventChannel(eventId);
    const listenGate = createDeferred<void>();
    const listenCalls: string[] = [];
    const unlistenCalls: string[] = [];

    const mockListener: ChannelListener = {
      listen: async (ch) => {
        listenCalls.push(ch);
        await listenGate.promise;
      },
      unlisten: async (ch) => {
        unlistenCalls.push(ch);
      },
    };

    const manager = new SSEConnectionManager(mockListener);

    // Trigger two concurrent first-time subscriptions before LISTEN resolves
    const sub1 = manager.subscribe(eventId);
    const sub2 = manager.subscribe(eventId);
    await Promise.resolve(); // flush opChain microtask so LISTEN starts

    assert.strictEqual(listenCalls.length, 1, 'Only one LISTEN call should be issued for concurrent first subscribers');
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 2, 'Refcount must synchronously reflect both subscribers');

    listenGate.resolve();
    await Promise.all([sub1, sub2]);

    assert.strictEqual(manager.getActiveSubscriberCount(channel), 2);
    assert.strictEqual(unlistenCalls.length, 0);

    // First subscriber disconnects while second remains active -> MUST NOT UNLISTEN
    await manager.unsubscribe(eventId);
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 1);
    assert.strictEqual(unlistenCalls.length, 0, 'Must NOT UNLISTEN while second subscriber is still connected');

    // Second (final) subscriber disconnects -> MUST UNLISTEN exactly once
    await manager.unsubscribe(eventId);
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 0);
    assert.strictEqual(manager.getActiveChannelCount(), 0);
    assert.deepStrictEqual(unlistenCalls, [channel]);

    // Duplicate unsubscribe -> idempotent no-op
    await manager.unsubscribe(eventId);
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 0);
    assert.deepStrictEqual(unlistenCalls, [channel], 'Duplicate unsubscribe must not trigger extra UNLISTEN');
  });

  it('2. cleans up stale state on LISTEN initialization failure so subsequent subscribers can retry cleanly', async () => {
    const userId = randomUUID();
    const channel = buildUserNotificationChannel(userId);
    const firstAttempt = createDeferred<void>();
    let attempts = 0;

    const mockListener: ChannelListener = {
      listen: async () => {
        attempts += 1;
        if (attempts === 1) {
          return firstAttempt.promise;
        }
      },
      unlisten: async () => {},
    };

    const manager = new SSEConnectionManager(mockListener);

    const p1 = manager.subscribeUserNotifications(userId);
    const p2 = manager.subscribeUserNotifications(userId);
    await Promise.resolve(); // allow opChain microtask to invoke listen()
    assert.strictEqual(attempts, 1);

    firstAttempt.reject(new Error('DB listen failed'));

    await assert.rejects(() => p1, /DB listen failed/);
    await assert.rejects(() => p2, /DB listen failed/);

    assert.strictEqual(manager.getActiveSubscriberCount(channel), 0);
    assert.strictEqual(manager.getActiveChannelCount(), 0, 'Failed init must not leave stale channel entry');

    // Retry must succeed cleanly with a fresh LISTEN call
    await manager.subscribeUserNotifications(userId);
    assert.strictEqual(attempts, 2);
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 1);

    await manager.unsubscribeUserNotifications(userId);
    assert.strictEqual(manager.getActiveChannelCount(), 0);
  });

  it('3. handles disconnect during in-flight LISTEN without leaking channel subscription', async () => {
    const eventId = randomUUID();
    const channel = buildEventChannel(eventId);
    const listenGate = createDeferred<void>();
    const unlistenCalls: string[] = [];

    const mockListener: ChannelListener = {
      listen: async () => listenGate.promise,
      unlisten: async (ch) => {
        unlistenCalls.push(ch);
      },
    };

    const manager = new SSEConnectionManager(mockListener);

    const sub = manager.subscribe(eventId);
    await Promise.resolve(); // ensure LISTEN is actively in-flight
    // Subscriber aborts while LISTEN is still in-flight
    const unsub = manager.unsubscribe(eventId);

    listenGate.resolve();
    await Promise.all([sub, unsub]);

    assert.strictEqual(manager.getActiveSubscriberCount(channel), 0);
    assert.strictEqual(manager.getActiveChannelCount(), 0);
    assert.deepStrictEqual(unlistenCalls, [channel]);
  });

  it('4. prevents double-decrement when cancelled during pending LISTEN that later rejects, keeps healthy peer active, and cleans up once', async () => {
    const eventId = randomUUID();
    const channel = buildEventChannel(eventId);
    const listenGate1 = createDeferred<void>();
    let listenAttempt = 0;
    const unlistenCalls: string[] = [];

    const mockListener: ChannelListener = {
      listen: async () => {
        listenAttempt += 1;
        if (listenAttempt === 1) {
          return listenGate1.promise;
        }
      },
      unlisten: async (ch) => {
        unlistenCalls.push(ch);
      },
    };

    const manager = new SSEConnectionManager(mockListener);

    // Scenario A: subscribe + cancel while LISTEN is pending, then LISTEN fails (handle API)
    const h1 = manager.acquireEventSubscription(eventId);
    const h2 = manager.acquireEventSubscription(eventId);
    await Promise.resolve();
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 2);

    // Cancel h1 twice (duplicate cancellation must be idempotent) while LISTEN is pending
    await h1.release();
    await h1.release();
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 1, 'Duplicate release must not decrement h2');

    // Now LISTEN rejects -> h1 must NOT decrement again; h2 rolls back 1 -> 0 cleanly
    listenGate1.reject(new Error('listen_boom'));
    await assert.rejects(() => h1.ready, /listen_boom/);
    await assert.rejects(() => h2.ready, /listen_boom/);
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 0);
    assert.strictEqual(manager.getActiveChannelCount(), 0);

    // Scenario B: retry succeeds with 2 healthy handles; duplicate release of first never affects second; final cleanup occurs once
    const a1 = manager.acquireEventSubscription(eventId);
    const a2 = manager.acquireEventSubscription(eventId);
    await Promise.all([a1.ready, a2.ready]);
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 2);

    await a1.release();
    await a1.release(); // duplicate release must NOT disturb a2!
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 1);
    assert.strictEqual(unlistenCalls.length, 0);

    await a2.release();
    await a2.release();
    assert.strictEqual(manager.getActiveSubscriberCount(channel), 0);
    assert.strictEqual(manager.getActiveChannelCount(), 0);
    assert.deepStrictEqual(unlistenCalls, [channel]);
  });
});

describe('PGListener — Serialized PostgreSQL LISTEN/UNLISTEN Operations', () => {
  it('1. strictly serializes concurrent LISTEN/UNLISTEN queries (maxInFlight === 1) and avoids duplicates', async () => {
    const gates: Deferred<void>[] = [];
    const gateStartedWaiters: Array<() => void> = [];
    const waitForQueryCount = (expected: number): Promise<void> => {
      if (gates.length >= expected) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const check = () => {
          if (gates.length >= expected) {
            resolve();
          } else {
            gateStartedWaiters.push(check);
          }
        };
        gateStartedWaiters.push(check);
      });
    };

    const mockClient = new MockPGClient(async () => {
      const gate = createDeferred<void>();
      gates.push(gate);
      while (gateStartedWaiters.length > 0) {
        gateStartedWaiters.shift()!();
      }
      await gate.promise;
      return { rows: [] };
    });

    const listener = new PGListener(() => mockClient);
    await listener.connect();

    const p1 = listener.listen('ch_a');
    await waitForQueryCount(1); // p1 starts executing LISTEN "ch_a" and pauses on gates[0]
    const p2 = listener.listen('ch_b');
    const p3 = listener.listen('ch_a'); // duplicate while ch_a is in-flight -> skipped once p1 marks ch_a listened

    // Only the first query should have started; p2 and p3 must wait behind it
    assert.strictEqual(mockClient.queries.length, 1);
    assert.strictEqual(mockClient.inFlight, 1);
    gates[0].resolve();
    await p1;

    // Wait deterministically for queued p2 (LISTEN "ch_b") to enter query()
    await waitForQueryCount(2);
    assert.strictEqual(mockClient.queries.length, 2);
    assert.strictEqual(mockClient.inFlight, 1);

    // Enqueue UNLISTEN "ch_a" while LISTEN "ch_b" is still in flight -> must serialize behind p2
    const p4 = listener.unlisten('ch_a');
    assert.strictEqual(mockClient.queries.length, 2);

    gates[1].resolve();
    await p2;

    // p3 (duplicate ch_a) is skipped; p4 (UNLISTEN "ch_a") deterministically enters query() next
    await waitForQueryCount(3);
    gates[2].resolve();
    await Promise.all([p3, p4]);

    assert.strictEqual(mockClient.maxInFlight, 1, 'PGClient queries must never overlap concurrently');
    assert.deepStrictEqual(mockClient.queries, [
      'LISTEN "ch_a"',
      'LISTEN "ch_b"',
      'UNLISTEN "ch_a"',
    ]);

    await listener.disconnect();
  });

  it('2. skips stale UNLISTEN if channel is re-subscribed before queued UNLISTEN executes, and recovers after query errors', async () => {
    const firstGate = createDeferred<void>();
    let callCount = 0;
    const mockClient = new MockPGClient(async (sql) => {
      callCount += 1;
      if (callCount === 1) {
        await firstGate.promise;
        return;
      }
      if (sql === 'LISTEN "ch_fail"') {
        throw new Error('simulated pg error');
      }
    });

    const listener = new PGListener(() => mockClient);
    await listener.connect();

    const pListenA = listener.listen('ch_a');
    const pUnlistenA = listener.unlisten('ch_a');
    const pRelistenA = listener.listen('ch_a'); // re-claims ch_a before UNLISTEN runs!
    const pFail = listener.listen('ch_fail');
    const pAfterFail = listener.listen('ch_ok');

    firstGate.resolve();
    await pListenA;
    await pUnlistenA;
    await pRelistenA;
    await assert.rejects(() => pFail, /simulated pg error/);
    await pAfterFail;

    assert.strictEqual(mockClient.maxInFlight, 1);
    assert.deepStrictEqual(mockClient.queries, [
      'LISTEN "ch_a"',
      'LISTEN "ch_fail"',
      'LISTEN "ch_ok"',
    ]);
    assert.strictEqual(listener.isListening('ch_a'), true);
    assert.strictEqual(listener.isListening('ch_ok'), true);
    assert.strictEqual(listener.isListening('ch_fail'), false);

    await listener.disconnect();
    assert.strictEqual(mockClient.ended, true);
  });

  it('3. drains pending operations cleanly during disconnect() without querying a closed client', async () => {
    const gate = createDeferred<void>();
    const mockClient = new MockPGClient(async () => gate.promise);

    const listener = new PGListener(() => mockClient);
    await listener.connect();

    const pListen = listener.listen('ch_drain');
    const pDisconnect = listener.disconnect();

    assert.strictEqual(mockClient.ended, false, 'Client must not close before pending query finishes');
    gate.resolve();
    await Promise.all([pListen, pDisconnect]);

    assert.strictEqual(mockClient.ended, true);
    // Subsequent unlisten after disconnect must be a safe no-op
    await listener.unlisten('ch_drain');
  });

  it('4. closes invalidated client if disconnect() runs while client.connect() is pending and later resolves', async () => {
    const connectGate = createDeferred<void>();
    const createdClients: MockPGClient[] = [];
    const listener = new PGListener(() => {
      const c = new MockPGClient(undefined, () => connectGate.promise);
      createdClients.push(c);
      return c;
    });

    const pConnect = listener.connect();
    assert.strictEqual(createdClients.length, 1);

    // Disconnect while client.connect() is still in flight
    const pDisconnect = listener.disconnect();

    // Now client.connect() resolves -> client MUST be closed immediately and NEVER published
    connectGate.resolve();
    await Promise.all([pConnect, pDisconnect]);

    assert.strictEqual(createdClients[0].ended, true, 'Invalidated client must be closed on connect resolution');
    assert.strictEqual(createdClients[0].endCalls, 1);
    assert.strictEqual(listener.hasActiveClient(), false, 'Invalidated client must never be published');
  });

  it('5. leaves no stale state when disconnect() runs while client.connect() fails, and allows clean retry afterward', async () => {
    const failGate = createDeferred<void>();
    let attempt = 0;
    const createdClients: MockPGClient[] = [];

    const listener = new PGListener(() => {
      attempt += 1;
      const current = attempt;
      const c = new MockPGClient(undefined, async () => {
        if (current === 1) {
          return failGate.promise;
        }
      });
      createdClients.push(c);
      return c;
    });

    const pConnect1 = listener.connect();
    const pDisconnect = listener.disconnect();
    failGate.reject(new Error('network_refused'));

    await Promise.all([pConnect1, pDisconnect]);
    assert.strictEqual(listener.hasActiveClient(), false);

    // Subsequent valid connect() must succeed cleanly
    await listener.connect();
    assert.strictEqual(createdClients.length, 2);
    assert.strictEqual(listener.hasActiveClient(), true);
    await listener.listen('ch_after_retry');
    assert.strictEqual(listener.isListening('ch_after_retry'), true);

    await listener.disconnect();
    assert.strictEqual(createdClients[1].endCalls, 1);
    assert.strictEqual(listener.hasActiveClient(), false);
  });

  it('6. shares one connection attempt across concurrent connect() calls and closes client once across concurrent disconnect() calls', async () => {
    const connectGate = createDeferred<void>();
    const endGate = createDeferred<void>();
    let factoryCalls = 0;
    let activeClient!: MockPGClient;

    const listener = new PGListener(() => {
      factoryCalls += 1;
      const c = new MockPGClient(undefined, () => connectGate.promise);
      const origEnd = c.end.bind(c);
      c.end = async () => {
        await endGate.promise;
        await origEnd();
      };
      activeClient = c;
      return c;
    });

    const c1 = listener.connect();
    const c2 = listener.connect();
    const c3 = listener.connect();
    assert.strictEqual(factoryCalls, 1, 'Concurrent connect() calls must create only one client');
    assert.strictEqual(activeClient.connectCalls, 1);

    connectGate.resolve();
    await Promise.all([c1, c2, c3]);
    assert.strictEqual(listener.hasActiveClient(), true);

    const d1 = listener.disconnect();
    const d2 = listener.disconnect();
    const d3 = listener.disconnect();
    endGate.resolve();
    await Promise.all([d1, d2, d3]);

    assert.strictEqual(activeClient.endCalls, 1, 'Concurrent disconnect() calls must close client exactly once');
    assert.strictEqual(listener.hasActiveClient(), false);
  });
});

describe('SSE Router — Response Initialization, Error Handling & Per-Client Backpressure', () => {
  function createTestApp(deps: Parameters<typeof createSseRouter>[0]) {
    const app = express();
    app.use('/v1', createSseRouter({
      authMiddleware: (req, _res, next) => {
        (req as any).user = { id: (req.headers['x-test-user-id'] as string) || randomUUID() };
        next();
      },
      checkEventReadAuthorization: async () => {},
      ...deps,
    }));
    app.use(errorHandler);
    return app;
  }

  it('1. returns SSE 200 headers on successful subscription and returns 500 JSON before headers on subscribe failure', async () => {
    const eventId = randomUUID();
    const bus = new EventEmitter();
    let shouldFail = false;

    const app = createTestApp({
      eventBus: bus,
      connectionManager: {
        subscribe: async () => {
          if (shouldFail) throw new Error('subscription_init_failed');
        },
        unsubscribe: async () => {},
        subscribeUserNotifications: async () => {},
        unsubscribeUserNotifications: async () => {},
      },
    });

    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as any;

    try {
      // A. Subscription failure BEFORE headers committed -> JSON 500
      shouldFail = true;
      const failRes = await new Promise<{ status: number; contentType: string; body: string }>((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/v1/events/${eventId}/live`, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode!, contentType: String(res.headers['content-type']), body }));
        }).on('error', reject);
      });
      assert.strictEqual(failRes.status, 500);
      assert.ok(failRes.contentType.includes('application/json'), `Expected JSON error, got ${failRes.contentType}`);

      // B. Successful SSE connection -> 200 + text/event-stream
      shouldFail = false;
      const okReq = http.get(`http://127.0.0.1:${port}/v1/events/${eventId}/live`);
      const okRes = await new Promise<http.IncomingMessage>((resolve, reject) => {
        okReq.on('response', resolve);
        okReq.on('error', reject);
      });
      assert.strictEqual(okRes.statusCode, 200);
      assert.strictEqual(okRes.headers['content-type'], 'text/event-stream');
      assert.strictEqual(okRes.headers['cache-control'], 'no-cache, no-transform');
      assert.strictEqual(okRes.headers['x-accel-buffering'], 'no');
      okReq.destroy();
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('2. errorHandler does not throw ERR_HTTP_HEADERS_SENT when res.headersSent is already true', () => {
    const res = new MockResponse();
    res.flushHeaders();
    assert.strictEqual(res.headersSent, true);

    assert.doesNotThrow(() => {
      errorHandler(
        new Error('post-header failure'),
        { originalUrl: '/v1/notifications/live', url: '/v1/notifications/live', method: 'GET', id: 'req-1' } as any,
        res as any,
        (() => {}) as any
      );
    });
    assert.strictEqual(res.writableEnded, true, 'Already-started response must be ended safely');
    assert.strictEqual(res.writtenChunks.length, 0, 'Must not write JSON error body over committed SSE stream');
  });

  it('3. cleans up exactly once when client disconnects during in-flight subscribe() or emits repeated close events', async () => {
    const eventId = randomUUID();
    const bus = new EventEmitter();
    const initGate = createDeferred<void>();
    let unsubscribeCalls = 0;

    const router = createSseRouter({
      eventBus: bus,
      authMiddleware: (req, _res, next) => {
        (req as any).user = { id: randomUUID() };
        next();
      },
      checkEventReadAuthorization: async () => {},
      connectionManager: {
        subscribe: async () => initGate.promise,
        unsubscribe: async () => {
          unsubscribeCalls += 1;
        },
        subscribeUserNotifications: async () => {},
        unsubscribeUserNotifications: async () => {},
      },
    });

    // Locate the route handler directly for deterministic in-flight close simulation
    const layer = (router as any).stack.find((l: any) => l.route?.path === '/events/:id/live');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const req = new EventEmitter() as any;
    req.params = { id: eventId };
    req.user = { id: randomUUID() };
    req.destroyed = false;
    req.setTimeout = () => {};
    const res = new MockResponse();

    const handlerPromise = handler(req, res as any, (err: unknown) => {
      if (err) throw err;
    });

    // Client disconnects WHILE subscribe() is still pending
    req.destroyed = true;
    req.emit('close');
    res.emit('close');

    initGate.resolve();
    await handlerPromise;

    // Emit duplicate close events after teardown
    req.emit('close');
    res.emit('close');

    assert.strictEqual(res.headersSent, false, 'Must not commit headers after early disconnect');
    assert.strictEqual(unsubscribeCalls, 1, 'Cleanup must call unsubscribe exactly once');
    assert.strictEqual(bus.listenerCount(buildEventChannel(eventId)), 0, 'No leaked event listeners');
  });

  it('4. handles backpressure (write() === false), slow-client eviction, healthy peer isolation, stream errors, and heartbeat cleanup', async () => {
    const eventId = randomUUID();
    const channel = buildEventChannel(eventId);
    const bus = new EventEmitter();
    let unsubscribeCount = 0;

    const router = createSseRouter({
      eventBus: bus,
      heartbeatIntervalMs: 60_000,
      maxPendingChunks: 2,
      authMiddleware: (req, _res, next) => {
        (req as any).user = { id: randomUUID() };
        next();
      },
      checkEventReadAuthorization: async () => {},
      connectionManager: {
        subscribe: async () => {},
        unsubscribe: async () => {
          unsubscribeCount += 1;
        },
        subscribeUserNotifications: async () => {},
        unsubscribeUserNotifications: async () => {},
      },
    });

    const layer = (router as any).stack.find((l: any) => l.route?.path === '/events/:id/live');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const makeReq = () => {
      const r = new EventEmitter() as any;
      r.params = { id: eventId };
      r.user = { id: randomUUID() };
      r.destroyed = false;
      r.setTimeout = () => {};
      return r;
    };

    // Slow client (write returns false) + Healthy client (write returns true)
    const slowReq = makeReq();
    const slowRes = new MockResponse();
    slowRes.writeReturnValue = false;

    const healthyReq = makeReq();
    const healthyRes = new MockResponse();

    await handler(slowReq, slowRes as any, (e: unknown) => { if (e) throw e; });
    await handler(healthyReq, healthyRes as any, (e: unknown) => { if (e) throw e; });

    // Event 1 -> written directly; slowRes returns false so enters draining state
    bus.emit(channel, { seq: 1 });
    assert.strictEqual(slowRes.writtenChunks.length, 1);
    assert.strictEqual(healthyRes.writtenChunks.length, 1);

    // Events 2 & 3 -> buffered for slowRes (up to maxPendingChunks=2), delivered immediately to healthyRes
    bus.emit(channel, { seq: 2 });
    bus.emit(channel, { seq: 3 });
    assert.strictEqual(slowRes.writtenChunks.length, 1);
    assert.strictEqual(healthyRes.writtenChunks.length, 3);

    // Drain slowRes -> buffered events 2 & 3 flush in order
    slowRes.writeReturnValue = true;
    slowRes.emit('drain');
    assert.strictEqual(slowRes.writtenChunks.length, 3);
    assert.ok(slowRes.writtenChunks[1].includes('"seq":2'));
    assert.ok(slowRes.writtenChunks[2].includes('"seq":3'));

    // Now simulate permanent congestion overflow (> maxPendingChunks=2) -> slow client evicted cleanly, healthy unaffected
    slowRes.writeReturnValue = false;
    bus.emit(channel, { seq: 4 }); // enters draining
    bus.emit(channel, { seq: 5 }); // pending=1
    bus.emit(channel, { seq: 6 }); // pending=2
    bus.emit(channel, { seq: 7 }); // exceeds maxPendingChunks=2 -> evicted!

    assert.strictEqual(slowRes.writableEnded, true, 'Overflowing slow client must be terminated cleanly');
    assert.strictEqual(healthyRes.writableEnded, false, 'Healthy client must remain connected');
    assert.strictEqual(healthyRes.writtenChunks.length, 7, 'Healthy client must receive all 7 events uninterrupted');

    // Further events must NEVER write to disconnected slowRes
    const slowCountAtDisconnect = slowRes.writtenChunks.length;
    bus.emit(channel, { seq: 8 });
    assert.strictEqual(slowRes.writtenChunks.length, slowCountAtDisconnect, 'Disconnected client must receive zero further writes');
    assert.strictEqual(healthyRes.writtenChunks.length, 8);

    // Stream error on healthyRes triggers full cleanup
    healthyRes.emit('error', new Error('socket reset'));
    assert.strictEqual(healthyRes.writableEnded, true);
    bus.emit(channel, { seq: 9 });
    assert.strictEqual(healthyRes.writtenChunks.length, 8, 'No writes after stream error');
    assert.strictEqual(bus.listenerCount(channel), 0, 'All listeners must be removed after cleanup');
    assert.strictEqual(unsubscribeCount, 2, 'Each client must unsubscribe exactly once');
  });

  it('5. stops heartbeat timer cleanly after disconnect and cleans up if response throws on write', async () => {
    const eventId = randomUUID();
    const channel = buildEventChannel(eventId);
    const bus = new EventEmitter();
    let unsubscribeCalls = 0;

    const router = createSseRouter({
      eventBus: bus,
      heartbeatIntervalMs: 25,
      authMiddleware: (req, _res, next) => {
        (req as any).user = { id: randomUUID() };
        next();
      },
      checkEventReadAuthorization: async () => {},
      connectionManager: {
        subscribe: async () => {},
        unsubscribe: async () => {
          unsubscribeCalls += 1;
        },
        subscribeUserNotifications: async () => {},
        unsubscribeUserNotifications: async () => {},
      },
    });

    const layer = (router as any).stack.find((l: any) => l.route?.path === '/events/:id/live');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const req = new EventEmitter() as any;
    req.params = { id: eventId };
    req.user = { id: randomUUID() };
    req.destroyed = false;
    req.setTimeout = () => {};
    const res = new MockResponse();

    await handler(req, res as any, (e: unknown) => { if (e) throw e; });

    // Wait for at least one heartbeat
    await new Promise((r) => setTimeout(r, 40));
    const heartbeatsBeforeClose = res.writtenChunks.filter((c) => c.includes('"heartbeat"')).length;
    assert.ok(heartbeatsBeforeClose >= 1, 'Expected at least 1 heartbeat before disconnect');

    // Trigger write throw on next event -> must cleanly tear down timer & listeners
    res.throwOnWrite = true;
    bus.emit(channel, { type: 'boom' });
    assert.strictEqual(res.writableEnded, true);
    assert.strictEqual(unsubscribeCalls, 1);

    const countAfterClose = res.writtenChunks.length;
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(res.writtenChunks.length, countAfterClose, 'Heartbeat timer must stop after disconnect');
    assert.strictEqual(bus.listenerCount(channel), 0);
  });

  it('6. suppresses redundant heartbeats while response is draining and resumes after drain', async () => {
    const eventId = randomUUID();
    const channel = buildEventChannel(eventId);
    const bus = new EventEmitter();

    const router = createSseRouter({
      eventBus: bus,
      heartbeatIntervalMs: 15,
      maxPendingChunks: 4,
      authMiddleware: (req, _res, next) => {
        (req as any).user = { id: randomUUID() };
        next();
      },
      checkEventReadAuthorization: async () => {},
      connectionManager: {
        subscribe: async () => {},
        unsubscribe: async () => {},
        subscribeUserNotifications: async () => {},
        unsubscribeUserNotifications: async () => {},
      },
    });

    const layer = (router as any).stack.find((l: any) => l.route?.path === '/events/:id/live');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const req = new EventEmitter() as any;
    req.params = { id: eventId };
    req.user = { id: randomUUID() };
    req.destroyed = false;
    req.setTimeout = () => {};
    const res = new MockResponse();
    res.writeReturnValue = false;

    await handler(req, res as any, (e: unknown) => { if (e) throw e; });

    // Enter draining state via 1 real event, then wait across multiple heartbeat intervals
    bus.emit(channel, { seq: 1 });
    await new Promise((r) => setTimeout(r, 55));

    // Drain -> zero heartbeats should have been queued behind seq:1 while draining
    res.writeReturnValue = true;
    res.emit('drain');
    const queuedHeartbeats = res.writtenChunks.filter((c) => c.includes('"heartbeat"'));
    assert.strictEqual(queuedHeartbeats.length, 0, 'Heartbeats must be suppressed while draining');

    // After drain clears, heartbeats resume normally
    await new Promise((r) => setTimeout(r, 40));
    const resumedHeartbeats = res.writtenChunks.filter((c) => c.includes('"heartbeat"'));
    assert.ok(resumedHeartbeats.length >= 1, 'Heartbeats should resume after drain completes');

    req.emit('close');
  });

  it('7. handles backpressure re-entry mid-onDrain while preserving bounded queue and strict FIFO order', async () => {
    const eventId = randomUUID();
    const channel = buildEventChannel(eventId);
    const bus = new EventEmitter();

    const router = createSseRouter({
      eventBus: bus,
      heartbeatIntervalMs: 60_000,
      maxPendingChunks: 2,
      authMiddleware: (req, _res, next) => {
        (req as any).user = { id: randomUUID() };
        next();
      },
      checkEventReadAuthorization: async () => {},
      connectionManager: {
        subscribe: async () => {},
        unsubscribe: async () => {},
        subscribeUserNotifications: async () => {},
        unsubscribeUserNotifications: async () => {},
      },
    });

    const layer = (router as any).stack.find((l: any) => l.route?.path === '/events/:id/live');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const req = new EventEmitter() as any;
    req.params = { id: eventId };
    req.user = { id: randomUUID() };
    req.destroyed = false;
    req.setTimeout = () => {};
    const res = new MockResponse();

    // Return false for write #1 (seq:1) and write #2 (seq:2 during first drain), then true thereafter
    let writeCall = 0;
    const origWrite = res.write.bind(res);
    res.write = (chunk: string) => {
      writeCall += 1;
      origWrite(chunk);
      return writeCall >= 3;
    };

    await handler(req, res as any, (e: unknown) => { if (e) throw e; });

    bus.emit(channel, { seq: 1 }); // write #1 -> false (enters draining)
    bus.emit(channel, { seq: 2 }); // pending: [seq:2]
    bus.emit(channel, { seq: 3 }); // pending: [seq:2, seq:3]
    assert.strictEqual(res.writtenChunks.length, 1);

    // First drain writes seq:2 -> returns false (re-enters backpressure mid-flush!), leaving [seq:3] pending
    res.emit('drain');
    assert.strictEqual(res.writtenChunks.length, 2);
    assert.strictEqual(res.writableEnded, false);

    // Enqueue seq:4 while still draining (pending becomes [seq:3, seq:4], within maxPendingChunks=2)
    bus.emit(channel, { seq: 4 });
    assert.strictEqual(res.writtenChunks.length, 2);

    // Second drain flushes seq:3 and seq:4 in strict FIFO order
    res.emit('drain');
    assert.strictEqual(res.writtenChunks.length, 4);
    assert.deepStrictEqual(
      res.writtenChunks.map((c) => JSON.parse(c.replace(/^data: /, '').trim()).seq),
      [1, 2, 3, 4],
      'All chunks must arrive in strict FIFO order across mid-drain backpressure re-entry'
    );

    req.emit('close');
  });

  it('8. safely handles an exception thrown after res.flushHeaders() inside handleSseStream without ERR_HTTP_HEADERS_SENT', async () => {
    const eventId = randomUUID();
    let unsubscribeCalls = 0;
    let nextCalled = false;

    const failingBus = {
      on: () => {
        throw new Error('post_headers_eventbus_failure');
      },
      off: () => {},
    };

    const router = createSseRouter({
      eventBus: failingBus as any,
      heartbeatIntervalMs: 60_000,
      authMiddleware: (req, _res, next) => {
        (req as any).user = { id: randomUUID() };
        next();
      },
      checkEventReadAuthorization: async () => {},
      connectionManager: {
        subscribe: async () => {},
        unsubscribe: async () => {
          unsubscribeCalls += 1;
        },
        subscribeUserNotifications: async () => {},
        unsubscribeUserNotifications: async () => {},
      },
    });

    const layer = (router as any).stack.find((l: any) => l.route?.path === '/events/:id/live');
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;

    const req = new EventEmitter() as any;
    req.params = { id: eventId };
    req.user = { id: randomUUID() };
    req.destroyed = false;
    req.setTimeout = () => {};
    const res = new MockResponse();

    await assert.doesNotReject(async () => {
      await handler(req, res as any, () => {
        nextCalled = true;
      });
    });

    assert.strictEqual(res.headersSent, true, 'Headers were committed before bus.on threw');
    assert.strictEqual(res.writableEnded, true, 'Stream must be terminated cleanly after post-header error');
    assert.strictEqual(unsubscribeCalls, 1, 'Subscription must be cleaned up exactly once');
    assert.strictEqual(nextCalled, false, 'Must NOT invoke next(err) after headers are committed');
  });
});
