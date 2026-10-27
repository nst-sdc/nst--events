import { z } from 'zod';
import { isValidSlug, isReservedSlug } from '../../utils/slug-utils';

export const CONTROLLED_PROJECT_CATEGORIES = [
  'AI / Machine Learning',
  'Web Development',
  'Mobile Applications',
  'Developer Tools',
  'Open Source',
  'Data Science',
  'Cybersecurity',
  'Cloud / DevOps',
  'Robotics / Hardware',
  'Research',
  'UI / UX and Design',
  'Other',
] as const;

export const PROJECT_TYPES = [
  'PERSONAL',
  'COURSEWORK',
  'HACKATHON',
  'OPEN_SOURCE',
  'RESEARCH',
  'HARDWARE',
  'DESIGN',
  'CASE_STUDY',
] as const;

export const PROJECT_STATUSES = [
  'IDEA',
  'IN_PROGRESS',
  'PROTOTYPE',
  'LIVE',
  'COMPLETED',
  'ARCHIVED',
] as const;

export const PROJECT_VISIBILITIES = [
  'DRAFT',
  'PUBLISHED',
  'UNPUBLISHED',
  'REMOVED',
] as const;

export const PROJECT_LINK_TYPES = [
  'DEMO',
  'REPOSITORY',
  'VIDEO',
  'DOCUMENTATION',
  'OTHER',
] as const;

export const REPORT_REASONS = [
  'PLAGIARISM',
  'SPAM',
  'ABUSIVE',
  'VOTE_MANIPULATION',
  'MALICIOUS_LINKS',
  'IP_PRIVACY',
  'OTHER',
] as const;

export const MODERATION_ACTION_TYPES = [
  'HIDE',
  'RESTORE',
  'REMOVE',
  'INVALIDATE_LIKES',
  'UPDATE_METADATA',
] as const;

const SafeUrlSchema = z.string().url().refine(
  (val) => /^https?:\/\//i.test(val),
  { message: 'URL must use safe http or https protocol' }
);

export const ProjectLinkInputSchema = z.object({
  type: z.enum(PROJECT_LINK_TYPES),
  url: SafeUrlSchema,
  label: z.string().max(50).optional(),
});

export const CreateProjectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(120, 'Title cannot exceed 120 characters'),
  tagline: z.string().min(5, 'Tagline must be at least 5 characters').max(160, 'Tagline cannot exceed 160 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.enum(CONTROLLED_PROJECT_CATEGORIES, {
    errorMap: () => ({ message: 'Invalid project category' }),
  }),
  tags: z.array(z.string().min(1).max(35)).max(12).default([]),
  projectType: z.enum(PROJECT_TYPES).default('PERSONAL'),
  developmentStatus: z.enum(PROJECT_STATUSES).default('IN_PROGRESS'),
  coverImageUrl: SafeUrlSchema,
  galleryImageUrls: z.array(SafeUrlSchema).max(6).default([]),
  problemStatement: z.string().max(3000).optional(),
  solution: z.string().max(3000).optional(),
  implementationDetails: z.string().max(5000).optional(),
  personalContribution: z.string().max(2000).optional(),
  whatsNext: z.string().max(2000).optional(),
  links: z.array(ProjectLinkInputSchema).default([]),
  customSlug: z.string()
    .min(3)
    .max(100)
    .refine((val) => isValidSlug(val), { message: 'Slug contains invalid characters' })
    .refine((val) => !isReservedSlug(val), { message: 'Slug is a reserved keyword' })
    .optional(),
  publishNow: z.boolean().default(false),
  rightsConfirmed: z.boolean().default(false),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  publishNow: z.boolean().optional(),
});

export const ChangeSlugSchema = z.object({
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug cannot exceed 100 characters')
    .refine((val) => isValidSlug(val), { message: 'Slug format invalid (only lowercase letters, digits, and hyphens)' })
    .refine((val) => !isReservedSlug(val), { message: 'Slug is a reserved system path' }),
});

export const QueryProjectsSchema = z.object({
  view: z.enum(['explore', 'trending', 'most_liked', 'recent']).default('explore'),
  category: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  type: z.enum(PROJECT_TYPES).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  timeRange: z.enum(['all', 'week', 'month']).default('all'),
});

export const InviteContributorSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .refine(
      (email) => {
        const lower = email.toLowerCase().trim();
        return lower.endsWith('@adypu.edu.in') || lower.endsWith('@newtonschool.co');
      },
      { message: 'Collaborator must have a verified institutional email (@adypu.edu.in or @newtonschool.co)' }
    ),
  role: z.string().min(2, 'Role must be at least 2 characters').max(60, 'Role cannot exceed 60 characters'),
});

export const RespondContributorSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED']),
});

export const SubmitReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
});

export const ModerateProjectSchema = z.object({
  action: z.enum(MODERATION_ACTION_TYPES),
  reason: z.string().min(5, 'Moderation reason must be at least 5 characters').max(1000),
  metadata: z.record(z.any()).optional(),
});

export const ResolveReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolutionNotes: z.string().max(1000).optional(),
});

export const RemoveContributorParamSchema = z.object({
  id: z.string().uuid(),
  contributorId: z.string().uuid(),
});
