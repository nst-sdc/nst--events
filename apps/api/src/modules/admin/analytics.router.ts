import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { BadRequestError } from '../../lib/errors';
import { adminAnalyticsService } from './analytics.service';

export const adminAnalyticsRouter: Router = Router();

adminAnalyticsRouter.use(authenticate);

adminAnalyticsRouter.get(
  '/access',
  async (req, res, next) => {
    try {
      const access = await adminAnalyticsService.getAnalyticsAccess(req.user!.id);
      res.json(access);
    } catch (err) {
      next(err);
    }
  }
);

adminAnalyticsRouter.get(
  '/overview',
  async (req, res, next) => {
    try {
      const overview = await adminAnalyticsService.getOverviewAnalytics(req.user!.id);
      res.json(overview);
    } catch (err) {
      next(err);
    }
  }
);

adminAnalyticsRouter.get(
  '/attendance',
  async (req, res, next) => {
    try {
      const { start, end } = req.query as { start: string; end: string };
      if (!start || !end) {
        throw new BadRequestError('Missing start or end date');
      }
      const data = await adminAnalyticsService.getAttendanceAnalytics(req.user!.id, { start, end });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

adminAnalyticsRouter.get(
  '/events',
  async (req, res, next) => {
    try {
      const data = await adminAnalyticsService.getEventAnalytics(req.user!.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

adminAnalyticsRouter.get(
  '/registrations',
  async (req, res, next) => {
    try {
      const { start, end } = req.query as { start: string; end: string };
      if (!start || !end) {
        throw new BadRequestError('Missing start or end date');
      }
      const data = await adminAnalyticsService.getRegistrationAnalytics(req.user!.id, { start, end });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

adminAnalyticsRouter.get(
  '/clubs',
  async (req, res, next) => {
    try {
      const data = await adminAnalyticsService.getClubsAnalytics(req.user!.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

adminAnalyticsRouter.get(
  '/disputes',
  async (req, res, next) => {
    try {
      const data = await adminAnalyticsService.getDisputeAnalytics(req.user!.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

adminAnalyticsRouter.get(
  '/users',
  async (req, res, next) => {
    try {
      const data = await adminAnalyticsService.getUsersAnalytics(req.user!.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

