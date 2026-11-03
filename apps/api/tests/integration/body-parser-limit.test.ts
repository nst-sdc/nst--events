import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('TASK P14: Body Parser Limits & RFC 7807 413 Verification', () => {
  const app = createApp();

  it('1. Oversized JSON body (>100kb) returns HTTP 413 with RFC 7807 problem details', async () => {
    // Generate an oversized string ~105 KiB (105 * 1024 bytes)
    const oversizedString = 'x'.repeat(105 * 1024);

    const res = await request(app)
      .post('/v1/events')
      .set('Content-Type', 'application/json')
      .set('X-Client-Platform', 'web')
      .send(JSON.stringify({ title: oversizedString }));

    assert.strictEqual(res.status, 413, 'Oversized JSON payload must return HTTP 413');
    assert.strictEqual(
      res.body.type,
      'https://api.nstsdc.org/errors/payload-too-large',
      'Must return canonical RFC 7807 error type'
    );
    assert.strictEqual(res.body.title, 'Payload Too Large');
    assert.strictEqual(res.body.status, 413);
    assert.ok(res.body.detail, 'Must provide actionable error detail');
    assert.ok(res.body.request_id, 'Must contain request correlation ID');
  });

  it('2. Oversized URL-encoded body (>100kb) returns HTTP 413 with RFC 7807 problem details', async () => {
    const oversizedParam = 'data=' + 'y'.repeat(105 * 1024);

    const res = await request(app)
      .post('/auth/refresh')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('X-Client-Platform', 'web')
      .send(oversizedParam);

    assert.strictEqual(res.status, 413, 'Oversized URL-encoded payload must return HTTP 413');
    assert.strictEqual(res.body.status, 413);
    assert.strictEqual(res.body.title, 'Payload Too Large');
    assert.strictEqual(res.body.type, 'https://api.nstsdc.org/errors/payload-too-large');
  });

  it('3. Normal body (<=100kb) passes body parser without 413 Payload Too Large', async () => {
    const normalPayload = { refresh_token: 'valid-test-token-under-100kb' };

    const res = await request(app)
      .post('/auth/refresh')
      .set('Content-Type', 'application/json')
      .set('X-Client-Platform', 'web')
      .send(normalPayload);

    // May return 401 (invalid test token) or 400 or 200, but NEVER 413
    assert.notStrictEqual(res.status, 413, 'Normal payload must not be rejected with 413');
  });
});
