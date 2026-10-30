import { prisma } from '../../lib/prisma';
import { withUserContext } from '@nst/database';
import { NotFoundError, BadRequestError, ConflictError } from '../../lib/errors';

interface AwardInput {
  id?: string;
  title: string;
  award_type: 'RANKED_PLACEMENT' | 'SPECIAL_AWARD' | 'HONORABLE_MENTION' | 'CUSTOM';
  placement?: number | null;
  description?: string | null;
  prize_details?: string | null;
  display_order: number;
  is_tied: boolean;
  tie_ranking_type?: 'COMPETITION' | 'DENSE' | null;
  recipients: {
    id?: string;
    recipient_type: 'INDIVIDUAL' | 'TEAM' | 'EXTERNAL';
    user_id?: string | null;
    registration_id?: string | null;
    team_id?: string | null;
    external_name?: string | null;
    external_details?: string | null;
    is_authorized_exception?: boolean;
    exception_reason?: string | null;
    members?: {
      user_id?: string | null;
      registration_id?: string | null;
      display_name: string;
      avatar_url?: string | null;
      roll_number?: string | null;
      team_role?: string | null;
      is_authorized_exception?: boolean;
      exception_reason?: string | null;
    }[];
  }[];
  project_links?: {
    project_id?: string | null;
    external_project_url?: string | null;
    project_title_snapshot?: string | null;
  }[];
}

/**
 * Public: Fetch active published result for an event by slug
 */
export async function getPublicResultsBySlug(slug: string, viewerUserId?: string) {
  return withUserContext(viewerUserId || null, async (tx) => {
    // 1. Resolve event by current slug or slug history
    const event = await tx.event.findFirst({
      where: { slug, deletedAt: null },
      include: {
        eventClubs: {
          where: { isPrimary: true },
          include: { club: { select: { id: true, name: true, bannerUrl: true } } },
        },
      },
    });

    if (!event) {
      const historicalSlug = await tx.eventSlugHistory.findUnique({
        where: { slug },
        include: {
          event: {
            include: {
              eventClubs: {
                where: { isPrimary: true },
                include: { club: { select: { id: true, name: true, bannerUrl: true } } },
              },
            },
          },
        },
      });

      if (historicalSlug?.event && !historicalSlug.event.deletedAt) {
        return {
          redirect: true,
          canonical_slug: historicalSlug.event.slug,
        };
      }

      throw new NotFoundError('Event not found');
    }

    // 2. Event state & visibility check
    if (event.state !== 'PUBLISHED' && event.state !== 'ARCHIVED') {
      throw new NotFoundError('Event results are not accessible');
    }

    if (event.visibility === 'RESTRICTED' && !viewerUserId) {
      return {
        status: 'UNAUTHENTICATED_RESTRICTED',
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
          visibility: event.visibility,
        },
      };
    }

    // 3. Find Result Set
    const resultSet = await tx.eventResultSet.findUnique({
      where: { eventId: event.id },
    });

    if (!resultSet || resultSet.status === 'NOT_CONFIGURED') {
      return {
        status: 'NOT_CONFIGURED',
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
          start_time: event.startTime,
          end_time: event.endTime,
          event_type: event.eventType,
          primary_club: event.eventClubs[0]?.club || null,
        },
        results: null,
      };
    }

    if (resultSet.status === 'WITHDRAWN') {
      return {
        status: 'WITHDRAWN',
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
          start_time: event.startTime,
          end_time: event.endTime,
          event_type: event.eventType,
          primary_club: event.eventClubs[0]?.club || null,
        },
        results: null,
      };
    }

    if (!resultSet.activePublishedRevisionId) {
      return {
        status: 'DRAFT',
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
          start_time: event.startTime,
          end_time: event.endTime,
          event_type: event.eventType,
          primary_club: event.eventClubs[0]?.club || null,
        },
        results: null,
      };
    }

    const activeRevision = await tx.eventResultRevision.findUnique({
      where: { id: resultSet.activePublishedRevisionId },
      include: {
        awards: {
          orderBy: [{ displayOrder: 'asc' }, { placement: 'asc' }],
          include: {
            recipients: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatarUrl: true,
                    studentProfile: { select: { slug: true } },
                    academicProfile: {
                      select: {
                        batch: {
                          select: {
                            admissionYear: true,
                            graduationYear: true,
                            program: { select: { name: true, code: true } },
                          },
                        },
                      },
                    },
                  },
                },
              team: { select: { id: true, name: true } },
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      email: true,
                      avatarUrl: true,
                      studentProfile: { select: { slug: true } },
                      academicProfile: {
                        select: {
                          batch: {
                            select: {
                              admissionYear: true,
                              graduationYear: true,
                              program: { select: { name: true, code: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          projectLinks: {
            include: {
              project: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  tagline: true,
                  coverImageUrl: true,
                  visibility: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!activeRevision || activeRevision.status !== 'PUBLISHED') {
    return {
      status: 'DRAFT',
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        start_time: event.startTime,
        end_time: event.endTime,
        event_type: event.eventType,
        primary_club: event.eventClubs[0]?.club || null,
      },
      results: null,
    };
  }

  // 4. Transform awards for public view
  const formattedAwards = activeRevision.awards.map((award: any) => {
    // Sanitize and format recipients
    const recipients = award.recipients.map((rec: any) => {
      const recipientData: any = {
        id: rec.id,
        recipient_type: rec.recipientType,
        is_authorized_exception: rec.isAuthorizedException,
      };

      if (rec.recipientType === 'INDIVIDUAL') {
        const programCode = rec.user?.academicProfile?.batch?.program?.code;
        const gradYear = rec.user?.academicProfile?.batch?.graduationYear;
        recipientData.student = {
          id: rec.user?.id,
          name: rec.user?.fullName || 'Anonymous Student',
          slug: rec.user?.studentProfile?.slug || null,
          avatar_url: rec.user?.avatarUrl,
          roll_number: rec.user?.email ? rec.user.email.split('@')[0] : null,
          program: programCode || null,
          batch: gradYear ? String(gradYear) : null,
        };
      } else if (rec.recipientType === 'TEAM') {
        recipientData.team = {
          id: rec.team?.id,
          name: rec.team?.name || 'Registered Team',
        };
        recipientData.members = rec.members.map((m: any) => {
          const mProgram = m.user?.academicProfile?.batch?.program?.code;
          const mGrad = m.user?.academicProfile?.batch?.graduationYear;
          return {
            id: m.id,
            user_id: m.userId,
            slug: m.user?.studentProfile?.slug || null,
            name: m.displayNameSnapshot,
            avatar_url: m.avatarUrlSnapshot || m.user?.avatarUrl,
            roll_number: m.rollNumberSnapshot || (m.user?.email ? m.user.email.split('@')[0] : null),
            program: mProgram || null,
            batch: mGrad ? String(mGrad) : null,
            team_role: m.teamRoleSnapshot,
            is_authorized_exception: m.isAuthorizedException,
          };
        });
      } else if (rec.recipientType === 'EXTERNAL') {
        recipientData.external = {
          name: rec.externalName,
          details: rec.externalDetails,
        };
      }

      return recipientData;
    });

    // Sanitize project links: only expose PUBLISHED non-deleted projects
    const projectLinks = award.projectLinks
      .map((pl: any) => {
        if (pl.projectId && pl.project) {
          if (pl.project.visibility === 'PUBLISHED' && !pl.project.deletedAt) {
            return {
              id: pl.id,
              type: 'NST_PROJECT',
              project_id: pl.project.id,
              title: pl.project.title,
              slug: pl.project.slug,
              tagline: pl.project.tagline,
              cover_image_url: pl.project.coverImageUrl,
            };
          }
          return null; // Suppress hidden/draft project
        }
        if (pl.externalProjectUrl) {
          return {
            id: pl.id,
            type: 'EXTERNAL_URL',
            url: pl.externalProjectUrl,
            title: pl.projectTitleSnapshot || 'Project Link',
          };
        }
        return null;
      })
      .filter(Boolean);

    return {
      id: award.id,
      title: award.title,
      award_type: award.awardType,
      placement: award.placement,
      description: award.description,
      prize_details: award.prizeDetails,
      display_order: award.displayOrder,
      is_tied: award.isTied,
      tie_ranking_type: award.tieRankingType,
      recipients,
      project_links: projectLinks,
    };
  });

  // Separate podium placements (1, 2, 3) vs other awards
  const podiumAwards = formattedAwards.filter(
    (a: any) => a.award_type === 'RANKED_PLACEMENT' && a.placement && a.placement >= 1 && a.placement <= 3
  );
  const otherRankedAwards = formattedAwards.filter(
    (a: any) => a.award_type === 'RANKED_PLACEMENT' && (!a.placement || a.placement > 3)
  );
  const specialAwards = formattedAwards.filter((a: any) => a.award_type !== 'RANKED_PLACEMENT');

  return {
    status: 'PUBLISHED',
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      start_time: event.startTime,
      end_time: event.endTime,
      event_type: event.eventType,
      registration_type: event.registrationType,
      primary_club: event.eventClubs[0]?.club || null,
    },
    results: {
      revision_number: activeRevision.revisionNumber,
      published_at: activeRevision.publishedAt,
      correction_reason: activeRevision.correctionReason,
      is_correction: !!activeRevision.correctionReason,
      podium: podiumAwards,
      additional_ranked: otherRankedAwards,
      special_awards: specialAwards,
      all_awards: formattedAwards,
    },
  };
  });
}

/**
 * Organizer: Get workspace data for an event
 */
export async function getOrganizerWorkspace(eventId: string, userId: string) {
  return withUserContext(userId, async (tx) => {
    // 1. Verify Event
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        eventClubs: {
          where: { isPrimary: true },
          include: { club: { select: { id: true, name: true } } },
        },
      },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    // 2. Find or create EventResultSet
    let resultSet = await tx.eventResultSet.findUnique({
      where: { eventId },
      include: {
        revisions: {
          orderBy: { revisionNumber: 'desc' },
          include: {
            creator: { select: { id: true, fullName: true } },
            publisher: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!resultSet) {
      resultSet = await tx.eventResultSet.create({
        data: {
          eventId,
          status: 'NOT_CONFIGURED',
        },
        include: {
          revisions: {
            orderBy: { revisionNumber: 'desc' },
            include: {
              creator: { select: { id: true, fullName: true } },
              publisher: { select: { id: true, fullName: true } },
            },
          },
        },
      });

      await tx.resultAuditLog.create({
        data: {
          resultSetId: resultSet.id,
          actorId: userId,
          action: 'RESULT_SET_INITIALIZED',
          metadata: { event_id: eventId },
        },
      });
    }

    // 3. Find current working revision (DRAFT if exists, or active PUBLISHED)
    let draftRevision = await tx.eventResultRevision.findFirst({
      where: { resultSetId: resultSet.id, status: 'DRAFT' },
      include: {
        awards: {
          orderBy: [{ displayOrder: 'asc' }, { placement: 'asc' }],
          include: {
            recipients: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatarUrl: true,
                    academicProfile: {
                      select: {
                        batch: {
                          select: {
                            admissionYear: true,
                            graduationYear: true,
                            program: { select: { name: true, code: true } },
                          },
                        },
                      },
                    },
                  },
                },
                team: { select: { id: true, name: true } },
                members: true,
              },
            },
            projectLinks: {
              include: {
                project: { select: { id: true, title: true, slug: true, visibility: true } },
              },
            },
          },
        },
      },
    });

    // If no draft exists and no published revision exists, create initial draft
    if (!draftRevision && resultSet.revisions.length === 0) {
      draftRevision = await tx.eventResultRevision.create({
        data: {
          resultSetId: resultSet.id,
          revisionNumber: 1,
          status: 'DRAFT',
          version: 1,
          createdBy: userId,
        },
        include: {
          awards: {
            include: {
              recipients: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      email: true,
                      avatarUrl: true,
                      academicProfile: {
                        select: {
                          batch: {
                            select: {
                              admissionYear: true,
                              graduationYear: true,
                              program: { select: { name: true, code: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                  team: { select: { id: true, name: true } },
                  members: true,
                },
              },
              projectLinks: {
                include: {
                  project: { select: { id: true, title: true, slug: true, visibility: true } },
                },
              },
            },
          },
        },
      });

      await tx.eventResultSet.update({
        where: { id: resultSet.id },
        data: { currentDraftRevisionId: draftRevision.id, status: 'DRAFT' },
      });

      await tx.resultAuditLog.create({
        data: {
          resultSetId: resultSet.id,
          revisionId: draftRevision.id,
          actorId: userId,
          action: 'DRAFT_CREATED',
          metadata: { revision_number: 1 },
        },
      });
    }

    // Active published revision if any
    const activePublishedRevision = resultSet.activePublishedRevisionId
      ? await tx.eventResultRevision.findUnique({
          where: { id: resultSet.activePublishedRevisionId },
          include: {
            awards: {
              orderBy: [{ displayOrder: 'asc' }, { placement: 'asc' }],
              include: {
                recipients: {
                  include: {
                    user: { select: { id: true, fullName: true, email: true } },
                    team: { select: { id: true, name: true } },
                    members: true,
                  },
                },
              },
            },
          },
        })
      : null;

    return {
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        state: event.state,
        visibility: event.visibility,
        registration_type: event.registrationType,
        primary_club: event.eventClubs[0]?.club || null,
      },
      result_set: {
        id: resultSet.id,
        status: resultSet.status,
        active_published_revision_id: resultSet.activePublishedRevisionId,
      },
      draft: draftRevision,
      active_published: activePublishedRevision,
      revision_history: resultSet.revisions,
    };
  });
}

/**
 * Search eligible individually registered participants for the event
 */
export async function getEligibleParticipants(
  eventId: string,
  userId: string,
  search?: string,
  limit = 50
) {
  return withUserContext(userId, async (tx) => {
    const where: any = {
      eventId,
      deletedAt: null,
      registrationStatus: 'REGISTERED',
    };

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.user = {
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      };
    }

    const registrations = await tx.eventRegistration.findMany({
      where,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            academicProfile: {
              select: {
                batch: {
                  select: {
                    admissionYear: true,
                    graduationYear: true,
                    program: { select: { name: true, code: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { registeredAt: 'asc' },
    });

    return registrations.map((r: any) => {
      const program = r.user?.academicProfile?.batch?.program?.code;
      const grad = r.user?.academicProfile?.batch?.graduationYear;
      return {
        registration_id: r.id,
        user_id: r.user?.id,
        full_name: r.user?.fullName || 'Anonymous Student',
        avatar_url: r.user?.avatarUrl,
        roll_number: r.user?.email ? r.user.email.split('@')[0] : null,
        program: program || null,
        batch: grad ? String(grad) : null,
      };
    });
  });
}

/**
 * Search eligible registered teams for the event
 */
export async function getEligibleTeams(
  eventId: string,
  userId: string,
  search?: string,
  limit = 50
) {
  return withUserContext(userId, async (tx) => {
    const where: any = {
      eventId,
      deletedAt: null,
    };

    if (search && search.trim().length > 0) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const teams = await tx.team.findMany({
      where,
      take: limit,
      include: {
        eventRegistrations: {
          where: { deletedAt: null, registrationStatus: 'REGISTERED' },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
                academicProfile: {
                  select: {
                    batch: {
                      select: {
                        admissionYear: true,
                        graduationYear: true,
                        program: { select: { name: true, code: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return teams.map((t: any) => ({
      team_id: t.id,
      name: t.name,
      leader_id: t.leaderId,
      status: t.status,
      members: (t.eventRegistrations || []).map((r: any) => {
        const grad = r.user?.academicProfile?.batch?.graduationYear;
        return {
          registration_id: r.id,
          user_id: r.user?.id,
          full_name: r.user?.fullName || 'Unknown',
          avatar_url: r.user?.avatarUrl,
          roll_number: r.user?.email ? r.user.email.split('@')[0] : null,
          batch: grad ? String(grad) : null,
          team_role: r.user?.id === t.leaderId ? 'LEADER' : 'MEMBER',
        };
      }),
    }));
  });
}

/**
 * Save draft awards and recipients
 */
export async function saveDraft(
  eventId: string,
  userId: string,
  data: { version: number; awards: AwardInput[] }
) {
  return withUserContext(userId, async (tx) => {
    // 1. Get result set
    const resultSet = await tx.eventResultSet.findUnique({
      where: { eventId },
    });

    if (!resultSet) {
      throw new NotFoundError('Result set not found for this event');
    }

    // 2. Find current draft
    const draft = await tx.eventResultRevision.findFirst({
      where: { resultSetId: resultSet.id, status: 'DRAFT' },
    });

    if (!draft) {
      throw new BadRequestError('No active draft found. Please create a correction draft if results are published.');
    }

    // Optimistic concurrency check and lock: conditionally bump version atomically
    const updatedCount = await tx.eventResultRevision.updateMany({
      where: { id: draft.id, version: data.version },
      data: {
        version: { increment: 1 },
      },
    });

    if (updatedCount.count === 0) {
      throw new ConflictError('Draft was modified concurrently by another organizer. Please refresh and review.');
    }

    const nextVersion = data.version + 1;

    // 3. Clear existing awards for this draft and re-insert atomically
    await tx.eventAward.deleteMany({
      where: { revisionId: draft.id },
    });

    for (let i = 0; i < data.awards.length; i++) {
      const award = data.awards[i];
      const createdAward = await tx.eventAward.create({
        data: {
          revisionId: draft.id,
          title: award.title,
          awardType: award.award_type,
          placement: award.placement || null,
          description: award.description || null,
          prizeDetails: award.prize_details || null,
          displayOrder: award.display_order ?? i,
          isTied: award.is_tied || false,
          tieRankingType: award.tie_ranking_type || null,
        },
      });

      // Insert recipients
      for (const rec of award.recipients || []) {
        const createdRec = await tx.awardRecipient.create({
          data: {
            awardId: createdAward.id,
            recipientType: rec.recipient_type,
            userId: rec.recipient_type === 'INDIVIDUAL' ? rec.user_id || null : null,
            registrationId: rec.recipient_type === 'INDIVIDUAL' ? rec.registration_id || null : null,
            teamId: rec.recipient_type === 'TEAM' ? rec.team_id || null : null,
            externalName: rec.recipient_type === 'EXTERNAL' ? rec.external_name || null : null,
            externalDetails: rec.recipient_type === 'EXTERNAL' ? rec.external_details || null : null,
            isAuthorizedException: rec.is_authorized_exception || false,
            exceptionReason: rec.exception_reason || null,
            exceptionAuthorizedBy: rec.is_authorized_exception ? userId : null,
          },
        });

        // Insert team member snapshots if TEAM
        if (rec.recipient_type === 'TEAM' && rec.members) {
          for (const m of rec.members) {
            await tx.awardRecipientMember.create({
              data: {
                recipientId: createdRec.id,
                userId: m.user_id || null,
                registrationId: m.registration_id || null,
                displayNameSnapshot: m.display_name,
                avatarUrlSnapshot: m.avatar_url || null,
                rollNumberSnapshot: m.roll_number || null,
                teamRoleSnapshot: m.team_role || null,
                isAuthorizedException: m.is_authorized_exception || false,
                exceptionReason: m.exception_reason || null,
              },
            });
          }
        }
      }

      // Insert project links
      for (const pl of award.project_links || []) {
        if (pl.project_id || pl.external_project_url) {
          await tx.awardProjectLink.create({
            data: {
              awardId: createdAward.id,
              projectId: pl.project_id || null,
              externalProjectUrl: pl.external_project_url || null,
              projectTitleSnapshot: pl.project_title_snapshot || null,
            },
          });
        }
      }
    }

    // 5. Audit log
    await tx.resultAuditLog.create({
      data: {
        resultSetId: resultSet.id,
        revisionId: draft.id,
        actorId: userId,
        action: 'DRAFT_SAVED',
        metadata: {
          awards_count: data.awards.length,
          version: nextVersion,
        },
      },
    });

    return {
      success: true,
      revision_id: draft.id,
      version: nextVersion,
    };
  });
}

/**
 * Publish a result revision atomically
 */
export async function publishRevision(
  eventId: string,
  userId: string,
  options: {
    revision_id: string;
    version: number;
    notify_winners: boolean;
    announce_participants: boolean;
  }
) {
  return withUserContext(userId, async (tx) => {
    // 1. Fetch Event & Result Set
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        eventClubs: {
          where: { isPrimary: true },
          include: { club: true },
        },
      },
    });

    if (!event || event.deletedAt) {
      throw new NotFoundError('Event not found');
    }

    if (event.state === 'CANCELLED') {
      throw new BadRequestError('Cannot publish results for a cancelled event.');
    }

    const resultSet = await tx.eventResultSet.findUnique({
      where: { eventId },
    });

    if (!resultSet) {
      throw new NotFoundError('Result set not found');
    }

    // 2. Fetch Revision
    const revision = await tx.eventResultRevision.findUnique({
      where: { id: options.revision_id },
      include: {
        awards: {
          include: {
            recipients: {
              include: {
                members: true,
                user: true,
                team: true,
                registration: true,
              },
            },
            projectLinks: true,
          },
        },
      },
    });

    if (!revision || revision.resultSetId !== resultSet.id) {
      throw new NotFoundError('Revision not found for this event');
    }

    if (revision.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot publish revision with status: ${revision.status}`);
    }

    if (revision.version !== options.version) {
      throw new ConflictError('Revision version mismatch. Please review latest draft before publishing.');
    }

    // 3. Validation: awards and recipients
    if (revision.awards.length === 0) {
      throw new BadRequestError('Cannot publish results without any awards configured.');
    }

    for (const award of revision.awards) {
      if (!award.title || award.title.trim().length === 0) {
        throw new BadRequestError('All awards must have a title.');
      }

      if (award.recipients.length === 0) {
        throw new BadRequestError(`Award "${award.title}" has no recipients assigned. Please assign a recipient or remove the award before publishing.`);
      }

      if (award.awardType === 'RANKED_PLACEMENT') {
        if (!award.placement || award.placement < 1) {
          throw new BadRequestError(`Award "${award.title}" is a Ranked Placement and must have a positive placement number.`);
        }
      }

      for (const rec of award.recipients) {
        if (rec.recipientType === 'INDIVIDUAL') {
          if (!rec.userId || !rec.registrationId) {
            throw new BadRequestError(`Individual recipient for "${award.title}" is missing student identity or registration.`);
          }
          // Validate registration belongs to this event
          if (!rec.registration || rec.registration.eventId !== eventId) {
            throw new BadRequestError(`Recipient student in "${award.title}" is not registered for this event.`);
          }
          if (rec.registration.deletedAt || rec.registration.registrationStatus !== 'REGISTERED') {
            if (!rec.isAuthorizedException) {
              throw new BadRequestError(`Recipient student in "${award.title}" does not have an active registration for this event.`);
            }
          }
        } else if (rec.recipientType === 'TEAM') {
          if (!rec.teamId || !rec.team) {
            throw new BadRequestError(`Team recipient for "${award.title}" is missing team reference.`);
          }
          if (rec.team.eventId !== eventId || rec.team.deletedAt) {
            throw new BadRequestError(`Team in "${award.title}" does not belong to this event.`);
          }
          if (rec.members.length === 0 && !rec.isAuthorizedException) {
            throw new BadRequestError(`Team "${rec.team.name}" in "${award.title}" has no recognized members confirmed.`);
          }
        } else if (rec.recipientType === 'EXTERNAL') {
          if (!rec.externalName || rec.externalName.trim().length === 0) {
            throw new BadRequestError(`External recipient for "${award.title}" must have a name.`);
          }
        }
      }
    }

    const now = new Date();

    // 4. Atomic Database Transitions
    // A. Supersede any currently active published revision
    await tx.eventResultRevision.updateMany({
      where: {
        resultSetId: resultSet.id,
        status: 'PUBLISHED',
      },
      data: {
        status: 'SUPERSEDED',
      },
    });

    // B. Publish this revision conditionally
    const publishedCount = await tx.eventResultRevision.updateMany({
      where: {
        id: revision.id,
        status: 'DRAFT',
        version: options.version,
      },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        publishedBy: userId,
      },
    });

    if (publishedCount.count === 0) {
      throw new ConflictError('Revision has already been published or modified concurrently.');
    }

    // C. Update ResultSet
    await tx.eventResultSet.update({
      where: { id: resultSet.id },
      data: {
        status: 'PUBLISHED',
        activePublishedRevisionId: revision.id,
        currentDraftRevisionId: null,
      },
    });

    // 5. Reconcile Student Achievements
    // Deactivate previous active achievements for this result set
    await tx.studentAchievement.updateMany({
      where: {
        resultSetId: resultSet.id,
        isActive: true,
      },
      data: {
        isActive: false,
        supersededByRevisionId: revision.id,
      },
    });

    // Create achievements for current winners
    const winnersToNotify: { userId: string; awardTitle: string; placement?: number | null }[] = [];

    for (const award of revision.awards) {
      const linkedProject = award.projectLinks.find((pl: any) => pl.projectId);

      for (const rec of award.recipients) {
        if (rec.recipientType === 'INDIVIDUAL' && rec.userId) {
          await tx.studentAchievement.upsert({
            where: {
              userId_awardId_revisionId: {
                userId: rec.userId,
                awardId: award.id,
                revisionId: revision.id,
              },
            },
            create: {
              userId: rec.userId,
              eventId,
              resultSetId: resultSet.id,
              revisionId: revision.id,
              awardId: award.id,
              recipientId: rec.id,
              awardTitle: award.title,
              awardType: award.awardType,
              placement: award.placement,
              isTeamAward: false,
              linkedProjectId: linkedProject?.projectId || null,
              publishedAt: now,
              isActive: true,
            },
            update: {
              isActive: true,
              supersededByRevisionId: null,
            },
          });

          winnersToNotify.push({
            userId: rec.userId,
            awardTitle: award.title,
            placement: award.placement,
          });
        } else if (rec.recipientType === 'TEAM' && rec.teamId) {
          for (const member of rec.members) {
            if (member.userId) {
              await tx.studentAchievement.upsert({
                where: {
                  userId_awardId_revisionId: {
                    userId: member.userId,
                    awardId: award.id,
                    revisionId: revision.id,
                  },
                },
                create: {
                  userId: member.userId,
                  eventId,
                  resultSetId: resultSet.id,
                  revisionId: revision.id,
                  awardId: award.id,
                  recipientId: rec.id,
                  awardTitle: award.title,
                  awardType: award.awardType,
                  placement: award.placement,
                  isTeamAward: true,
                  teamId: rec.teamId,
                  teamNameSnapshot: rec.team?.name || null,
                  linkedProjectId: linkedProject?.projectId || null,
                  publishedAt: now,
                  isActive: true,
                },
                update: {
                  isActive: true,
                  supersededByRevisionId: null,
                },
              });

              winnersToNotify.push({
                userId: member.userId,
                awardTitle: award.title,
                placement: award.placement,
              });
            }
          }
        }
      }
    }
    // 6. Record Audit Log
    await tx.resultAuditLog.create({
      data: {
        resultSetId: resultSet.id,
        revisionId: revision.id,
        actorId: userId,
        action: revision.correctionReason ? 'CORRECTION_PUBLISHED' : 'PUBLISHED',
        reason: revision.correctionReason || null,
        metadata: {
          revision_number: revision.revisionNumber,
          awards_count: revision.awards.length,
          achievements_created: winnersToNotify.length,
        },
      },
    });

    // 7. Notification Outbox & Dispatch
    if (options.notify_winners && winnersToNotify.length > 0) {
      const seen = new Set<string>();
      for (const winner of winnersToNotify) {
        const key = `${revision.id}_${winner.userId}_WINNER`;
        if (seen.has(key)) continue;
        seen.add(key);

        const title = `🏆 Result Announcement: ${event.title}`;
        const body = winner.placement
          ? `Congratulations! You received ${winner.placement === 1 ? '1st Place' : winner.placement === 2 ? '2nd Place' : winner.placement === 3 ? '3rd Place' : `${winner.placement}th Place`} (${winner.awardTitle}) in ${event.title}!`
          : `Congratulations! You were recognized with "${winner.awardTitle}" in ${event.title}!`;

        await tx.resultNotificationOutbox.upsert({
          where: { idempotencyKey: key },
          create: {
            resultSetId: resultSet.id,
            revisionId: revision.id,
            recipientUserId: winner.userId,
            notificationType: 'WINNER_NOTIFICATION',
            idempotencyKey: key,
            deliveryStatus: 'DELIVERED',
            payload: {
              event_id: eventId,
              event_slug: event.slug,
              award_title: winner.awardTitle,
              placement: winner.placement,
            },
          },
          update: {},
        });

        // In-app notification creation (temporarily set app.user_id to satisfy notifications RLS)
        const [caller] = await tx.$queryRaw<any[]>`SELECT current_setting('app.user_id', true) as uid`;
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${winner.userId}'`);
        const notification = await tx.notification.create({
          data: {
            userId: winner.userId,
            title,
            body,
            type: 'EVENT_REMINDER',
            metadata: {
              event_id: eventId,
              slug: event.slug,
              screen: 'EventResults',
              award_title: winner.awardTitle,
            },
          },
        });
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${caller.uid || ''}'`);

        // Trigger real-time SSE notification
        await tx.$executeRaw`
          SELECT pg_notify(
            ${`user_${winner.userId}_notifications_live`},
            ${JSON.stringify({
              type: 'NOTIFICATION_RECEIVED',
              notification_id: notification.id,
              title,
              body,
            })}
          )
        `;
      }
    }

    return {
      success: true,
      revision_id: revision.id,
      revision_number: revision.revisionNumber,
      published_at: now,
    };
  });
}

/**
 * Create a correction draft from active published revision
 */
export async function createCorrectionDraft(
  eventId: string,
  userId: string,
  data: { correction_reason: string }
) {
  return withUserContext(userId, async (tx) => {
    const resultSet = await tx.eventResultSet.findUnique({
      where: { eventId },
      include: {
        revisions: {
          orderBy: { revisionNumber: 'desc' },
        },
      },
    });

    if (!resultSet || !resultSet.activePublishedRevisionId) {
      throw new BadRequestError('Cannot create a correction draft when no published results exist.');
    }

    // Check if an existing draft already exists
    const existingDraft = await tx.eventResultRevision.findFirst({
      where: { resultSetId: resultSet.id, status: 'DRAFT' },
    });

    if (existingDraft) {
      return {
        already_exists: true,
        revision_id: existingDraft.id,
        revision_number: existingDraft.revisionNumber,
      };
    }

    // Fetch active published revision to copy awards
    const activeRevision = await tx.eventResultRevision.findUnique({
      where: { id: resultSet.activePublishedRevisionId },
      include: {
        awards: {
          include: {
            recipients: {
              include: { members: true },
            },
            projectLinks: true,
          },
        },
      },
    });

    if (!activeRevision) {
      throw new NotFoundError('Active published revision not found');
    }

    const nextRevisionNumber = (resultSet.revisions[0]?.revisionNumber || 1) + 1;

    // Create new DRAFT revision
    const newDraft = await tx.eventResultRevision.create({
      data: {
        resultSetId: resultSet.id,
        revisionNumber: nextRevisionNumber,
        status: 'DRAFT',
        version: 1,
        createdBy: userId,
        correctionReason: data.correction_reason,
      },
    });

    // Copy awards, recipients, member snapshots, and project links
    for (const award of activeRevision.awards) {
      const newAward = await tx.eventAward.create({
        data: {
          revisionId: newDraft.id,
          title: award.title,
          awardType: award.awardType,
          placement: award.placement,
          description: award.description,
          prizeDetails: award.prizeDetails,
          displayOrder: award.displayOrder,
          isTied: award.isTied,
          tieRankingType: award.tieRankingType,
        },
      });

      for (const rec of award.recipients) {
        const newRec = await tx.awardRecipient.create({
          data: {
            awardId: newAward.id,
            recipientType: rec.recipientType,
            userId: rec.userId,
            registrationId: rec.registrationId,
            teamId: rec.teamId,
            externalName: rec.externalName,
            externalDetails: rec.externalDetails,
            isAuthorizedException: rec.isAuthorizedException,
            exceptionReason: rec.exceptionReason,
            exceptionAuthorizedBy: rec.exceptionAuthorizedBy,
          },
        });

        for (const m of rec.members) {
          await tx.awardRecipientMember.create({
            data: {
              recipientId: newRec.id,
              userId: m.userId,
              registrationId: m.registrationId,
              displayNameSnapshot: m.displayNameSnapshot,
              avatarUrlSnapshot: m.avatarUrlSnapshot,
              rollNumberSnapshot: m.rollNumberSnapshot,
              teamRoleSnapshot: m.teamRoleSnapshot,
              isAuthorizedException: m.isAuthorizedException,
              exceptionReason: m.exceptionReason,
            },
          });
        }
      }

      for (const pl of award.projectLinks) {
        await tx.awardProjectLink.create({
          data: {
            awardId: newAward.id,
            projectId: pl.projectId,
            externalProjectUrl: pl.externalProjectUrl,
            projectTitleSnapshot: pl.projectTitleSnapshot,
          },
        });
      }
    }

    await tx.eventResultSet.update({
      where: { id: resultSet.id },
      data: { currentDraftRevisionId: newDraft.id },
    });

    await tx.resultAuditLog.create({
      data: {
        resultSetId: resultSet.id,
        revisionId: newDraft.id,
        actorId: userId,
        action: 'CORRECTION_DRAFT_CREATED',
        reason: data.correction_reason,
        metadata: {
          previous_revision_id: activeRevision.id,
          revision_number: nextRevisionNumber,
        },
      },
    });

    return {
      success: true,
      revision_id: newDraft.id,
      revision_number: nextRevisionNumber,
    };
  });
}

/**
 * Withdraw published results
 */
export async function withdrawResults(eventId: string, userId: string, reason: string) {
  return withUserContext(userId, async (tx) => {
    const resultSet = await tx.eventResultSet.findUnique({
      where: { eventId },
    });

    if (!resultSet || !resultSet.activePublishedRevisionId) {
      throw new BadRequestError('No active published results to withdraw.');
    }

    const now = new Date();

    await tx.eventResultRevision.update({
      where: { id: resultSet.activePublishedRevisionId },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: now,
        withdrawnBy: userId,
        withdrawalReason: reason,
      },
    });

    const withdrawnCount = await tx.eventResultSet.updateMany({
      where: {
        id: resultSet.id,
        status: 'PUBLISHED',
        activePublishedRevisionId: resultSet.activePublishedRevisionId,
      },
      data: { status: 'WITHDRAWN' },
    });

    if (withdrawnCount.count === 0) {
      throw new ConflictError('Results are not currently published or were modified concurrently.');
    }

    // Deactivate achievements
    await tx.studentAchievement.updateMany({
      where: {
        resultSetId: resultSet.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    await tx.resultAuditLog.create({
      data: {
        resultSetId: resultSet.id,
        revisionId: resultSet.activePublishedRevisionId,
        actorId: userId,
        action: 'RESULTS_WITHDRAWN',
        reason,
      },
    });

    return { success: true };
  });
}

/**
 * Restore previously withdrawn results
 */
export async function restoreResults(eventId: string, userId: string, reason: string) {
  return withUserContext(userId, async (tx) => {
    const resultSet = await tx.eventResultSet.findUnique({
      where: { eventId },
    });

    if (!resultSet || !resultSet.activePublishedRevisionId) {
      throw new BadRequestError('No withdrawn results to restore.');
    }

    const now = new Date();

    await tx.eventResultRevision.update({
      where: { id: resultSet.activePublishedRevisionId },
      data: {
        status: 'PUBLISHED',
        restoredAt: now,
        restoredBy: userId,
      },
    });

    const restoredCount = await tx.eventResultSet.updateMany({
      where: {
        id: resultSet.id,
        status: 'WITHDRAWN',
        activePublishedRevisionId: resultSet.activePublishedRevisionId,
      },
      data: { status: 'PUBLISHED' },
    });

    if (restoredCount.count === 0) {
      throw new ConflictError('Results are not in WITHDRAWN status or were modified concurrently.');
    }

    // Reactivate achievements for the active revision
    await tx.studentAchievement.updateMany({
      where: {
        revisionId: resultSet.activePublishedRevisionId,
      },
      data: {
        isActive: true,
      },
    });
    await tx.resultAuditLog.create({
      data: {
        resultSetId: resultSet.id,
        revisionId: resultSet.activePublishedRevisionId,
        actorId: userId,
        action: 'RESULTS_RESTORED',
        reason,
      },
    });

    return { success: true };
  });
}

/**
 * Submit report on potential result inaccuracy
 */
export async function submitResultReport(
  eventId: string,
  reporterId: string | null,
  data: { reason: string; details: string }
) {
  return withUserContext(reporterId || null, async (tx) => {
    const resultSet = await tx.eventResultSet.findUnique({
      where: { eventId },
    });

    if (!resultSet || !resultSet.activePublishedRevisionId) {
      throw new BadRequestError('Results are not published for this event.');
    }

    const report = await tx.resultReport.create({
      data: {
        resultSetId: resultSet.id,
        revisionId: resultSet.activePublishedRevisionId,
        reporterId: reporterId || null,
        reason: data.reason,
        details: data.details,
        status: 'PENDING',
      },
    });

    if (reporterId) {
      await tx.resultAuditLog.create({
        data: {
          resultSetId: resultSet.id,
          revisionId: resultSet.activePublishedRevisionId,
          actorId: reporterId,
          action: 'REPORT_SUBMITTED',
          reason: data.reason,
        },
      });
    }

    return { success: true, report_id: report.id };
  });
}

/**
 * Query active achievements for a student
 */
export async function getStudentAchievements(userId: string, viewerId?: string) {
  const achievements = await prisma.studentAchievement.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: { publishedAt: 'desc' },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          visibility: true,
          state: true,
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
  });

  // Filter based on event visibility
  return achievements
    .filter((a) => {
      if (a.event.state !== 'PUBLISHED' && a.event.state !== 'ARCHIVED') return false;
      if (a.event.visibility === 'PUBLIC' || a.event.visibility === 'UNLISTED') return true;
      if (a.event.visibility === 'RESTRICTED') return !!viewerId;
      return false;
    })
    .map((a) => ({
      id: a.id,
      award_title: a.awardTitle,
      award_type: a.awardType,
      placement: a.placement,
      is_team_award: a.isTeamAward,
      team_name: a.teamNameSnapshot,
      published_at: a.publishedAt,
      event: {
        id: a.event.id,
        title: a.event.title,
        slug: a.event.slug,
        start_time: a.event.startTime,
      },
      linked_project:
        a.linkedProject && a.linkedProject.visibility === 'PUBLISHED'
          ? {
              id: a.linkedProject.id,
              title: a.linkedProject.title,
              slug: a.linkedProject.slug,
              cover_image_url: a.linkedProject.coverImageUrl,
            }
          : null,
    }));
}
