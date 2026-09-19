import { Router, Request } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { canManageEvent } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  ParamEventIdSchema,
  ParamFormIdSchema,
  CreateEventFormSchema,
  UpdateEventFormSchema,
  UpdateEventFormFieldsSchema,
  SubmitEventFormResponsesSchema,
} from './event-forms.schema';
import * as eventFormsService from './event-forms.service';

const router = Router();

// ==========================================
// Student / Public Endpoints
// ==========================================

router.get(
  '/:eventId/forms',
  authenticate,
  validate(ParamEventIdSchema),
  async (req, res, next) => {
    try {
      const forms = await eventFormsService.listEventForms(req.user!.id, req.params.eventId);
      res.json({ data: forms });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:eventId/forms/:formId',
  authenticate,
  validate(ParamFormIdSchema),
  async (req, res, next) => {
    try {
      const form = await eventFormsService.getEventForm(
        req.user!.id,
        req.params.eventId,
        req.params.formId
      );
      res.json(form);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:eventId/forms/:formId/responses',
  authenticate,
  validate(ParamFormIdSchema),
  validate(SubmitEventFormResponsesSchema),
  async (req, res, next) => {
    try {
      const result = await eventFormsService.submitEventFormResponses(
        req.user!.id,
        req.params.eventId,
        req.params.formId,
        req.body.responses
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Admin Endpoints
// ==========================================

router.post(
  '/:eventId/forms',
  authenticate,
  validate(ParamEventIdSchema),
  canManageEvent((req: Request) => req.params.eventId),
  validate(CreateEventFormSchema),
  async (req, res, next) => {
    try {
      const form = await eventFormsService.createEventForm(
        req.user!.id,
        req.params.eventId,
        req.body
      );
      res.status(201).json(form);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:eventId/forms/:formId',
  authenticate,
  validate(ParamFormIdSchema),
  canManageEvent((req: Request) => req.params.eventId),
  validate(UpdateEventFormSchema),
  async (req, res, next) => {
    try {
      const form = await eventFormsService.updateEventForm(
        req.user!.id,
        req.params.eventId,
        req.params.formId,
        req.body
      );
      res.json(form);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:eventId/forms/:formId',
  authenticate,
  validate(ParamFormIdSchema),
  canManageEvent((req: Request) => req.params.eventId),
  async (req, res, next) => {
    try {
      await eventFormsService.deleteEventForm(
        req.user!.id,
        req.params.eventId,
        req.params.formId
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:eventId/forms/:formId/fields',
  authenticate,
  validate(ParamFormIdSchema),
  canManageEvent((req: Request) => req.params.eventId),
  validate(UpdateEventFormFieldsSchema),
  async (req, res, next) => {
    try {
      const fields = await eventFormsService.updateEventFormFields(
        req.user!.id,
        req.params.eventId,
        req.params.formId,
        req.body.fields
      );
      res.json({ data: fields });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:eventId/forms/:formId/responses',
  authenticate,
  validate(ParamFormIdSchema),
  canManageEvent((req: Request) => req.params.eventId),
  async (req, res, next) => {
    try {
      const responses = await eventFormsService.getEventFormResponses(
        req.user!.id,
        req.params.eventId,
        req.params.formId
      );
      res.json({ data: responses });
    } catch (err) {
      next(err);
    }
  }
);

export const eventFormsRouter: Router = router;
