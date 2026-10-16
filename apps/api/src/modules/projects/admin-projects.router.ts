import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { projectsService } from './projects.service';
import {
  ModerateProjectSchema,
  ResolveReportSchema,
} from './projects.schema';
import { z } from 'zod';

const QueryAdminProjectsWrapper = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    filter: z.enum(['all', 'reported', 'hidden']).default('all'),
  }),
});

const ModerateWrapper = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: ModerateProjectSchema,
});

const QueryReportsWrapper = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['PENDING', 'RESOLVED', 'DISMISSED']).optional(),
  }),
});

const ResolveReportWrapper = z.object({
  params: z.object({ reportId: z.string().uuid() }),
  body: ResolveReportSchema,
});

export const adminProjectsRouter: Router = Router();

// Enforce PLATFORM_ADMIN or FACULTY_ADMIN on all admin project routes
adminProjectsRouter.use(authenticate, requireRole(['PLATFORM_ADMIN', 'FACULTY_ADMIN']));

// 1. GET /v1/admin/projects — List projects for moderation
adminProjectsRouter.get(
  '/',
  validate(QueryAdminProjectsWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const filter = (req.query.filter as 'all' | 'reported' | 'hidden') || 'all';

      const result = await projectsService.listAdminProjects(req.user!.id, page, limit, filter);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 2. POST /v1/admin/projects/:id/moderate — Perform moderation action
adminProjectsRouter.post(
  '/:id/moderate',
  validate(ModerateWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.moderateProject(
        req.user!.id,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 3. GET /v1/admin/projects/reports — List all reports
adminProjectsRouter.get(
  '/reports',
  validate(QueryReportsWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as 'PENDING' | 'RESOLVED' | 'DISMISSED' | undefined;

      const result = await projectsService.listReports(req.user!.id, status, page, limit);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 4. POST /v1/admin/projects/reports/:reportId/resolve — Resolve a report
adminProjectsRouter.post(
  '/reports/:reportId/resolve',
  validate(ResolveReportWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.resolveReport(
        req.user!.id,
        req.params.reportId,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
