import { z } from 'zod';

export const MAX_POLICY_CONTENT_BYTES = 100 * 1024; // 100 KiB (102,400 bytes)

export const PolicyContentSchema = z.string().refine(
  (val) => Buffer.byteLength(val, 'utf8') <= MAX_POLICY_CONTENT_BYTES,
  {
    message: `Policy content exceeds ${MAX_POLICY_CONTENT_BYTES} bytes (100 KiB) limit`,
  }
);

export const GetPolicyParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase alphanumeric characters and hyphens').max(64),
});

export const UpdatePolicySchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(128, 'Title cannot exceed 128 characters').optional(),
  content: PolicyContentSchema,
  action: z.enum(['SAVE_DRAFT', 'PUBLISH']),
  base_concurrency_revision: z.number().int().min(1, 'Base concurrency revision must be a positive integer'),
});

export type UpdatePolicyInput = z.infer<typeof UpdatePolicySchema>;
