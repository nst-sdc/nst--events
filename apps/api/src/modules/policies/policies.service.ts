import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { withUserContext } from '@nst/database';
import { NotFoundError, AppError } from '../../lib/errors';
import { UpdatePolicyInput } from './policies.schema';

export class PolicyConflictError extends AppError {
  public readonly currentConcurrencyRevision: number;
  public readonly currentPublishedVersion: number;
  public readonly serverDraftContent: string;
  public readonly lastModifiedBy: { name: string; email: string } | null;

  constructor(
    message: string,
    currentConcurrencyRevision: number,
    currentPublishedVersion: number,
    serverDraftContent: string,
    lastModifiedBy: { name: string; email: string } | null
  ) {
    super(message, 409, 'Conflict', 'https://api.nstsdc.org/errors/concurrent-modification');
    this.currentConcurrencyRevision = currentConcurrencyRevision;
    this.currentPublishedVersion = currentPublishedVersion;
    this.serverDraftContent = serverDraftContent;
    this.lastModifiedBy = lastModifiedBy;
  }
}

export class PoliciesService {
  /**
   * Public retrieval: strictly exposes published content and metadata.
   * Never exposes draft content or audit logs.
   */
  async getPublishedPolicy(slug: string) {
    const policy = await prisma.systemPolicy.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        publishedContent: true,
        publishedVersion: true,
        publishedAt: true,
      },
    });

    if (!policy) {
      throw new NotFoundError(`Policy with slug '${slug}' was not found`);
    }

    return {
      slug: policy.slug,
      title: policy.title,
      content: policy.publishedContent,
      published_version: policy.publishedVersion,
      published_at: policy.publishedAt?.toISOString() ?? null,
    };
  }

  /**
   * Platform Admin retrieval: returns draft, published content, metadata, and concurrency revision.
   */
  async getAdminPolicy(slug: string, callerId: string) {
    return withUserContext(callerId, async (tx) => {
      const policy = await tx.systemPolicy.findUnique({
        where: { slug },
        include: {
          publishedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!policy) {
        throw new NotFoundError(`Policy with slug '${slug}' was not found`);
      }

      return {
        slug: policy.slug,
        title: policy.title,
        published_content: policy.publishedContent,
        draft_content: policy.draftContent,
        concurrency_revision: policy.concurrencyRevision,
        published_version: policy.publishedVersion,
        published_at: policy.publishedAt?.toISOString() ?? null,
        updated_at: policy.updatedAt.toISOString(),
        published_by: policy.publishedBy
          ? {
              id: policy.publishedBy.id,
              full_name: policy.publishedBy.fullName,
              email: policy.publishedBy.email,
            }
          : null,
      };
    });
  }

  /**
   * Platform Admin mutation: updates draft or publishes atomically.
   * Applies optimistic concurrency control using base_concurrency_revision.
   * Records transactional audit logs.
   */
  async updatePolicy(
    caller: { id: string; fullName: string; email: string },
    slug: string,
    input: UpdatePolicyInput
  ) {
    return withUserContext(caller.id, async (tx) => {
      const policy = await tx.systemPolicy.findUnique({
        where: { slug },
        include: {
          publishedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!policy) {
        throw new NotFoundError(`Policy with slug '${slug}' was not found`);
      }

      // Optimistic concurrency check
      if (policy.concurrencyRevision !== input.base_concurrency_revision) {
        // Query the most recent audit actor if available
        let lastModifier = policy.publishedBy
          ? { name: policy.publishedBy.fullName, email: policy.publishedBy.email }
          : null;

        const lastAudit = await tx.auditLog.findFirst({
          where: { entityType: 'SystemPolicy' },
          orderBy: { id: 'desc' },
          select: { actor: { select: { fullName: true, email: true } } },
        });

        if (lastAudit?.actor) {
          lastModifier = {
            name: lastAudit.actor.fullName,
            email: lastAudit.actor.email,
          };
        }

        throw new PolicyConflictError(
          'Policy was modified by another administrator. Your local edits have been preserved.',
          policy.concurrencyRevision,
          policy.publishedVersion,
          policy.draftContent,
          lastModifier
        );
      }

      const nextRevision = policy.concurrencyRevision + 1;
      const now = new Date();

      if (input.action === 'SAVE_DRAFT') {
        const updated = await tx.systemPolicy.update({
          where: { slug },
          data: {
            draftContent: input.content,
            title: input.title ?? policy.title,
            concurrencyRevision: nextRevision,
            updatedAt: now,
          },
        });

        const draftHash = crypto.createHash('sha256').update(input.content, 'utf8').digest('hex');

        await tx.auditLog.create({
          data: {
            actorId: caller.id,
            action: 'POLICY_SAVED_DRAFT',
            entityType: 'SystemPolicy',
            entityId: null, // PostgreSQL UUID column; slug is in new_state
            newState: {
              slug,
              title: updated.title,
              base_concurrency_revision: input.base_concurrency_revision,
              new_concurrency_revision: nextRevision,
              draft_content_sha256: draftHash,
              draft_size_bytes: Buffer.byteLength(input.content, 'utf8'),
              updated_at: now.toISOString(),
            },
          },
        });

        return {
          status: 'SUCCESS',
          slug,
          action: 'SAVE_DRAFT',
          concurrency_revision: nextRevision,
          published_version: policy.publishedVersion,
          updated_at: now.toISOString(),
        };
      }

      if (input.action === 'PUBLISH') {
        const nextPublishedVersion = policy.publishedVersion + 1;

        let publisherName = caller.fullName;
        let publisherEmail = caller.email;
        if (!publisherName || !publisherEmail) {
          const callerUser = await tx.user.findUnique({
            where: { id: caller.id },
            select: { fullName: true, email: true },
          });
          if (callerUser) {
            publisherName = callerUser.fullName;
            publisherEmail = callerUser.email;
          }
        }

        await tx.systemPolicy.update({
          where: { slug },
          data: {
            publishedContent: input.content,
            draftContent: input.content, // Synchronize draft baseline
            title: input.title ?? policy.title,
            concurrencyRevision: nextRevision,
            publishedVersion: nextPublishedVersion,
            publishedAt: now,
            publishedById: caller.id,
            updatedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: caller.id,
            action: 'POLICY_PUBLISHED',
            entityType: 'SystemPolicy',
            entityId: null,
            previousState: {
              slug,
              published_version: policy.publishedVersion,
              published_at: policy.publishedAt?.toISOString() ?? null,
              publisher_id: policy.publishedById,
              content: policy.publishedContent,
            },
            newState: {
              slug,
              published_version: nextPublishedVersion,
              published_at: now.toISOString(),
              publisher_id: caller.id,
              publisher_name: publisherName || 'Platform Administrator',
              publisher_email: publisherEmail || 'admin@nstsdc.org',
              content: input.content,
            },
          },
        });

        return {
          status: 'SUCCESS',
          slug,
          action: 'PUBLISH',
          concurrency_revision: nextRevision,
          published_version: nextPublishedVersion,
          published_at: now.toISOString(),
          updated_at: now.toISOString(),
        };
      }

      throw new AppError('Invalid policy action', 400);
    });
  }
}

export const policiesService = new PoliciesService();
