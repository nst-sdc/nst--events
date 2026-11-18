import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../../src/app';
import { signJwt } from '../../src/lib/jwt';
import { adminPrisma } from '../helpers/adminDb';
import { sseConnectionManager } from '../../src/modules/sse/sse-connection-manager';
import { buildEventChannel } from '../../src/modules/sse/sse.utils';

describe('Phase 16A: SSE Authorization Security', () => {
  const app = createApp();
  const runTag = randomUUID().slice(0, 8);
  const userAId = randomUUID();
  const userBId = randomUUID();
  const eventAId = randomUUID();
  const eventBId = randomUUID();

  let tokenA: string;
  let server: http.Server;
  let port: number;

  async function cleanup() {
    await adminPrisma.event.deleteMany({ where: { id: { in: [eventAId, eventBId] } } });
    await adminPrisma.studentProfile.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await adminPrisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  }

  before(async () => {
    await cleanup();

    await adminPrisma.user.createMany({
      data: [
        { id: userAId, email: `user_a_sse_${runTag}@adypu.edu.in`, googleSub: `google_sub_a_sse_${runTag}`, fullName: 'User A SSE', globalRole: 'STUDENT' },
        { id: userBId, email: `user_b_sse_${runTag}@adypu.edu.in`, googleSub: `google_sub_b_sse_${runTag}`, fullName: 'User B SSE', globalRole: 'STUDENT' },
      ],
    });

    tokenA = signJwt(userAId);

    // Event A is PUBLISHED + PUBLIC -> User A is authorized to read
    // Event B is DRAFT + RESTRICTED created by User B -> User A is unauthorized to read
    await adminPrisma.event.createMany({
      data: [
        {
          id: eventAId,
          title: `Event A Public ${runTag}`,
          state: 'PUBLISHED',
          visibility: 'PUBLIC',
          registrationType: 'INDIVIDUAL',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          createdBy: userAId,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600_000),
          eventType: 'WORKSHOP',
        },
        {
          id: eventBId,
          title: `Event B Draft Restricted ${runTag}`,
          state: 'DRAFT',
          visibility: 'RESTRICTED',
          registrationType: 'INDIVIDUAL',
          attendanceType: 'SINGLE',
          audience: 'ALL_STUDENTS',
          createdBy: userBId,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600_000),
          eventType: 'WORKSHOP',
        },
      ],
    });

    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as any).port;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((r) => server.close(() => r()));
    }
    await cleanup();
  });

  it('User A connecting to Event A/live -> SUCCESS (200 text/event-stream)', async () => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: `/v1/events/${eventAId}/live`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'X-Client-Platform': 'web',
        Accept: 'text/event-stream',
      },
    });

    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      req.on('response', resolve);
      req.on('error', (err: any) => {
        if (err.code !== 'ECONNRESET') reject(err);
      });
      req.end();
    });

    try {
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'text/event-stream');
    } finally {
      req.destroy();
      const channel = buildEventChannel(eventAId);
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline && sseConnectionManager.getActiveSubscriberCount(channel) > 0) {
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.strictEqual(sseConnectionManager.getActiveSubscriberCount(channel), 0);
    }
  });

  it('User A connecting to Event B/live -> REJECTED (Unauthorized read, 404)', async () => {
    const res = await request(app)
      .get(`/v1/events/${eventBId}/live`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Since checkEventReadAuthorization throws NotFoundError for unauthorized events
    assert.strictEqual(res.status, 404);
  });

  it('Malformed UUID -> Existing validation failure (422)', async () => {
    const res = await request(app)
      .get('/v1/events/not-a-uuid/live')
      .set('Authorization', `Bearer ${tokenA}`);

    assert.strictEqual(res.status, 422); // UnprocessableEntityError
  });
});
