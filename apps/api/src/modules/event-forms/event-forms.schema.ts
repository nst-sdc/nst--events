import { z } from 'zod';
import { FieldType } from '@nst/database';

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
    isPublished: z.boolean().optional(),
  }),
});

export const InlineFormDefinitionSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  fieldType: z.nativeEnum(FieldType),
  options: z.array(z.string()).optional(),
  isReusable: z.boolean().default(true),
});

export const UpdateEventFormFieldsSchema = z.object({
  body: z.object({
    fields: z.array(
      z.object({
        fieldDefinitionId: z.string().uuid().optional(),
        definition: InlineFormDefinitionSchema.optional(),
        isRequired: z.boolean().default(true),
        order: z.number().int().nonnegative(),
      }).refine((f) => !!f.fieldDefinitionId || !!f.definition, {
        message: 'Each field must have either a fieldDefinitionId or an inline definition',
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
