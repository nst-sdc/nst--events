import { apiClient, API_BASE_URL } from './api';

export interface PublicProfileProject {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  category: string;
  tags: string[];
  cover_image_url: string;
  role: string;
  is_owner: boolean;
  published_at: string | null;
  featured: boolean;
  display_order: number;
}

export interface PublicProfileAchievement {
  id: string;
  award_name: string;
  placement: string | null;
  tier: string | null;
  certificate_url: string | null;
  awarded_at: string;
  event: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface PublicProfileClub {
  id: string;
  club_id: string;
  club_name: string;
  role: string;
  joined_at: string;
}

export interface PublicStudentProfile {
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
  interests: string[];
  externalLinks: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
    other?: string;
  };
  projects: PublicProfileProject[];
  achievements: PublicProfileAchievement[];
  clubs: PublicProfileClub[];
  isMinimal: boolean;
  redirect?: boolean;
  canonical_slug?: string;
}

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

    return res.json();
  },

  /**
   * Authenticated student editable profile & settings
   */
  async getMyProfile(): Promise<EditableProfileData> {
    return apiClient<EditableProfileData>('/v1/students/me/profile');
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
    return apiClient<EditableProfileData>('/v1/students/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
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
    return apiClient('/v1/students/me/curation', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Change public handle/slug
   */
  async changeHandle(handle: string): Promise<{ message: string; slug: string }> {
    return apiClient('/v1/students/me/handle', {
      method: 'POST',
      body: JSON.stringify({ handle }),
    });
  },
};
