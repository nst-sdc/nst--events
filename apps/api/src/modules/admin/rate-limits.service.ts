import { withUserContext } from '@nst/database';
import { env } from '../../config/env';
import { BadRequestError, NotFoundError } from '../../lib/errors';
import {
  rateLimitSettingsCache,
  RATE_LIMIT_BUCKETS,
  BUCKET_BOUNDS,
  RateLimitBucket,
} from '../../lib/rate-limit-settings';
import {
  UpdateRateLimitSettingInput,
  CreateRateLimitOverrideInput,
} from './rate-limits.schema';

export class RateLimitsService {
  async getSettings() {
    const buckets = rateLimitSettingsCache.getAllBucketSettings().map((b) => ({
      bucket: b.bucket,
      max_total: b.maxTotal,
      per_replica: b.perReplica,
      enabled: b.enabled,
      source: b.source,
      min: b.min,
      max: b.max,
      default: b.envDefault,
      updated_by: b.updatedBy,
      updated_at: b.updatedAt?.toISOString() ?? null,
    }));

    return {
      replicas: env.RATE_LIMIT_REPLICAS,
      window_ms: env.RATE_LIMIT_WINDOW_MS,
      buckets,
    };
  }

  async updateSetting(callerId: string, bucketStr: string, input: UpdateRateLimitSettingInput) {
    const bucket = bucketStr as RateLimitBucket;
    if (!RATE_LIMIT_BUCKETS.includes(bucket)) {
      throw new BadRequestError(
        `Invalid rate limit bucket '${bucketStr}'. Allowed buckets: ${RATE_LIMIT_BUCKETS.join(', ')}`
      );
    }

    const bounds = BUCKET_BOUNDS[bucket];
    if (input.max_total < bounds.min || input.max_total > bounds.max) {
      throw new BadRequestError(
        `Rate limit for '${bucket}' must be between ${bounds.min} and ${bounds.max}. Received: ${input.max_total}`
      );
    }

    const updated = await withUserContext(callerId, async (tx) => {
      const existing = await tx.rateLimitSetting.findUnique({
        where: { bucket },
      });

      const enabled = input.enabled !== undefined ? input.enabled : existing ? existing.enabled : true;

      const saved = await tx.rateLimitSetting.upsert({
        where: { bucket },
        create: {
          bucket,
          maxTotal: input.max_total,
          enabled,
          updatedBy: callerId,
        },
        update: {
          maxTotal: input.max_total,
          enabled,
          updatedBy: callerId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: callerId,
          action: 'RATE_LIMIT_UPDATED',
          entityType: 'RateLimitSetting',
          entityId: null,
          previousState: existing
            ? { bucket, max_total: existing.maxTotal, enabled: existing.enabled }
            : { bucket, max_total: bounds.envDefault, enabled: true },
          newState: { bucket, max_total: saved.maxTotal, enabled: saved.enabled },
        },
      });

      return saved;
    });

    // Invalidate local replica cache immediately
    await rateLimitSettingsCache.reload();

    const replicas = Math.max(1, env.RATE_LIMIT_REPLICAS);
    return {
      bucket: updated.bucket,
      max_total: updated.maxTotal,
      per_replica: Math.ceil(updated.maxTotal / replicas),
      enabled: updated.enabled,
      source: 'DATABASE',
      min: bounds.min,
      max: bounds.max,
      default: bounds.envDefault,
      updated_by: updated.updatedBy,
      updated_at: updated.updatedAt.toISOString(),
    };
  }

  async resetSettings(callerId: string) {
    await withUserContext(callerId, async (tx) => {
      const existing = await tx.rateLimitSetting.findMany();

      await tx.rateLimitSetting.deleteMany();

      await tx.auditLog.create({
        data: {
          actorId: callerId,
          action: 'RATE_LIMIT_RESET',
          entityType: 'RateLimitSetting',
          entityId: null,
          previousState: existing.map((r) => ({
            bucket: r.bucket,
            max_total: r.maxTotal,
            enabled: r.enabled,
          })),
          newState: { reset_at: new Date().toISOString() },
        },
      });
    });

    // Invalidate local replica cache immediately
    await rateLimitSettingsCache.reload();

    return this.getSettings();
  }

  async getOverrides(callerId: string) {
    return withUserContext(callerId, async (tx) => {
      const rows = await tx.rateLimitOverride.findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return rows.map((r) => ({
        id: r.id,
        subject_type: r.subjectType,
        subject: r.subject,
        mode: r.mode,
        custom_max: r.customMax,
        expires_at: r.expiresAt.toISOString(),
        reason: r.reason,
        created_at: r.createdAt.toISOString(),
        created_by: r.creator
          ? {
              id: r.creator.id,
              full_name: r.creator.fullName,
              email: r.creator.email,
            }
          : null,
      }));
    });
  }

  async createOverride(callerId: string, input: CreateRateLimitOverrideInput) {
    const created = await withUserContext(callerId, async (tx) => {
      const override = await tx.rateLimitOverride.create({
        data: {
          subjectType: input.subject_type,
          subject: input.subject,
          mode: input.mode,
          customMax: input.mode === 'custom_max' ? input.custom_max : null,
          expiresAt: new Date(input.expires_at),
          reason: input.reason,
          createdBy: callerId,
        },
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: callerId,
          action: 'RATE_LIMIT_OVERRIDE_CREATED',
          entityType: 'RateLimitOverride',
          entityId: override.id,
          newState: {
            id: override.id,
            subject_type: override.subjectType,
            subject: override.subject,
            mode: override.mode,
            custom_max: override.customMax,
            expires_at: override.expiresAt.toISOString(),
            reason: override.reason,
          },
        },
      });

      return override;
    });

    await rateLimitSettingsCache.reload();

    return {
      id: created.id,
      subject_type: created.subjectType,
      subject: created.subject,
      mode: created.mode,
      custom_max: created.customMax,
      expires_at: created.expiresAt.toISOString(),
      reason: created.reason,
      created_at: created.createdAt.toISOString(),
      created_by: created.creator
        ? {
            id: created.creator.id,
            full_name: created.creator.fullName,
            email: created.creator.email,
          }
        : null,
    };
  }

  async deleteOverride(callerId: string, overrideId: string) {
    await withUserContext(callerId, async (tx) => {
      const existing = await tx.rateLimitOverride.findUnique({
        where: { id: overrideId },
      });

      if (!existing) {
        throw new NotFoundError(`Rate limit override '${overrideId}' not found`);
      }

      await tx.rateLimitOverride.delete({
        where: { id: overrideId },
      });

      await tx.auditLog.create({
        data: {
          actorId: callerId,
          action: 'RATE_LIMIT_OVERRIDE_DELETED',
          entityType: 'RateLimitOverride',
          entityId: overrideId,
          previousState: {
            id: existing.id,
            subject_type: existing.subjectType,
            subject: existing.subject,
            mode: existing.mode,
            custom_max: existing.customMax,
            expires_at: existing.expiresAt.toISOString(),
            reason: existing.reason,
          },
        },
      });
    });

    await rateLimitSettingsCache.reload();

    return { success: true };
  }
}

export const rateLimitsService = new RateLimitsService();
