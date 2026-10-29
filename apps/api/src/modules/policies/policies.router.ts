import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { policiesService, PolicyConflictError } from './policies.service';
import { GetPolicyParamsSchema, UpdatePolicySchema } from './policies.schema';

// ---------------------------------------------------------------------------
// 1. Public Policies Router (/v1/policies)
// ---------------------------------------------------------------------------
export const policiesRouter: Router = Router();

policiesRouter.get(
  '/:slug',
  validate(z.object({ params: GetPolicyParamsSchema })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const policy = await policiesService.getPublishedPolicy(slug);

      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=60');
      if (policy.published_at) {
        res.setHeader('x-nst-origin-timestamp', policy.published_at);
      }

      res.json(policy);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// 2. Platform Admin Policies Router (/v1/admin/policies)
// ---------------------------------------------------------------------------
export const adminPoliciesRouter: Router = Router();

// Strictly restrict admin routes to PLATFORM_ADMIN
adminPoliciesRouter.use(authenticate, requireRole(['PLATFORM_ADMIN']));

adminPoliciesRouter.get(
  '/:slug',
  validate(z.object({ params: GetPolicyParamsSchema })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const policy = await policiesService.getAdminPolicy(slug, req.user!.id);
      res.json(policy);
    } catch (error) {
      next(error);
    }
  }
);

adminPoliciesRouter.put(
  '/:slug',
  validate(z.object({ params: GetPolicyParamsSchema, body: UpdatePolicySchema })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const result = await policiesService.updatePolicy(
        { id: req.user!.id, fullName: '', email: '' },
        slug,
        req.body
      );
      res.json(result);
    } catch (error) {
      if (error instanceof PolicyConflictError) {
        res.status(409).json({
          error: 'CONCURRENT_POLICY_MODIFICATION',
          message: error.message,
          current_concurrency_revision: error.currentConcurrencyRevision,
          current_published_version: error.currentPublishedVersion,
          server_draft_content: error.serverDraftContent,
          last_modified_by: error.lastModifiedBy,
        });
        return;
      }
      next(error);
    }
  }
);
