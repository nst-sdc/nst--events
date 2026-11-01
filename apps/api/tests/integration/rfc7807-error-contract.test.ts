import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma as prisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';

const app = createApp();

test('RFC 7807 Error Contract Verification', async (t) => {
  const ts = Date.now();
  const testEmail = `rfc_tester_${ts}@example.com`;
  let studentToken: string;
  let adminToken: string;
  let studentId: string;
  let adminId: string;

  t.before(async () => {
    const studentUser = await prisma.user.create({
      data: {
        email: testEmail,
        fullName: 'RFC Tester',
        globalRole: 'STUDENT',
        googleSub: `sub_rfc_${ts}`,
      },
    });
    studentId = studentUser.id;
    studentToken = signJwt(studentUser.id);

    const adminUser = await prisma.user.create({
      data: {
        email: `rfc_admin_${ts}@example.com`,
        fullName: 'RFC Admin',
        globalRole: 'PLATFORM_ADMIN',
        googleSub: `sub_rfc_admin_${ts}`,
      },
    });
    adminId = adminUser.id;
    adminToken = signJwt(adminUser.id);
  });

  t.after(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [studentId, adminId] } },
    });
  });

  await t.test('GET /clubs/:id with non-existent ID returns RFC 7807 404 Problem Details', async () => {
    const res = await request(app)
      .get('/clubs/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/not-found');
    assert.strictEqual(res.body.title, 'Not Found');
    assert.strictEqual(res.body.status, 404);
    assert.strictEqual(res.body.detail, 'Club not found');
    assert.ok(res.body.request_id);
    assert.ok(res.body.instance);
  });

  await t.test('GET /clubs/search with unsupported type returns RFC 7807 400 Problem Details', async () => {
    const res = await request(app)
      .get('/clubs/search?type=unsupported')
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/bad-request');
    assert.strictEqual(res.body.title, 'Bad Request');
    assert.strictEqual(res.body.status, 400);
    assert.strictEqual(res.body.detail, 'Only type=clubs is supported currently');
    assert.ok(res.body.request_id);
  });

  await t.test('GET /users/:id/profile with non-existent user returns RFC 7807 404 Problem Details', async () => {
    const res = await request(app)
      .get('/users/00000000-0000-0000-0000-000000000000/profile')
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/not-found');
    assert.strictEqual(res.body.title, 'Not Found');
    assert.strictEqual(res.body.status, 404);
    assert.strictEqual(res.body.detail, 'User not found');
    assert.ok(res.body.request_id);
  });

  await t.test('GET /v1/admin/analytics/attendance without date range returns RFC 7807 400 Problem Details', async () => {
    const res = await request(app)
      .get('/v1/admin/analytics/attendance')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/bad-request');
    assert.strictEqual(res.body.title, 'Bad Request');
    assert.strictEqual(res.body.status, 400);
    assert.strictEqual(res.body.detail, 'Missing start or end date');
    assert.ok(res.body.request_id);
  });

  await t.test('PATCH /v1/notifications/:id/read with non-existent ID returns RFC 7807 404 Problem Details', async () => {
    const res = await request(app)
      .patch('/v1/notifications/00000000-0000-0000-0000-000000000000/read')
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/not-found');
    assert.strictEqual(res.body.title, 'Not Found');
    assert.strictEqual(res.body.status, 404);
    assert.strictEqual(res.body.detail, 'Notification not found');
    assert.ok(res.body.request_id);
  });
});
