import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { pgListener } from '../../src/modules/sse/pg-listener';
import { sseConnectionManager } from '../../src/modules/sse/sse-connection-manager';
import { sseEventBus } from '../../src/modules/sse/event-bus';
import { buildEventChannel, buildUserNotificationChannel } from '../../src/modules/sse/sse.utils';
import { adminPrisma } from '../helpers/adminDb';

interface LiveStreamHandle {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  chunks: string[];
  waitForChunk: (predicate: (chunk: string) => boolean, timeoutMs?: number) => Promise<string>;
  waitForClose: (timeoutMs?: number) => Promise<void>;
  close: () => void;
  isClosed: () => boolean;
}

describe('Phase 14: SSE Lifecycle Integration Suite (Real HTTP + PostgreSQL LISTEN/NOTIFY)', () => {
  const runTag = randomUUID().slice(0, 8);
  const userAId = randomUUID();
  const userBId = randomUUID();
  const publicEventId = randomUUID();
  const draftEventId = randomUUID();

  let server: http.Server;
  let port: number;
  let tokenA: string;
  let tokenB: string;
  const openHandles: LiveStreamHandle[] = [];

  function openSse(path: string, token?: string): Promise<LiveStreamHandle> {
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];
      const waiters: Array<{ predicate: (c: string) => boolean; resolve: (c: string) => void }> = [];
      let closed = false;
      const closeWaiters: Array<() => void> = [];

      const headers: Record<string, string> = {
        'X-Client-Platform': 'web',
        Accept: 'text/event-stream',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const req = http.request(
        { hostname: '127.0.0.1', port, path, method: 'GET', headers },
        (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            chunks.push(chunk);
            for (let i = waiters.length - 1; i >= 0; i--) {
              if (waiters[i].predicate(chunk)) {
                const w = waiters.splice(i, 1)[0];
                w.resolve(chunk);
              }
            }
          });
          res.on('end', () => {
            closed = true;
            while (closeWaiters.length > 0) closeWaiters.shift()!();
          });
          res.on('close', () => {
            closed = true;
            while (closeWaiters.length > 0) closeWaiters.shift()!();
          });

          const handle: LiveStreamHandle = {
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            chunks,
            waitForChunk: (predicate, timeoutMs = 5000) => {
              const existing = chunks.find(predicate);
              if (existing) return Promise.resolve(existing);
              return new Promise<string>((resWait, rejWait) => {
                const timer = setTimeout(() => {
                  const idx = waiters.findIndex((w) => w.resolve === wrappedResolve);
                  if (idx >= 0) waiters.splice(idx, 1);
                  rejWait(new Error(`Timed out waiting for SSE chunk after ${timeoutMs}ms (received: ${JSON.stringify(chunks)})`));
                }, timeoutMs);
                const wrappedResolve = (c: string) => {
                  clearTimeout(timer);
                  resWait(c);
                };
                waiters.push({ predicate, resolve: wrappedResolve });
              });
            },
            waitForClose: (timeoutMs = 5000) => {
              if (closed) return Promise.resolve();
              return new Promise<void>((resClose, rejClose) => {
                const timer = setTimeout(() => rejClose(new Error(`Timed out waiting for SSE close after ${timeoutMs}ms`)), timeoutMs);
                closeWaiters.push(() => {
                  clearTimeout(timer);
                  resClose();
                });
              });
            },
            close: () => {
              closed = true;
              req.destroy();
            },
            isClosed: () => closed,
          };

          openHandles.push(handle);
          resolve(handle);
        }
      );

      req.on('error', (err: any) => {
        if (err.code !== 'ECONNRESET' && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
          reject(err);
        }
      });
      req.end();
    });
  }

  async function waitForCondition(check: () => boolean, timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  async function cleanupDb() {
    await adminPrisma.event.deleteMany({ where: { id: { in: [publicEventId, draftEventId] } } });
    await adminPrisma.studentProfile.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  }

  before(async () => {
    await cleanupDb();

    await adminPrisma.user.createMany({
      data: [
        { id: userAId, email: `sse-life-a-${runTag}@adypu.edu.in`, fullName: 'SSE Life A', globalRole: 'STUDENT', googleSub: `sub-sselife-a-${runTag}` },
        { id: userBId, email: `sse-life-b-${runTag}@adypu.edu.in`, fullName: 'SSE Life B', globalRole: 'STUDENT', googleSub: `sub-sselife-b-${runTag}` },
      ],
    });

    await adminPrisma.event.createMany({
      data: [
        {
          id: publicEventId,
          title: `SSE Public Event ${runTag}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'INDIVIDUAL',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          maxCapacity: 50,
          createdBy: userAId,
          startTime: new Date(Date.now() + 3600_000),
          endTime: new Date(Date.now() + 7200_000),
        },
        {
          id: draftEventId,
          title: `SSE Draft Event ${runTag}`,
          state: 'DRAFT',
          visibility: 'RESTRICTED',
          registrationType: 'INDIVIDUAL',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          eventType: 'WORKSHOP',
          maxCapacity: 10,
          createdBy: userBId,
          startTime: new Date(Date.now() + 3600_000),
          endTime: new Date(Date.now() + 7200_000),
        },
      ],
    });

    tokenA = signJwt(userAId);
    tokenB = signJwt(userBId);

    await pgListener.connect();
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as any).port;
  });

  after(async () => {
    for (const h of openHandles) {
      h.close();
    }
    if (server) {
      await new Promise<void>((r) => server.close(() => r()));
    }
    await pgListener.disconnect();
    await cleanupDb();
  });

  it('1. rejects unauthenticated SSE requests with 401 and unauthorized draft event streams with 404', async () => {
    const unauth = await openSse(`/v1/events/${publicEventId}/live`);
    assert.strictEqual(unauth.statusCode, 401);
    unauth.close();

    const unauthNotif = await openSse('/v1/notifications/live');
    assert.strictEqual(unauthNotif.statusCode, 401);
    unauthNotif.close();

    const forbiddenDraft = await openSse(`/v1/events/${draftEventId}/live`, tokenA);
    assert.strictEqual(forbiddenDraft.statusCode, 404);
    forbiddenDraft.close();
  });

  it('2. delivers PostgreSQL pg_notify events with proper SSE headers, isolates private notifications, and preserves stream when a peer disconnects', async () => {
    const eventChannel = buildEventChannel(publicEventId);
    const notifChannelA = buildUserNotificationChannel(userAId);

    // Connect two simultaneous subscribers to the same event + private notification streams for A and B
    const [evSub1, evSub2, notifA, notifB] = await Promise.all([
      openSse(`/v1/events/${publicEventId}/live`, tokenA),
      openSse(`/v1/events/${publicEventId}/live`, tokenB),
      openSse('/v1/notifications/live', tokenA),
      openSse('/v1/notifications/live', tokenB),
    ]);

    try {
      for (const s of [evSub1, evSub2, notifA, notifB]) {
        assert.strictEqual(s.statusCode, 200);
        assert.strictEqual(s.headers['content-type'], 'text/event-stream');
        assert.strictEqual(s.headers['cache-control'], 'no-cache, no-transform');
        assert.strictEqual(s.headers['connection'], 'keep-alive');
        assert.strictEqual(s.headers['x-accel-buffering'], 'no');
      }

      assert.strictEqual(sseConnectionManager.getActiveSubscriberCount(eventChannel), 2);

      // Emit shared event notification -> BOTH simultaneous subscribers must receive it
      await adminPrisma.$executeRaw`SELECT pg_notify(${eventChannel}, ${JSON.stringify({ type: 'capacity_update', seq: 1 })})`;
      const [c1, c2] = await Promise.all([
        evSub1.waitForChunk((c) => c.includes('"seq":1')),
        evSub2.waitForChunk((c) => c.includes('"seq":1')),
      ]);
      assert.ok(c1.includes('"capacity_update"'));
      assert.ok(c2.includes('"capacity_update"'));

      // Emit private notification for User A -> User A receives it, User B does NOT
      await adminPrisma.$executeRaw`SELECT pg_notify(${notifChannelA}, ${JSON.stringify({ type: 'private_notice', secret: runTag })})`;
      const notifChunkA = await notifA.waitForChunk((c) => c.includes(runTag));
      assert.ok(notifChunkA.includes('"private_notice"'));
      assert.strictEqual(
        notifB.chunks.some((c) => c.includes(runTag)),
        false,
        'User B must never receive User A private notifications'
      );

      // Disconnect subscriber 1 -> subscriber 2 MUST continue receiving notifications (no premature UNLISTEN)
      evSub1.close();
      await waitForCondition(() => sseConnectionManager.getActiveSubscriberCount(eventChannel) === 1);
      assert.strictEqual(pgListener.isListening(eventChannel), true);

      await adminPrisma.$executeRaw`SELECT pg_notify(${eventChannel}, ${JSON.stringify({ type: 'capacity_update', seq: 2 })})`;
      const c2AfterPeerLeave = await evSub2.waitForChunk((c) => c.includes('"seq":2'));
      assert.ok(c2AfterPeerLeave.includes('"seq":2'));

      // Final subscriber disconnects -> channel subscription must be released cleanly
      evSub2.close();
      await waitForCondition(() => sseConnectionManager.getActiveSubscriberCount(eventChannel) === 0);
      await waitForCondition(() => !pgListener.isListening(eventChannel));
    } finally {
      evSub1.close();
      evSub2.close();
      notifA.close();
      notifB.close();
    }
  });

  it('3. supports clean reconnection without duplicate listeners and terminates active streams on system:disconnect', async () => {
    const eventChannel = buildEventChannel(publicEventId);

    const stream1 = await openSse(`/v1/events/${publicEventId}/live`, tokenA);
    assert.strictEqual(stream1.statusCode, 200);

    // Emit system:disconnect -> server must close active stream cleanly and release refcount
    sseEventBus.emit('system:disconnect', {});
    await stream1.waitForClose(3000);
    await waitForCondition(() => sseConnectionManager.getActiveSubscriberCount(eventChannel) === 0);

    // Reconnect and confirm live delivery with exactly 1 event (no duplicates)
    const stream2 = await openSse(`/v1/events/${publicEventId}/live`, tokenA);
    try {
      assert.strictEqual(stream2.statusCode, 200);
      assert.strictEqual(sseConnectionManager.getActiveSubscriberCount(eventChannel), 1);

      await adminPrisma.$executeRaw`SELECT pg_notify(${eventChannel}, ${JSON.stringify({ type: 'post_reconnect', tag: runTag })})`;
      await stream2.waitForChunk((c) => c.includes('"post_reconnect"'));
      const matching = stream2.chunks.filter((c) => c.includes('"post_reconnect"'));
      assert.strictEqual(matching.length, 1, 'Reconnected stream must receive event exactly once');
    } finally {
      stream2.close();
      await waitForCondition(() => sseConnectionManager.getActiveSubscriberCount(eventChannel) === 0);
    }
  });

  it('4. emits real 30-second heartbeat and keeps live stream open', async () => {
    const stream = await openSse(`/v1/events/${publicEventId}/live`, tokenA);
    try {
      assert.strictEqual(stream.statusCode, 200);
      const hb = await stream.waitForChunk((c) => c.includes('"type":"heartbeat"'), 33_000);
      assert.ok(hb.startsWith('data: '), 'Heartbeat must be formatted as an SSE data frame');
      assert.strictEqual(stream.isClosed(), false, 'Stream must remain open after heartbeat');
    } finally {
      stream.close();
    }
  });
});
