import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/lib/prisma';
import { getRegistrationResponses } from '../../src/modules/registrations/registrations.service';
import { getEventFormResponses, updateEventForm } from '../../src/modules/event-forms/event-forms.service';
import { canManageEvent } from '../../src/middleware/authorize';
import { NotFoundError, ForbiddenError } from '../../src/lib/errors';
import { Request, Response, NextFunction } from 'express';

test('Blocker 5: Permissions and Response Integrity Verification', async (t) => {
  const origTransaction = prisma.$transaction;

  const eventAId = '11111111-1111-1111-1111-111111111111';
  const eventBId = '22222222-2222-2222-2222-222222222222';

  const regAId = 'reg-event-a';
  const regBId = 'reg-event-b';

  const formAId = 'form-event-a';
  const formBId = 'form-event-b';

  const organizerUserId = 'user-organizer';
  const studentUserId = 'user-student';

  function createMockTx() {
    return {
      $executeRaw: async () => {},
      user: {
        findUnique: async ({ where }: any) => {
          if (where.id === organizerUserId) {
            return { id: organizerUserId, globalRole: 'STUDENT' };
          }
          if (where.id === studentUserId) {
            return { id: studentUserId, globalRole: 'STUDENT' };
          }
          return null;
        },
      },
      eventClub: {
        findFirst: async ({ where }: any) => {
          const userId = where?.club?.memberships?.some?.userId;
          // Only organizer has role in primary club of event A
          if (where.eventId === eventAId && where.isPrimary && userId === organizerUserId) {
            return { id: 'ec-1', eventId: eventAId, isPrimary: true };
          }
          return null;
        },
      },
      eventRegistration: {
        findFirst: async ({ where }: any) => {
          if (where.id === regAId && where.eventId === eventAId) {
            return { id: regAId, eventId: eventAId, userId: 'student-1' };
          }
          if (where.id === regBId && where.eventId === eventBId) {
            return { id: regBId, eventId: eventBId, userId: 'student-2' };
          }
          return null;
        },
      },
      eventRegistrationResponse: {
        findMany: async ({ where }: any) => {
          if (where.eventRegistrationId === regAId) {
            return [{ id: 'resp-a', eventRegistrationId: regAId, value: 'Answer A' }];
          }
          if (where.eventRegistrationId === regBId) {
            return [{ id: 'resp-b', eventRegistrationId: regBId, value: 'Answer B' }];
          }
          if (where.formId === formAId) {
            return [{ id: 'resp-form-a', formId: formAId, value: 'Form A Answer' }];
          }
          return [];
        },
      },
      eventForm: {
        findFirst: async ({ where }: any) => {
          if (where.id === formAId && where.eventId === eventAId) {
            return { id: formAId, eventId: eventAId, title: 'Form A' };
          }
          if (where.id === formBId && where.eventId === eventBId) {
            return { id: formBId, eventId: eventBId, title: 'Form B' };
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          return { id: where.id, ...data };
        },
      },
    };
  }

  t.beforeEach(() => {
    prisma.$transaction = (async (fn: any) => {
      const mockTx = createMockTx();
      return await fn(mockTx);
    }) as any;
  });

  t.after(() => {
    prisma.$transaction = origTransaction;
  });

  await t.test('canManageEvent allows organizer for Event A but forbids Event B', async () => {
    const middleware = canManageEvent((req: Request) => req.params.id);

    // Request for Event A (which organizer manages)
    let nextCalled = false;
    let nextError: any = null;
    const reqA = { user: { id: organizerUserId }, params: { id: eventAId } } as unknown as Request;
    await middleware(reqA, {} as Response, ((err?: any) => {
      nextCalled = true;
      nextError = err;
    }) as NextFunction);
    assert.equal(nextCalled, true);
    assert.equal(nextError, undefined, 'Organizer must be allowed for Event A');

    // Request for Event B (which organizer does NOT manage)
    nextCalled = false;
    nextError = null;
    const reqB = { user: { id: organizerUserId }, params: { id: eventBId } } as unknown as Request;
    await middleware(reqB, {} as Response, ((err?: any) => {
      nextCalled = true;
      nextError = err;
    }) as NextFunction);
    assert.equal(nextCalled, true);
    assert.ok(nextError instanceof ForbiddenError, 'Organizer must be forbidden for Event B');
  });

  await t.test('canManageEvent forbids ordinary student from managing any event', async () => {
    const middleware = canManageEvent((req: Request) => req.params.id);
    let nextError: any = null;
    const req = { user: { id: studentUserId }, params: { id: eventAId } } as unknown as Request;
    await middleware(req, {} as Response, ((err?: any) => {
      nextError = err;
    }) as NextFunction);
    assert.ok(nextError instanceof ForbiddenError, 'Ordinary student must be forbidden');
  });

  await t.test('cross-event isolation: organizer of Event A cannot fetch registration responses of Event B', async () => {
    // Attempting to query regBId under eventAId throws NotFoundError because regBId does not belong to Event A
    await assert.rejects(
      async () => {
        await getRegistrationResponses(organizerUserId, eventAId, regBId);
      },
      (err: any) => err instanceof NotFoundError && err.message.includes('Registration not found')
    );

    // Legitimate query for regAId under eventAId succeeds
    const responses = await getRegistrationResponses(organizerUserId, eventAId, regAId);
    assert.equal(responses.length, 1);
    assert.equal(responses[0].value, 'Answer A');
  });

  await t.test('cross-event isolation: organizer of Event A cannot update form of Event B', async () => {
    // Passing Event A ID with Form B ID
    await assert.rejects(
      async () => {
        await updateEventForm(organizerUserId, eventAId, formBId, { title: 'Hijacked Form' });
      },
      (err: any) => err instanceof NotFoundError && err.message.includes('Form not found')
    );
  });

  await t.test('getEventFormResponses verifies form belongs to the event', async () => {
    // Valid query
    const responses = await getEventFormResponses(organizerUserId, eventAId, formAId);
    assert.equal(responses.length, 1);
    assert.equal(responses[0].value, 'Form A Answer');

    // Form B under Event A is rejected
    await assert.rejects(
      async () => {
        await getEventFormResponses(organizerUserId, eventAId, formBId);
      },
      (err: any) => err instanceof NotFoundError && err.message.includes('Form not found')
    );
  });
});
