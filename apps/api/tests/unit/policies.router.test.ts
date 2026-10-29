import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { signJwt } from '../../src/lib/jwt';
import { policiesService, PolicyConflictError } from '../../src/modules/policies/policies.service';
import { NotFoundError } from '../../src/lib/errors';

describe('FEAT-ADMIN-04: Policies API Express Router Integration', () => {
  const app = createApp();

  const platformAdminId = '11111111-1111-1111-1111-111111111111';
  const studentId = '22222222-2222-2222-2222-222222222222';

  const platformAdminToken = signJwt(platformAdminId);
  const studentToken = signJwt(studentId);

  const origTransaction = prisma.$transaction;

  it('GET /v1/policies/:slug returns 200 with public headers', async () => {
    const origGetPublished = policiesService.getPublishedPolicy;
    policiesService.getPublishedPolicy = async (slug: string) => {
      if (slug === 'privacy-policy') {
        return {
          slug: 'privacy-policy',
          title: 'Privacy Policy — NST Events',
          content: '# Public Legal Text',
          published_version: 1,
          published_at: '2026-09-09T00:00:00.000Z',
        };
      }
      throw new NotFoundError('Policy not found');
    };

    try {
      const res = await request(app).get('/v1/policies/privacy-policy');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.slug, 'privacy-policy');
      assert.strictEqual(res.body.content, '# Public Legal Text');
      assert.strictEqual(res.body.published_version, 1);
      assert.strictEqual(res.headers['cache-control'], 'public, max-age=60, s-maxage=60, stale-while-revalidate=60');
      assert.strictEqual(res.headers['x-nst-origin-timestamp'], '2026-09-09T00:00:00.000Z');

      // Test 404 for missing slug
      const missingRes = await request(app).get('/v1/policies/non-existent');
      assert.strictEqual(missingRes.status, 404);

      // Test 400 for invalid slug regex
      const invalidRes = await request(app).get('/v1/policies/INVALID_SLUG!!');
      assert.strictEqual(invalidRes.status, 400);
    } finally {
      policiesService.getPublishedPolicy = origGetPublished;
    }
  });

  it('GET /v1/admin/policies/:slug rejects unauthenticated and non-PLATFORM_ADMIN users', async () => {
    // 1. Unauthenticated -> 401
    const unauthRes = await request(app).get('/v1/admin/policies/privacy-policy');
    assert.strictEqual(unauthRes.status, 401);

    // Mock withUserContext for authenticate & authorize middleware
    const mockTx: any = {
      $executeRaw: async () => {},
      user: {
        findUnique: async ({ where }: any) => {
          if (where.id === studentId) {
            return {
              id: studentId,
              globalRole: 'STUDENT',
              deletedAt: null,
              securityVersion: 1,
            };
          }
          if (where.id === platformAdminId) {
            return {
              id: platformAdminId,
              globalRole: 'PLATFORM_ADMIN',
              deletedAt: null,
              securityVersion: 1,
            };
          }
          return null;
        },
      },
    };

    (prisma as any).$transaction = async (fn: any) => fn(mockTx);

    try {
      // 2. Student -> 403 Forbidden
      const studentRes = await request(app)
        .get('/v1/admin/policies/privacy-policy')
        .set('Authorization', `Bearer ${studentToken}`);
      assert.strictEqual(studentRes.status, 403);
    } finally {
      prisma.$transaction = origTransaction;
    }
  });

  it('PUT /v1/admin/policies/:slug enforces 100 KiB UTF-8 limit and handles 409 conflict', async () => {
    const mockTx: any = {
      $executeRaw: async () => {},
      user: {
        findUnique: async ({ where }: any) => {
          if (where.id === platformAdminId) {
            return {
              id: platformAdminId,
              globalRole: 'PLATFORM_ADMIN',
              deletedAt: null,
              securityVersion: 1,
              fullName: 'Admin User',
              email: 'admin@nstsdc.org',
            };
          }
          return null;
        },
      },
    };

    (prisma as any).$transaction = async (fn: any) => fn(mockTx);

    const origUpdate = policiesService.updatePolicy;

    try {
      // 1. Content size > 100 KiB -> 400 Validation Error
      const oversizedPayload = {
        title: 'Oversized Policy',
        content: 'A'.repeat(102401),
        action: 'SAVE_DRAFT',
        base_concurrency_revision: 1,
      };

      const overRes = await request(app)
        .put('/v1/admin/policies/privacy-policy')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send(oversizedPayload);

      assert.strictEqual(overRes.status, 400);

      // 2. Conflict Handling -> 409 Conflict with full metadata
      policiesService.updatePolicy = async () => {
        throw new PolicyConflictError(
          'Policy was modified by another administrator. Your local edits have been preserved.',
          12,
          3,
          '# Remote Draft Text',
          { name: 'Dr. Jane Smith', email: 'jane@nstsdc.org' }
        );
      };

      const conflictRes = await request(app)
        .put('/v1/admin/policies/privacy-policy')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'Conflict Test',
          content: '# Local Draft Text',
          action: 'SAVE_DRAFT',
          base_concurrency_revision: 11,
        });

      assert.strictEqual(conflictRes.status, 409);
      assert.strictEqual(conflictRes.body.error, 'CONCURRENT_POLICY_MODIFICATION');
      assert.strictEqual(conflictRes.body.current_concurrency_revision, 12);
      assert.strictEqual(conflictRes.body.current_published_version, 3);
      assert.strictEqual(conflictRes.body.server_draft_content, '# Remote Draft Text');
      assert.strictEqual(conflictRes.body.last_modified_by.name, 'Dr. Jane Smith');
      assert.strictEqual(conflictRes.body.last_modified_by.email, 'jane@nstsdc.org');

      // 3. Successful draft save -> 200 OK
      policiesService.updatePolicy = async () => ({
        status: 'SUCCESS',
        slug: 'privacy-policy',
        action: 'SAVE_DRAFT',
        concurrency_revision: 2,
        published_version: 1,
        updated_at: '2026-10-29T10:00:00.000Z',
      });

      const successRes = await request(app)
        .put('/v1/admin/policies/privacy-policy')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'Updated Policy',
          content: '# Working Draft',
          action: 'SAVE_DRAFT',
          base_concurrency_revision: 1,
        });

      assert.strictEqual(successRes.status, 200);
      assert.strictEqual(successRes.body.status, 'SUCCESS');
      assert.strictEqual(successRes.body.concurrency_revision, 2);
    } finally {
      policiesService.updatePolicy = origUpdate;
      prisma.$transaction = origTransaction;
    }
  });

  it('enforces route-scoped 256kb parser for policies and strict 100kb limit on unrelated routes', async () => {
    // 1. Policy route accepts a payload of ~105 KiB (102,400 bytes content + JSON wrapping)
    const validLargeContent = 'A'.repeat(102400);
    const origUpdate = policiesService.updatePolicy;
    policiesService.updatePolicy = async () => ({
      status: 'SUCCESS',
      slug: 'privacy-policy',
      action: 'SAVE_DRAFT',
      concurrency_revision: 2,
      published_version: 1,
      updated_at: '2026-10-29T10:00:00.000Z',
    });

    const mockTx: any = {
      $executeRaw: async () => {},
      user: {
        findUnique: async () => ({
          id: platformAdminId,
          globalRole: 'PLATFORM_ADMIN',
          deletedAt: null,
          securityVersion: 1,
          fullName: 'Admin User',
          email: 'admin@nstsdc.org',
        }),
      },
    };
    (prisma as any).$transaction = async (fn: any) => fn(mockTx);

    try {
      const policyRes = await request(app)
        .put('/v1/admin/policies/privacy-policy')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          title: 'Large Valid Policy',
          content: validLargeContent,
          action: 'SAVE_DRAFT',
          base_concurrency_revision: 1,
        });

      // Accepted by route-scoped parser (limit: 256kb) and processed
      assert.strictEqual(policyRes.status, 200);

      // 2. Policy route rejects an excessively large payload (> 256kb) with HTTP 413
      const massivePolicyBody = JSON.stringify({
        title: 'Massive Policy',
        content: 'B'.repeat(300 * 1024), // 300 KiB
        action: 'SAVE_DRAFT',
        base_concurrency_revision: 1,
      });

      const policyOverRes = await request(app)
        .put('/v1/admin/policies/privacy-policy')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .set('Content-Type', 'application/json')
        .send(massivePolicyBody);

      assert.strictEqual(policyOverRes.status, 413);
      assert.strictEqual(policyOverRes.body.title, 'Payload Too Large');

      // 3. Unrelated route (e.g., /auth/refresh) retains strict 100kb limit and rejects > 100kb with HTTP 413
      const unrelatedLargeBody = JSON.stringify({
        data: 'X'.repeat(120 * 1024), // 120 KiB (> 100kb default limit)
      });

      const unrelatedOverRes = await request(app)
        .post('/auth/refresh')
        .set('Content-Type', 'application/json')
        .send(unrelatedLargeBody);

      assert.strictEqual(unrelatedOverRes.status, 413);
      assert.strictEqual(unrelatedOverRes.body.title, 'Payload Too Large');
    } finally {
      policiesService.updatePolicy = origUpdate;
      prisma.$transaction = origTransaction;
    }
  });
});
