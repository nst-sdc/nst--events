import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { studentsService } from './students.service';
import {
  QueryDirectorySchema,
  UpdateProfileSchema,
  UpdateVisibilitySchema,
  CurateItemSchema,
  ChangeHandleSchema,
} from './students.schema';
import { z } from 'zod';

const ParamSlugSchema = z.object({
  params: z.object({
    slug: z.string().min(1),
  }),
});

const QueryDirectoryWrapper = z.object({
  query: QueryDirectorySchema,
});

const UpdateProfileWrapper = z.object({
  body: UpdateProfileSchema,
});

const UpdateVisibilityWrapper = z.object({
  body: UpdateVisibilitySchema,
});

const CurateItemWrapper = z.object({
  body: CurateItemSchema,
});

const ChangeHandleWrapper = z.object({
  body: ChangeHandleSchema,
});

export const studentsRouter: Router = Router();

// ==========================================
// Public Directory & Profile Routes
// ==========================================

// 1. GET /v1/students — Public student directory listing & search
studentsRouter.get(
  '/',
  validate(QueryDirectoryWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await studentsService.listDirectory(req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Authenticated Student Operations
// (Must be mounted before /:slug so /me doesn't collide with slug)
// ==========================================

// 2. GET /v1/students/me/profile — Retrieve own profile, visibility settings, and curation options
studentsRouter.get(
  '/me/profile',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await studentsService.getMyProfile(req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 3. PATCH /v1/students/me/profile — Update headline, bio, skills, interests, external links
studentsRouter.patch(
  '/me/profile',
  authenticate,
  validate(UpdateProfileWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await studentsService.updateMyProfile(req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 4. PATCH /v1/students/me/visibility — Update section visibility toggles & directory listing preference
studentsRouter.patch(
  '/me/visibility',
  authenticate,
  validate(UpdateVisibilityWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await studentsService.updateMyVisibility(req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 5. POST /v1/students/me/curation — Curate individual item (featured flag, visibility, display order)
studentsRouter.post(
  '/me/curation',
  authenticate,
  validate(CurateItemWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await studentsService.curateItem(req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 6. POST /v1/students/me/handle — Change public handle (slug) with history recording
studentsRouter.post(
  '/me/handle',
  authenticate,
  validate(ChangeHandleWrapper),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await studentsService.changeHandle(req.user!.id, req.body.slug);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// 7. GET /v1/students/:slug — Public student profile projection by slug
studentsRouter.get(
  '/:slug',
  validate(ParamSlugSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await studentsService.getPublicProfileBySlug(req.params.slug);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
