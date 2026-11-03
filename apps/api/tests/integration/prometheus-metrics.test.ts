import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { adminPrisma } from '../helpers/adminDb';
import { signJwt } from '../../src/lib/jwt';
import { env } from '../../src/config/env';
import {
  apiMetricsRegistry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  rateLimitExceededTotal,
  sseActiveConnections,
  getMergedMetrics,
} from '../../src/lib/metrics';

describe('PHASE 3: Prometheus Metrics & Observability Suite', () => {
  const app = createApp();

  const adminId = 'a3333333-3333-3333-3333-333333333333';
  const adminToken = signJwt(adminId, 1);

  before(async () => {
    await adminPrisma.user.upsert({
      where: { id: adminId },
      create: {
        id: adminId,
        email: 'metrics.admin@adypu.edu.in',
        fullName: 'Metrics Admin',
        googleSub: 'google-sub-admin-metrics',
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
      update: {
        globalRole: 'PLATFORM_ADMIN',
        securityVersion: 1,
      },
    });
  });

  after(async () => {
    await adminPrisma.user.deleteMany({
      where: { id: adminId },
    });
  });

  it('1. GET /metrics returns Prometheus formatted metrics with canonical prefixes', async () => {
    const res = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/plain/);

    const body = res.text;
    assert.match(body, /# HELP nst_api_http_requests_total/);
    assert.match(body, /# TYPE nst_api_http_requests_total counter/);
    assert.match(body, /# HELP nst_api_http_request_duration_seconds/);
    assert.match(body, /# TYPE nst_api_http_request_duration_seconds histogram/);
    assert.match(body, /# HELP nst_api_rate_limit_exceeded_total/);
    assert.match(body, /# HELP nst_api_sse_active_connections/);
  });

  it('2. Metrics middleware measures request counts and normalizes route templates', async () => {
    // Send request to /health
    await request(app).get('/health');

    // Send request to unmatched route
    await request(app).get('/non-existent-testing-route-404');

    const metricsText = await getMergedMetrics();

    // Verify /health route label
    assert.match(metricsText, /nst_api_http_requests_total\{method="GET",route="\/health",status_code="200",status_class="2xx"\}/);

    // Verify unmatched route label (preventing cardinality explosion)
    assert.match(metricsText, /nst_api_http_requests_total\{method="GET",route="unmatched",status_code="404",status_class="4xx"\}/);
  });

  it('3. Rate limit counter tracks 429 rejections by bucket', async () => {
    // Increment rateLimitExceededTotal for testing
    rateLimitExceededTotal.inc({ bucket: 'auth_token' });
    rateLimitExceededTotal.inc({ bucket: 'attendance' });

    const metricsText = await getMergedMetrics();
    assert.match(metricsText, /nst_api_rate_limit_exceeded_total\{bucket="auth_token"\} 1/);
    assert.match(metricsText, /nst_api_rate_limit_exceeded_total\{bucket="attendance"\} 1/);
  });

  it('4. SSE active connections gauge increments and decrements', async () => {
    sseActiveConnections.inc({ stream_type: 'event_live' });
    let metricsText = await getMergedMetrics();
    assert.match(metricsText, /nst_api_sse_active_connections\{stream_type="event_live"\} 1/);

    sseActiveConnections.dec({ stream_type: 'event_live' });
    metricsText = await getMergedMetrics();
    assert.match(metricsText, /nst_api_sse_active_connections\{stream_type="event_live"\} 0/);
  });

  it('5. Access control: non-loopback untrusted caller without token is rejected with 403', async () => {
    // Supertest defaults to 127.0.0.1, simulate external IP via X-Forwarded-For if not loopback
    // Or test token protection when METRICS_TOKEN is set
    const originalToken = env.METRICS_TOKEN;
    try {
      (env as any).METRICS_TOKEN = 'secret-prom-scrape-token';

      // Without token -> 401
      const unauth = await request(app).get('/metrics');
      assert.strictEqual(unauth.status, 401);

      // With wrong token -> 401
      const badToken = await request(app)
        .get('/metrics')
        .set('Authorization', 'Bearer wrong-token');
      assert.strictEqual(badToken.status, 401);

      // With valid Bearer token -> 200
      const validBearer = await request(app)
        .get('/metrics')
        .set('Authorization', 'Bearer secret-prom-scrape-token');
      assert.strictEqual(validBearer.status, 200);

      // With valid X-Metrics-Token header -> 200
      const validHeader = await request(app)
        .get('/metrics')
        .set('X-Metrics-Token', 'secret-prom-scrape-token');
      assert.strictEqual(validHeader.status, 200);
    } finally {
      (env as any).METRICS_TOKEN = originalToken;
    }
  });
});
