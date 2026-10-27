/**
 * Student Public Profile Data Transfer Objects (DTOs) & Boundary Normalization
 * Sourced directly from backend ground truth:
 * - apps/api/src/modules/students/students.service.ts
 * - docs/frontend/shared/DATA_CONTRACT.md
 */

// ============================================================================
// 1. Backend Wire / Transport DTOs (Exact JSON shapes from GET /v1/students/:slug)
// ============================================================================

export interface PublicProfileAcademicTransportDto {
  program: string;
  program_code: string;
  graduation_year: number;
  admission_year?: number;
}

export interface PublicProfileExternalLinkTransportDto {
  type: string;
  label?: string;
  url: string;
}

export interface PublicProfileProjectTransportDto {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description?: string;
  cover_image_url: string;
  category: string;
  tags: string[];
  is_owner: boolean;
  is_featured: boolean;
  like_count?: number;
  view_count?: number;
  published_at: string | Date | null;
}

export interface PublicProfileAchievementTransportDto {
  id: string;
  award_title: string;
  award_type: string;
  placement: number | string | null;
  is_team_award?: boolean;
  team_name?: string | null;
  is_featured: boolean;
  published_at: string | Date;
  event: {
    id: string;
    title: string;
    slug: string | null;
    start_time: string | Date;
  };
  linked_project?: {
    id: string;
    title: string;
    slug: string;
    cover_image_url: string;
  } | null;
}

export interface PublicProfileClubTransportDto {
  club_id: string;
  club_name: string;
  role: string;
  banner_url: string | null;
  is_featured: boolean;
}

export interface PublicStudentProfileRedirectTransportDto {
  redirect: true;
  canonical_slug: string;
}

export interface PublicStudentProfileTransportDto {
  slug: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  academic: PublicProfileAcademicTransportDto | null;
  skills: string[];
  interests: string[];
  external_links: PublicProfileExternalLinkTransportDto[];
  projects: PublicProfileProjectTransportDto[];
  achievements: PublicProfileAchievementTransportDto[];
  clubs: PublicProfileClubTransportDto[];
}

// ============================================================================
// 2. Canonical UI Models (Consumed by mobile and web components)
// ============================================================================

export interface PublicProfileProject {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  category: string;
  tags: string[];
  cover_image_url: string;
  coverImageUrl?: string;
  role: string;
  is_owner: boolean;
  isOwner?: boolean;
  published_at: string | null;
  publishedAt?: string | null;
  featured: boolean;
  display_order: number;
  displayOrder?: number;
}

export interface PublicProfileAchievement {
  id: string;
  award_name: string;
  awardName?: string;
  award_title?: string;
  awardTitle?: string;
  placement: string | null;
  tier: string | null;
  certificate_url: string | null;
  certificateUrl?: string | null;
  awarded_at: string;
  awardedAt?: string;
  event: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface PublicProfileClub {
  id: string;
  club_id: string;
  clubId?: string;
  club_name: string;
  clubName?: string;
  role: string;
  joined_at: string;
  joinedAt?: string;
  banner_url?: string | null;
  bannerUrl?: string | null;
}

export interface PublicStudentProfile {
  id: string;
  fullName: string | null;
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
    [key: string]: string | undefined;
  };
  projects: PublicProfileProject[];
  achievements: PublicProfileAchievement[];
  clubs: PublicProfileClub[];
  isMinimal: boolean;
  redirect?: boolean;
  canonical_slug?: string;
}

// ============================================================================
// 3. Explicit Boundary Normalizer (Transport -> Canonical UI Model)
// ============================================================================

export function normalizePublicStudentProfile(raw: unknown): PublicStudentProfile {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      fullName: null,
      slug: '',
      avatarUrl: null,
      headline: null,
      bio: null,
      batch: null,
      program: null,
      campus: null,
      skills: [],
      interests: [],
      externalLinks: {},
      projects: [],
      achievements: [],
      clubs: [],
      isMinimal: true,
    };
  }

  const p = raw as Record<string, any>;

  // 1. Handle canonical slug redirect
  if (p.redirect === true && typeof p.canonical_slug === 'string') {
    return {
      id: p.canonical_slug,
      fullName: null,
      slug: p.canonical_slug,
      avatarUrl: null,
      headline: null,
      bio: null,
      batch: null,
      program: null,
      campus: null,
      skills: [],
      interests: [],
      externalLinks: {},
      projects: [],
      achievements: [],
      clubs: [],
      isMinimal: false,
      redirect: true,
      canonical_slug: p.canonical_slug,
    };
  }

  // 2. Identity & avatar
  const slug = typeof p.slug === 'string' ? p.slug : '';
  const id = typeof p.id === 'string' && p.id ? p.id : slug;

  let fullName: string | null = null;
  if (p.full_name !== undefined) {
    fullName = p.full_name !== null ? String(p.full_name) : null;
  } else if (p.fullName !== undefined) {
    fullName = p.fullName !== null ? String(p.fullName) : null;
  }

  let avatarUrl: string | null = null;
  if (p.avatar_url !== undefined) {
    avatarUrl = p.avatar_url !== null ? String(p.avatar_url) : null;
  } else if (p.avatarUrl !== undefined) {
    avatarUrl = p.avatarUrl !== null ? String(p.avatarUrl) : null;
  }

  const headline = p.headline !== undefined && p.headline !== null ? String(p.headline) : null;
  const bio = p.bio !== undefined && p.bio !== null ? String(p.bio) : null;

  // 3. Academic details
  let program: string | null = null;
  let batch: string | null = null;
  if (p.academic && typeof p.academic === 'object') {
    if (p.academic.program !== undefined && p.academic.program !== null) {
      program = String(p.academic.program);
    }
    if (p.academic.graduation_year !== undefined && p.academic.graduation_year !== null) {
      batch = String(p.academic.graduation_year);
    }
  }
  if (!program && p.program !== undefined && p.program !== null) {
    program = String(p.program);
  }
  if (!batch && p.batch !== undefined && p.batch !== null) {
    batch = String(p.batch);
  }

  const campus = p.campus !== undefined && p.campus !== null ? String(p.campus) : null;

  // 4. Skills & Interests
  const skills = Array.isArray(p.skills)
    ? p.skills.filter((s: unknown): s is string => typeof s === 'string')
    : [];
  const interests = Array.isArray(p.interests)
    ? p.interests.filter((i: unknown): i is string => typeof i === 'string')
    : [];

  // 5. External Links
  const externalLinks: Record<string, string> = {};
  const rawLinks = p.external_links !== undefined ? p.external_links : p.externalLinks;
  if (Array.isArray(rawLinks)) {
    for (const item of rawLinks) {
      if (!item || typeof item !== 'object') continue;
      const rawKey = String(item.type || item.label || item.platform || '').trim();
      if (rawKey && typeof item.url === 'string' && item.url.trim()) {
        const url = item.url.trim();
        externalLinks[rawKey.toLowerCase()] = url;
        externalLinks[rawKey.toUpperCase()] = url;
        externalLinks[rawKey] = url;
      }
    }
  } else if (rawLinks && typeof rawLinks === 'object') {
    for (const [key, val] of Object.entries(rawLinks)) {
      if (typeof val === 'string' && val.trim()) {
        const url = val.trim();
        externalLinks[key.toLowerCase()] = url;
        externalLinks[key.toUpperCase()] = url;
        externalLinks[key] = url;
      }
    }
  }

  // 6. Projects
  const rawProjects = Array.isArray(p.projects) ? p.projects : [];
  const projects: PublicProfileProject[] = rawProjects.map((proj: any, idx: number) => {
    const isOwner = proj.is_owner !== undefined
      ? Boolean(proj.is_owner)
      : (proj.isOwner !== undefined ? Boolean(proj.isOwner) : true);

    const publishedAt = proj.published_at !== undefined
      ? (proj.published_at ? (typeof proj.published_at === 'string' ? proj.published_at : new Date(proj.published_at).toISOString()) : null)
      : (proj.publishedAt !== undefined ? (proj.publishedAt ? String(proj.publishedAt) : null) : null);

    const isFeatured = proj.is_featured !== undefined
      ? Boolean(proj.is_featured)
      : (proj.isFeatured !== undefined ? Boolean(proj.isFeatured) : Boolean(proj.featured));

    const displayOrder = typeof proj.display_order === 'number'
      ? proj.display_order
      : (typeof proj.displayOrder === 'number' ? proj.displayOrder : idx);

    const coverImageUrl = String(proj.cover_image_url || proj.coverImageUrl || '');
    return {
      id: String(proj.id || ''),
      title: String(proj.title || ''),
      slug: String(proj.slug || ''),
      tagline: String(proj.tagline || ''),
      category: String(proj.category || 'General'),
      tags: Array.isArray(proj.tags) ? proj.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
      cover_image_url: coverImageUrl,
      coverImageUrl,
      role: String(proj.role || (isOwner ? 'Creator / Lead' : 'Contributor')),
      is_owner: isOwner,
      isOwner,
      published_at: publishedAt,
      publishedAt,
      featured: isFeatured,
      display_order: displayOrder,
      displayOrder,
    };
  });

  // 7. Achievements
  const rawAchievements = Array.isArray(p.achievements) ? p.achievements : [];
  const achievements: PublicProfileAchievement[] = rawAchievements.map((ach: any) => {
    const awardName = String(
      ach.award_title || ach.awardTitle || ach.award_name || ach.awardName || 'Official Honor'
    );

    let placement: string | null = null;
    if (ach.placement !== undefined && ach.placement !== null) {
      placement = String(ach.placement);
    }

    const tier = ach.award_type || ach.awardType || ach.tier || null;
    const certificateUrl = ach.certificate_url || ach.certificateUrl || null;
    const awardedAt = ach.published_at
      ? (typeof ach.published_at === 'string' ? ach.published_at : new Date(ach.published_at).toISOString())
      : (ach.publishedAt || ach.awarded_at || ach.awardedAt || new Date().toISOString());

    return {
      id: String(ach.id || ''),
      award_name: awardName,
      awardName,
      award_title: awardName,
      awardTitle: awardName,
      placement,
      tier: tier !== null ? String(tier) : null,
      certificate_url: certificateUrl !== null ? String(certificateUrl) : null,
      certificateUrl: certificateUrl !== null ? String(certificateUrl) : null,
      awarded_at: String(awardedAt),
      awardedAt: String(awardedAt),
      event: {
        id: String(ach.event?.id || ach.id || ''),
        title: String(ach.event?.title || 'NST Competition'),
        slug: String(ach.event?.slug || ''),
      },
    };
  });

  // 8. Clubs
  const rawClubs = Array.isArray(p.clubs) ? p.clubs : [];
  const clubs: PublicProfileClub[] = rawClubs.map((club: any) => {
    const clubId = String(club.club_id || club.clubId || club.id || '');
    const clubName = String(club.club_name || club.clubName || club.name || '');
    const joinedAt = String(club.joined_at || club.joinedAt || new Date().toISOString());
    const bannerUrl = club.banner_url || club.bannerUrl || null;
    return {
      id: clubId,
      club_id: clubId,
      clubId,
      club_name: clubName,
      clubName,
      role: String(club.role || 'Member'),
      joined_at: joinedAt,
      joinedAt,
      banner_url: bannerUrl,
      bannerUrl,
    };
  });

  // 9. Minimal state calculation
  const hasNoPublicContent =
    !fullName &&
    !avatarUrl &&
    projects.length === 0 &&
    achievements.length === 0 &&
    clubs.length === 0;

  const isMinimal = typeof p.isMinimal === 'boolean'
    ? p.isMinimal
    : (typeof p.is_minimal === 'boolean' ? p.is_minimal : hasNoPublicContent);

  return {
    id,
    fullName,
    slug,
    avatarUrl,
    headline,
    bio,
    batch,
    program,
    campus,
    skills,
    interests,
    externalLinks,
    projects,
    achievements,
    clubs,
    isMinimal,
    ...(p.redirect ? { redirect: true } : {}),
    ...(p.canonical_slug ? { canonical_slug: String(p.canonical_slug) } : {}),
  };
}
