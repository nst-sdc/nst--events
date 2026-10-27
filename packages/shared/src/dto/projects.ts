/**
 * Canonical Project Portfolio Data Transfer Objects (DTOs)
 * Sourced directly from backend ground truth:
 * - apps/api/src/modules/projects/projects.service.ts
 * - docs/frontend/shared/DATA_CONTRACT.md
 */

export interface ProjectAuthor {
  name: string;
  avatar_url: string | null;
  slug?: string | null;
}

export interface ProjectLinkItem {
  id?: string;
  type: 'DEMO' | 'REPOSITORY' | 'VIDEO' | 'DOCUMENTATION' | 'OTHER';
  url: string;
  label?: string | null;
  order?: number;
}

export interface ProjectContributorItem {
  id: string;
  role: string;
  name: string;
  avatar_url: string | null;
  slug?: string | null;
  status?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  email?: string | null;
  invited_email?: string | null;
  user_id?: string | null;
  created_at?: string;
}

export interface ProjectCardItem {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  category: string;
  tags: string[];
  project_type: string;
  development_status: string;
  cover_image_url: string;
  like_count: number;
  view_count: number;
  published_at: string | null;
  author: ProjectAuthor;
  links?: ProjectLinkItem[];
}

export interface ProjectDetail {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  problem_statement?: string | null;
  solution?: string | null;
  implementation_details?: string | null;
  personal_contribution?: string | null;
  whats_next?: string | null;
  category: string;
  tags: string[];
  project_type: string;
  development_status: string;
  visibility?: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'REMOVED';
  published_at: string | null;
  cover_image_url: string;
  gallery_image_urls?: string[];
  like_count: number;
  view_count: number;
  has_liked?: boolean;
  is_owner?: boolean;
  owner_id?: string;
  author: ProjectAuthor;
  links: ProjectLinkItem[];
  contributors: ProjectContributorItem[];
  redirect?: boolean;
  canonical_slug?: string;
}

export interface ProjectsResponse {
  data: ProjectCardItem[];
  pagination: {
    next_cursor?: string | null;
    has_more: boolean;
  };
}
