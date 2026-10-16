import { Router, Request } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { canManageEvent } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as resultsService from './event-results.service';
import {
  SaveDraftSchema,
  PublishRevisionSchema,
  CreateCorrectionDraftSchema,
  WithdrawResultsSchema,
  RestoreResultsSchema,
  SubmitReportSchema,
  EligibleSearchQuerySchema,
} from './event-results.schema';
import { z } from 'zod';

const router = Router();

const ParamIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }).passthrough(),
}).passthrough();

const SlugParamSchema = z.object({
  params: z.object({ slug: z.string().min(1) }).passthrough(),
}).passthrough();

// ==========================================
// Public Endpoints
// ==========================================

router.get(
  '/public/:slug/results',
  optionalAuthenticate,
  validate(SlugParamSchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.getPublicResultsBySlug(req.params.slug, req.user?.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/results/report',
  optionalAuthenticate,
  validate(ParamIdSchema),
  validate(SubmitReportSchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.submitResultReport(
        req.params.id,
        req.user?.id || null,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Student Achievements Query
// ==========================================

router.get(
  '/users/:id/achievements',
  optionalAuthenticate,
  validate(ParamIdSchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.getStudentAchievements(req.params.id, req.user?.id);
      res.json({ achievements: result });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Event Manager / Organizer Endpoints
// ==========================================

router.get(
  '/:id/results/manage',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  async (req, res, next) => {
    try {
      const result = await resultsService.getOrganizerWorkspace(req.params.id, req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/results/eligible-participants',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(EligibleSearchQuerySchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.getEligibleParticipants(
        req.params.id,
        req.user!.id,
        req.query.search as string | undefined,
        Number(req.query.limit) || 50
      );
      res.json({ participants: result });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/results/eligible-teams',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(EligibleSearchQuerySchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.getEligibleTeams(
        req.params.id,
        req.user!.id,
        req.query.search as string | undefined,
        Number(req.query.limit) || 50
      );
      res.json({ teams: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/results/draft',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(SaveDraftSchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.saveDraft(req.params.id, req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/results/publish',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(PublishRevisionSchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.publishRevision(req.params.id, req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/results/correction',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(CreateCorrectionDraftSchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.createCorrectionDraft(req.params.id, req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/results/withdraw',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(WithdrawResultsSchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.withdrawResults(
        req.params.id,
        req.user!.id,
        req.body.withdrawal_reason
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/results/restore',
  authenticate,
  validate(ParamIdSchema),
  canManageEvent((req: Request) => req.params.id),
  validate(RestoreResultsSchema),
  async (req, res, next) => {
    try {
      const result = await resultsService.restoreResults(
        req.params.id,
        req.user!.id,
        req.body.restoration_reason
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export const eventResultsRouter: Router = router;
