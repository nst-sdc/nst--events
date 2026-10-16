import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { projectsService } from './projects.service';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ChangeSlugSchema,
  QueryProjectsSchema,
  InviteContributorSchema,
  RespondContributorSchema,
  SubmitReportSchema,
} from './projects.schema';
import { z } from 'zod';

const ParamIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const ParamSlugSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});

const QueryProjectsWrapper = z.object({
  query: QueryProjectsSchema,
});

const CreateProjectWrapper = z.object({
  body: CreateProjectSchema,
});

const UpdateProjectWrapper = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: UpdateProjectSchema,
});

const ChangeSlugWrapper = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: ChangeSlugSchema,
});

const PublishWrapper = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    rightsConfirmed: z.boolean().default(true),
  }),
});

const InviteContributorWrapper = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: InviteContributorSchema,
});

const RespondContributorWrapper = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: RespondContributorSchema,
});

const SubmitReportWrapper = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: SubmitReportSchema,
});

export const projectsRouter: Router = Router();

// ==========================================
// Public Project Routes
// ==========================================

// 1. GET /v1/projects — Public discovery query
projectsRouter.get(
  '/',
  validate(QueryProjectsWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.listPublicProjects(req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 2. GET /v1/projects/categories — Controlled category list
projectsRouter.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await projectsService.getCategories();
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// 3. GET /v1/projects/my — Authenticated student's own projects
projectsRouter.get(
  '/my',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.listMyProjects(req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 4. GET /v1/projects/:slug — Public project detail (with redirect detection and optional auth)
projectsRouter.get(
  '/:slug',
  optionalAuthenticate,
  validate(ParamSlugSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.getPublicProjectBySlug(req.params.slug, req.user?.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Authenticated Student CRUD & Lifecycle
// ==========================================

// 5. POST /v1/projects — Create project (draft or publish)
projectsRouter.post(
  '/',
  authenticate,
  validate(CreateProjectWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectsService.createProject(req.user!.id, req.body);
      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  }
);

// 6. PUT & PATCH /v1/projects/:id — Update project
const handleUpdateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check admin status for override permission
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { globalRole: true },
    });
    const isAdmin = user?.globalRole === 'PLATFORM_ADMIN' || user?.globalRole === 'FACULTY_ADMIN';

    const updated = await projectsService.updateProject(req.user!.id, req.params.id, req.body, isAdmin);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

projectsRouter.put(
  '/:id',
  authenticate,
  validate(UpdateProjectWrapper),
  handleUpdateProject
);

projectsRouter.patch(
  '/:id',
  authenticate,
  validate(UpdateProjectWrapper),
  handleUpdateProject
);

// 7. POST /v1/projects/:id/publish — Publish project
projectsRouter.post(
  '/:id/publish',
  authenticate,
  validate(PublishWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { globalRole: true },
      });
      const isAdmin = user?.globalRole === 'PLATFORM_ADMIN' || user?.globalRole === 'FACULTY_ADMIN';

      const published = await projectsService.publishProject(
        req.user!.id,
        req.params.id,
        req.body.rightsConfirmed,
        isAdmin
      );
      res.json(published);
    } catch (err) {
      next(err);
    }
  }
);

// 8. POST /v1/projects/:id/unpublish — Unpublish project
projectsRouter.post(
  '/:id/unpublish',
  authenticate,
  validate(ParamIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { globalRole: true },
      });
      const isAdmin = user?.globalRole === 'PLATFORM_ADMIN' || user?.globalRole === 'FACULTY_ADMIN';

      const unpublished = await projectsService.unpublishProject(req.user!.id, req.params.id, isAdmin);
      res.json(unpublished);
    } catch (err) {
      next(err);
    }
  }
);

// 9. DELETE /v1/projects/:id — Delete project
projectsRouter.delete(
  '/:id',
  authenticate,
  validate(ParamIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { globalRole: true },
      });
      const isAdmin = user?.globalRole === 'PLATFORM_ADMIN' || user?.globalRole === 'FACULTY_ADMIN';

      const deleted = await projectsService.deleteProject(req.user!.id, req.params.id, isAdmin);
      res.json(deleted);
    } catch (err) {
      next(err);
    }
  }
);

// 10. POST /v1/projects/:id/slug — Explicit slug update
projectsRouter.post(
  '/:id/slug',
  authenticate,
  validate(ChangeSlugWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { globalRole: true },
      });
      const isAdmin = user?.globalRole === 'PLATFORM_ADMIN' || user?.globalRole === 'FACULTY_ADMIN';

      const updated = await projectsService.changeSlug(
        req.user!.id,
        req.params.id,
        req.body.slug,
        isAdmin
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Likes (Verified Students Only)
// ==========================================

// 11. POST /v1/projects/:id/like — Like a project
projectsRouter.post(
  '/:id/like',
  authenticate,
  validate(ParamIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.likeProject(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 12. DELETE /v1/projects/:id/like — Unlike a project
projectsRouter.delete(
  '/:id/like',
  authenticate,
  validate(ParamIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.unlikeProject(req.user!.id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Contributors
// ==========================================

// 13. POST /v1/projects/:id/contributors — Invite a collaborator
projectsRouter.post(
  '/:id/contributors',
  authenticate,
  validate(InviteContributorWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.inviteContributor(
        req.user!.id,
        req.params.id,
        req.body.email,
        req.body.role
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 14. POST /v1/projects/contributors/:id/respond — Respond to invitation
projectsRouter.post(
  '/contributors/:id/respond',
  authenticate,
  validate(RespondContributorWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.respondToContributor(
        req.user!.id,
        req.params.id,
        req.body.status
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Abuse Reporting (Public & Authenticated)
// ==========================================

// 15. POST /v1/projects/:id/report — Submit project report
projectsRouter.post(
  '/:id/report',
  optionalAuthenticate,
  validate(SubmitReportWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectsService.reportProject(
        req.user?.id || null,
        req.params.id,
        req.body
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);
