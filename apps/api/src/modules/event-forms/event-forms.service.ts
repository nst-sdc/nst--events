import { prisma } from '../../lib/prisma';
import { withUserContext, Prisma } from '@nst/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors';
import { validateFieldValue } from '../../utils/form-validation';


/**
 * Helper to check if a user is an admin/core member of the primary club for the given event,
 * or a Platform / Faculty Admin.
 */
async function isEventAdmin(tx: any, userId: string, eventId: string): Promise<boolean> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { globalRole: true },
  });
  if (user && ['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
    return true;
  }

  const hasRole = await tx.eventClub.findFirst({
    where: {
      eventId,
      isPrimary: true,
      club: {
        memberships: {
          some: {
            userId,
            deletedAt: null,
            role: { in: ['CLUB_ADMIN', 'CORE_MEMBER'] },
          },
        },
      },
    },
  });
  return !!hasRole;
}

export async function listEventForms(userId: string, eventId: string) {
  return withUserContext(userId, async (tx) => {
    const isAdmin = await isEventAdmin(tx, userId, eventId);

    let allowedToViewForms = isAdmin;
    
    // If not admin, check if student is registered
    if (!isAdmin) {
      const registration = await tx.eventRegistration.findFirst({
        where: {
          eventId,
          userId,
          registrationStatus: 'REGISTERED',
          deletedAt: null,
        },
      });
      if (registration) {
        allowedToViewForms = true;
      }
    }

    if (!allowedToViewForms) {
      throw new ForbiddenError('You do not have access to view forms for this event.');
    }

    const whereClause: any = { eventId };
    if (!isAdmin) {
      whereClause.publishedAt = { not: null };
    }

    return tx.eventForm.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    });
  });
}


export async function getEventForm(userId: string, eventId: string, formId: string) {
  return withUserContext(userId, async (tx) => {
    const isAdmin = await isEventAdmin(tx, userId, eventId);

    let allowedToViewForm = isAdmin;
    
    if (!isAdmin) {
      const registration = await tx.eventRegistration.findFirst({
        where: {
          eventId,
          userId,
          registrationStatus: 'REGISTERED',
          deletedAt: null,
        },
      });
      if (registration) {
        allowedToViewForm = true;
      }
    }

    if (!allowedToViewForm) {
      throw new ForbiddenError('You do not have access to view this form.');
    }

    const form = await tx.eventForm.findFirst({
      where: {
        id: formId,
        eventId,
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
          include: { fieldDefinition: true },
        },
      },
    });

    if (!form) throw new NotFoundError('Form not found');

    if (!isAdmin && (form.publishedAt === null || (form.releaseAt && form.releaseAt > new Date()))) {
      throw new ForbiddenError('This form is not yet available.');
    }

    return form;
  });
}

export async function createEventForm(userId: string, eventId: string, data: { title: string, purpose: any, releaseAt?: string | null, closeAt?: string | null }) {
  if (data.releaseAt && data.closeAt) {
    const release = new Date(data.releaseAt);
    const close = new Date(data.closeAt);
    if (close <= release) {
      throw new BadRequestError('Form closing time must be after opening time.');
    }
  }

  return withUserContext(userId, async (tx) => {
    return tx.eventForm.create({
      data: {
        eventId,
        title: data.title,
        purpose: data.purpose,
        releaseAt: data.releaseAt ? new Date(data.releaseAt) : null,
        closeAt: data.closeAt ? new Date(data.closeAt) : null,
        publishedAt: null, // Always starts as a Draft
      },
    });
  });
}

export async function publishEventForm(userId: string, eventId: string, formId: string) {
  return withUserContext(userId, async (tx) => {
    const form = await tx.eventForm.findFirst({
      where: { id: formId, eventId },
    });
    if (!form) throw new NotFoundError('Form not found');

    if (form.releaseAt && form.closeAt && form.closeAt <= form.releaseAt) {
      throw new BadRequestError('Form closing time must be after opening time.');
    }

    const questionCount = await tx.eventFormField.count({
      where: { formId, eventId },
    });
    if (questionCount === 0) {
      throw new BadRequestError('Cannot publish a form with no questions. Add at least one question first.');
    }

    return tx.eventForm.update({
      where: { id: formId },
      data: {
        publishedAt: new Date(),
      },
    });
  });
}

export async function unpublishEventForm(userId: string, eventId: string, formId: string) {
  return withUserContext(userId, async (tx) => {
    const form = await tx.eventForm.findFirst({
      where: { id: formId, eventId },
    });
    if (!form) throw new NotFoundError('Form not found');

    return tx.eventForm.update({
      where: { id: formId },
      data: {
        publishedAt: null,
      },
    });
  });
}

export async function updateEventForm(userId: string, eventId: string, formId: string, data: { title?: string, releaseAt?: string | null, closeAt?: string | null, isPublished?: boolean }) {
  return withUserContext(userId, async (tx) => {
    const existing = await tx.eventForm.findFirst({ where: { id: formId, eventId } });
    if (!existing) throw new NotFoundError('Form not found');

    const targetReleaseAt = data.releaseAt !== undefined
      ? (data.releaseAt ? new Date(data.releaseAt) : null)
      : existing.releaseAt;
    const targetCloseAt = data.closeAt !== undefined
      ? (data.closeAt ? new Date(data.closeAt) : null)
      : existing.closeAt;

    if (targetReleaseAt && targetCloseAt && targetCloseAt <= targetReleaseAt) {
      throw new BadRequestError('Form closing time must be after opening time.');
    }

    let newPublishedAt = existing.publishedAt;
    if (data.isPublished === true) {
      const questionCount = await tx.eventFormField.count({ where: { formId, eventId } });
      if (questionCount === 0) {
        throw new BadRequestError('Cannot publish a form with no questions. Add at least one question first.');
      }
      newPublishedAt = existing.publishedAt || new Date();
    } else if (data.isPublished === false) {
      newPublishedAt = null;
    }

    let newNotifiedAt: Date | null | undefined = undefined;
    const newReleaseAt = data.releaseAt !== undefined ? (data.releaseAt ? new Date(data.releaseAt) : null) : undefined;
    
    // If releaseAt is explicitly being changed, reset notifiedAt so the sweep job can fire again
    if (newReleaseAt !== undefined) {
      const existingReleaseAtTime = existing.releaseAt?.getTime() || null;
      const newReleaseAtTime = newReleaseAt?.getTime() || null;
      if (existingReleaseAtTime !== newReleaseAtTime) {
        newNotifiedAt = null;
      }
    }

    return tx.eventForm.update({
      where: { id: formId },
      data: {
        title: data.title,
        releaseAt: newReleaseAt,
        closeAt: data.closeAt !== undefined ? (data.closeAt ? new Date(data.closeAt) : null) : undefined,
        publishedAt: newPublishedAt,
        ...(newNotifiedAt !== undefined && { notifiedAt: newNotifiedAt }),
      },
    });
  });
}

export async function deleteEventForm(userId: string, eventId: string, formId: string) {
  return withUserContext(userId, async (tx) => {
    const existing = await tx.eventForm.findFirst({ where: { id: formId, eventId } });
    if (!existing) throw new NotFoundError('Form not found');

    const responseCount = await tx.eventRegistrationResponse.count({
      where: { formId },
    });
    if (responseCount > 0) {
      throw new BadRequestError('Cannot delete a form that already has responses. Unpublish or archive the form to preserve historical responses.');
    }

    await tx.eventForm.delete({ where: { id: formId } });
  });
}

export async function updateEventFormFields(
  userId: string,
  eventId: string,
  formId: string,
  fields: Array<{ fieldDefinitionId?: string; definition?: any; isRequired: boolean; order: number }>
) {
  return withUserContext(userId, async (tx) => {
    const form = await tx.eventForm.findFirst({ where: { id: formId, eventId } });
    if (!form) throw new NotFoundError('Form not found');

    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        eventClubs: {
          select: { clubId: true },
        },
      },
    });

    const caller = await tx.user.findUnique({
      where: { id: userId },
      select: { globalRole: true },
    });

    let derivedClubId: string | null = null;
    if (caller && !['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(caller.globalRole)) {
      derivedClubId = event?.eventClubs[0]?.clubId || null;
      if (!derivedClubId) {
        const membership = await tx.clubMembership.findFirst({
          where: {
            userId,
            role: { in: ['CLUB_ADMIN', 'CORE_MEMBER'] },
            deletedAt: null,
          },
          select: { clubId: true },
        });
        derivedClubId = membership?.clubId || null;
      }
    }

    const resolvedKeys = new Map<string, string>();
    const resolvedFields: Array<{ fieldDefinitionId: string; isRequired: boolean; order: number }> = [];

    for (const f of fields) {
      let resolvedId = f.fieldDefinitionId;
      if (!resolvedId && f.definition) {
        const cachedId = resolvedKeys.get(f.definition.key);
        if (cachedId) {
          resolvedId = cachedId;
        } else {
          const existingDef = await tx.fieldDefinition.findUnique({
            where: { key: f.definition.key },
          });
          if (existingDef) {
            resolvedId = existingDef.id;
          } else {
            const created = await tx.fieldDefinition.create({
              data: {
                key: f.definition.key,
                label: f.definition.label,
                fieldType: f.definition.fieldType,
                options: f.definition.options ? (f.definition.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                isReusable: f.definition.isReusable ?? true,
                createdByClubId: derivedClubId,
              },
            });
            resolvedId = created.id;
          }
          resolvedKeys.set(f.definition.key, resolvedId);
        }
      }

      if (!resolvedId) {
        throw new BadRequestError('Each question must have a valid field definition ID or definition payload');
      }

      resolvedFields.push({
        fieldDefinitionId: resolvedId,
        isRequired: f.isRequired,
        order: f.order,
      });
    }

    await tx.eventFormField.deleteMany({
      where: { eventId, formId },
    });

    const createdFields = [];
    for (const f of resolvedFields) {
      const field = await tx.eventFormField.create({
        data: {
          eventId,
          formId,
          fieldDefinitionId: f.fieldDefinitionId,
          isRequired: f.isRequired,
          order: f.order,
        },
        include: { fieldDefinition: true },
      });
      createdFields.push(field);
    }

    return createdFields;
  });
}

export async function submitEventFormResponses(
  userId: string,
  eventId: string,
  formId: string,
  responses: Array<{ fieldDefinitionId: string; value: string }>
) {
  return withUserContext(userId, async (tx) => {
    const form = await tx.eventForm.findFirst({
      where: { id: formId, eventId },
      include: { 
        fields: {
          include: { fieldDefinition: true }
        }
      },
    });
    if (!form) throw new NotFoundError('Form not found');

    const now = new Date();

    if (form.publishedAt === null) {
      throw new ForbiddenError('This form is not published.');
    }
    if (form.releaseAt && now < form.releaseAt) {
      throw new ForbiddenError('Form is not yet released.');
    }
    if (form.closeAt && now >= form.closeAt) {
      throw new ForbiddenError('Form is closed for submissions.');
    }

    const registration = await tx.eventRegistration.findFirst({
      where: {
        eventId,
        userId,
        registrationStatus: 'REGISTERED',
        deletedAt: null,
      },
    });
    if (!registration) {
      throw new ForbiddenError('Only actively registered students can submit this form.');
    }

    // Validate required form fields
    const requiredFields = form.fields.filter(f => f.isRequired);
    if (requiredFields.length > 0) {
      const providedFieldIds = new Set(responses?.map(r => r.fieldDefinitionId) || []);
      const missingFields = requiredFields.filter(f => {
        const response = responses?.find(r => r.fieldDefinitionId === f.fieldDefinitionId);
        // Ensure the value exists, is not null/undefined, and is not an empty string or empty array string '[]'
        return !providedFieldIds.has(f.fieldDefinitionId) || 
               !response || 
               !response.value?.trim() || 
               response.value.trim() === '[]';
      });
      
      if (missingFields.length > 0) {
        throw new BadRequestError(`Missing required form fields: ${missingFields.map(f => f.fieldDefinitionId).join(', ')}`);
      }
    }

    // Deduplicate responses by fieldDefinitionId (latest value takes precedence)
    const dedupedMap = new Map<string, { fieldDefinitionId: string; value: string }>();
    for (const r of responses || []) {
      dedupedMap.set(r.fieldDefinitionId, r);
    }
    const dedupedResponses = Array.from(dedupedMap.values());

    const savedResponses = [];
    for (const r of dedupedResponses) {
      const field = form.fields.find(f => f.fieldDefinitionId === r.fieldDefinitionId);
      if (!field) {
        throw new BadRequestError(`Field ${r.fieldDefinitionId} is not part of this form`);
      }
      
      validateFieldValue(
        { 
          fieldType: field.fieldDefinition.fieldType, 
          options: field.fieldDefinition.options, 
          label: field.fieldDefinition.label 
        }, 
        r.value
      );
      
      const response = await tx.eventRegistrationResponse.upsert({
        where: {
          eventRegistrationId_formId_fieldDefinitionId: {
            eventRegistrationId: registration.id,
            formId: form.id,
            fieldDefinitionId: r.fieldDefinitionId,
          }
        },
        create: {
          eventRegistrationId: registration.id,
          formId: form.id,
          fieldDefinitionId: r.fieldDefinitionId,
          value: r.value,
        },
        update: {
          value: r.value,
        }
      });
      savedResponses.push(response);

      // Only upsert to StudentProfileValue if the field definition is marked reusable
      if (field.fieldDefinition.isReusable) {
        await tx.studentProfileValue.upsert({
          where: {
            userId_fieldDefinitionId: {
              userId,
              fieldDefinitionId: r.fieldDefinitionId,
            },
          },
          create: {
            userId,
            fieldDefinitionId: r.fieldDefinitionId,
            value: r.value,
          },
          update: {
            value: r.value,
          }
        });
      }
    }

    return savedResponses;
  });
}

export async function getEventFormResponses(userId: string, eventId: string, formId: string) {
  return withUserContext(userId, async (tx) => {
    const form = await tx.eventForm.findFirst({ where: { id: formId, eventId } });
    if (!form) throw new NotFoundError('Form not found');

    return tx.eventRegistrationResponse.findMany({
      where: { formId },
      include: {
        eventRegistration: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              }
            }
          }
        },
        fieldDefinition: true,
      },
    });
  });
}
