import { apiClient, API_BASE_URL } from './api';

import type {
  ProjectAuthor,
  ProjectLinkItem,
  ProjectContributorItem,
  ProjectCardItem,
  ProjectDetail,
} from '@nst/shared';

export type {
  ProjectAuthor,
  ProjectLinkItem,
  ProjectContributorItem,
  ProjectCardItem,
  ProjectDetail,
};

export interface ProjectCategoryItem {
  category: string;
  count: number;
}

export interface ProjectsListResponse {
  items: ProjectCardItem[];
  data?: ProjectCardItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MyProjectsResponse {
  owned: Array<ProjectDetail & {
    stats?: { reportsCount: number };
    latest_moderation?: { action: string; reason: string; createdAt: string } | null;
    contributors?: ProjectContributorItem[];
  }>;
  contributing: Array<{
    id: string;
    contributor_id?: string;
    role: string;
    status: string;
    created_at?: string;
    project: ProjectCardItem & { owner_name?: string };
  }>;
  stats: {
    total: number;
    published: number;
    drafts: number;
    unpublished: number;
    totalLikes: number;
    totalViews: number;
    likes?: number;
  };
}

export interface AdminReportItem {
  id: string;
  projectId: string;
  reporterId?: string | null;
  reason: string;
  details?: string | null;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  resolutionNotes?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    slug: string;
    visibility: string;
    owner: {
      fullName: string;
      email: string;
    };
  };
  reporter?: {
    fullName: string;
    email: string;
  } | null;
  resolvedBy?: {
    fullName: string;
  } | null;
}

export interface AdminProjectsResponse {
  items: Array<ProjectCardItem & { reportsCount: number; ownerEmail: string }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminReportsResponse {
  items: AdminReportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const projectsApi = {
  // Public Discovery
  async listPublic(query: {
    view?: 'explore' | 'trending' | 'most_liked' | 'recent';
    category?: string;
    tag?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    timeRange?: 'all' | 'week' | 'month';
  }): Promise<ProjectsListResponse> {
    const params = new URLSearchParams();
    if (query.view) params.set('view', query.view);
    if (query.category) params.set('category', query.category);
    if (query.tag) params.set('tag', query.tag);
    if (query.status) params.set('status', query.status);
    if (query.search) params.set('search', query.search);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.timeRange) params.set('timeRange', query.timeRange);

    const res = await fetch(`${API_BASE_URL}/v1/projects?${params.toString()}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error('Failed to load projects');
    return res.json();
  },

  async getCategories(): Promise<ProjectCategoryItem[]> {
    const res = await fetch(`${API_BASE_URL}/v1/projects/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  },

  async getPublicBySlug(slug: string, token?: string): Promise<ProjectDetail | null> {
    const headers: Record<string, string> = { 'X-Client-Platform': 'web' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/v1/projects/${encodeURIComponent(slug)}`, {
      headers,
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to load project details');
    return res.json();
  },

  // Student Actions
  async create(data: Record<string, unknown>): Promise<ProjectDetail> {
    return apiClient('/v1/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Record<string, unknown>): Promise<ProjectDetail> {
    return apiClient(`/v1/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async publish(id: string, rightsConfirmed = true): Promise<ProjectDetail> {
    return apiClient(`/v1/projects/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ rightsConfirmed }),
    });
  },

  async unpublish(id: string): Promise<ProjectDetail> {
    return apiClient(`/v1/projects/${id}/unpublish`, {
      method: 'POST',
    });
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return apiClient(`/v1/projects/${id}`, {
      method: 'DELETE',
    });
  },

  async changeSlug(id: string, slug: string): Promise<ProjectDetail> {
    return apiClient(`/v1/projects/${id}/slug`, {
      method: 'POST',
      body: JSON.stringify({ slug }),
    });
  },

  async like(id: string): Promise<{ liked: boolean; like_count: number }> {
    return apiClient(`/v1/projects/${id}/like`, {
      method: 'POST',
    });
  },

  async unlike(id: string): Promise<{ liked: boolean; like_count: number }> {
    return apiClient(`/v1/projects/${id}/like`, {
      method: 'DELETE',
    });
  },

  async inviteContributor(id: string, email: string, role: string) {
    return apiClient(`/v1/projects/${id}/contributors`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },

  async respondContributor(contributorId: string, status: 'ACCEPTED' | 'DECLINED') {
    return apiClient(`/v1/projects/contributors/${contributorId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async listContributors(id: string): Promise<ProjectContributorItem[]> {
    return apiClient(`/v1/projects/${id}/contributors`);
  },

  async removeContributor(id: string, contributorId: string): Promise<{ success: boolean; message: string }> {
    return apiClient(`/v1/projects/${id}/contributors/${contributorId}`, {
      method: 'DELETE',
    });
  },

  async submitReport(projectId: string, reason: string, details?: string) {
    return apiClient(`/v1/projects/${projectId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, details }),
    });
  },

  async getMyProjects(): Promise<MyProjectsResponse> {
    return apiClient('/v1/projects/my');
  },

  // Admin / Moderator Actions
  async adminListProjects(page = 1, limit = 20, filter = 'all'): Promise<AdminProjectsResponse> {
    return apiClient(`/v1/admin/projects?page=${page}&limit=${limit}&filter=${filter}`);
  },

  async adminModerateProject(id: string, action: string, reason: string) {
    return apiClient(`/v1/admin/projects/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    });
  },

  async adminListReports(page = 1, limit = 20, status?: string): Promise<AdminReportsResponse> {
    const q = status ? `&status=${status}` : '';
    return apiClient(`/v1/admin/projects/reports?page=${page}&limit=${limit}${q}`);
  },

  async adminResolveReport(reportId: string, status: 'RESOLVED' | 'DISMISSED', resolutionNotes?: string) {
    return apiClient(`/v1/admin/projects/reports/${reportId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status, resolutionNotes }),
    });
  },
};
