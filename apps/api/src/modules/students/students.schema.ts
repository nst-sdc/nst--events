import { z } from 'zod';
import { isValidSlug, isReservedSlug } from '../../utils/slug-utils';

export const EXTERNAL_LINK_TYPES = [
  'github',
  'linkedin',
  'portfolio',
  'twitter',
  'instagram',
  'youtube',
  'other',
] as const;

export const PROFILE_ITEM_TYPES = [
  'PROJECT',
  'ACHIEVEMENT',
  'CLUB',
  'LINK',
] as const;

export const QueryDirectorySchema = z.object({
  search: z.string().trim().max(100).optional(),
  program_code: z.string().trim().max(50).optional(),
  graduation_year: z.coerce.number().int().min(2000).max(2100).optional(),
  skill: z.string().trim().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ExternalLinkItemSchema = z.object({
  type: z.enum(EXTERNAL_LINK_TYPES),
  label: z.string().trim().max(50).optional(),
  url: z
    .string()
    .trim()
    .url('Must be a valid URL')
    .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
      message: 'URL must use http or https scheme',
    }),
});

export const UpdateProfileSchema = z.object({
  headline: z.string().trim().max(120, 'Headline cannot exceed 120 characters').nullable().optional(),
  bio: z.string().trim().max(1000, 'Biography cannot exceed 1000 characters').nullable().optional(),
  skills: z
    .array(z.string().trim().min(1).max(40, 'Skill cannot exceed 40 characters'))
    .max(25, 'Maximum 25 skills allowed')
    .optional(),
  interests: z
    .array(z.string().trim().min(1).max(40, 'Interest cannot exceed 40 characters'))
    .max(25, 'Maximum 25 interests allowed')
    .optional(),
  external_links: z.array(ExternalLinkItemSchema).max(10, 'Maximum 10 external links allowed').optional(),
});

export const SectionVisibilitySchema = z.object({
  identity: z.boolean().optional(),
  name: z.boolean().optional(),
  avatar: z.boolean().optional(),
  avatar_url: z.boolean().optional(),
  academic: z.boolean().optional(),
  bio: z.boolean().optional(),
  skills: z.boolean().optional(),
  links: z.boolean().optional(),
  external_links: z.boolean().optional(),
  projects: z.boolean().optional(),
  achievements: z.boolean().optional(),
  clubs: z.boolean().optional(),
});

export const UpdateVisibilitySchema = z.object({
  section_visibility: SectionVisibilitySchema.optional(),
  directory_listed: z.boolean().optional(),
});

export const CurateItemSchema = z.object({
  item_type: z.enum(PROFILE_ITEM_TYPES),
  source_id: z.string().min(1, 'Source ID is required'),
  is_visible: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  display_order: z.coerce.number().int().min(0).default(0),
});

export const ChangeHandleSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Handle must be at least 3 characters')
    .max(100, 'Handle cannot exceed 100 characters')
    .refine(isValidSlug, {
      message: 'Handle may only contain lowercase alphanumeric characters and single hyphens',
    })
    .refine((s) => !isReservedSlug(s), {
      message: 'This handle is a reserved system path and cannot be used',
    }),
});

export type QueryDirectoryInput = z.infer<typeof QueryDirectorySchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateVisibilityInput = z.infer<typeof UpdateVisibilitySchema>;
export type CurateItemInput = z.infer<typeof CurateItemSchema>;
export type ChangeHandleInput = z.infer<typeof ChangeHandleSchema>;
