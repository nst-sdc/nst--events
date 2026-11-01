import { z } from 'zod';
import { RATE_LIMIT_BUCKETS, RateLimitBucket } from '../../lib/rate-limit-settings';

export const UpdateRateLimitSettingSchema = z.object({
  max_total: z.number().int({ message: 'max_total must be an integer' }),
  enabled: z.boolean().optional(),
});

export type UpdateRateLimitSettingInput = z.infer<typeof UpdateRateLimitSettingSchema>;

export const CreateRateLimitOverrideSchema = z.object({
  subject_type: z.enum(['user', 'ip'], {
    errorMap: () => ({ message: "subject_type must be 'user' or 'ip'" }),
  }),
  subject: z.string().trim().min(1, 'subject is required'),
  mode: z.enum(['block', 'allow', 'custom_max'], {
    errorMap: () => ({ message: "mode must be 'block', 'allow', or 'custom_max'" }),
  }),
  custom_max: z.number().int().positive().optional(),
  expires_at: z.string().refine((val) => !isNaN(Date.parse(val)) && new Date(val).getTime() > Date.now(), {
    message: 'expires_at must be a valid future ISO date string',
  }),
  reason: z.string().trim().min(1, 'reason is required').max(255, 'reason cannot exceed 255 characters'),
}).refine(
  (data) => {
    if (data.mode === 'custom_max') {
      return typeof data.custom_max === 'number' && data.custom_max > 0;
    }
    return true;
  },
  {
    message: "custom_max must be a positive integer when mode is 'custom_max'",
    path: ['custom_max'],
  }
);

export type CreateRateLimitOverrideInput = z.infer<typeof CreateRateLimitOverrideSchema>;
