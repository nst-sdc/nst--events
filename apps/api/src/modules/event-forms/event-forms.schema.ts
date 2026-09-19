import { z } from 'zod';

export const ParamEventIdSchema = z.object({
  params: z.object({
    eventId: z.string().uuid(),
  }).passthrough(),
}).passthrough();

export const ParamFormIdSchema = z.object({
  params: z.object({
    eventId: z.string().uuid(),
    formId: z.string().uuid(),
  }).passthrough(),
}).passthrough();

export const CreateEventFormSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    purpose: z.enum(['REGISTRATION', 'SUBMISSION', 'FEEDBACK', 'CUSTOM']),
    releaseAt: z.string().datetime().optional().nullable(),
    closeAt: z.string().datetime().optional().nullable(),
  }),
});

export const UpdateEventFormSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    releaseAt: z.string().datetime().optional().nullable(),
    closeAt: z.string().datetime().optional().nullable(),
  }),
});

export const UpdateEventFormFieldsSchema = z.object({
  body: z.object({
    fields: z.array(
      z.object({
        fieldDefinitionId: z.string().uuid(),
        isRequired: z.boolean().default(true),
        order: z.number().int().nonnegative(),
      })
    ),
  }),
});

export const SubmitEventFormResponsesSchema = z.object({
  body: z.object({
    responses: z.array(
      z.object({
        fieldDefinitionId: z.string().uuid(),
        value: z.string(),
      })
    ),
  }),
});
