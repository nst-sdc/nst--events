import { z } from 'zod';

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days retention window

export const listAuthEventsSchema = z.object({
  query: z
    .object({
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      event_type: z
        .enum([
          'LOGIN_SUCCESS',
          'LOGIN_FAILED',
          'REFRESH_FAILED',
          'REUSE_DETECTED',
          'LOGOUT',
          'SESSION_REVOKED',
        ])
        .optional(),
      platform: z.enum(['web', 'mobile']).optional(),
      user_id: z.string().uuid().optional(),
      network_class: z.enum(['campus', 'off_campus', 'unknown']).optional(),
      start_date: z.string().datetime().optional(),
      end_date: z.string().datetime().optional(),
    })
    .refine(
      (data) => {
        const start = data.start_date ? new Date(data.start_date).getTime() : undefined;
        const end = data.end_date ? new Date(data.end_date).getTime() : undefined;
        if (start && end) {
          return end >= start && end - start <= MAX_RANGE_MS;
        }
        if (start && !end) {
          return Date.now() - start <= MAX_RANGE_MS;
        }
        return true;
      },
      {
        message: 'Date range cannot exceed 90 days (data retention window)',
        path: ['start_date'],
      }
    ),
});

export type ListAuthEventsQuery = z.infer<typeof listAuthEventsSchema>['query'];

export const getAuthStatsSchema = z.object({
  query: z
    .object({
      start_date: z.string().datetime().optional(),
      end_date: z.string().datetime().optional(),
      granularity: z.enum(['hour', 'day']).default('day'),
    })
    .refine(
      (data) => {
        const start = data.start_date ? new Date(data.start_date).getTime() : undefined;
        const end = data.end_date ? new Date(data.end_date).getTime() : undefined;
        if (start && end) {
          return end >= start && end - start <= MAX_RANGE_MS;
        }
        if (start && !end) {
          return Date.now() - start <= MAX_RANGE_MS;
        }
        return true;
      },
      {
        message: 'Date range cannot exceed 90 days (data retention window)',
        path: ['start_date'],
      }
    ),
});

export type GetAuthStatsQuery = z.infer<typeof getAuthStatsSchema>['query'];

