import { z } from 'zod';
import {
  EventState,
  EventType,
  EventVisibility,
  RegistrationMode,
  RegistrationType,
  AttendanceType,
  EventAudience,
  FieldType,
} from '@nst/database';

const EventBodySchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(5000).optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  registration_start_time: z.string().datetime().optional(),
  registration_end_time: z.string().datetime().optional(),
  location_name: z.string().max(255).optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  event_type: z.nativeEnum(EventType),
  visibility: z.nativeEnum(EventVisibility).optional().nullable(),
  slug: z.string().min(3).max(100).optional(),
  registration_mode: z.nativeEnum(RegistrationMode).default('REQUIRED'),
  registration_type: z.nativeEnum(RegistrationType).default('INDIVIDUAL'),
  attendance_type: z.nativeEnum(AttendanceType).default('SINGLE'),
  audience: z.nativeEnum(EventAudience).default('ALL_STUDENTS'),
  audience_batch_ids: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).default({}),
  /** Maximum capacity limit. For INDIVIDUAL events: registered students. For TEAM events: registered teams. NULL/omitted: unlimited. */
  max_capacity: z.number().int().positive().nullable().optional(),
  /** Maximum participants limit for TEAM events: total registered participants across all teams. NULL/omitted: unlimited. */
  max_participants: z.number().int().positive().nullable().optional(),

  club_ids: z
    .array(
      z.object({
        club_id: z.string().uuid(),
        is_primary: z.boolean(),
      })
    )
    .min(1),
});

const validateEventBody = (data: z.infer<typeof EventBodySchema> | Partial<z.infer<typeof EventBodySchema>>, ctx: z.RefinementCtx) => {
  let eventStart: number | undefined;
  let eventEnd: number | undefined;
  let regStart: number | undefined;
  let regEnd: number | undefined;

  if (data.start_time) eventStart = new Date(data.start_time).getTime();
  if (data.end_time) eventEnd = new Date(data.end_time).getTime();
  if (data.registration_start_time) regStart = new Date(data.registration_start_time).getTime();
  if (data.registration_end_time) regEnd = new Date(data.registration_end_time).getTime();

  if (eventStart !== undefined && eventEnd !== undefined && eventStart >= eventEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'start_time must be before end_time', path: ['end_time'] });
  }

  if (regStart !== undefined && regEnd !== undefined && regStart >= regEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'registration_start_time must be before registration_end_time', path: ['registration_start_time'] });
  }

  if (regStart !== undefined && eventEnd !== undefined && regStart >= eventEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'registration_start_time must be before event end_time', path: ['registration_start_time'] });
  }

  if (regEnd !== undefined && eventEnd !== undefined && regEnd > eventEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'registration_end_time must be less than or equal to event end_time', path: ['registration_end_time'] });
  }

  if (data.audience === 'SPECIFIC_BATCHES' && (!data.audience_batch_ids || data.audience_batch_ids.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'audience_batch_ids is required when audience is SPECIFIC_BATCHES',
      path: ['audience_batch_ids']
    });
  }

  if (data.registration_type === 'TEAM') {
    const min = data.metadata?.minimum_team_size;
    const max = data.metadata?.maximum_team_size;
    
    if (typeof min !== 'number' || !Number.isInteger(min) || min < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'metadata.minimum_team_size must be an integer >= 1 for TEAM events',
        path: ['metadata', 'minimum_team_size']
      });
    }
    
    if (typeof max !== 'number' || !Number.isInteger(max) || (typeof min === 'number' && max < min)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'metadata.maximum_team_size must be an integer >= minimum_team_size',
        path: ['metadata', 'maximum_team_size']
      });
    }
  } else if (data.registration_type === 'INDIVIDUAL') {
    if (data.metadata?.minimum_team_size !== undefined || data.metadata?.maximum_team_size !== undefined) {
       ctx.addIssue({
         code: z.ZodIssueCode.custom,
         message: 'team rules must not be present in metadata for INDIVIDUAL events',
         path: ['metadata']
       });
    }
    if (data.max_participants !== undefined && data.max_participants !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'max_participants is only configurable for TEAM events',
        path: ['max_participants']
      });
    }
  }
};

export const CreateEventSchema = z.object({
  body: EventBodySchema.superRefine(validateEventBody).superRefine((data, ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(data.start_time).getTime() < today.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'start_time cannot be in the past (before today)',
        path: ['start_time']
      });
    }
    if (data.registration_start_time && new Date(data.registration_start_time).getTime() < today.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'registration_start_time cannot be in the past (before today)',
        path: ['registration_start_time']
      });
    }
  }),
});

export const UpdateEventSchema = z.object({
  body: EventBodySchema.omit({ club_ids: true }).partial(),
});

export const ListEventsQuerySchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.enum(['start_time', 'created_at']).default('start_time'),
    order: z.enum(['asc', 'desc']).default('asc'),
    filter_state: z.nativeEnum(EventState).optional(),
    filter_event_type: z.nativeEnum(EventType).optional(),
    filter_club_id: z.string().uuid().optional(),
    filter_visibility: z.nativeEnum(EventVisibility).optional(),
    q: z.string().max(255).optional(),
  }),
});

export const RejectEventSchema = z.object({
  body: z.object({
    rejection_reason: z.string().min(10).max(1000),
  }),
});

export const CancelEventSchema = z.object({
  body: z.object({
    reason: z.string().min(5).max(1000),
  }),
});

export type CancelEventInput = z.infer<typeof CancelEventSchema>['body'];

const SessionBodySchema = z.object({
  title: z.string().min(3).max(255),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  open_at: z.string().datetime(),
  close_at: z.string().datetime(),
  geofence_radius: z.number().positive().default(50),
  venue_latitude: z.number().min(-90).max(90).optional(),
  venue_longitude: z.number().min(-180).max(180).optional(),
  location_accuracy: z.number().min(0).optional(),
});

export const CreateSessionSchema = z.object({
  body: SessionBodySchema.superRefine((data, ctx) => {
    const start = new Date(data.start_time).getTime();
    const end = new Date(data.end_time).getTime();
    const open = new Date(data.open_at).getTime();
    const close = new Date(data.close_at).getTime();

    if (start >= end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'start_time must be before end_time', path: ['end_time'] });
    }
    if (open >= close) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'open_at must be before close_at', path: ['close_at'] });
    }
  }),
});

export const UpdateSessionSchema = z.object({
  body: SessionBodySchema.partial(),
});

export interface EventClubInput {
  club_id: string;
  is_primary: boolean;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  registration_start_time?: string;
  registration_end_time?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  event_type: EventType;
  visibility?: EventVisibility | null;
  slug?: string;
  registration_mode?: RegistrationMode;
  registration_type?: RegistrationType;
  attendance_type?: AttendanceType;
  audience?: EventAudience;
  audience_batch_ids?: string[];
  metadata?: Record<string, unknown>;
  max_capacity?: number | null;
  max_participants?: number | null;
  club_ids: EventClubInput[];
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'club_ids'>>;
export type ListEventsQuery = z.infer<typeof ListEventsQuerySchema>['query'];
export type RejectEventInput = z.infer<typeof RejectEventSchema>['body'];
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>['body'];
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>['body'];

export const InlineFieldDefinitionSchema = z.object({
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
        definition: InlineFieldDefinitionSchema.optional(),
        isRequired: z.boolean().default(true),
        order: z.number().int().min(0),
      }).refine((f) => !!f.fieldDefinitionId || !!f.definition, {
        message: 'Each field must have either a fieldDefinitionId or an inline definition',
      })
    ),
  }),
});

export type UpdateEventFormFieldsInput = z.infer<typeof UpdateEventFormFieldsSchema>['body'];

export type EventLockState = 'UNLOCKED' | 'MANUALLY_LOCKED' | 'PERMANENTLY_LOCKED';

export const PublicEventsQuerySchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['start_time', 'created_at']).default('start_time'),
    order: z.enum(['asc', 'desc']).default('asc'),
    time_filter: z.enum(['upcoming', 'past']).default('upcoming'),
    filter_event_type: z.nativeEnum(EventType).optional(),
    filter_club_id: z.string().uuid().optional(),
    q: z.string().max(255).optional(),
  }).passthrough(),
});

export const ValidateSlugQuerySchema = z.object({
  query: z.object({
    slug: z.string().min(1).max(100),
    event_id: z.string().uuid().optional(),
  }).passthrough(),
});

export const SlugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1).max(255),
  }).passthrough(),
});

export type PublicEventsQuery = z.infer<typeof PublicEventsQuerySchema>['query'];

