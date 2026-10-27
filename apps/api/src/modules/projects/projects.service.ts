import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { withUserContext } from '@nst/database';
import { enqueueNotification } from '@nst/shared';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../lib/errors';
import { generateSlug, isValidSlug, isReservedSlug } from '../../utils/slug-utils';
import { validateVerifiedUser, isInstitutionalEmail } from '../events/events.service';
import {
  CONTROLLED_PROJECT_CATEGORIES,
  QueryProjectsSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  ChangeSlugSchema,
  InviteContributorSchema,
  RespondContributorSchema,
  SubmitReportSchema,
  ModerateProjectSchema,
  ResolveReportSchema,
} from './projects.schema';
import crypto from 'crypto';
import { z } from 'zod';

export class ProjectsService {
  /**
   * Generates a unique, URL-safe slug for a project.
   */
  async generateUniqueSlug(title: string, tx: Prisma.TransactionClient = prisma): Promise<string> {
    const baseSlug = generateSlug(title);
    if (!baseSlug || isReservedSlug(baseSlug)) {
      const randomSuffix = crypto.randomBytes(3).toString('hex');
      return `project-${randomSuffix}`;
    }

    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const [existingProject, existingHistory] = await Promise.all([
        tx.project.findUnique({ where: { slug: candidate } }),
        tx.projectSlugHistory.findUnique({ where: { slug: candidate } }),
      ]);

      if (!existingProject && !existingHistory && !isReservedSlug(candidate)) {
        return candidate;
      }

      counter++;
      candidate = `${baseSlug}-${counter}`;
    }
  }

  /**
   * Public Project Discovery query with search, category/tag/status filtering,
   * and view ranking algorithms (Explore, Trending, Most Liked, Recent).
   */
  async listPublicProjects(query: z.infer<typeof QueryProjectsSchema>) {
    const { view, category, tag, status, type, search, page, limit, timeRange } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      visibility: 'PUBLISHED',
      deletedAt: null,
    };

    if (category) {
      where.category = category;
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (status) {
      where.developmentStatus = status;
    }

    if (type) {
      where.projectType = type;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { tagline: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { problemStatement: { contains: q, mode: 'insensitive' } },
        { solution: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    // Time-range filter for 'most_liked'
    if (view === 'most_liked' && timeRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (timeRange === 'week') {
        cutoff.setDate(now.getDate() - 7);
      } else if (timeRange === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
      }
      where.publishedAt = { gte: cutoff };
    }

    let orderBy: Prisma.ProjectOrderByWithRelationInput[] = [];

    switch (view) {
      case 'most_liked':
        orderBy = [{ likeCount: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }];
        break;
      case 'recent':
        orderBy = [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
        break;
      case 'trending':
        // Trending: prioritize recent likes and engagement
        orderBy = [{ likeCount: 'desc' }, { publishedAt: 'desc' }, { viewCount: 'desc' }, { id: 'asc' }];
        break;
      case 'explore':
      default:
        // Explore: balanced discovery
        orderBy = [{ publishedAt: 'desc' }, { likeCount: 'desc' }, { id: 'asc' }];
        break;
    }

    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          tagline: true,
          category: true,
          tags: true,
          projectType: true,
          developmentStatus: true,
          coverImageUrl: true,
          likeCount: true,
          viewCount: true,
          publishedAt: true,
          owner: {
            select: {
              fullName: true,
              avatarUrl: true,
            },
          },
          links: {
            select: {
              type: true,
              url: true,
              label: true,
            },
            orderBy: { order: 'asc' },
            take: 2,
          },
        },
      }),
    ]);

    const items = projects.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      tagline: p.tagline,
      category: p.category,
      tags: p.tags,
      project_type: p.projectType,
      development_status: p.developmentStatus,
      cover_image_url: p.coverImageUrl,
      like_count: p.likeCount,
      view_count: p.viewCount,
      published_at: p.publishedAt,
      author: {
        name: p.owner?.fullName || 'Creator',
        avatar_url: p.owner?.avatarUrl || null,
      },
      links: p.links,
    }));

    return {
      items,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single public project by slug. Follows historical slug redirects.
   */
  async getPublicProjectBySlug(slug: string, callerUserId?: string) {
    const normalizedSlug = slug.toLowerCase().trim();

    // 1. Check historical slug table for redirect
    const historyMatch = await prisma.projectSlugHistory.findUnique({
      where: { slug: normalizedSlug },
      include: { project: { select: { slug: true, visibility: true, deletedAt: true } } },
    });

    if (historyMatch && historyMatch.project && historyMatch.project.deletedAt === null) {
      if (historyMatch.project.visibility === 'PUBLISHED') {
        return {
          redirect: true,
          canonical_slug: historyMatch.project.slug,
        };
      }
    }

    // 2. Query project (by slug or UUID ID)
    let project: any;
    let hasLiked = false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedSlug);
    const projectWhere = isUuid ? { id: normalizedSlug } : { slug: normalizedSlug };

    const includeClause = {
      owner: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          studentProfile: { select: { slug: true } },
        },
      },
      links: {
        orderBy: { order: 'asc' as const },
        select: {
          id: true,
          type: true,
          label: true,
          url: true,
          order: true,
        },
      },
      contributors: {
        where: { status: 'ACCEPTED' as const },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              studentProfile: { select: { slug: true } },
            },
          },
        },
      },
    };

    if (callerUserId) {
      await withUserContext(callerUserId, async (tx) => {
        project = await tx.project.findUnique({
          where: projectWhere,
          include: includeClause,
        });

        if (project) {
          const userLike = await tx.projectLike.findUnique({
            where: {
              projectId_userId: {
                projectId: project.id,
                userId: callerUserId,
              },
            },
          });
          hasLiked = Boolean(userLike);
        }
      });
    } else {
      project = await prisma.project.findUnique({
        where: projectWhere,
        include: includeClause,
      });
    }

    if (!project || project.deletedAt !== null) {
      throw new NotFoundError('Project not found');
    }

    // 3. Visibility check: if not PUBLISHED, only owner or global admins can view
    if (project.visibility !== 'PUBLISHED') {
      if (!callerUserId) {
        throw new NotFoundError('Project not found');
      }

      let isOwner = false;
      let isAcceptedCollaborator = false;
      let isAdmin = false;

      await withUserContext(callerUserId, async (tx) => {
        const caller = await tx.user.findUnique({
          where: { id: callerUserId },
          select: { globalRole: true },
        });

        isOwner = project.ownerId === callerUserId;
        isAcceptedCollaborator = (project.contributors || []).some((c: any) => c.userId === callerUserId);
        isAdmin = caller?.globalRole === 'PLATFORM_ADMIN' || caller?.globalRole === 'FACULTY_ADMIN';
      });

      if (!isOwner && !isAcceptedCollaborator && !isAdmin) {
        throw new NotFoundError('Project not found');
      }
    }

    // 4. Increment view count asynchronously via SECURITY DEFINER function
    prisma.$executeRaw`SELECT increment_project_view_count(${project.id}::uuid)`.catch(() => {});

    return {
      id: project.id,
      title: project.title,
      slug: project.slug,
      tagline: project.tagline,
      description: project.description,
      problem_statement: project.problemStatement,
      solution: project.solution,
      implementation_details: project.implementationDetails,
      personal_contribution: project.personalContribution,
      whats_next: project.whatsNext,
      category: project.category,
      tags: project.tags,
      project_type: project.projectType,
      development_status: project.developmentStatus,
      visibility: project.visibility,
      published_at: project.publishedAt,
      cover_image_url: project.coverImageUrl,
      gallery_image_urls: project.galleryImageUrls,
      like_count: project.likeCount,
      view_count: project.viewCount,
      has_liked: hasLiked,
      is_owner: callerUserId === project.ownerId,
      owner_id: project.ownerId,
      author: {
        name: project.owner.fullName,
        avatar_url: project.owner.avatarUrl,
        slug: (project.owner as any)?.studentProfile?.slug || null,
      },
      links: project.links,
      contributors: (project.contributors || []).map((c: any) => ({
        id: c.id,
        role: c.role,
        name: c.user?.fullName || 'Contributor',
        avatar_url: c.user?.avatarUrl || null,
        slug: c.user?.studentProfile?.slug || null,
      })),
    };
  }

  /**
   * Retrieves controlled categories with active published project counts.
   */
  async getCategories() {
    const counts = await prisma.project.groupBy({
      by: ['category'],
      where: { visibility: 'PUBLISHED', deletedAt: null },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const c of counts) {
      countMap.set(c.category, c._count.id);
    }

    return CONTROLLED_PROJECT_CATEGORIES.map((cat) => ({
      name: cat,
      count: countMap.get(cat) || 0,
    }));
  }

  /**
   * Creates a new project (draft or published).
   */
  async createProject(userId: string, input: z.infer<typeof CreateProjectSchema>) {
    return withUserContext(userId, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');

      // Enforce verified institutional email
      validateVerifiedUser(user);

      let slug = input.customSlug ? input.customSlug.toLowerCase().trim() : null;

      if (slug) {
        if (!isValidSlug(slug) || isReservedSlug(slug)) {
          throw new BadRequestError('Custom slug is invalid or reserved');
        }
        const existing = await tx.project.findUnique({ where: { slug } });
        if (existing) throw new ConflictError('Slug is already taken by another project');
      } else {
        slug = await this.generateUniqueSlug(input.title, tx);
      }

      const isPublishing = input.publishNow;
      if (isPublishing) {
        if (!input.rightsConfirmed) {
          throw new BadRequestError('You must confirm rights to publish this project');
        }
        if (!input.links || input.links.length === 0) {
          throw new BadRequestError('At least one public project showcase link (Demo, GitHub, Video, Docs) is required for publication');
        }
      }

      const project = await tx.project.create({
        data: {
          ownerId: userId,
          title: input.title.trim(),
          slug,
          tagline: input.tagline.trim(),
          description: input.description.trim(),
          problemStatement: input.problemStatement?.trim() || null,
          solution: input.solution?.trim() || null,
          implementationDetails: input.implementationDetails?.trim() || null,
          personalContribution: input.personalContribution?.trim() || null,
          whatsNext: input.whatsNext?.trim() || null,
          category: input.category,
          tags: input.tags,
          projectType: input.projectType,
          developmentStatus: input.developmentStatus,
          visibility: isPublishing ? 'PUBLISHED' : 'DRAFT',
          publishedAt: isPublishing ? new Date() : null,
          coverImageUrl: input.coverImageUrl,
          galleryImageUrls: input.galleryImageUrls || [],
          links: input.links && input.links.length > 0 ? {
            create: input.links.map((link, idx) => ({
              type: link.type,
              url: link.url,
              label: link.label || null,
              order: idx,
            })),
          } : undefined,
        },
        include: {
          links: true,
        },
      });

      return project;
    });
  }

  /**
   * Updates an existing project.
   */
  async updateProject(userId: string, projectId: string, input: z.infer<typeof UpdateProjectSchema>, isAdmin = false) {
    return withUserContext(userId, async (tx) => {
      const existing = await tx.project.findUnique({
        where: { id: projectId },
        include: { links: true },
      });

      if (!existing || existing.deletedAt !== null) {
        throw new NotFoundError('Project not found');
      }

      if (existing.ownerId !== userId && !isAdmin) {
        throw new ForbiddenError('You do not have permission to edit this project');
      }

      if (existing.visibility === 'REMOVED' && !isAdmin) {
        throw new ForbiddenError('This project has been removed by platform moderation and cannot be edited');
      }

      const updateData: Prisma.ProjectUpdateInput = {};

      if (input.title !== undefined) updateData.title = input.title.trim();
      if (input.tagline !== undefined) updateData.tagline = input.tagline.trim();
      if (input.description !== undefined) updateData.description = input.description.trim();
      if (input.problemStatement !== undefined) updateData.problemStatement = input.problemStatement?.trim() || null;
      if (input.solution !== undefined) updateData.solution = input.solution?.trim() || null;
      if (input.implementationDetails !== undefined) updateData.implementationDetails = input.implementationDetails?.trim() || null;
      if (input.personalContribution !== undefined) updateData.personalContribution = input.personalContribution?.trim() || null;
      if (input.whatsNext !== undefined) updateData.whatsNext = input.whatsNext?.trim() || null;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.tags !== undefined) updateData.tags = input.tags;
      if (input.projectType !== undefined) updateData.projectType = input.projectType;
      if (input.developmentStatus !== undefined) updateData.developmentStatus = input.developmentStatus;
      if (input.coverImageUrl !== undefined) updateData.coverImageUrl = input.coverImageUrl;
      if (input.galleryImageUrls !== undefined) updateData.galleryImageUrls = input.galleryImageUrls;

      // Handle custom slug update if provided
      if (input.customSlug !== undefined && input.customSlug.trim()) {
        const normalizedNewSlug = input.customSlug.toLowerCase().trim();
        if (normalizedNewSlug !== existing.slug) {
          if (!isValidSlug(normalizedNewSlug) || isReservedSlug(normalizedNewSlug)) {
            throw new BadRequestError('Invalid or reserved slug format');
          }
          const collision = await tx.project.findUnique({ where: { slug: normalizedNewSlug } });
          if (collision) {
            throw new ConflictError('Slug is already in use by another project');
          }
          await tx.projectSlugHistory.upsert({
            where: { slug: existing.slug },
            create: { projectId, slug: existing.slug },
            update: { projectId },
          });
          updateData.slug = normalizedNewSlug;
        }
      }

      if (input.publishNow) {
        if (!input.rightsConfirmed && existing.visibility !== 'PUBLISHED') {
          throw new BadRequestError('You must confirm ownership rights to publish this project');
        }

        const effectiveTitle = input.title !== undefined ? input.title.trim() : existing.title;
        const effectiveTagline = input.tagline !== undefined ? input.tagline.trim() : existing.tagline;
        const effectiveDesc = input.description !== undefined ? input.description.trim() : existing.description;
        const effectiveCover = input.coverImageUrl !== undefined ? input.coverImageUrl : existing.coverImageUrl;

        if (!effectiveTitle || !effectiveTagline || !effectiveDesc || !effectiveCover) {
          throw new BadRequestError('Project basics (title, tagline, description, and cover image) must be complete before publishing');
        }

        const effectiveLinks = input.links !== undefined ? input.links : existing.links;
        if (!effectiveLinks || effectiveLinks.length === 0) {
          throw new BadRequestError('At least one public showcase artifact (Demo, GitHub, Video, Documentation) is required before publishing');
        }

        updateData.visibility = 'PUBLISHED';
        if (!existing.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }

      // Sync links if provided
      if (input.links !== undefined) {
        await tx.projectLink.deleteMany({ where: { projectId } });
        if (input.links.length > 0) {
          await tx.projectLink.createMany({
            data: input.links.map((link, idx) => ({
              projectId,
              type: link.type,
              url: link.url,
              label: link.label || null,
              order: idx,
            })),
          });
        }
      }

      const updated = await tx.project.update({
        where: { id: projectId },
        data: updateData,
        include: { links: true },
      });

      return updated;
    });
  }

  /**
   * Publishes a project after validating publication completeness.
   */
  async publishProject(userId: string, projectId: string, rightsConfirmed: boolean, isAdmin = false) {
    if (!rightsConfirmed) {
      throw new BadRequestError('You must confirm ownership and publishing rights to showcase this project');
    }

    return withUserContext(userId, async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: { links: true },
      });

      if (!project || project.deletedAt !== null) {
        throw new NotFoundError('Project not found');
      }

      if (project.ownerId !== userId && !isAdmin) {
        throw new ForbiddenError('You do not have permission to publish this project');
      }

      // Validate completeness
      if (!project.title || !project.tagline || !project.description || !project.category || !project.coverImageUrl) {
        throw new BadRequestError('Project basics (title, tagline, description, category, and cover image) must be complete before publishing');
      }

      if (!project.links || project.links.length === 0) {
        throw new BadRequestError('At least one public showcase artifact (Demo, GitHub, Video, Documentation) is required before publishing');
      }

      return tx.project.update({
        where: { id: projectId },
        data: {
          visibility: 'PUBLISHED',
          publishedAt: project.publishedAt || new Date(),
        },
      });
    });
  }

  /**
   * Unpublishes a project (sets to UNPUBLISHED / hidden).
   */
  async unpublishProject(userId: string, projectId: string, isAdmin = false) {
    return withUserContext(userId, async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project || project.deletedAt !== null) {
        throw new NotFoundError('Project not found');
      }

      if (project.ownerId !== userId && !isAdmin) {
        throw new ForbiddenError('You do not have permission to unpublish this project');
      }

      return tx.project.update({
        where: { id: projectId },
        data: { visibility: 'UNPUBLISHED' },
      });
    });
  }

  /**
   * Soft-deletes a project.
   */
  async deleteProject(userId: string, projectId: string, isAdmin = false) {
    return withUserContext(userId, async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project || project.deletedAt !== null) {
        throw new NotFoundError('Project not found');
      }

      if (project.ownerId !== userId && !isAdmin) {
        throw new ForbiddenError('You do not have permission to delete this project');
      }

      return tx.project.update({
        where: { id: projectId },
        data: {
          deletedAt: new Date(),
          visibility: 'REMOVED',
        },
      });
    });
  }

  /**
   * Explicit slug change with historical redirect preservation.
   */
  async changeSlug(userId: string, projectId: string, newSlugInput: string, isAdmin = false) {
    const normalizedNewSlug = newSlugInput.toLowerCase().trim();

    if (!isValidSlug(normalizedNewSlug) || isReservedSlug(normalizedNewSlug)) {
      throw new BadRequestError('Invalid or reserved slug format');
    }

    return withUserContext(userId, async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project || project.deletedAt !== null) {
        throw new NotFoundError('Project not found');
      }

      if (project.ownerId !== userId && !isAdmin) {
        throw new ForbiddenError('You do not have permission to modify this project slug');
      }

      if (project.slug === normalizedNewSlug) {
        return project;
      }

      // Check collision
      const existingProject = await tx.project.findUnique({ where: { slug: normalizedNewSlug } });
      if (existingProject) {
        throw new ConflictError('Slug is already in use by another project');
      }

      // Archive previous slug into history
      await tx.projectSlugHistory.upsert({
        where: { slug: project.slug },
        create: {
          projectId,
          slug: project.slug,
        },
        update: {
          projectId,
        },
      });

      // Update current project slug
      const updated = await tx.project.update({
        where: { id: projectId },
        data: { slug: normalizedNewSlug },
      });

      return updated;
    });
  }

  /**
   * Likes a project with database constraint and atomic likeCount increment.
   * Prohibits owner from self-liking.
   */
  async likeProject(userId: string, projectId: string) {
    return withUserContext(userId, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');
      validateVerifiedUser(user);

      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project || project.deletedAt !== null || project.visibility !== 'PUBLISHED') {
        throw new NotFoundError('Published project not found');
      }

      if (project.ownerId === userId) {
        throw new BadRequestError('Creators cannot like their own project');
      }

      // Check existing like (idempotent)
      const existingLike = await tx.projectLike.findUnique({
        where: {
          projectId_userId: { projectId, userId },
        },
      });

      if (existingLike) {
        return { liked: true, like_count: project.likeCount, likeCount: project.likeCount };
      }

      await tx.projectLike.create({
        data: { projectId, userId },
      });

      const likeCount = await tx.projectLike.count({
        where: { projectId },
      });

      return { liked: true, like_count: likeCount, likeCount };
    });
  }

  /**
   * Unlikes a project and decrements likeCount atomically.
   */
  async unlikeProject(userId: string, projectId: string) {
    return withUserContext(userId, async (tx) => {
      const existingLike = await tx.projectLike.findUnique({
        where: {
          projectId_userId: { projectId, userId },
        },
      });

      if (!existingLike) {
        const count = await tx.projectLike.count({ where: { projectId } });
        return { liked: false, like_count: count, likeCount: count };
      }

      await tx.projectLike.delete({
        where: {
          projectId_userId: { projectId, userId },
        },
      });

      const likeCount = await tx.projectLike.count({
        where: { projectId },
      });

      return { liked: false, like_count: likeCount, likeCount };
    });
  }

  /**
   * Retrieves verified student's own projects (drafts, published, unpublished) and collaborations.
   */
  async listMyProjects(userId: string) {
    return withUserContext(userId, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      const userEmail = user?.email?.toLowerCase();

      if (userEmail) {
        try {
          await this.reconcilePendingInvitations(tx, userId, userEmail);
        } catch {
          // Non-blocking
        }
      }

      const projects = await tx.project.findMany({
        where: {
          ownerId: userId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          links: true,
          contributors: {
            include: {
              user: { select: { fullName: true, email: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          moderationActions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { action: true, reason: true, createdAt: true },
          },
        },
      });

      const contributing = await tx.projectContributor.findMany({
        where: {
          OR: [
            { userId },
            ...(userEmail ? [{ invitedEmail: userEmail }] : []),
          ],
          project: { deletedAt: null },
        },
        include: {
          project: {
            include: {
              owner: { select: { fullName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const ownedMapped = projects.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        tagline: p.tagline,
        category: p.category,
        project_type: p.projectType,
        development_status: p.developmentStatus,
        visibility: p.visibility,
        published_at: p.publishedAt,
        created_at: p.createdAt,
        cover_image_url: p.coverImageUrl,
        like_count: p.likeCount,
        view_count: p.viewCount,
        links_count: p.links.length,
        contributors_count: p.contributors.length,
        latest_moderation: p.moderationActions[0] || null,
        contributors: p.contributors.map((c) => ({
          id: c.id,
          role: c.role,
          status: c.status,
          invited_email: c.invitedEmail,
          user_id: c.userId,
          name: c.user?.fullName || c.invitedEmail || 'Collaborator',
          email: c.user?.email || c.invitedEmail,
          avatar_url: c.user?.avatarUrl || null,
          created_at: c.createdAt,
        })),
      }));

      const contributingMapped = contributing.map((c) => ({
        id: c.id,
        contributor_id: c.id,
        role: c.role,
        status: c.status,
        created_at: c.createdAt,
        project: {
          id: c.project.id,
          title: c.project.title,
          slug: c.project.slug,
          tagline: c.project.tagline,
          visibility: c.project.visibility,
          owner_name: c.project.owner.fullName,
        },
      }));

      return {
        owned: ownedMapped,
        contributing: contributingMapped,
        stats: {
          total: ownedMapped.length,
          published: ownedMapped.filter((p) => p.visibility === 'PUBLISHED').length,
          drafts: ownedMapped.filter((p) => p.visibility === 'DRAFT').length,
          unpublished: ownedMapped.filter((p) => p.visibility === 'UNPUBLISHED').length,
          totalLikes: ownedMapped.reduce((sum, p) => sum + p.like_count, 0),
          totalViews: ownedMapped.reduce((sum, p) => sum + p.view_count, 0),
          likes: ownedMapped.reduce((sum, p) => sum + p.like_count, 0),
        },
      };
    });
  }

  /**
   * Reconciles unlinked or missing notifications for pending invitations matching a user's institutional email.
   * Atomically links userId and enqueues actionable in-app notifications if not already present.
   */
  async reconcilePendingInvitations(tx: Prisma.TransactionClient, userId: string, email: string) {
    if (!email) return;
    const cleanEmail = email.toLowerCase().trim();

    // 1. Link any unlinked invitations for this email
    await tx.projectContributor.updateMany({
      where: {
        invitedEmail: cleanEmail,
        userId: null,
      },
      data: {
        userId,
      },
    });

    // 2. Ensure in-app notification exists for all pending invitations
    const pendingInvitations = await tx.projectContributor.findMany({
      where: {
        OR: [
          { userId },
          { invitedEmail: cleanEmail },
        ],
        status: 'PENDING',
        project: { deletedAt: null },
      },
      include: {
        project: { select: { id: true, title: true } },
      },
    });

    for (const invite of pendingInvitations) {
      try {
        await enqueueNotification({
          tx,
          userId,
          type: 'PROJECT_INVITATION',
          title: 'Project Collaboration Invitation',
          body: `You were invited to collaborate on "${invite.project.title}" as ${invite.role}.`,
          metadata: {
            schema_version: 1,
            routing: {
              target: 'project_invitation',
              fallback: '/my/projects',
              params: { id: invite.project.id },
            },
            entity_ids: {
              project_id: invite.project.id,
              contributor_id: invite.id,
            },
          },
          preferenceGate: 'push_enabled',
          idempotencyString: `PROJECT_INVITATION:${invite.id}`,
        });
      } catch {
        // Enqueue is idempotent and safe
      }
    }
  }

  /**
   * Invites a student collaborator by institutional email.
   * Enforces domain checks, role limits, self-invitation guards, duplicate safety, and in-app notifications.
   */
  async inviteContributor(userId: string, projectId: string, invitedEmail: string, role: string) {
    const cleanEmail = invitedEmail.toLowerCase().trim();
    const cleanRole = role.trim();

    if (!isInstitutionalEmail(cleanEmail)) {
      throw new BadRequestError('Only institutional email addresses (@adypu.edu.in or @newtonschool.co) are permitted');
    }

    if (!cleanRole || cleanRole.length < 2 || cleanRole.length > 60) {
      throw new BadRequestError('Role description must be between 2 and 60 characters');
    }

    return withUserContext(userId, async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: {
          owner: { select: { id: true, email: true, fullName: true } },
        },
      });

      if (!project || project.deletedAt !== null || project.visibility === 'REMOVED') {
        throw new NotFoundError('Project not found');
      }

      if (project.ownerId !== userId) {
        throw new ForbiddenError('Only project owner can invite contributors');
      }

      // Safely resolve registered student identity via SECURITY DEFINER function
      const userRows = await tx.$queryRaw<{ id: string; email: string; full_name: string; avatar_url: string | null }[]>`
        SELECT * FROM find_user_by_institutional_email(${cleanEmail});
      `;
      const invitedUser = userRows[0] ? { id: userRows[0].id, email: userRows[0].email, fullName: userRows[0].full_name } : null;

      // Prohibit self-invitation by email or user ID
      if (cleanEmail === project.owner.email.toLowerCase() || (invitedUser && invitedUser.id === userId)) {
        throw new BadRequestError('Owner cannot be added as a collaborator');
      }

      // Check existing contributor records for this project
      const existing = await tx.projectContributor.findFirst({
        where: {
          projectId,
          OR: [
            ...(invitedUser ? [{ userId: invitedUser.id }] : []),
            { invitedEmail: cleanEmail },
          ],
        },
      });

      let contributorRecord: any;

      if (existing) {
        if (existing.status === 'ACCEPTED') {
          throw new ConflictError('Contributor has already accepted an invitation to this project');
        }
        if (existing.status === 'PENDING') {
          throw new ConflictError('A pending invitation has already been sent to this contributor');
        }
        // Reopen DECLINED invitation with new role
        contributorRecord = await tx.projectContributor.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING',
            role: cleanRole,
            userId: invitedUser?.id || existing.userId,
            invitedEmail: cleanEmail,
            updatedAt: new Date(),
          },
        });
      } else {
        contributorRecord = await tx.projectContributor.create({
          data: {
            projectId,
            userId: invitedUser?.id || null,
            invitedEmail: cleanEmail,
            role: cleanRole,
            status: 'PENDING',
          },
        });
      }

      // Notify the invited student via existing in-app notification infrastructure
      if (invitedUser) {
        try {
          await enqueueNotification({
            tx,
            userId: invitedUser.id,
            type: 'PROJECT_INVITATION',
            title: 'Project Collaboration Invitation',
            body: `You were invited to collaborate on "${project.title}" as ${cleanRole}.`,
            metadata: {
              schema_version: 1,
              routing: {
                target: 'project_invitation',
                fallback: '/my/projects',
                params: { id: project.id },
              },
              entity_ids: {
                project_id: project.id,
                contributor_id: contributorRecord.id,
              },
            },
            preferenceGate: 'push_enabled',
            idempotencyString: `PROJECT_INVITATION:${contributorRecord.id}`,
          });
        } catch (err) {
          console.error('INVITE ENQUEUE ERROR:', err);
        }
      }

      return contributorRecord;
    });
  }

  /**
   * Responds to a collaborator invitation (accept or decline).
   * Atomically verifies authenticated identity, guards against replays, and notifies the project owner.
   */
  async respondToContributor(userId: string, contributorId: string, status: 'ACCEPTED' | 'DECLINED') {
    return withUserContext(userId, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');

      const contributor = await tx.projectContributor.findUnique({
        where: { id: contributorId },
        include: {
          project: {
            select: { id: true, title: true, ownerId: true, deletedAt: true, visibility: true },
          },
        },
      });

      if (!contributor) {
        throw new NotFoundError('Invitation not found');
      }

      if (contributor.project.deletedAt !== null || contributor.project.visibility === 'REMOVED') {
        throw new NotFoundError('Project is no longer available');
      }

      // Verify recipient identity strictly against authenticated session
      const matchesUser =
        (contributor.userId && contributor.userId === userId) ||
        (contributor.invitedEmail && contributor.invitedEmail.toLowerCase() === user.email.toLowerCase());

      if (!matchesUser) {
        throw new ForbiddenError('You do not have permission to respond to this invitation');
      }

      // Guard against replay / repeated response
      if (contributor.status === 'ACCEPTED') {
        throw new BadRequestError('Invitation has already been accepted');
      }
      if (contributor.status === 'DECLINED') {
        throw new BadRequestError('Invitation has already been declined');
      }

      // Expiry check: invitations older than 30 days cannot be accepted
      const ageMs = Date.now() - contributor.createdAt.getTime();
      if (ageMs > 30 * 24 * 60 * 60 * 1000) {
        throw new BadRequestError('Invitation has expired');
      }

      const updatedCount = await tx.projectContributor.updateMany({
        where: { id: contributorId, status: 'PENDING' },
        data: {
          userId,
          status,
          updatedAt: new Date(),
        },
      });

      if (updatedCount.count === 0) {
        throw new ConflictError('Invitation status was updated concurrently. Please refresh.');
      }

      const updated = await tx.projectContributor.findUnique({
        where: { id: contributorId },
      });

      // If accepted, notify the project owner atomically
      if (status === 'ACCEPTED') {
        try {
          await enqueueNotification({
            tx,
            userId: contributor.project.ownerId,
            type: 'PROJECT_COLLABORATION_ACCEPTED',
            title: 'Collaborator Joined',
            body: `${user.fullName || user.email} accepted the invitation for "${contributor.project.title}".`,
            metadata: {
              schema_version: 1,
              routing: {
                target: 'project_details',
                fallback: '/my/projects',
                params: { id: contributor.project.id },
              },
              entity_ids: {
                project_id: contributor.project.id,
                contributor_id: contributor.id,
              },
            },
            preferenceGate: 'push_enabled',
            idempotencyString: `PROJECT_COLLABORATION_ACCEPTED:${contributor.id}`,
          });
        } catch {
          // Non-blocking notification delivery
        }
      }

      return updated;
    });
  }

  /**
   * Lists contributors for a project.
   * If caller is project owner or admin, returns all invitations (PENDING, ACCEPTED, DECLINED).
   * For other users and public visitors, returns only ACCEPTED contributors on published projects.
   */
  async listProjectContributors(callerUserId: string | null, projectId: string) {
    return withUserContext(callerUserId, async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true, ownerId: true, deletedAt: true, visibility: true },
      });

      if (!project || project.deletedAt !== null) {
        throw new NotFoundError('Project not found');
      }

      let isOwnerOrAdmin = false;
      if (callerUserId) {
        if (project.ownerId === callerUserId) {
          isOwnerOrAdmin = true;
        } else {
          const caller = await tx.user.findUnique({
            where: { id: callerUserId },
            select: { globalRole: true },
          });
          isOwnerOrAdmin = caller?.globalRole === 'PLATFORM_ADMIN' || caller?.globalRole === 'FACULTY_ADMIN';
        }
      }

      if (!isOwnerOrAdmin && project.visibility !== 'PUBLISHED') {
        throw new NotFoundError('Project not found');
      }

      const whereClause: Prisma.ProjectContributorWhereInput = {
        projectId,
        ...(isOwnerOrAdmin ? {} : { status: 'ACCEPTED' }),
      };

      const contributors = await tx.projectContributor.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              email: true,
              studentProfile: { select: { slug: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return contributors.map((c) => ({
        id: c.id,
        role: c.role,
        status: c.status,
        created_at: c.createdAt,
        invited_email: isOwnerOrAdmin ? c.invitedEmail : undefined,
        user_id: c.userId,
        name: c.user?.fullName || (isOwnerOrAdmin ? c.invitedEmail : 'Collaborator'),
        email: isOwnerOrAdmin ? (c.user?.email || c.invitedEmail) : undefined,
        avatar_url: c.user?.avatarUrl || null,
        slug: c.user?.studentProfile?.slug || null,
      }));
    });
  }

  /**
   * Revokes or cancels a collaborator invitation or existing membership.
   * Allowed for project owners, admins, or the contributor themselves (leaving the project).
   */
  async removeContributor(userId: string, projectId: string, contributorId: string, isAdmin = false) {
    return withUserContext(userId, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');

      const contributor = await tx.projectContributor.findUnique({
        where: { id: contributorId },
        include: {
          project: { select: { id: true, ownerId: true, deletedAt: true } },
        },
      });

      if (!contributor || contributor.projectId !== projectId) {
        throw new NotFoundError('Contributor invitation or record not found');
      }

      const isOwner = contributor.project.ownerId === userId;
      const isSelf =
        (contributor.userId && contributor.userId === userId) ||
        (contributor.invitedEmail && contributor.invitedEmail.toLowerCase() === user.email.toLowerCase());

      if (!isOwner && !isSelf && !isAdmin) {
        throw new ForbiddenError('You do not have permission to manage this contributor');
      }

      await tx.projectContributor.delete({
        where: { id: contributorId },
      });

      return {
        success: true,
        message: isSelf ? 'You have left the project' : 'Contributor removed successfully',
      };
    });
  }

  /**
   * Submits a project abuse report using the submit_project_report SECURITY DEFINER function.
   * Keeps reporter identity and report details strictly private (zero SELECT leakage).
   */
  async reportProject(reporterId: string | null, projectId: string, input: z.infer<typeof SubmitReportSchema>) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt !== null) {
      throw new NotFoundError('Project not found');
    }

    const details = input.details?.trim() || null;
    await prisma.$queryRaw`
      SELECT submit_project_report(
        ${projectId}::uuid,
        ${reporterId ? reporterId : null}::uuid,
        ${input.reason}::"ReportReason",
        ${details}::text
      )
    `;

    return {
      success: true,
      message: 'Report submitted successfully. Thank you for helping keep NST Projects safe.',
    };
  }

  /**
   * Admin: Lists projects for moderation.
   */
  async listAdminProjects(adminUserId: string, page = 1, limit = 20, filter?: 'all' | 'reported' | 'hidden') {
    return withUserContext(adminUserId, async (tx) => {
      const skip = (page - 1) * limit;
      const where: Prisma.ProjectWhereInput = { deletedAt: null };

      if (filter === 'hidden') {
        where.visibility = 'UNPUBLISHED';
      } else if (filter === 'reported') {
        where.reports = { some: { status: 'PENDING' } };
      }

      const [total, projects] = await Promise.all([
        tx.project.count({ where }),
        tx.project.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            owner: { select: { fullName: true, email: true } },
            reports: { select: { id: true, reason: true, status: true, createdAt: true } },
            moderationActions: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        }),
      ]);

      return {
        items: projects,
        data: projects,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  /**
   * Admin: Moderates a project (HIDE, RESTORE, REMOVE, INVALIDATE_LIKES).
   */
  async moderateProject(adminUserId: string, projectId: string, input: z.infer<typeof ModerateProjectSchema>) {
    return withUserContext(adminUserId, async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId } });
      if (!project) throw new NotFoundError('Project not found');

      let nextVisibility = project.visibility;
      let deletedAt = project.deletedAt;

      if (input.action === 'HIDE') {
        nextVisibility = 'UNPUBLISHED';
      } else if (input.action === 'RESTORE') {
        nextVisibility = 'PUBLISHED';
        deletedAt = null;
      } else if (input.action === 'REMOVE') {
        nextVisibility = 'REMOVED';
        deletedAt = new Date();
      }

      await tx.project.update({
        where: { id: projectId },
        data: {
          visibility: nextVisibility,
          deletedAt,
          ...(input.action === 'INVALIDATE_LIKES' ? { likeCount: 0 } : {}),
        },
      });

      if (input.action === 'INVALIDATE_LIKES') {
        await tx.projectLike.deleteMany({ where: { projectId } });
      }

      const action = await tx.projectModerationAction.create({
        data: {
          projectId,
          actorId: adminUserId,
          action: input.action,
          reason: input.reason.trim(),
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });

      return action;
    });
  }

  /**
   * Admin: Lists reports.
   */
  async listReports(adminUserId: string, status?: 'PENDING' | 'RESOLVED' | 'DISMISSED', page = 1, limit = 20) {
    return withUserContext(adminUserId, async (tx) => {
      const skip = (page - 1) * limit;
      const where: Prisma.ProjectReportWhereInput = {};
      if (status) where.status = status;

      const [total, reports] = await Promise.all([
        tx.projectReport.count({ where }),
        tx.projectReport.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            project: {
              select: { id: true, title: true, slug: true, visibility: true },
            },
            resolvedBy: { select: { fullName: true } },
          },
        }),
      ]);

      return {
        items: reports,
        data: reports,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  /**
   * Admin: Resolves a report.
   */
  async resolveReport(adminUserId: string, reportId: string, input: z.infer<typeof ResolveReportSchema>) {
    return withUserContext(adminUserId, async (tx) => {
      const report = await tx.projectReport.findUnique({ where: { id: reportId } });
      if (!report) throw new NotFoundError('Report not found');

      return tx.projectReport.update({
        where: { id: reportId },
        data: {
          status: input.status,
          resolutionNotes: input.resolutionNotes?.trim() || null,
          resolvedById: adminUserId,
          resolvedAt: new Date(),
        },
      });
    });
  }
}

export const projectsService = new ProjectsService();
