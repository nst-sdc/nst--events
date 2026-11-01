import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  listAuthEventsSchema,
  getAuthStatsSchema,
} from './auth-analytics.schema';
import { adminAuthAnalyticsService } from './auth-analytics.service';

export const adminAuthAnalyticsRouter: Router = Router();

// GET /v1/admin/auth-events
adminAuthAnalyticsRouter.get(
  '/auth-events',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  validate(listAuthEventsSchema),
  async (req, res, next) => {
    try {
      const adminId = req.user!.id;
      const result = await adminAuthAnalyticsService.listAuthEvents(adminId, req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /v1/admin/auth-stats
adminAuthAnalyticsRouter.get(
  '/auth-stats',
  authenticate,
  requireRole(['PLATFORM_ADMIN']),
  validate(getAuthStatsSchema),
  async (req, res, next) => {
    try {
      const adminId = req.user!.id;
      const result = await adminAuthAnalyticsService.getAuthStats(adminId, req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
