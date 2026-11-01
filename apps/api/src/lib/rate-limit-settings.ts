import { env } from '../config/env';
import { prisma } from './prisma';
import { sseEventBus } from '../modules/sse/event-bus';
import { pgListener } from '../modules/sse/pg-listener';

export type RateLimitBucket =
  | 'user'
  | 'unauth'
  | 'auth_token'
  | 'auth_oauth_failed'
  | 'auth_ip_ceiling'
  | 'attendance';

export const RATE_LIMIT_BUCKETS: RateLimitBucket[] = [
  'user',
  'unauth',
  'auth_token',
  'auth_oauth_failed',
  'auth_ip_ceiling',
  'attendance',
];

export interface BucketBounds {
  min: number;
  max: number;
  envDefault: number;
}

export const BUCKET_BOUNDS: Record<RateLimitBucket, BucketBounds> = {
  user: {
    min: 500,
    max: 20000,
    envDefault: env.RATE_LIMIT_USER_MAX,
  },
  unauth: {
    min: 500,
    max: 20000,
    envDefault: env.RATE_LIMIT_UNAUTH_MAX,
  },
  auth_token: {
    min: 30,
    max: 1000,
    envDefault: env.RATE_LIMIT_AUTH_TOKEN_MAX,
  },
  auth_oauth_failed: {
    min: 100,
    max: 5000,
    envDefault: env.RATE_LIMIT_AUTH_FAILED_MAX ?? env.RATE_LIMIT_AUTH_MAX,
  },
  auth_ip_ceiling: {
    min: 1000,
    max: 50000,
    envDefault: env.RATE_LIMIT_AUTH_IP_CEILING_MAX,
  },
  attendance: {
    min: 200,
    max: 10000,
    envDefault: env.RATE_LIMIT_ATTENDANCE_MAX,
  },
};


export interface CachedBucketSetting {
  bucket: RateLimitBucket;
  maxTotal: number;
  perReplica: number;
  enabled: boolean;
  source: 'DATABASE' | 'ENV';
  min: number;
  max: number;
  envDefault: number;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export interface CachedOverride {
  id: string;
  subjectType: 'user' | 'ip';
  subject: string;
  mode: 'block' | 'allow' | 'custom_max';
  customMax: number | null;
  expiresAt: Date;
  reason: string;
  createdBy: string | null;
  createdAt: Date;
}

export class RateLimitSettingsCache {
  private settings: Map<RateLimitBucket, CachedBucketSetting> = new Map();
  private overrides: Map<string, CachedOverride> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private changeListener: (() => void) | null = null;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const replicas = Math.max(1, env.RATE_LIMIT_REPLICAS);
    for (const bucket of RATE_LIMIT_BUCKETS) {
      const bounds = BUCKET_BOUNDS[bucket];
      this.settings.set(bucket, {
        bucket,
        maxTotal: bounds.envDefault,
        perReplica: Math.ceil(bounds.envDefault / replicas),
        enabled: true,
        source: 'ENV',
        min: bounds.min,
        max: bounds.max,
        envDefault: bounds.envDefault,
        updatedBy: null,
        updatedAt: null,
      });
    }
  }

  public resetToDefaults(): void {
    this.seedDefaults();
    this.overrides.clear();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Initial load from DB
    await this.reload();

    // Listen on pg_notify via pgListener
    try {
      await pgListener.listen('rate_limit_changed');
    } catch (err) {
      console.error('[RateLimitSettingsCache] Failed to register pgListener for rate_limit_changed:', err);
    }

    this.changeListener = () => {
      this.reload().catch((err) => {
        console.error('[RateLimitSettingsCache] Error reloading after rate_limit_changed notification:', err);
      });
    };
    sseEventBus.on('rate_limit_changed', this.changeListener);

    // 60-second fallback poll
    this.pollInterval = setInterval(() => {
      this.reload().catch((err) => {
        console.error('[RateLimitSettingsCache] Error during 60s fallback poll:', err);
      });
    }, 60_000);
    this.pollInterval.unref();
  }

  public async reload(): Promise<void> {
    const replicas = Math.max(1, env.RATE_LIMIT_REPLICAS);

    // 1. Reload bucket settings via SECURITY DEFINER function
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          bucket: string;
          max_total: number;
          enabled: boolean;
          updated_by: string | null;
          updated_at: Date;
        }>
      >`SELECT bucket, max_total, enabled, updated_by, updated_at FROM get_rate_limit_settings()`;

      const dbMap = new Map(rows.map((r) => [r.bucket, r]));

      for (const bucket of RATE_LIMIT_BUCKETS) {
        const bounds = BUCKET_BOUNDS[bucket];
        const dbRow = dbMap.get(bucket);

        if (dbRow) {
          this.settings.set(bucket, {
            bucket,
            maxTotal: dbRow.max_total,
            perReplica: Math.ceil(dbRow.max_total / replicas),
            enabled: dbRow.enabled,
            source: 'DATABASE',
            min: bounds.min,
            max: bounds.max,
            envDefault: bounds.envDefault,
            updatedBy: dbRow.updated_by,
            updatedAt: new Date(dbRow.updated_at),
          });
        } else {
          // Revert to env default if row was deleted / not present
          this.settings.set(bucket, {
            bucket,
            maxTotal: bounds.envDefault,
            perReplica: Math.ceil(bounds.envDefault / replicas),
            enabled: true,
            source: 'ENV',
            min: bounds.min,
            max: bounds.max,
            envDefault: bounds.envDefault,
            updatedBy: null,
            updatedAt: null,
          });
        }
      }
    } catch (err) {
      // KEEP LAST GOOD VALUES on DB error
      console.warn('[RateLimitSettingsCache] Failed to load rate_limit_settings from DB, retaining last good values:', err);
    }

    // 2. Reload active overrides via SECURITY DEFINER function
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          subject_type: string;
          subject: string;
          mode: string;
          custom_max: number | null;
          expires_at: Date;
          reason: string;
          created_by: string | null;
          created_at: Date;
        }>
      >`SELECT id, subject_type, subject, mode, custom_max, expires_at, reason, created_by, created_at FROM get_active_rate_limit_overrides()`;

      const newOverrides = new Map<string, CachedOverride>();
      for (const row of rows) {
        const expiresAt = new Date(row.expires_at);
        if (expiresAt.getTime() > Date.now()) {
          const key = `${row.subject_type}:${row.subject}`;
          newOverrides.set(key, {
            id: row.id,
            subjectType: row.subject_type as 'user' | 'ip',
            subject: row.subject,
            mode: row.mode as 'block' | 'allow' | 'custom_max',
            customMax: row.custom_max,
            expiresAt,
            reason: row.reason,
            createdBy: row.created_by,
            createdAt: new Date(row.created_at),
          });
        }
      }
      this.overrides = newOverrides;
    } catch (err) {
      console.warn('[RateLimitSettingsCache] Failed to load rate_limit_overrides from DB, retaining last good values:', err);
    }
  }

  public getBucketSetting(bucket: RateLimitBucket): CachedBucketSetting {
    const setting = this.settings.get(bucket);
    if (setting) return setting;
    const bounds = BUCKET_BOUNDS[bucket];
    const replicas = Math.max(1, env.RATE_LIMIT_REPLICAS);
    return {
      bucket,
      maxTotal: bounds.envDefault,
      perReplica: Math.ceil(bounds.envDefault / replicas),
      enabled: true,
      source: 'ENV',
      min: bounds.min,
      max: bounds.max,
      envDefault: bounds.envDefault,
      updatedBy: null,
      updatedAt: null,
    };
  }

  public getAllBucketSettings(): CachedBucketSetting[] {
    return RATE_LIMIT_BUCKETS.map((b) => this.getBucketSetting(b));
  }

  public getActiveOverride(subjectType: 'user' | 'ip', subject: string): CachedOverride | null {
    const key = `${subjectType}:${subject}`;
    const override = this.overrides.get(key);
    if (!override) return null;
    if (override.expiresAt.getTime() <= Date.now()) {
      this.overrides.delete(key);
      return null;
    }
    return override;
  }

  public getAllActiveOverrides(): CachedOverride[] {
    const now = Date.now();
    const result: CachedOverride[] = [];
    for (const [key, ov] of this.overrides.entries()) {
      if (ov.expiresAt.getTime() > now) {
        result.push(ov);
      } else {
        this.overrides.delete(key);
      }
    }
    return result;
  }

  /**
   * Resolves effective per-replica quota for an incoming request.
   * Checks subject overrides first (user ID, then client IP).
   */
  public resolveQuota(
    bucket: RateLimitBucket,
    subject?: { userId?: string | null; ip?: string | null }
  ): {
    max: number;
    skip: boolean;
    mode: 'normal' | 'allow' | 'block' | 'custom_max';
    reason?: string;
  } {
    const setting = this.getBucketSetting(bucket);
    if (!setting.enabled) {
      return { max: Number.MAX_SAFE_INTEGER, skip: true, mode: 'allow' };
    }

    const replicas = Math.max(1, env.RATE_LIMIT_REPLICAS);

    // 1. Check user override
    if (subject?.userId) {
      const userOverride = this.getActiveOverride('user', subject.userId);
      if (userOverride) {
        if (userOverride.mode === 'allow') {
          return { max: Number.MAX_SAFE_INTEGER, skip: true, mode: 'allow', reason: userOverride.reason };
        }
        if (userOverride.mode === 'block') {
          return { max: 0, skip: false, mode: 'block', reason: userOverride.reason };
        }
        if (userOverride.mode === 'custom_max' && userOverride.customMax !== null) {
          return {
            max: Math.ceil(userOverride.customMax / replicas),
            skip: false,
            mode: 'custom_max',
            reason: userOverride.reason,
          };
        }
      }
    }

    // 2. Check IP override
    if (subject?.ip) {
      const ipOverride = this.getActiveOverride('ip', subject.ip);
      if (ipOverride) {
        if (ipOverride.mode === 'allow') {
          return { max: Number.MAX_SAFE_INTEGER, skip: true, mode: 'allow', reason: ipOverride.reason };
        }
        if (ipOverride.mode === 'block') {
          return { max: 0, skip: false, mode: 'block', reason: ipOverride.reason };
        }
        if (ipOverride.mode === 'custom_max' && ipOverride.customMax !== null) {
          return {
            max: Math.ceil(ipOverride.customMax / replicas),
            skip: false,
            mode: 'custom_max',
            reason: ipOverride.reason,
          };
        }
      }
    }

    // 3. Fall back to bucket setting
    return {
      max: setting.perReplica,
      skip: false,
      mode: 'normal',
    };
  }

  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.changeListener) {
      sseEventBus.off('rate_limit_changed', this.changeListener);
      this.changeListener = null;
    }
    this.isInitialized = false;
  }
}

export const rateLimitSettingsCache = new RateLimitSettingsCache();
