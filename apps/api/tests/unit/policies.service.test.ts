import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_POLICY_CONTENT_BYTES,
  PolicyContentSchema,
  UpdatePolicySchema,
  GetPolicyParamsSchema,
} from '../../src/modules/policies/policies.schema';
import {
  policiesService,
  PolicyConflictError,
} from '../../src/modules/policies/policies.service';
import { prisma } from '../../src/lib/prisma';
import { NotFoundError } from '../../src/lib/errors';

describe('FEAT-ADMIN-04: Policies Schema & UTF-8 Byte Limit Tests', () => {
  it('enforces exact 100 KiB (102,400 bytes) limit on ASCII text', () => {
    const exact100KiB = 'A'.repeat(MAX_POLICY_CONTENT_BYTES);
    assert.strictEqual(Buffer.byteLength(exact100KiB, 'utf8'), 102400);

    const validResult = PolicyContentSchema.safeParse(exact100KiB);
    assert.strictEqual(validResult.success, true);

    const over100KiB = 'A'.repeat(MAX_POLICY_CONTENT_BYTES + 1);
    assert.strictEqual(Buffer.byteLength(over100KiB, 'utf8'), 102401);

    const invalidResult = PolicyContentSchema.safeParse(over100KiB);
    assert.strictEqual(invalidResult.success, false);
    assert.match(invalidResult.error!.errors[0].message, /100 KiB/);
  });

  it('correctly calculates multi-byte UTF-8 emoji and non-ASCII characters against byte limit', () => {
    // 🔥 is 4 UTF-8 bytes and 2 UTF-16 code units
    const emoji = '🔥';
    assert.strictEqual(Buffer.byteLength(emoji, 'utf8'), 4);
    assert.strictEqual(emoji.length, 2);

    // 25,600 emojis = 102,400 UTF-8 bytes (exact limit)
    // In JavaScript string.length, this is only 51,200 code units
    const exactEmoji = emoji.repeat(25600);
    assert.strictEqual(Buffer.byteLength(exactEmoji, 'utf8'), 102400);
    assert.strictEqual(exactEmoji.length, 51200);

    const validEmoji = PolicyContentSchema.safeParse(exactEmoji);
    assert.strictEqual(validEmoji.success, true);

    // 25,601 emojis = 102,404 UTF-8 bytes (exceeds byte limit by 4 bytes)
    const overEmoji = emoji.repeat(25601);
    assert.strictEqual(Buffer.byteLength(overEmoji, 'utf8'), 102404);

    const invalidEmoji = PolicyContentSchema.safeParse(overEmoji);
    assert.strictEqual(invalidEmoji.success, false);
    assert.match(invalidEmoji.error!.errors[0].message, /100 KiB/);
  });

  it('validates UpdatePolicySchema requiring valid action and positive base revision', () => {
    const validPayload = {
      title: 'Valid Privacy Policy',
      content: '# Privacy Policy Content',
      action: 'SAVE_DRAFT',
      base_concurrency_revision: 1,
    };
    const valid = UpdatePolicySchema.safeParse(validPayload);
    assert.strictEqual(valid.success, true);

    const invalidAction = UpdatePolicySchema.safeParse({
      ...validPayload,
      action: 'DELETE',
    });
    assert.strictEqual(invalidAction.success, false);

    const invalidRevision = UpdatePolicySchema.safeParse({
      ...validPayload,
      base_concurrency_revision: 0,
    });
    assert.strictEqual(invalidRevision.success, false);
  });

  it('validates empty and ordinary Markdown content', () => {
    // Empty markdown string is allowed
    const emptyResult = PolicyContentSchema.safeParse('');
    assert.strictEqual(emptyResult.success, true);

    // Ordinary markdown with headings, lists, links
    const ordinaryMarkdown = '# NST Privacy Policy\n\n## Section 1\n\n- Item 1\n- Item 2\n\n[Link](https://nstsdc.org)';
    const ordinaryResult = PolicyContentSchema.safeParse(ordinaryMarkdown);
    assert.strictEqual(ordinaryResult.success, true);
  });

  it('validates special characters: newlines, backslashes, quotes, and JSON-escaped sequences', () => {
    const complexContent = 'Line 1\r\nLine 2\n"Quoted text" and \'single quotes\'\n\\Backslash\\ and `code`\n{"key": "value"}';
    const result = PolicyContentSchema.safeParse(complexContent);
    assert.strictEqual(result.success, true);
  });

  it('rejects invalid payload types for policy content', () => {
    assert.strictEqual(PolicyContentSchema.safeParse(12345).success, false);
    assert.strictEqual(PolicyContentSchema.safeParse(true).success, false);
    assert.strictEqual(PolicyContentSchema.safeParse(null).success, false);
    assert.strictEqual(PolicyContentSchema.safeParse(undefined).success, false);
    assert.strictEqual(PolicyContentSchema.safeParse({}).success, false);
    assert.strictEqual(PolicyContentSchema.safeParse(['array']).success, false);
  });

  it('validates slug format in GetPolicyParamsSchema', () => {
    assert.strictEqual(GetPolicyParamsSchema.safeParse({ slug: 'privacy-policy' }).success, true);
    assert.strictEqual(GetPolicyParamsSchema.safeParse({ slug: 'terms-of-service-2026' }).success, true);
    assert.strictEqual(GetPolicyParamsSchema.safeParse({ slug: 'INVALID_SLUG!' }).success, false);
    assert.strictEqual(GetPolicyParamsSchema.safeParse({ slug: '../path-traversal' }).success, false);
  });
});

describe('FEAT-ADMIN-04: Policies Service & Concurrency Isolation', () => {
  const origFindUnique = prisma.systemPolicy.findUnique;
  const origTransaction = prisma.$transaction;

  it('public retrieval returns only published content and hides draft/audit fields', async () => {
    (prisma.systemPolicy as any).findUnique = async ({ where }: any) => {
      if (where.slug === 'privacy-policy') {
        return {
          slug: 'privacy-policy',
          title: 'Privacy Policy — NST Events',
          publishedContent: '# Published Legal Content',
          publishedVersion: 2,
          publishedAt: new Date('2026-10-28T00:00:00Z'),
        };
      }
      return null;
    };

    try {
      const policy = await policiesService.getPublishedPolicy('privacy-policy');
      assert.strictEqual(policy.slug, 'privacy-policy');
      assert.strictEqual(policy.content, '# Published Legal Content');
      assert.strictEqual(policy.published_version, 2);
      assert.strictEqual(policy.published_at, '2026-10-28T00:00:00.000Z');
      assert.strictEqual((policy as any).draft_content, undefined);
      assert.strictEqual((policy as any).concurrency_revision, undefined);

      await assert.rejects(
        async () => policiesService.getPublishedPolicy('unknown-slug'),
        NotFoundError
      );
    } finally {
      prisma.systemPolicy.findUnique = origFindUnique;
    }
  });

  it('draft save increments concurrencyRevision without modifying published content or publishedVersion', async () => {
    let storedPolicy: any = {
      slug: 'privacy-policy',
      title: 'Privacy Policy — NST Events',
      publishedContent: '# Published v1',
      draftContent: '# Old Draft',
      concurrencyRevision: 3,
      publishedVersion: 1,
      publishedAt: new Date('2026-09-09T00:00:00Z'),
      publishedById: null,
      updatedAt: new Date('2026-09-09T00:00:00Z'),
      publishedBy: null,
    };

    let createdAuditLogs: any[] = [];

    const mockTx: any = {
      $executeRaw: async () => {},
      systemPolicy: {
        findUnique: async () => ({ ...storedPolicy }),
        update: async ({ data }: any) => {
          storedPolicy = { ...storedPolicy, ...data };
          return storedPolicy;
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          createdAuditLogs.push(data);
          return { id: BigInt(1), ...data };
        },
        findFirst: async () => null,
      },
      user: {
        findUnique: async () => ({ id: 'admin-uuid', fullName: 'Jane Doe', email: 'jane@nstsdc.org' }),
      },
    };

    (prisma as any).$transaction = async (fn: any) => {
      return fn(mockTx);
    };

    try {
      const result = await policiesService.updatePolicy(
        { id: 'admin-uuid', fullName: 'Jane Doe', email: 'jane@nstsdc.org' },
        'privacy-policy',
        {
          action: 'SAVE_DRAFT',
          content: '# New Working Draft Content',
          base_concurrency_revision: 3,
        }
      );

      assert.strictEqual(result.status, 'SUCCESS');
      assert.strictEqual(result.action, 'SAVE_DRAFT');
      assert.strictEqual(result.concurrency_revision, 4);
      assert.strictEqual(result.published_version, 1); // Published version untouched!

      assert.strictEqual(storedPolicy.draftContent, '# New Working Draft Content');
      assert.strictEqual(storedPolicy.publishedContent, '# Published v1'); // Published content untouched!
      assert.strictEqual(storedPolicy.publishedVersion, 1);
      assert.strictEqual(storedPolicy.concurrencyRevision, 4);

      assert.strictEqual(createdAuditLogs.length, 1);
      const audit = createdAuditLogs[0];
      assert.strictEqual(audit.actorId, 'admin-uuid');
      assert.strictEqual(audit.action, 'POLICY_SAVED_DRAFT');
      assert.strictEqual(audit.entityType, 'SystemPolicy');
      assert.strictEqual(audit.entityId, null);
      assert.strictEqual(audit.newState.slug, 'privacy-policy');
      assert.strictEqual(audit.newState.new_concurrency_revision, 4);
      assert.ok(audit.newState.draft_content_sha256);
      assert.strictEqual(audit.newState.content, undefined);
    } finally {
      prisma.$transaction = origTransaction;
    }
  });

  it('publish atomically increments publishedVersion and concurrencyRevision with dual snapshots in auditLog', async () => {
    let storedPolicy: any = {
      slug: 'privacy-policy',
      title: 'Privacy Policy — NST Events',
      publishedContent: '# Published v1',
      draftContent: '# Working Draft v2',
      concurrencyRevision: 4,
      publishedVersion: 1,
      publishedAt: new Date('2026-09-09T00:00:00Z'),
      publishedById: null,
      updatedAt: new Date('2026-09-09T00:00:00Z'),
      publishedBy: null,
    };

    let createdAuditLogs: any[] = [];

    const mockTx: any = {
      $executeRaw: async () => {},
      systemPolicy: {
        findUnique: async () => ({ ...storedPolicy }),
        update: async ({ data }: any) => {
          storedPolicy = { ...storedPolicy, ...data };
          return storedPolicy;
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          createdAuditLogs.push(data);
          return { id: BigInt(2), ...data };
        },
        findFirst: async () => null,
      },
      user: {
        findUnique: async () => ({ id: 'admin-uuid-1', fullName: 'Alice Admin', email: 'alice@nstsdc.org' }),
      },
    };

    (prisma as any).$transaction = async (fn: any) => {
      return fn(mockTx);
    };

    try {
      const result = await policiesService.updatePolicy(
        { id: 'admin-uuid-1', fullName: 'Alice Admin', email: 'alice@nstsdc.org' },
        'privacy-policy',
        {
          action: 'PUBLISH',
          content: '# Officially Published v2 Legal Terms',
          base_concurrency_revision: 4,
        }
      );

      assert.strictEqual(result.status, 'SUCCESS');
      assert.strictEqual(result.action, 'PUBLISH');
      assert.strictEqual(result.concurrency_revision, 5);
      assert.strictEqual(result.published_version, 2);

      assert.strictEqual(storedPolicy.publishedContent, '# Officially Published v2 Legal Terms');
      assert.strictEqual(storedPolicy.draftContent, '# Officially Published v2 Legal Terms');
      assert.strictEqual(storedPolicy.publishedVersion, 2);
      assert.strictEqual(storedPolicy.publishedById, 'admin-uuid-1');

      assert.strictEqual(createdAuditLogs.length, 1);
      const audit = createdAuditLogs[0];
      assert.strictEqual(audit.action, 'POLICY_PUBLISHED');
      assert.strictEqual(audit.actorId, 'admin-uuid-1');
      assert.strictEqual(audit.entityId, null);

      assert.strictEqual(audit.previousState.published_version, 1);
      assert.strictEqual(audit.previousState.content, '# Published v1');

      assert.strictEqual(audit.newState.published_version, 2);
      assert.strictEqual(audit.newState.content, '# Officially Published v2 Legal Terms');
      assert.strictEqual(audit.newState.publisher_name, 'Alice Admin');
      assert.strictEqual(audit.newState.publisher_email, 'alice@nstsdc.org');
    } finally {
      prisma.$transaction = origTransaction;
    }
  });

  it('rejects stale writes with PolicyConflictError (409) preserving existing data', async () => {
    const serverPolicy: any = {
      slug: 'privacy-policy',
      title: 'Privacy Policy — NST Events',
      publishedContent: '# v1',
      draftContent: '# Remote Draft Updated By Bob',
      concurrencyRevision: 8,
      publishedVersion: 1,
      publishedAt: new Date('2026-09-09T00:00:00Z'),
      publishedById: null,
      updatedAt: new Date(),
      publishedBy: null,
    };

    const mockTx: any = {
      $executeRaw: async () => {},
      systemPolicy: {
        findUnique: async () => ({ ...serverPolicy }),
        update: async () => {
          assert.fail('Database update must NOT be called on conflict!');
        },
      },
      auditLog: {
        findFirst: async () => ({
          actor: { fullName: 'Bob Modifier', email: 'bob@nstsdc.org' },
        }),
        create: async () => {
          assert.fail('Audit log must NOT be created on conflict!');
        },
      },
    };

    (prisma as any).$transaction = async (fn: any) => {
      return fn(mockTx);
    };

    try {
      await assert.rejects(
        async () => {
          await policiesService.updatePolicy(
            { id: 'admin-uuid-2', fullName: 'Charlie Admin', email: 'charlie@nstsdc.org' },
            'privacy-policy',
            {
              action: 'SAVE_DRAFT',
              content: '# My Local Edits That Must Not Overwrite',
              base_concurrency_revision: 7, // Stale!
            }
          );
        },
        (err: any) => {
          assert.ok(err instanceof PolicyConflictError);
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.currentConcurrencyRevision, 8);
          assert.strictEqual(err.currentPublishedVersion, 1);
          assert.strictEqual(err.serverDraftContent, '# Remote Draft Updated By Bob');
          assert.strictEqual(err.lastModifiedBy?.name, 'Bob Modifier');
          assert.strictEqual(err.lastModifiedBy?.email, 'bob@nstsdc.org');
          return true;
        }
      );
    } finally {
      prisma.$transaction = origTransaction;
    }
  });
});
