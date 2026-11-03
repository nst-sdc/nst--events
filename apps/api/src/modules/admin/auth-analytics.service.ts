import { Prisma, withUserContext } from '@nst/database';
import { ListAuthEventsQuery, GetAuthStatsQuery } from './auth-analytics.schema';

export const adminAuthAnalyticsService = {
  async listAuthEvents(adminUserId: string, query: ListAuthEventsQuery) {
    return withUserContext(adminUserId, async (tx) => {
      const {
        cursor,
        limit,
        event_type,
        platform,
        user_id,
        network_class,
        start_date,
        end_date,
      } = query;

      const where: Prisma.AuthEventWhereInput = {};

      if (event_type) where.eventType = event_type;
      if (platform) where.platform = platform;
      if (user_id) where.userId = user_id;
      if (network_class) where.networkClass = network_class;

      const minRetentionDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      if (start_date || end_date) {
        where.createdAt = {};
        if (start_date) {
          const parsedStart = new Date(start_date);
          where.createdAt.gte = parsedStart < minRetentionDate ? minRetentionDate : parsedStart;
        }
        if (end_date) where.createdAt.lte = new Date(end_date);
      }

      const items = await tx.authEvent.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });

      let nextCursor: string | null = null;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'AUTH_DATA_VIEWED',
          entityType: 'AuthEvent',
          entityId: adminUserId,
          newState: {
            filters: {
              event_type,
              platform,
              user_id,
              network_class,
              start_date,
              end_date,
            },
            result_count: items.length,
          },
        },
      });

      return {
        data: items.map((item) => ({
          id: item.id,
          user_id: item.userId,
          user: item.user
            ? {
                id: item.user.id,
                email: item.user.email,
                full_name: item.user.fullName,
              }
            : null,
          event_type: item.eventType,
          platform: item.platform,
          app_version: item.appVersion,
          user_agent_family: item.userAgentFamily,
          device_class: item.deviceClass,
          ip_hash: item.ipHash,
          raw_ip: item.rawIp,
          network_class: item.networkClass,
          failure_reason: item.failureReason,
          created_at: item.createdAt.toISOString(),
        })),
        pagination: {
          next_cursor: nextCursor,
        },
      };
    });
  },

  async getAuthStats(adminUserId: string, query: GetAuthStatsQuery) {
    return withUserContext(adminUserId, async (tx) => {
      const now = new Date();
      const minRetentionDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      let startDate = query.start_date ? new Date(query.start_date) : defaultStart;
      if (startDate < minRetentionDate) {
        startDate = minRetentionDate;
      }
      const endDate = query.end_date ? new Date(query.end_date) : now;
      const granularity = query.granularity === 'hour' ? 'hour' : 'day';

      // 1. Overall stats & DAU / WAU
      const summaryRows = await tx.$queryRaw<
        Array<{
          total_success: number;
          total_failed: number;
          dau: number;
          wau: number;
        }>
      >`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'LOGIN_SUCCESS')::int as total_success,
          COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED')::int as total_failed,
          COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'LOGIN_SUCCESS' AND user_id IS NOT NULL AND created_at >= (now() - interval '24 hours'))::int as dau,
          COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'LOGIN_SUCCESS' AND user_id IS NOT NULL AND created_at >= (now() - interval '7 days'))::int as wau
        FROM auth_events
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
      `;

      const summary = summaryRows[0] || {
        total_success: 0,
        total_failed: 0,
        dau: 0,
        wau: 0,
      };

      const totalAttempts = summary.total_success + summary.total_failed;
      const failureRate =
        totalAttempts > 0
          ? Number(((summary.total_failed / totalAttempts) * 100).toFixed(2))
          : 0;

      // 2. Time series (hourly or daily)
      // Note: date_trunc requires a string literal, safe from enum validation
      const timeSeriesRows = await tx.$queryRaw<
        Array<{
          bucket: Date;
          success_count: number;
          failure_count: number;
        }>
      >(
        granularity === 'hour'
          ? Prisma.sql`
              SELECT
                date_trunc('hour', created_at) as bucket,
                COUNT(*) FILTER (WHERE event_type = 'LOGIN_SUCCESS')::int as success_count,
                COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED')::int as failure_count
              FROM auth_events
              WHERE created_at >= ${startDate} AND created_at <= ${endDate}
              GROUP BY bucket
              ORDER BY bucket ASC
            `
          : Prisma.sql`
              SELECT
                date_trunc('day', created_at) as bucket,
                COUNT(*) FILTER (WHERE event_type = 'LOGIN_SUCCESS')::int as success_count,
                COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED')::int as failure_count
              FROM auth_events
              WHERE created_at >= ${startDate} AND created_at <= ${endDate}
              GROUP BY bucket
              ORDER BY bucket ASC
            `
      );

      // 3. Platform breakdown
      const platformRows = await tx.$queryRaw<Array<{ platform: string; count: number }>>`
        SELECT platform, COUNT(*)::int as count
        FROM auth_events
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY platform
      `;

      // 4. Network class breakdown
      const networkRows = await tx.$queryRaw<Array<{ network_class: string; count: number }>>`
        SELECT network_class, COUNT(*)::int as count
        FROM auth_events
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY network_class
      `;

      // 5. Top failure reasons
      const failureReasonRows = await tx.$queryRaw<Array<{ failure_reason: string; count: number }>>`
        SELECT failure_reason, COUNT(*)::int as count
        FROM auth_events
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
          AND failure_reason IS NOT NULL
        GROUP BY failure_reason
        ORDER BY count DESC
        LIMIT 10
      `;

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          action: 'AUTH_DATA_VIEWED',
          entityType: 'AuthStats',
          entityId: adminUserId,
          newState: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            granularity,
          },
        },
      });

      return {
        summary: {
          total_success: summary.total_success,
          total_failed: summary.total_failed,
          total_attempts: totalAttempts,
          failure_rate: failureRate,
          dau: summary.dau,
          wau: summary.wau,
        },
        time_series: timeSeriesRows.map((r) => ({
          timestamp: r.bucket.toISOString(),
          success_count: r.success_count,
          failure_count: r.failure_count,
        })),
        platform_breakdown: platformRows.reduce<Record<string, number>>((acc, row) => {
          acc[row.platform] = row.count;
          return acc;
        }, {}),
        network_breakdown: networkRows.reduce<Record<string, number>>((acc, row) => {
          acc[row.network_class] = row.count;
          return acc;
        }, {}),
        top_failure_reasons: failureReasonRows.map((r) => ({
          reason: r.failure_reason,
          count: r.count,
        })),
      };
    });
  },
};
