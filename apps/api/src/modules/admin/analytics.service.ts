import { Prisma } from '@prisma/client';
import { withUserContext } from '@nst/database';
import { ForbiddenError } from '../../lib/errors';

export class AdminAnalyticsService {
  async getAnalyticsAccess(userId: string) {
    return withUserContext(userId, async (tx) => {
      const scope = await this.getScope(tx, userId);
      return scope;
    });
  }

  private async getScope(tx: any, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { globalRole: true },
    });

    if (!user) {
      throw new ForbiddenError('User not found');
    }

    if (['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
      return { scope: 'GLOBAL' as const };
    }

    const memberships = await tx.clubMembership.findMany({
      where: {
        userId,
        role: 'CLUB_ADMIN',
        deletedAt: null,
      },
      select: { clubId: true },
    });

    if (memberships.length > 0) {
      return { scope: 'CLUB' as const, clubIds: memberships.map((m: any) => m.clubId) };
    }

    throw new ForbiddenError('Insufficient role for analytics access');
  }

  async getOverviewAnalytics(userId: string) {
    return withUserContext(userId, async (tx) => {
      const access = await this.getScope(tx, userId);
      const isGlobal = access.scope === 'GLOBAL';
      // Fallback to empty array if clubIds is undefined (e.g., GLOBAL scope)
      const clubIds = access.scope === 'CLUB' && access.clubIds ? access.clubIds : [];

      const eventFilter = isGlobal
        ? { deletedAt: null }
        : { deletedAt: null, eventClubs: { some: { clubId: { in: clubIds } } } };

      const total_events = await tx.event.count({ where: eventFilter });

      const regFilter = isGlobal
        ? { deletedAt: null }
        : { deletedAt: null, event: { eventClubs: { some: { clubId: { in: clubIds } } }, deletedAt: null } };

      const total_registrations = await tx.eventRegistration.count({ where: regFilter });

      const attFilter: any = isGlobal
        ? { status: 'PRESENT' }
        : { status: 'PRESENT', session: { event: { eventClubs: { some: { clubId: { in: clubIds } } } } } };

      const total_attendance = await tx.attendanceRecord.count({ where: attFilter });

      const attendance_rate = total_registrations > 0
        ? Math.round((total_attendance / total_registrations) * 100)
        : 0;

      const active_clubs = isGlobal
        ? await tx.club.count({ where: { status: 'ACTIVE', deletedAt: null } })
        : await tx.club.count({ where: { id: { in: clubIds }, status: 'ACTIVE', deletedAt: null } });

      return {
        total_events,
        total_registrations,
        attendance_rate,
        active_clubs,
      };
    });
  }

  async getAttendanceAnalytics(userId: string, dateRange: { start: string; end: string }) {
    return withUserContext(userId, async (tx) => {
      const access = await this.getScope(tx, userId);
      const isGlobal = access.scope === 'GLOBAL';
      const clubIds = access.scope === 'CLUB' && access.clubIds ? access.clubIds : [];

      const attemptFilter: any = {
        attemptedAt: {
          gte: new Date(dateRange.start),
          lte: new Date(dateRange.end),
        },
      };

      if (!isGlobal) {
        attemptFilter.session = {
          event: {
            eventClubs: { some: { clubId: { in: clubIds } } }
          }
        };
      }

      const attempts = await tx.attendanceAttempt.findMany({
        where: attemptFilter,
        select: { attemptedAt: true, isSuccess: true },
        orderBy: { attemptedAt: 'asc' }
      });

      const failureBreakdownRaw = await tx.attendanceAttempt.groupBy({
        by: ['failureReason'],
        where: { ...attemptFilter, isSuccess: false },
        _count: { id: true },
      });

      const failure_breakdown = failureBreakdownRaw.map((f: any) => ({
        reason: f.failureReason || 'UNKNOWN',
        count: f._count.id,
      }));

      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);

      let timeSeriesRaw: any[];
      if (isGlobal) {
        timeSeriesRaw = await tx.$queryRaw`
          SELECT DATE_TRUNC('day', "attempted_at") as date,
                 SUM(CASE WHEN "is_success" = true THEN 1 ELSE 0 END)::int as success,
                 SUM(CASE WHEN "is_success" = false THEN 1 ELSE 0 END)::int as fail
          FROM attendance_attempts
          WHERE "attempted_at" >= ${startDate} AND "attempted_at" <= ${endDate}
          GROUP BY DATE_TRUNC('day', "attempted_at")
          ORDER BY date ASC
        `;
      } else {
        timeSeriesRaw = await tx.$queryRaw`
          SELECT DATE_TRUNC('day', aa."attempted_at") as date,
                 SUM(CASE WHEN aa."is_success" = true THEN 1 ELSE 0 END)::int as success,
                 SUM(CASE WHEN aa."is_success" = false THEN 1 ELSE 0 END)::int as fail
          FROM attendance_attempts aa
          JOIN attendance_sessions sess ON sess.id = aa."session_id"
          JOIN event_clubs ec ON ec."event_id" = sess."event_id"
          WHERE aa."attempted_at" >= ${startDate} AND aa."attempted_at" <= ${endDate}
            AND ec."club_id"::text IN (${Prisma.join(clubIds)})
          GROUP BY DATE_TRUNC('day', aa."attempted_at")
          ORDER BY date ASC
        `;
      }

      const time_series = timeSeriesRaw.map(row => ({
        date: row.date.toISOString().split('T')[0],
        success: Number(row.success),
        fail: Number(row.fail)
      }));

      return {
        time_series,
        failure_breakdown,
      };
    });
  }

  async getEventAnalytics(userId: string) {
    return withUserContext(userId, async (tx) => {
      const access = await this.getScope(tx, userId);
      const isGlobal = access.scope === 'GLOBAL';
      const clubIds = access.scope === 'CLUB' && access.clubIds ? access.clubIds : [];

      const filter = isGlobal
        ? { deletedAt: null }
        : { deletedAt: null, eventClubs: { some: { clubId: { in: clubIds } } } };

      const eventsRaw = await tx.event.findMany({
        where: filter,
        select: { id: true, title: true, state: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      const pipeline_counts: Record<string, number> = {
        DRAFT: 0,
        PENDING_APPROVAL: 0,
        PUBLISHED: 0,
        LOCKED: 0,
        ARCHIVED: 0,
      };

      for (const e of eventsRaw) {
        if (pipeline_counts[e.state] !== undefined) {
          pipeline_counts[e.state]++;
        } else {
          pipeline_counts[e.state] = 1;
        }
      }

      return {
        pipeline_counts,
        recent_events: eventsRaw.slice(0, 50),
      };
    });
  }

  async getRegistrationAnalytics(userId: string, dateRange: { start: string; end: string }) {
    return withUserContext(userId, async (tx) => {
      const access = await this.getScope(tx, userId);
      const isGlobal = access.scope === 'GLOBAL';
      const clubIds = access.scope === 'CLUB' && access.clubIds ? access.clubIds : [];

      const filter: any = {
        registeredAt: {
          gte: new Date(dateRange.start),
          lte: new Date(dateRange.end),
        },
        deletedAt: null,
      };

      if (!isGlobal) {
        filter.event = { eventClubs: { some: { clubId: { in: clubIds } } } };
      }

      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);

      let timeSeriesRaw: any[];
      if (isGlobal) {
        timeSeriesRaw = await tx.$queryRaw`
          SELECT DATE_TRUNC('day', "registered_at") as date, COUNT(*)::int as count
          FROM event_registrations
          WHERE "registered_at" >= ${startDate} AND "registered_at" <= ${endDate}
            AND "deleted_at" IS NULL
          GROUP BY DATE_TRUNC('day', "registered_at")
          ORDER BY date ASC
        `;
      } else {
        timeSeriesRaw = await tx.$queryRaw`
          SELECT DATE_TRUNC('day', r."registered_at") as date, COUNT(*)::int as count
          FROM event_registrations r
          JOIN event_clubs ec ON ec."event_id" = r."event_id"
          WHERE r."registered_at" >= ${startDate} AND r."registered_at" <= ${endDate}
            AND r."deleted_at" IS NULL
            AND ec."club_id"::text IN (${Prisma.join(clubIds)})
          GROUP BY DATE_TRUNC('day', r."registered_at")
          ORDER BY date ASC
        `;
      }

      const time_series = timeSeriesRaw.map(row => ({
        date: row.date.toISOString().split('T')[0],
        count: Number(row.count)
      }));

      return {
        time_series,
      };
    });
  }

  async getClubsAnalytics(userId: string) {
    return withUserContext(userId, async (tx) => {
      const access = await this.getScope(tx, userId);
      const isGlobal = access.scope === 'GLOBAL';
      const clubIds = access.scope === 'CLUB' && access.clubIds ? access.clubIds : [];

      const clubFilter = isGlobal ? { deletedAt: null } : { id: { in: clubIds }, deletedAt: null };

      const clubsRaw = await tx.club.findMany({
        where: clubFilter,
        select: {
          id: true,
          name: true,
          _count: {
            select: { eventClubs: true, memberships: { where: { deletedAt: null } } }
          }
        },
        orderBy: { eventClubs: { _count: 'desc' } },
        take: 20
      });

      const clubs = clubsRaw.map((c: any) => ({
        id: c.id,
        name: c.name,
        events_count: c._count.eventClubs,
        members_count: c._count.memberships
      }));

      return { clubs };
    });
  }

  async getDisputeAnalytics(userId: string) {
    return withUserContext(userId, async (tx) => {
      const access = await this.getScope(tx, userId);
      const isGlobal = access.scope === 'GLOBAL';
      const clubIds = access.scope === 'CLUB' && access.clubIds ? access.clubIds : [];

      const filter: any = {};
      if (!isGlobal) {
        filter.session = { event: { eventClubs: { some: { clubId: { in: clubIds } } } } };
      }

      const disputeBreakdownRaw = await tx.attendanceDispute.groupBy({
        by: ['status'],
        where: filter,
        _count: { id: true },
      });

      const breakdown = disputeBreakdownRaw.map((d: any) => ({
        status: d.status,
        count: d._count.id,
      }));

      return { breakdown };
    });
  }

  async getUsersAnalytics(userId: string) {
    return withUserContext(userId, async (tx) => {
      const access = await this.getScope(tx, userId);
      if (access.scope !== 'GLOBAL') {
        throw new ForbiddenError('Users analytics is restricted to global admins');
      }

      const roleBreakdownRaw = await tx.user.groupBy({
        by: ['globalRole'],
        where: { deletedAt: null },
        _count: { id: true }
      });

      const role_breakdown = roleBreakdownRaw.map((r: any) => ({
        role: r.globalRole,
        count: r._count.id
      }));

      return { role_breakdown };
    });
  }

  async getLeaderboardAnalytics(userId: string) {
    return withUserContext(userId, async (tx) => {
      const access = await this.getScope(tx, userId);
      if (access.scope !== 'GLOBAL') {
        throw new ForbiddenError('Leaderboard analytics is restricted to global admins');
      }

      const reasonBreakdownRaw = await tx.leaderboardScore.groupBy({
        by: ['reason'],
        _count: { id: true },
        _sum: { points: true }
      });

      const reason_breakdown = reasonBreakdownRaw.map((r: any) => ({
        reason: r.reason,
        count: r._count.id,
        total_points: r._sum.points || 0
      }));

      return { reason_breakdown };
    });
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
