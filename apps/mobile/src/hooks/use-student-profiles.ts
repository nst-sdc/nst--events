import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

import {
  PublicProfileProject,
  PublicProfileAchievement,
  PublicProfileClub,
  PublicStudentProfile,
  PublicStudentProfileTransportDto,
  PublicStudentProfileRedirectTransportDto,
  normalizePublicStudentProfile,
} from '@nst/shared';

export type {
  PublicProfileProject,
  PublicProfileAchievement,
  PublicProfileClub,
  PublicStudentProfile,
  PublicStudentProfileTransportDto,
  PublicStudentProfileRedirectTransportDto,
};
export { normalizePublicStudentProfile };

export interface PublicStudentCard {
  id: string;
  fullName: string;
  slug: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  batch: string | null;
  program: string | null;
  campus: string | null;
  skills: string[];
  projectsCount: number;
  achievementsCount: number;
}

export interface StudentDirectoryResponse {
  items: PublicStudentCard[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  facets: {
    programs: string[];
    batches: string[];
    skills: string[];
  };
}

export interface SectionVisibility {
  identity: boolean;
  avatar: boolean;
  academic: boolean;
  bio: boolean;
  skills: boolean;
  links: boolean;
  projects: boolean;
  achievements: boolean;
  clubs: boolean;
}

export interface CuratedItem {
  id: string;
  itemType: 'PROJECT' | 'ACHIEVEMENT' | 'CLUB' | 'LINK';
  sourceRecordId: string;
  displayOrder: number;
  featured: boolean;
  hidden: boolean;
}

export interface EditableProfileData {
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    headline: string | null;
    bio: string | null;
    batch: string | null;
    program: string | null;
    campus: string | null;
    skills: string[];
    interests: string[];
    externalLinks: {
      github?: string;
      linkedin?: string;
      portfolio?: string;
      other?: string;
    };
  };
  profile: {
    id: string;
    slug: string;
    directoryListed: boolean;
    sectionVisibility: SectionVisibility;
  };
  curatedItems: CuratedItem[];
  availableProjects: Array<{
    id: string;
    title: string;
    slug: string;
    tagline: string;
    category: string;
    tags: string[];
    cover_image_url: string;
    role: string;
    is_owner: boolean;
    visibility: string;
  }>;
  availableAchievements: Array<{
    id: string;
    award_name: string;
    placement: string | null;
    tier: string | null;
    awarded_at: string;
    status: string;
    event: {
      id: string;
      title: string;
      slug: string;
      visibility: string;
    };
  }>;
  availableClubs: Array<{
    id: string;
    club_id: string;
    club_name: string;
    role: string;
    joined_at: string;
  }>;
}

export function useStudentDirectory(params: {
  search?: string;
  program?: string;
  batch?: string;
  skill?: string;
  page?: number;
  limit?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.program) query.set('program', params.program);
  if (params.batch) query.set('batch', params.batch);
  if (params.skill) query.set('skill', params.skill);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  return useQuery<StudentDirectoryResponse, Error>({
    queryKey: ['student-directory', params],
    queryFn: async () => {
      const res = await apiClient(`/v1/students?${query.toString()}`);
      return res as StudentDirectoryResponse;
    },
    staleTime: 30 * 1000,
  });
}

export function usePublicStudentProfile(slug: string, enabled = true) {
  return useQuery<PublicStudentProfile, Error>({
    queryKey: ['public-student-profile', slug],
    queryFn: async () => {
      const res = await apiClient(`/v1/students/${encodeURIComponent(slug)}`);
      return normalizePublicStudentProfile(res);
    },
    enabled: enabled && !!slug,
    staleTime: 15 * 1000,
  });
}

export function useMyStudentProfile() {
  return useQuery<EditableProfileData, Error>({
    queryKey: ['my-student-profile'],
    queryFn: async () => {
      const res = await apiClient('/v1/students/me/profile');
      return res as EditableProfileData;
    },
  });
}

export function useUpdateMyVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      section_visibility?: Partial<SectionVisibility>;
      directory_listed?: boolean;
    }) => {
      const res = await apiClient('/v1/students/me/visibility', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['student-directory'] });
    },
  });
}

export function useCurateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      item_type: 'PROJECT' | 'ACHIEVEMENT' | 'CLUB' | 'LINK';
      source_record_id: string;
      hidden?: boolean;
      featured?: boolean;
      display_order?: number;
    }) => {
      const res = await apiClient('/v1/students/me/curation', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
    },
  });
}

export function useChangeHandle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (handle: string) => {
      const res = await apiClient('/v1/students/me/handle', {
        method: 'POST',
        body: JSON.stringify({ handle }),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['student-directory'] });
    },
  });
}

export function useUpdateMyProfileContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      headline?: string | null;
      bio?: string | null;
      skills?: string[];
      interests?: string[];
      externalLinks?: {
        github?: string;
        linkedin?: string;
        portfolio?: string;
        other?: string;
      };
    }) => {
      const res = await apiClient('/v1/students/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
    },
  });
}
