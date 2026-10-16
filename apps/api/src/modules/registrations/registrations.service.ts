import { withUserContext } from '@nst/database';
import { enqueueNotification } from '@nst/shared';
import { prisma } from '../../lib/prisma';

import { NotFoundError, BadRequestError, ForbiddenError } from '../../lib/errors';
import { validateFieldValue } from '../../utils/form-validation';
import { mapDatabaseError } from '../../lib/errors/database-error-mapper';

import { checkAudienceEligibility } from '../events/audience.service';
import { isInstitutionalEmail, validateRegistrationEligibility } from '../events/events.service';

export const validateRegistrationResponses = async (
  tx: any,
  eventId: string,
  responses?: { fieldDefinitionId: string; value: string }[]
) => {
  // Validate required custom fields (Registration Questionnaire fields have formId: null)
  const requiredFields = await tx.eventFormField.findMany({
    where: { eventId, formId: null, isRequired: true },
  });

  if (requiredFields.length > 0) {
    const providedFieldIds = new Set(responses?.map((r) => r.fieldDefinitionId) || []);
    const missingFields = requiredFields.filter((f: any) => {
      const resp = responses?.find((r) => r.fieldDefinitionId === f.fieldDefinitionId);
      return (
        !providedFieldIds.has(f.fieldDefinitionId) ||
        !resp ||
        !resp.value?.trim() ||
        resp.value.trim() === '[]'
      );
    });

    if (missingFields.length > 0) {
      throw new BadRequestError(
        `Missing required registration fields: ${missingFields.map((f: any) => f.fieldDefinitionId).join(', ')}`
      );
    }
  }

  // If custom responses provided, validate against event's registration fields
  if (responses && responses.length > 0) {
    const eventFields = await tx.eventFormField.findMany({
      where: { eventId, formId: null },
    });
    const allowedFieldIds = new Set(eventFields.map((f: any) => f.fieldDefinitionId));

    const fieldDefs = await tx.fieldDefinition.findMany({
      where: { id: { in: responses.map((r) => r.fieldDefinitionId) } },
    });

    for (const response of responses) {
      if (!allowedFieldIds.has(response.fieldDefinitionId)) {
        throw new BadRequestError(
          `Field ${response.fieldDefinitionId} is not part of this event's registration form`
        );
      }
      const fieldDef = fieldDefs.find((f: any) => f.id === response.fieldDefinitionId);
      if (!fieldDef) {
        throw new BadRequestError(`Field definition ${response.fieldDefinitionId} not found`);
      }
      validateFieldValue(
        { fieldType: fieldDef.fieldType, options: fieldDef.options, label: fieldDef.label },
        response.value
      );
    }
  }
};

export const saveRegistrationResponses = async (
  tx: any,
  userId: string,
  registrationId: string,
  eventId: string,
  responses?: { fieldDefinitionId: string; value: string }[]
) => {
  if (!responses || responses.length === 0) return;

  const fieldDefs = await tx.fieldDefinition.findMany({
    where: { id: { in: responses.map((r) => r.fieldDefinitionId) } },
  });
  const reusableFieldIds = new Set(fieldDefs.filter((f: any) => f.isReusable).map((f: any) => f.id));

  for (const response of responses) {
    const existingResponse = await tx.eventRegistrationResponse.findFirst({
      where: {
        eventRegistrationId: registrationId,
        formId: null,
        fieldDefinitionId: response.fieldDefinitionId,
      },
    });

    if (existingResponse) {
      await tx.eventRegistrationResponse.update({
        where: { id: existingResponse.id },
        data: { value: response.value },
      });
    } else {
      await tx.eventRegistrationResponse.create({
        data: {
          eventRegistrationId: registrationId,
          formId: null,
          fieldDefinitionId: response.fieldDefinitionId,
          value: response.value,
        },
      });
    }

    // Upsert StudentProfileValue if reusable
    if (reusableFieldIds.has(response.fieldDefinitionId)) {
      await tx.studentProfileValue.upsert({
        where: {
          userId_fieldDefinitionId: {
            userId,
            fieldDefinitionId: response.fieldDefinitionId,
          },
        },
        create: {
          userId,
          fieldDefinitionId: response.fieldDefinitionId,
          value: response.value,
        },
        update: {
          value: response.value,
        },
      });
    }
  }
};

export const registerEvent = async (
  userId: string, 
  eventId: string,
  responses?: { fieldDefinitionId: string, value: string }[]
) => {
  return withUserContext(userId, async (tx) => {
    try {
      if (tx.user) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, googleSub: true, deletedAt: true },
        });
        validateRegistrationEligibility(user);
      }

      await validateRegistrationResponses(tx, eventId, responses);

      const result = await tx.$queryRaw<{ register_event: any }[]>`
        SELECT register_event(${eventId}::uuid);
      `;
      
      const res = result[0].register_event;

      // Handle custom form responses
      if (responses && responses.length > 0) {
        const reg = await tx.eventRegistration.findFirst({
          where: { eventId, userId, deletedAt: null },
        });

        if (reg) {
          await saveRegistrationResponses(tx, userId, reg.id, eventId, responses);
        }
      }

      return res;
    } catch (err: any) {
      mapDatabaseError(err);
    }
  });
};

export const cancelRegistration = async (userId: string, eventId: string) => {
  return withUserContext(userId, async (tx) => {
    try {
      const result = await tx.$queryRaw<{ cancel_registration: string[] }[]>`
        SELECT cancel_registration(${eventId}::uuid, ${userId}::uuid);
      `;
      
      const promotedUserIds = result[0].cancel_registration;
      
      if (promotedUserIds && promotedUserIds.length > 0) {
        for (const uid of promotedUserIds) {
          await enqueueNotification({
            tx,
            userId: uid,
            type: 'WAITLIST_PROMOTED',
            title: 'You are off the waitlist!',
            body: 'A spot opened up and you are now registered.',
            metadata: {
              schema_version: 1,
              routing: { target: 'event_details', fallback: '/events', params: { id: eventId } },
              entity_ids: { event_id: eventId }
            },
            preferenceGate: 'push_enabled',
            idempotencyString: `WAITLIST_PROMOTED:${uid}:${eventId}`
          });
        }
      }
      
      return promotedUserIds;
    } catch (err: any) {
      mapDatabaseError(err);
    }
  });
};

export const getEventRegistrations = async (userId: string, eventId: string, limit: number, cursor?: string, filter_status?: string) => {
  return withUserContext(userId, async (tx) => {
    const where: any = { eventId, deletedAt: null };
    if (filter_status) where.registrationStatus = filter_status;
    
    const take = limit + 1;
    const registrations = await tx.eventRegistration.findMany({
      where,
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: { user: { select: { id: true, fullName: true, email: true, globalRole: true } } },
      orderBy: [
        { registeredAt: 'desc' },
        { id: 'asc' }
      ]
    });

    const has_more = registrations.length > limit;
    if (has_more) registrations.pop();
    
    return {
      data: registrations,
      pagination: {
        next_cursor: has_more ? registrations[registrations.length - 1].id : null,
        has_more
      }
    };
  });
};

export const getMyRegistrations = async (userId: string): Promise<any[]> => {
  return withUserContext(userId, async (tx) => {
    const registrations = await tx.eventRegistration.findMany({
      where: { userId, deletedAt: null },
      include: { event: true },
      orderBy: { registeredAt: 'desc' }
    });
    return registrations;
  });
};

export const getMyRegistrationStatus = async (userId: string, eventId: string) => {
  return withUserContext(userId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { registrationType: true }
    });
    
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const reg = await tx.eventRegistration.findFirst({
      where: { eventId, userId, deletedAt: null },
      select: { 
        id: true,
        teamId: true, 
        registrationStatus: true,
        registeredAt: true 
      }
    });

    if (!reg) {
      return { status: 'NOT_REGISTERED' };
    }

    let waitlist_position: number | null = null;
    let finalStatus: string = reg.registrationStatus;
    
    if (reg.teamId) {
      const team = await tx.team.findUnique({
        where: { id: reg.teamId },
        select: { status: true },
      });
      if (team?.status === 'FORMING') {
        finalStatus = 'FORMING';
      }
    }

    if (finalStatus === 'WAITLISTED') {
      if (event.registrationType === 'INDIVIDUAL') {
        const countResult = await tx.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*)::int as count 
          FROM event_registrations er 
          WHERE er.event_id = ${eventId}::uuid 
            AND er.registration_status = 'WAITLISTED'
            AND er.team_id IS NULL 
            AND er.deleted_at IS NULL
            AND (er.registered_at < ${reg.registeredAt} OR (er.registered_at = ${reg.registeredAt} AND er.id < ${reg.id}::uuid))
        `;
        waitlist_position = countResult[0].count + 1;
      } else if (event.registrationType === 'TEAM' && reg.teamId) {
        const teamRegQuery = await tx.$queryRaw<{ min_reg: Date }[]>`
          SELECT min(er.registered_at) as min_reg
          FROM event_registrations er 
          WHERE er.team_id = ${reg.teamId}::uuid AND er.deleted_at IS NULL
        `;
        const myMinReg = teamRegQuery[0]?.min_reg;

        if (myMinReg) {
          const countResult = await tx.$queryRaw<{ count: number }[]>`
            SELECT COUNT(t.id)::int as count 
            FROM teams t
            WHERE t.event_id = ${eventId}::uuid 
              AND t.status = 'WAITLISTED'
              AND t.deleted_at IS NULL
              AND (
                (SELECT min(er.registered_at) FROM event_registrations er WHERE er.team_id = t.id AND er.deleted_at IS NULL) < ${myMinReg}
                OR (
                  (SELECT min(er.registered_at) FROM event_registrations er WHERE er.team_id = t.id AND er.deleted_at IS NULL) = ${myMinReg} 
                  AND t.id < ${reg.teamId}::uuid
                )
              )
          `;
          waitlist_position = countResult[0].count + 1;
        }
      }
    }

    return { 
      status: finalStatus,
      team_id: reg.teamId,
      waitlist_position 
    };
  });
};

export const getRegistrationResponses = async (
  userId: string,
  eventId: string,
  registrationId: string
) => {
  return withUserContext(userId, async (tx) => {
    const reg = await tx.eventRegistration.findFirst({
      where: {
        id: registrationId,
        eventId,
        deletedAt: null,
      },
    });

    if (!reg) {
      throw new NotFoundError('Registration not found');
    }

    return tx.eventRegistrationResponse.findMany({
      where: { eventRegistrationId: registrationId },
      include: { fieldDefinition: true },
    });
  });
};

