import { apiClient, API_BASE_URL } from './api';

import {
  PublicProfileProject,
  PublicProfileAchievement,
  PublicProfileClub,
  PublicStudentProfile,
  normalizePublicStudentProfile,
} from '@nst/shared';

export type {
  PublicProfileProject,
  PublicProfileAchievement,
  PublicProfileClub,
  PublicStudentProfile,
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

interface RawProjectItem {
  id?: string;
  title?: string;
  slug?: string;
  tagline?: string;
  category?: string;
  tags?: string[];
  cover_image_url?: string;
  coverImageUrl?: string;
  role?: string;
  is_owner?: boolean;
  isOwner?: boolean;
  published_at?: string | null;
  publishedAt?: string | null;
  is_featured?: boolean;
  isFeatured?: boolean;
  featured?: boolean;
  display_order?: number;
  displayOrder?: number;
  visibility?: string;
}

interface RawAchievementItem {
  id?: string;
  award_title?: string;
  awardTitle?: string;
  award_name?: string;
  awardName?: string;
  placement?: string | number | null;
  award_type?: string | null;
  awardType?: string | null;
  tier?: string | null;
  certificate_url?: string | null;
  certificateUrl?: string | null;
  published_at?: string;
  publishedAt?: string;
  awarded_at?: string;
  awardedAt?: string;
  status?: string;
  event_title?: string;
  event_visibility?: string;
  event?: {
    id?: string;
    title?: string;
    slug?: string;
    visibility?: string;
  };
}

interface RawClubItem {
  id?: string;
  club_id?: string;
  club_name?: string;
  clubName?: string;
  name?: string;
  role?: string;
  joined_at?: string;
  joinedAt?: string;
}

interface RawCuratedItem {
  id?: string;
  item_type?: string;
  itemType?: string;
  source_id?: string;
  sourceRecordId?: string;
  display_order?: number;
  displayOrder?: number;
  is_featured?: boolean;
  featured?: boolean;
  is_visible?: boolean;
  hidden?: boolean;
}

interface RawMyProfileResponse {
  user?: {
    id?: string;
    fullName?: string;
    full_name?: string;
    email?: string;
    avatarUrl?: string | null;
    avatar_url?: string | null;
    headline?: string | null;
    bio?: string | null;
    batch?: string | null;
    program?: string | null;
    campus?: string | null;
    skills?: string[];
    interests?: string[];
    academic_profile?: {
      batch?: {
        graduation_year?: number | string;
        program?: {
          name?: string;
        };
      };
    } | null;
    externalLinks?: Record<string, string>;
  };
  profile?: {
    id?: string;
    slug?: string;
    headline?: string | null;
    bio?: string | null;
    skills?: string[];
    interests?: string[];
    directoryListed?: boolean;
    directory_listed?: boolean;
    section_visibility?: Partial<SectionVisibility>;
    sectionVisibility?: Partial<SectionVisibility>;
    external_links?: Array<{ type?: string; url?: string }>;
    externalLinks?: Array<{ type?: string; url?: string }> | Record<string, string>;
  };
  curated_items?: RawCuratedItem[];
  curatedItems?: RawCuratedItem[];
  source_options?: {
    projects?: RawProjectItem[];
    achievements?: RawAchievementItem[];
    clubs?: RawClubItem[];
  };
  availableProjects?: RawProjectItem[];
  availableAchievements?: RawAchievementItem[];
  availableClubs?: RawClubItem[];
}

export const studentsApi = {
  /**
   * Public directory search & filter
   */
  async getDirectory(query: {
    search?: string;
    program?: string;
    batch?: string;
    skill?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<StudentDirectoryResponse> {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.program) params.set('program', query.program);
    if (query.batch) params.set('batch', query.batch);
    if (query.skill) params.set('skill', query.skill);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));

    const res = await fetch(`${API_BASE_URL}/v1/students?${params.toString()}`, {
      next: { revalidate: 30 },
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch student directory: ${res.statusText}`);
    }

    return res.json();
  },

  /**
   * Public student profile by slug
   */
  async getPublicProfile(slug: string): Promise<PublicStudentProfile> {
    const res = await fetch(`${API_BASE_URL}/v1/students/${encodeURIComponent(slug)}`, {
      next: { revalidate: 15 },
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'web',
      },
    });

    if (res.status === 404) {
      throw new Error('NOT_FOUND');
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch student profile: ${res.statusText}`);
    }

    const raw = await res.json();
    return normalizePublicStudentProfile(raw);
  },

  /**
   * Authenticated student editable profile & settings
   */
  async getMyProfile(): Promise<EditableProfileData> {
    const raw = await apiClient<RawMyProfileResponse>('/v1/students/me/profile');
    if (!raw) {
      return {
        user: {
          id: '',
          fullName: '',
          email: '',
          avatarUrl: null,
          headline: null,
          bio: null,
          batch: null,
          program: null,
          campus: null,
          skills: [],
          interests: [],
          externalLinks: {},
        },
        profile: {
          id: '',
          slug: '',
          directoryListed: true,
          sectionVisibility: {
            identity: true,
            avatar: true,
            academic: true,
            bio: true,
            skills: true,
            links: true,
            projects: true,
            achievements: true,
            clubs: true,
          },
        },
        curatedItems: [],
        availableProjects: [],
        availableAchievements: [],
        availableClubs: [],
      };
    }

    let externalLinks: Record<string, string> = {};
    const rawLinks = raw.profile?.external_links || raw.profile?.externalLinks || raw.user?.externalLinks;
    if (Array.isArray(rawLinks)) {
      for (const item of rawLinks) {
        if (item && item.type && item.url) {
          externalLinks[item.type] = item.url;
        }
      }
    } else if (rawLinks && typeof rawLinks === 'object') {
      externalLinks = { ...rawLinks };
    }

    const defaultVisibility: SectionVisibility = {
      identity: true,
      avatar: true,
      academic: true,
      bio: true,
      skills: true,
      links: true,
      projects: true,
      achievements: true,
      clubs: true,
    };

    const sectionVisibility = {
      ...defaultVisibility,
      ...(raw.profile?.section_visibility || raw.profile?.sectionVisibility || {}),
    };

    const curatedItems: CuratedItem[] = (raw.curated_items || raw.curatedItems || []).map((ci) => ({
      id: ci.id || '',
      itemType: (ci.item_type || ci.itemType || 'PROJECT') as 'PROJECT' | 'ACHIEVEMENT' | 'CLUB',
      sourceRecordId: ci.source_id || ci.sourceRecordId || '',
      displayOrder: ci.display_order ?? ci.displayOrder ?? 0,
      featured: ci.is_featured ?? ci.featured ?? false,
      hidden: ci.is_visible !== undefined ? !ci.is_visible : (ci.hidden ?? false),
    }));

    const availableProjects = (raw.source_options?.projects || raw.availableProjects || []).map((p) => ({
      id: p.id || '',
      title: p.title || '',
      slug: p.slug || '',
      tagline: p.tagline || '',
      category: p.category || 'PROJECT',
      tags: p.tags || [],
      cover_image_url: p.cover_image_url || '',
      role: p.role || 'CREATOR',
      is_owner: p.is_owner ?? true,
      visibility: p.visibility || 'PUBLISHED',
    }));

    const availableAchievements = (raw.source_options?.achievements || raw.availableAchievements || []).map((a) => ({
      id: a.id || '',
      award_name: a.award_title || a.award_name || '',
      placement: a.placement ? String(a.placement) : null,
      tier: a.award_type || a.tier || null,
      awarded_at: a.published_at || a.awarded_at || new Date().toISOString(),
      status: a.status || 'VERIFIED',
      event: {
        id: a.event?.id || a.id || '',
        title: a.event_title || a.event?.title || '',
        slug: a.event?.slug || '',
        visibility: a.event_visibility || a.event?.visibility || 'PUBLIC',
      },
    }));

    const availableClubs = (raw.source_options?.clubs || raw.availableClubs || []).map((c) => ({
      id: c.club_id || c.id || '',
      club_id: c.club_id || c.id || '',
      club_name: c.club_name || c.name || '',
      role: c.role || 'MEMBER',
      joined_at: c.joined_at || new Date().toISOString(),
    }));

    return {
      user: {
        id: raw.user?.id || '',
        fullName: raw.user?.full_name || raw.user?.fullName || '',
        email: raw.user?.email || '',
        avatarUrl: raw.user?.avatar_url || raw.user?.avatarUrl || null,
        headline: raw.profile?.headline || raw.user?.headline || null,
        bio: raw.profile?.bio || raw.user?.bio || null,
        batch: raw.user?.academic_profile?.batch?.graduation_year
          ? String(raw.user.academic_profile.batch.graduation_year)
          : (raw.user?.batch || null),
        program: raw.user?.academic_profile?.batch?.program?.name || raw.user?.program || null,
        campus: raw.user?.campus || null,
        skills: raw.profile?.skills || raw.user?.skills || [],
        interests: raw.profile?.interests || raw.user?.interests || [],
        externalLinks,
      },
      profile: {
        id: raw.profile?.id || '',
        slug: raw.profile?.slug || '',
        directoryListed: raw.profile?.directory_listed ?? raw.profile?.directoryListed ?? true,
        sectionVisibility,
      },
      curatedItems,
      availableProjects,
      availableAchievements,
      availableClubs,
    };
  },

  /**
   * Update student content (headline, bio, skills, interests, links)
   */
  async updateMyProfile(payload: {
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
  }): Promise<EditableProfileData> {
    const backendPayload: Record<string, unknown> = { ...payload };
    if (payload.externalLinks) {
      const extLinksList: Array<{ type: string; url: string }> = [];
      for (const [key, val] of Object.entries(payload.externalLinks)) {
        if (val && typeof val === 'string' && val.trim()) {
          extLinksList.push({ type: key, url: val.trim() });
        }
      }
      backendPayload.external_links = extLinksList;
    }
    return apiClient<EditableProfileData>('/v1/students/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(backendPayload),
    });
  },

  /**
   * Update section visibility and directory listing toggle
   */
  async updateMyVisibility(payload: {
    section_visibility?: Partial<SectionVisibility>;
    directory_listed?: boolean;
  }): Promise<{ message: string; section_visibility: SectionVisibility; directory_listed: boolean }> {
    return apiClient('/v1/students/me/visibility', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Curate an item (featured, hidden, display order)
   */
  async curateItem(payload: {
    item_type: 'PROJECT' | 'ACHIEVEMENT' | 'CLUB' | 'LINK';
    source_record_id: string;
    hidden?: boolean;
    featured?: boolean;
    display_order?: number;
  }): Promise<{ message: string; curated_item: CuratedItem }> {
    const body = {
      item_type: payload.item_type,
      source_id: payload.source_record_id,
      source_record_id: payload.source_record_id,
      is_visible: payload.hidden !== undefined ? !payload.hidden : true,
      is_featured: payload.featured !== undefined ? payload.featured : false,
      featured: payload.featured !== undefined ? payload.featured : false,
      hidden: payload.hidden,
      display_order: payload.display_order ?? 0,
    };
    return apiClient('/v1/students/me/curation', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * Change public handle/slug
   */
  async changeHandle(handle: string): Promise<{ message: string; slug: string }> {
    return apiClient('/v1/students/me/handle', {
      method: 'POST',
      body: JSON.stringify({ slug: handle, handle }),
    });
  },
};
