import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { rateLimitsService } from './rate-limits.service';
import {
  UpdateRateLimitSettingSchema,
  CreateRateLimitOverrideSchema,
} from './rate-limits.schema';

export const adminRateLimitsRouter: Router = Router();

// Strictly restrict all rate-limit administration to PLATFORM_ADMIN
adminRateLimitsRouter.use(authenticate, requireRole(['PLATFORM_ADMIN']));

/**
 * GET /v1/admin/rate-limits
 * List all rate limit bucket configurations, defaults, and bounds
 */
adminRateLimitsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await rateLimitsService.getSettings();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /v1/admin/rate-limits/:bucket
 * Update rate limit setting for a specific bucket
 */
adminRateLimitsRouter.put(
  '/:bucket',
  validate(
    z.object({
      params: z.object({
        bucket: z.string().trim().min(1),
      }),
      body: UpdateRateLimitSettingSchema,
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bucket = req.params.bucket as string;
      const result = await rateLimitsService.updateSetting(req.user!.id, bucket, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /v1/admin/rate-limits/reset
 * Revert all rate limit buckets to environment defaults
 */
adminRateLimitsRouter.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await rateLimitsService.resetSettings(req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/admin/rate-limits/overrides
 * List all active temporary rate limit overrides
 */
adminRateLimitsRouter.get('/overrides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await rateLimitsService.getOverrides(req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/admin/rate-limits/overrides
 * Create a new temporary rate limit override (block, allow, or custom_max)
 */
adminRateLimitsRouter.post(
  '/overrides',
  validate(
    z.object({
      body: CreateRateLimitOverrideSchema,
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await rateLimitsService.createOverride(req.user!.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /v1/admin/rate-limits/overrides/:id
 * Remove a temporary rate limit override
 */
adminRateLimitsRouter.delete(
  '/overrides/:id',
  validate(
    z.object({
      params: z.object({
        id: z.string().uuid({ message: 'id must be a valid UUID' }),
      }),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await rateLimitsService.deleteOverride(req.user!.id, req.params.id as string);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
