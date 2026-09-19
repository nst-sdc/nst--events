import { prisma } from '../../lib/prisma';
import { withUserContext } from '@nst/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors';

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
      // Students only see released forms (null releaseAt means immediate)
      whereClause.OR = [
        { releaseAt: null },
        { releaseAt: { lte: new Date() } },
      ];
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

    if (!isAdmin && form.releaseAt && form.releaseAt > new Date()) {
      throw new ForbiddenError('This form is not yet available.');
    }

    return form;
  });
}

export async function createEventForm(userId: string, eventId: string, data: { title: string, purpose: any, releaseAt?: string | null, closeAt?: string | null }) {
  return withUserContext(userId, async (tx) => {
    return tx.eventForm.create({
      data: {
        eventId,
        title: data.title,
        purpose: data.purpose,
        releaseAt: data.releaseAt ? new Date(data.releaseAt) : null,
        closeAt: data.closeAt ? new Date(data.closeAt) : null,
      },
    });
  });
}

export async function updateEventForm(userId: string, eventId: string, formId: string, data: { title?: string, releaseAt?: string | null, closeAt?: string | null }) {
  return withUserContext(userId, async (tx) => {
    const existing = await tx.eventForm.findFirst({ where: { id: formId, eventId } });
    if (!existing) throw new NotFoundError('Form not found');

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
        ...(newNotifiedAt !== undefined && { notifiedAt: newNotifiedAt }),
      },
    });
  });
}

export async function deleteEventForm(userId: string, eventId: string, formId: string) {
  return withUserContext(userId, async (tx) => {
    const existing = await tx.eventForm.findFirst({ where: { id: formId, eventId } });
    if (!existing) throw new NotFoundError('Form not found');

    await tx.eventForm.delete({ where: { id: formId } });
  });
}

export async function updateEventFormFields(
  userId: string,
  eventId: string,
  formId: string,
  fields: Array<{ fieldDefinitionId: string; isRequired: boolean; order: number }>
) {
  return withUserContext(userId, async (tx) => {
    const form = await tx.eventForm.findFirst({ where: { id: formId, eventId } });
    if (!form) throw new NotFoundError('Form not found');

    await tx.eventFormField.deleteMany({
      where: { eventId, formId },
    });

    const createdFields = [];
    for (const f of fields) {
      const field = await tx.eventFormField.create({
        data: {
          eventId,
          formId,
          fieldDefinitionId: f.fieldDefinitionId,
          isRequired: f.isRequired,
          order: f.order,
        },
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
      include: { fields: true },
    });
    if (!form) throw new NotFoundError('Form not found');

    if (form.releaseAt && form.releaseAt > new Date()) {
      throw new ForbiddenError('Form is not yet released.');
    }
    if (form.closeAt && form.closeAt < new Date()) {
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
               response.value === '[]';
      });
      
      if (missingFields.length > 0) {
        throw new BadRequestError(`Missing required form fields: ${missingFields.map(f => f.fieldDefinitionId).join(', ')}`);
      }
    }

    const savedResponses = [];
    for (const r of responses) {
      const fieldDef = form.fields.find(f => f.fieldDefinitionId === r.fieldDefinitionId);
      if (!fieldDef) {
        throw new BadRequestError(`Field ${r.fieldDefinitionId} is not part of this form`);
      }
      
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

      // Also upsert to StudentProfileValue for the student's profile context if applicable
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
