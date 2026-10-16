import { z } from 'zod';

export const AwardRecipientTypeEnum = z.enum(['INDIVIDUAL', 'TEAM', 'EXTERNAL']);
export const AwardTypeEnum = z.enum(['RANKED_PLACEMENT', 'SPECIAL_AWARD', 'HONORABLE_MENTION', 'CUSTOM']);
export const TieRankingTypeEnum = z.enum(['COMPETITION', 'DENSE']);
export const ResultReportStatusEnum = z.enum(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']);

export const RecipientMemberInputSchema = z.object({
  user_id: z.string().uuid().optional().nullable(),
  registration_id: z.string().uuid().optional().nullable(),
  display_name: z.string().min(1).max(200),
  avatar_url: z.string().url().optional().nullable(),
  roll_number: z.string().max(50).optional().nullable(),
  team_role: z.string().max(50).optional().nullable(),
  is_authorized_exception: z.boolean().default(false),
  exception_reason: z.string().max(500).optional().nullable(),
});

export const AwardRecipientInputSchema = z.object({
  id: z.string().uuid().optional(),
  recipient_type: AwardRecipientTypeEnum,
  user_id: z.string().uuid().optional().nullable(),
  registration_id: z.string().uuid().optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  external_name: z.string().min(1).max(200).optional().nullable(),
  external_details: z.string().max(1000).optional().nullable(),
  is_authorized_exception: z.boolean().default(false),
  exception_reason: z.string().max(500).optional().nullable(),
  members: z.array(RecipientMemberInputSchema).default([]),
});

export const AwardProjectLinkInputSchema = z.object({
  project_id: z.string().uuid().optional().nullable(),
  external_project_url: z.string().url().max(1000).optional().nullable(),
  project_title_snapshot: z.string().max(200).optional().nullable(),
});

export const AwardInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  award_type: AwardTypeEnum.default('RANKED_PLACEMENT'),
  placement: z.number().int().positive().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  prize_details: z.string().max(1000).optional().nullable(),
  display_order: z.number().int().min(0).default(0),
  is_tied: z.boolean().default(false),
  tie_ranking_type: TieRankingTypeEnum.optional().nullable(),
  recipients: z.array(AwardRecipientInputSchema).default([]),
  project_links: z.array(AwardProjectLinkInputSchema).default([]),
});

export const SaveDraftSchema = z.object({
  body: z.object({
    version: z.number().int().min(1).default(1),
    awards: z.array(AwardInputSchema).default([]),
  }),
});

export const PublishRevisionSchema = z.object({
  body: z.object({
    revision_id: z.string().uuid(),
    version: z.number().int().min(1),
    notify_winners: z.boolean().default(true),
    announce_participants: z.boolean().default(false),
  }),
});

export const CreateCorrectionDraftSchema = z.object({
  body: z.object({
    correction_reason: z.string().min(5).max(1000),
  }),
});

export const WithdrawResultsSchema = z.object({
  body: z.object({
    withdrawal_reason: z.string().min(5).max(1000),
  }),
});

export const RestoreResultsSchema = z.object({
  body: z.object({
    restoration_reason: z.string().min(5).max(1000),
  }),
});

export const SubmitReportSchema = z.object({
  body: z.object({
    reason: z.string().min(3).max(200),
    details: z.string().min(10).max(2000),
  }),
});

export const EligibleSearchQuerySchema = z.object({
  query: z.object({
    search: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});
