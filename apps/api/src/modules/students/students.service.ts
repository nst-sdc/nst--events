import { Prisma, ProfileItemType, withUserContext } from '@nst/database';
import { prisma } from '../../lib/prisma';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../lib/errors';
import { generateSlug, isValidSlug, isReservedSlug } from '../../utils/slug-utils';
import {
  QueryDirectoryInput,
  UpdateProfileInput,
  UpdateVisibilityInput,
  CurateItemInput,
} from './students.schema';

export interface PublicStudentProfileDto {
  slug: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  academic: {
    program: string;
    program_code: string;
    graduation_year: number;
    admission_year?: number;
  } | null;
  skills: string[];
  interests: string[];
  external_links: Array<{
    type: string;
    label?: string;
    url: string;
  }>;
  projects: Array<{
    id: string;
    title: string;
    slug: string;
    tagline: string;
    description: string;
    cover_image_url: string;
    category: string;
    tags: string[];
    is_owner: boolean;
    is_featured: boolean;
    like_count: number;
    view_count: number;
    published_at: Date | null;
  }>;
  achievements: Array<{
    id: string;
    award_title: string;
    award_type: string;
    placement: number | null;
    is_team_award: boolean;
    team_name: string | null;
    is_featured: boolean;
    published_at: Date;
    event: {
      id: string;
      title: string;
      slug: string | null;
      start_time: Date;
    };
    linked_project: {
      id: string;
      title: string;
      slug: string;
      cover_image_url: string;
    } | null;
  }>;
  clubs: Array<{
    club_id: string;
    club_name: string;
    role: string;
    banner_url: string | null;
    is_featured: boolean;
  }>;
}

export class StudentsService {
  /**
   * Generates a unique handle (slug) for a student, avoiding collisions and reserved words.
   */
  async generateUniqueHandle(baseName: string, userId: string, tx: Prisma.TransactionClient = prisma): Promise<string> {
    let base = generateSlug(baseName);
    if (!base || base.length < 3) {
      base = `student-${userId.replace(/-/g, '').slice(0, 6)}`;
    }
    if (isReservedSlug(base)) {
      base = `student-${base}`;
    }

    let candidate = base;
    let counter = 1;

    while (true) {
      const isTaken = await tx.$queryRaw<Array<{ is_taken: boolean }>>`
        SELECT is_student_slug_taken(${candidate}) AS is_taken
      `;

      if (!isTaken?.[0]?.is_taken && !isReservedSlug(candidate)) {
        return candidate;
      }

      candidate = `${base}-${counter}`;
      counter += 1;
    }
  }

  /**
   * Generates a collision-resistant anonymous handle (slug) for a student.
   * Checks both active student profiles and historical slug records to prevent birthday collisions.
   */
  async generateUniqueAnonymousHandle(userId: string, tx: Prisma.TransactionClient = prisma): Promise<string> {
    const rawShort = userId.replace(/-/g, '').slice(0, 8).toLowerCase();
    const base = `student-${rawShort}`;
    let candidate = base;
    let counter = 1;

    while (true) {
      const isTaken = await tx.$queryRaw<Array<{ is_taken: boolean }>>`
        SELECT is_student_slug_taken(${candidate}) AS is_taken
      `;

      if (!isTaken?.[0]?.is_taken && !isReservedSlug(candidate)) {
        return candidate;
      }

      candidate = `${base}-${counter}`;
      counter += 1;
    }
  }

  /**
   * Resolves or provisions a stable student profile for a given user.
   */
  async getOrCreateStudentProfile(userId: string, tx: Prisma.TransactionClient = prisma) {
    const existing = await tx.studentProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const baseName = user.fullName || user.email.split('@')[0];
    const slug = await this.generateUniqueHandle(baseName, userId, tx);

    try {
      return await tx.studentProfile.create({
        data: {
          userId,
          slug,
          headline: null,
          bio: null,
          skills: [],
          interests: [],
          externalLinks: [],
          sectionVisibility: {
            identity: true,
            name: true,
            avatar: true,
            academic: true,
            bio: false,
            skills: false,
            links: false,
            external_links: false,
            projects: false,
            achievements: false,
            clubs: false,
          },
          directoryListed: true,
        },
      });
    } catch (err: any) {
      if (
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') ||
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2010' && err.meta?.code === '23505')
      ) {
        const found = await tx.studentProfile.findUnique({ where: { userId } });
        if (found) return found;

        const retrySlug = await this.generateUniqueHandle(baseName, userId, tx);
        return tx.studentProfile.create({
          data: {
            userId,
            slug: retrySlug,
            headline: null,
            bio: null,
            skills: [],
            interests: [],
            externalLinks: [],
            sectionVisibility: {
              identity: true,
              name: true,
              avatar: true,
              academic: true,
              bio: false,
              skills: false,
              links: false,
              external_links: false,
              projects: false,
              achievements: false,
              clubs: false,
            },
            directoryListed: true,
          },
        });
      }
      throw err;
    }
  }

  /**
   * Public: Fetch public student profile by slug.
   * Handles historical redirects, source-level filtering, and section visibility.
   */
  async getPublicProfileBySlug(slug: string): Promise<
    | { redirect: true; canonical_slug: string }
    | PublicStudentProfileDto
  > {
    const normalizedSlug = slug.toLowerCase().trim();

    return withUserContext(null, async (tx) => {
      // 1. Check historical slug table for redirect via security definer function
      const redirectRows = await tx.$queryRaw<Array<{ canonical_slug: string }>>`
        SELECT canonical_slug FROM lookup_student_slug_redirect(${normalizedSlug})
      `;

      if (redirectRows.length > 0 && redirectRows[0].canonical_slug && redirectRows[0].canonical_slug !== normalizedSlug) {
        return {
          redirect: true,
          canonical_slug: redirectRows[0].canonical_slug,
        };
      }

      // 2. Lookup active student profile by current slug via security definer function (supports unlisted profiles with SQL-level masking)
      const profiles = await tx.$queryRaw<Array<{
        profile_id: string;
        user_id: string;
        slug: string;
        headline: string | null;
        bio: string | null;
        skills: string[];
        interests: string[];
        external_links: any;
        section_visibility: any;
        directory_listed: boolean;
        settings_version: number;
        created_at: Date;
        updated_at: Date;
        full_name: string | null;
        avatar_url: string | null;
        graduation_year: number | null;
        batch_id: string | null;
        program_name: string | null;
        program_code: string | null;
        admission_year: number | null;
      }>>`
        SELECT * FROM lookup_public_student_profile_by_slug(${normalizedSlug})
        LIMIT 1
      `;

      if (!profiles || profiles.length === 0) {
        throw new NotFoundError('Student profile not found');
      }

      const profile = profiles[0];
      const userId = profile.user_id;
      const secVisibility = (profile.section_visibility as Record<string, boolean>) || {};

      // 3. Fetch curated items for this student
      const curatedItems = await tx.studentProfileCuratedItem.findMany({
        where: { userId },
      });

      const curationMap = new Map<string, { isVisible: boolean; isFeatured: boolean; displayOrder: number }>();
      for (const item of curatedItems) {
        curationMap.set(`${item.itemType}:${item.sourceId}`, {
          isVisible: item.isVisible,
          isFeatured: item.isFeatured,
          displayOrder: item.displayOrder,
        });
      }

      // 4. Fetch eligible Projects (User is owner OR accepted contributor, PUBLISHED, non-deleted)
      const [ownedProjects, contributedProjects] = await Promise.all([
        tx.project.findMany({
          where: {
            ownerId: userId,
            visibility: 'PUBLISHED',
            deletedAt: null,
          },
        }),
        tx.projectContributor.findMany({
          where: {
            userId,
            status: 'ACCEPTED',
            project: {
              visibility: 'PUBLISHED',
              deletedAt: null,
            },
          },
          include: {
            project: true,
          },
        }),
      ]);

      const projectsList: PublicStudentProfileDto['projects'] = [];
      const seenProjectIds = new Set<string>();

      for (const p of ownedProjects) {
        seenProjectIds.add(p.id);
        const curation = curationMap.get(`PROJECT:${p.id}`);
        // If curated and explicitly hidden, exclude
        if (curation && !curation.isVisible) continue;

        projectsList.push({
          id: p.id,
          title: p.title,
          slug: p.slug,
          tagline: p.tagline,
          description: p.description,
          cover_image_url: p.coverImageUrl,
          category: p.category,
          tags: p.tags,
          is_owner: true,
          is_featured: curation?.isFeatured || false,
          like_count: p.likeCount,
          view_count: p.viewCount,
          published_at: p.publishedAt,
        });
      }

      for (const cp of contributedProjects) {
        const p = cp.project;
        if (seenProjectIds.has(p.id)) continue;
        seenProjectIds.add(p.id);

        const curation = curationMap.get(`PROJECT:${p.id}`);
        if (curation && !curation.isVisible) continue;

        projectsList.push({
          id: p.id,
          title: p.title,
          slug: p.slug,
          tagline: p.tagline,
          description: p.description,
          cover_image_url: p.coverImageUrl,
          category: p.category,
          tags: p.tags,
          is_owner: false,
          is_featured: curation?.isFeatured || false,
          like_count: p.likeCount,
          view_count: p.viewCount,
          published_at: p.publishedAt,
        });
      }

      // Sort projects: featured first, then display_order, then published_at DESC
      projectsList.sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        const orderA = curationMap.get(`PROJECT:${a.id}`)?.displayOrder ?? 0;
        const orderB = curationMap.get(`PROJECT:${b.id}`)?.displayOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        const timeA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const timeB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return timeB - timeA;
      });

      // 5. Fetch eligible Achievements (active, non-restricted, non-unlisted, event PUBLISHED)
      const rawAchievements = await tx.studentAchievement.findMany({
        where: {
          userId,
          isActive: true,
          event: {
            state: 'PUBLISHED',
            visibility: 'PUBLIC', // Strictly PUBLIC only! Restricted & Unlisted must not leak
            deletedAt: null,
          },
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              startTime: true,
            },
          },
          linkedProject: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImageUrl: true,
              visibility: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
      });

      const achievementsList: PublicStudentProfileDto['achievements'] = [];
      for (const ach of rawAchievements) {
        const curation = curationMap.get(`ACHIEVEMENT:${ach.id}`);
        if (curation && !curation.isVisible) continue;

        achievementsList.push({
          id: ach.id,
          award_title: ach.awardTitle,
          award_type: ach.awardType,
          placement: ach.placement,
          is_team_award: ach.isTeamAward,
          team_name: ach.teamNameSnapshot,
          is_featured: curation?.isFeatured || false,
          published_at: ach.publishedAt,
          event: {
            id: ach.event.id,
            title: ach.event.title,
            slug: ach.event.slug,
            start_time: ach.event.startTime,
          },
          linked_project:
            ach.linkedProject && ach.linkedProject.visibility === 'PUBLISHED'
              ? {
                  id: ach.linkedProject.id,
                  title: ach.linkedProject.title,
                  slug: ach.linkedProject.slug,
                  cover_image_url: ach.linkedProject.coverImageUrl,
                }
              : null,
        });
      }

      // Sort achievements: featured first, then display_order, then published_at DESC
      achievementsList.sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        const orderA = curationMap.get(`ACHIEVEMENT:${a.id}`)?.displayOrder ?? 0;
        const orderB = curationMap.get(`ACHIEVEMENT:${b.id}`)?.displayOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      });

      // 6. Fetch eligible Clubs (active club, non-deleted membership)
      const clubsList: PublicStudentProfileDto['clubs'] = [];
      if (secVisibility.clubs !== false) {
        let memberships: Array<{
          club_id: string;
          club_name: string;
          role: string;
          banner_url: string | null;
          joined_at?: Date | string;
        }> = [];

        try {
          // Security-definer lookup function bypasses anonymous RLS masking while preserving strict active status invariants
          memberships = await tx.$queryRaw<Array<{
            club_id: string;
            club_name: string;
            role: string;
            banner_url: string | null;
            joined_at?: Date | string;
          }>>`
            SELECT club_id, club_name, role, banner_url, joined_at
            FROM lookup_public_student_clubs(${userId}::uuid)
          `;
        } catch {
          // Fallback to Prisma relation query
          const rawMemberships = await tx.clubMembership.findMany({
            where: {
              userId,
              deletedAt: null,
            },
            include: {
              club: true,
            },
          });
          memberships = rawMemberships
            .filter((m) => m.club.status === 'ACTIVE' && m.club.deletedAt === null)
            .map((m) => ({
              club_id: m.clubId,
              club_name: m.club.name,
              role: m.role,
              banner_url: m.club.bannerUrl,
              joined_at: m.createdAt,
            }));
        }

        for (const mem of memberships) {
          const curation = curationMap.get(`CLUB:${mem.club_id}`);
          if (curation && !curation.isVisible) continue;

          clubsList.push({
            club_id: mem.club_id,
            club_name: mem.club_name,
            role: mem.role,
            banner_url: mem.banner_url,
            is_featured: curation?.isFeatured || false,
          });
        }
      }

      // 7. Academic Details
      const academicData =
        secVisibility.academic !== false && profile.graduation_year && profile.program_name
          ? {
              program: profile.program_name,
              program_code: profile.program_code || '',
              graduation_year: profile.graduation_year,
              admission_year: profile.admission_year || undefined,
            }
          : null;

      const isIdentityVisible = secVisibility.identity !== false && secVisibility.name !== false;
      const isAvatarVisible = secVisibility.avatar !== false && secVisibility.avatar_url !== false;
      const isBioVisible = secVisibility.bio !== false;
      const isSkillsVisible = secVisibility.skills !== false;
      const isLinksVisible = secVisibility.links !== false && secVisibility.external_links !== false;
      const isProjectsVisible = secVisibility.projects !== false;
      const isAchievementsVisible = secVisibility.achievements !== false;
      const isClubsVisible = secVisibility.clubs !== false;

      // 8. Return strictly projected public DTO
      return {
        slug: profile.slug,
        full_name: isIdentityVisible ? profile.full_name : null,
        avatar_url: isAvatarVisible ? profile.avatar_url : null,
        headline: isBioVisible ? profile.headline : null,
        bio: isBioVisible ? profile.bio : null,
        academic: academicData,
        skills: isSkillsVisible ? profile.skills : [],
        interests: isSkillsVisible ? profile.interests : [],
        external_links: isLinksVisible ? (profile.external_links as any[]) : [],
        projects: isProjectsVisible ? projectsList : [],
        achievements: isAchievementsVisible ? achievementsList : [],
        clubs: isClubsVisible ? clubsList : [],
      };
    });
  }

  /**
   * Public: List and search student directory.
   */
  async listDirectory(query: QueryDirectoryInput) {
    const { search, program_code, graduation_year, skill, limit, offset } = query;

    return withUserContext(null, async (tx) => {
      const conditions: Prisma.Sql[] = [Prisma.sql`directory_listed = true`];

      if (search && search.trim().length > 0) {
        const term = `%${search.trim()}%`;
        conditions.push(
          Prisma.sql`(
            slug ILIKE ${term}
            OR (
              coalesce((section_visibility->>'identity')::boolean, (section_visibility->>'name')::boolean) IS TRUE
              AND full_name ILIKE ${term}
            )
          )`
        );
      }

      if (program_code) {
        conditions.push(
          Prisma.sql`(
            (section_visibility->>'academic')::boolean IS TRUE
            AND program_code ILIKE ${program_code}
          )`
        );
      }

      if (graduation_year) {
        conditions.push(
          Prisma.sql`(
            (section_visibility->>'academic')::boolean IS TRUE
            AND graduation_year = ${graduation_year}
          )`
        );
      }

      if (skill) {
        conditions.push(
          Prisma.sql`(
            (section_visibility->>'skills')::boolean IS TRUE
            AND ${skill} = ANY(skills)
          )`
        );
      }

      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

      const [profiles, totalResult] = await Promise.all([
        tx.$queryRaw<Array<{
          profile_id: string;
          user_id: string;
          slug: string;
          headline: string | null;
          bio: string | null;
          skills: string[];
          interests: string[];
          section_visibility: any;
          full_name: string | null;
          avatar_url: string | null;
          graduation_year: number | null;
          program_name: string | null;
          program_code: string | null;
        }>>`
          SELECT 
            profile_id,
            user_id,
            slug,
            headline,
            bio,
            skills,
            interests,
            section_visibility,
            full_name,
            avatar_url,
            graduation_year,
            program_name,
            program_code
          FROM public_student_profiles_view
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `,
        tx.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count
          FROM public_student_profiles_view
          ${whereClause}
        `,
      ]);

      const total = totalResult[0]?.count ?? 0;

      const items = profiles.map((p) => {
        const sec = (p.section_visibility as Record<string, boolean>) || {};
        const isNameVisible = sec.identity !== false && sec.name !== false;
        const isAvatarVisible = sec.avatar !== false && sec.avatar_url !== false;
        const isAcademicVisible = sec.academic !== false;
        const isSkillsVisible = sec.skills !== false;
        const isBioVisible = sec.bio !== false;

        return {
          id: p.profile_id,
          user_id: p.user_id,
          slug: p.slug,
          full_name: isNameVisible ? p.full_name : null,
          avatar_url: isAvatarVisible ? p.avatar_url : null,
          headline: isBioVisible ? p.headline : null,
          academic:
            isAcademicVisible && p.graduation_year && p.program_name
              ? {
                  program_code: p.program_code || '',
                  program_name: p.program_name,
                  graduation_year: p.graduation_year,
                }
              : null,
          skills: isSkillsVisible ? (p.skills || []).slice(0, 5) : [],
        };
      });

      return {
        data: items,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total,
        },
      };
    });
  }

  /**
   * Authenticated Student: Retrieve own complete profile with curation items and raw source options.
   */
  async getMyProfile(userId: string) {
    return withUserContext(userId, async (tx) => {
      const profile = await this.getOrCreateStudentProfile(userId, tx);

      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          academicProfile: {
            include: {
              batch: {
                include: {
                  program: true,
                },
              },
            },
          },
          clubMemberships: {
            where: { deletedAt: null },
            include: {
              club: true,
            },
          },
        },
      });

      if (!user) throw new NotFoundError('User not found');

      // Fetch user's eligible projects
      const [ownedProjects, contributedProjects] = await Promise.all([
        tx.project.findMany({
          where: { ownerId: userId, deletedAt: null },
          orderBy: { publishedAt: 'desc' },
        }),
        tx.projectContributor.findMany({
          where: { userId, status: 'ACCEPTED', project: { deletedAt: null } },
          include: { project: true },
        }),
      ]);

      const allProjects = [...ownedProjects];
      for (const cp of contributedProjects) {
        if (!allProjects.some((p) => p.id === cp.project.id)) {
          allProjects.push(cp.project);
        }
      }

      // Fetch user's active achievements
      const achievements = await tx.studentAchievement.findMany({
        where: { userId, isActive: true },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              visibility: true,
              state: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
      });

      // Fetch curation items
      const curatedItems = await tx.studentProfileCuratedItem.findMany({
        where: { userId },
      });

      return {
        profile: {
          id: profile.id,
          slug: profile.slug,
          headline: profile.headline,
          bio: profile.bio,
          skills: profile.skills,
          interests: profile.interests,
          external_links: profile.externalLinks,
          section_visibility: profile.sectionVisibility,
          directory_listed: profile.directoryListed,
          settings_version: profile.settingsVersion,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt,
        },
        user: {
          id: user.id,
          email: user.email,
          full_name: user.fullName,
          avatar_url: user.avatarUrl,
          global_role: user.globalRole,
          academic_profile: user.academicProfile
            ? {
                batch: {
                  program: {
                    name: user.academicProfile.batch.program.name,
                    code: user.academicProfile.batch.program.code,
                  },
                  graduation_year: user.academicProfile.batch.graduationYear,
                  admission_year: user.academicProfile.batch.admissionYear,
                },
              }
            : null,
          club_memberships: user.clubMemberships.map((m) => ({
            club_id: m.clubId,
            club_name: m.club.name,
            role: m.role,
          })),
        },
        curated_items: curatedItems.map((ci) => ({
          id: ci.id,
          item_type: ci.itemType,
          source_id: ci.sourceId,
          is_visible: ci.isVisible,
          is_featured: ci.isFeatured,
          display_order: ci.displayOrder,
        })),
        source_options: {
          projects: allProjects.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            visibility: p.visibility,
            published_at: p.publishedAt,
          })),
          achievements: achievements.map((a) => ({
            id: a.id,
            award_title: a.awardTitle,
            award_type: a.awardType,
            placement: a.placement,
            event_title: a.event.title,
            event_visibility: a.event.visibility,
            published_at: a.publishedAt,
          })),
          clubs: user.clubMemberships.map((m) => ({
            club_id: m.clubId,
            club_name: m.club.name,
            role: m.role,
          })),
        },
      };
    });
  }

  /**
   * Authenticated Student: Update editable profile content (headline, bio, skills, interests, links).
   */
  async updateMyProfile(userId: string, input: UpdateProfileInput) {
    return withUserContext(userId, async (tx) => {
      await this.getOrCreateStudentProfile(userId, tx);

      const updated = await tx.studentProfile.update({
        where: { userId },
        data: {
          ...(input.headline !== undefined && { headline: input.headline }),
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.skills !== undefined && { skills: input.skills }),
          ...(input.interests !== undefined && { interests: input.interests }),
          ...(input.external_links !== undefined && { externalLinks: input.external_links }),
          settingsVersion: { increment: 1 },
        },
      });

      return {
        headline: updated.headline,
        bio: updated.bio,
        skills: updated.skills,
        interests: updated.interests,
        external_links: updated.externalLinks,
      };
    });
  }

  /**
   * Authenticated Student: Update section-level visibility toggles and directory listing preference.
   */
  async updateMyVisibility(userId: string, input: UpdateVisibilityInput) {
    return withUserContext(userId, async (tx) => {
      const current = await this.getOrCreateStudentProfile(userId, tx);

      const currentVisibility = (current.sectionVisibility as Record<string, boolean>) || {};
      const hasIdentity = input.section_visibility && ('identity' in input.section_visibility || 'name' in input.section_visibility);
      let identityVal: boolean;
      if (hasIdentity) {
        const inIdentity = input.section_visibility!.identity;
        const inName = input.section_visibility!.name;
        if (inIdentity === false || inName === false) {
          identityVal = false;
        } else if (inIdentity === true && (inName === undefined || inName === true)) {
          identityVal = true;
        } else if (inName === true && (inIdentity === undefined || inIdentity === true)) {
          identityVal = true;
        } else {
          identityVal = false;
        }
      } else {
        identityVal = currentVisibility.identity !== false && currentVisibility.name !== false;
      }

      const hasAvatar = input.section_visibility && ('avatar' in input.section_visibility || 'avatar_url' in input.section_visibility);
      let avatarVal: boolean;
      if (hasAvatar) {
        const inAvatar = input.section_visibility!.avatar;
        const inAvatarUrl = input.section_visibility!.avatar_url;
        // If either key is explicitly false, privacy wins and avatar is hidden
        if (inAvatar === false || inAvatarUrl === false) {
          avatarVal = false;
        } else if (inAvatar === true && (inAvatarUrl === undefined || inAvatarUrl === true)) {
          avatarVal = true;
        } else if (inAvatarUrl === true && (inAvatar === undefined || inAvatar === true)) {
          avatarVal = true;
        } else {
          avatarVal = false;
        }
      } else {
        avatarVal = currentVisibility.avatar !== false && currentVisibility.avatar_url !== false;
      }

      const hasLinks = input.section_visibility && ('links' in input.section_visibility || 'external_links' in input.section_visibility);
      let linksVal: boolean;
      if (hasLinks) {
        const inLinks = input.section_visibility!.links;
        const inExtLinks = input.section_visibility!.external_links;
        if (inLinks === false || inExtLinks === false) {
          linksVal = false;
        } else if (inLinks === true && (inExtLinks === undefined || inExtLinks === true)) {
          linksVal = true;
        } else if (inExtLinks === true && (inLinks === undefined || inLinks === true)) {
          linksVal = true;
        } else {
          linksVal = false;
        }
      } else {
        linksVal = currentVisibility.links === true || currentVisibility.external_links === true;
      }

      const normalizedVisibility = {
        ...currentVisibility,
        ...(input.section_visibility || {}),
        identity: identityVal,
        name: identityVal,
        avatar: avatarVal,
        avatar_url: avatarVal,
        links: linksVal,
        external_links: linksVal,
      };

      // When identity visibility is disabled, rotate any name-derived slug to an anonymous handle
      let targetSlug = current.slug;
      if (identityVal === false) {
        const isAnonSlug = /^student-[a-f0-9]{6,12}(?:-\d+)?$/i.test(current.slug);
        if (!isAnonSlug) {
          const rotated = await tx.$queryRaw<Array<{ slug: string }>>`
            SELECT rotate_student_to_anonymous_slug(${userId}::uuid) AS slug
          `;
          targetSlug = rotated?.[0]?.slug || current.slug;
        }
      }

      const updated = await tx.studentProfile.update({
        where: { userId },
        data: {
          slug: targetSlug,
          sectionVisibility: normalizedVisibility,
          ...(input.directory_listed !== undefined && { directoryListed: input.directory_listed }),
          settingsVersion: { increment: 1 },
        },
      });

      return {
        slug: updated.slug,
        section_visibility: updated.sectionVisibility,
        directory_listed: updated.directoryListed,
      };
    });
  }

  /**
   * Authenticated Student: Curate an individual item (toggle visibility, featured flag, display order).
   * Strictly validates that the authenticated student owns or is a verified contributor/member of the item.
   */
  async curateItem(userId: string, input: CurateItemInput) {
    return withUserContext(userId, async (tx) => {
      const { item_type, source_id, is_visible, is_featured, display_order } = input;

      // 1. Verify eligibility based on item_type
      if (item_type === 'PROJECT') {
        const isOwner = await tx.project.findFirst({
          where: { id: source_id, ownerId: userId, deletedAt: null },
        });
        const isContributor = await tx.projectContributor.findFirst({
          where: { projectId: source_id, userId, status: 'ACCEPTED' },
        });

        if (!isOwner && !isContributor) {
          throw new ForbiddenError('You are not authorized to curate this project');
        }
      } else if (item_type === 'ACHIEVEMENT') {
        const achievement = await tx.studentAchievement.findFirst({
          where: { id: source_id, userId, isActive: true },
        });

        if (!achievement) {
          throw new ForbiddenError('You are not authorized to curate this achievement');
        }
      } else if (item_type === 'CLUB') {
        const membership = await tx.clubMembership.findFirst({
          where: { clubId: source_id, userId, deletedAt: null },
        });

        if (!membership) {
          throw new ForbiddenError('You are not authorized to curate this club');
        }
      }

      // 2. Upsert curated item record
      const curated = await tx.studentProfileCuratedItem.upsert({
        where: {
          userId_itemType_sourceId: {
            userId,
            itemType: item_type as ProfileItemType,
            sourceId: source_id,
          },
        },
        update: {
          isVisible: is_visible,
          isFeatured: is_featured,
          displayOrder: display_order,
        },
        create: {
          userId,
          itemType: item_type as ProfileItemType,
          sourceId: source_id,
          isVisible: is_visible,
          isFeatured: is_featured,
          displayOrder: display_order,
        },
      });

      return {
        id: curated.id,
        item_type: curated.itemType,
        source_id: curated.sourceId,
        is_visible: curated.isVisible,
        is_featured: curated.isFeatured,
        display_order: curated.displayOrder,
      };
    });
  }

  /**
   * Authenticated Student: Change public profile handle/slug with collision prevention and historical redirect.
   */
  async changeHandle(userId: string, newSlugInput: string) {
    const normalizedNewSlug = newSlugInput.toLowerCase().trim();

    if (!isValidSlug(normalizedNewSlug) || isReservedSlug(normalizedNewSlug)) {
      throw new BadRequestError('Invalid or reserved handle format');
    }

    return withUserContext(userId, async (tx) => {
      const profile = await this.getOrCreateStudentProfile(userId, tx);

      if (profile.slug === normalizedNewSlug) {
        return { slug: profile.slug };
      }

      // Check if handle is taken in current profiles or slug history
      const isTaken = await tx.$queryRaw<Array<{ is_taken: boolean }>>`
        SELECT is_student_slug_taken(${normalizedNewSlug}) AS is_taken
      `;
      if (isTaken?.[0]?.is_taken) {
        throw new ConflictError('This handle has been previously used and is reserved');
      }

      // Record old slug into slug history
      await tx.studentSlugHistory.upsert({
        where: { slug: profile.slug },
        update: { userId },
        create: {
          userId,
          slug: profile.slug,
        },
      });

      // Update current profile slug
      const updated = await tx.studentProfile.update({
        where: { userId },
        data: {
          slug: normalizedNewSlug,
          settingsVersion: { increment: 1 },
        },
      });

      return { slug: updated.slug };
    });
  }
}

export const studentsService = new StudentsService();
