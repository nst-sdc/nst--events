import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/lib/prisma';
import {
  submitEventFormResponses,
  createEventForm,
  updateEventForm,
} from '../../src/modules/event-forms/event-forms.service';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../src/lib/errors';

test('Blocker 2: Enforce Scheduled-Form Availability on the Server', async (t) => {
  const origTransaction = prisma.$transaction;

  const eventId = '11111111-1111-1111-1111-111111111111';
  const otherEventId = '22222222-2222-2222-2222-222222222222';
  const registeredUserId = 'user-reg-1';
  const unregisteredUserId = 'user-unreg-1';
  const formId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const fieldDefId = 'field-def-1';

  let savedResponses: any[] = [];
  let savedProfiles: any[] = [];

  // Controllable fixtures
  let currentForm: {
    id: string;
    eventId: string;
    releaseAt: Date | null;
    closeAt: Date | null;
    fields: any[];
  } = {
    id: formId,
    eventId,
    releaseAt: null,
    closeAt: null,
    fields: [
      {
        fieldDefinitionId: fieldDefId,
        isRequired: true,
        fieldDefinition: {
          id: fieldDefId,
          label: 'Test Field',
          fieldType: 'TEXT',
          options: null,
          isReusable: true,
        },
      },
    ],
  };

  function createMockTx() {
    return {
      $executeRaw: async () => {},
      eventForm: {
        findFirst: async ({ where }: any) => {
          if (where.id === currentForm.id && where.eventId === currentForm.eventId) {
            return { ...currentForm };
          }
          return null;
        },
        create: async ({ data }: any) => {
          return { id: 'new-form-id', ...data };
        },
        update: async ({ where, data }: any) => {
          if (where.id === currentForm.id) {
            currentForm = { ...currentForm, ...data };
            return currentForm;
          }
          return null;
        },
      },
      eventRegistration: {
        findFirst: async ({ where }: any) => {
          if (where.eventId === eventId && where.userId === registeredUserId && where.registrationStatus === 'REGISTERED') {
            return {
              id: 'reg-1',
              eventId,
              userId: registeredUserId,
              registrationStatus: 'REGISTERED',
            };
          }
          return null;
        },
      },
      eventRegistrationResponse: {
        upsert: async ({ create, update }: any) => {
          const resp = { id: 'resp-' + Math.random(), ...create };
          savedResponses.push(resp);
          return resp;
        },
      },
      studentProfileValue: {
        upsert: async ({ create, update }: any) => {
          const prof = { id: 'prof-' + Math.random(), ...create };
          savedProfiles.push(prof);
          return prof;
        },
      },
    };
  }

  t.beforeEach(() => {
    savedResponses = [];
    savedProfiles = [];
    currentForm = {
      id: formId,
      eventId,
      releaseAt: null,
      closeAt: null,
      fields: [
        {
          fieldDefinitionId: fieldDefId,
          isRequired: true,
          fieldDefinition: {
            id: fieldDefId,
            label: 'Test Field',
            fieldType: 'TEXT',
            options: null,
            isReusable: true,
          },
        },
      ],
    };

    prisma.$transaction = (async (fn: any) => {
      const snapResp = JSON.stringify(savedResponses);
      const snapProf = JSON.stringify(savedProfiles);
      try {
        const mockTx = createMockTx();
        return await fn(mockTx);
      } catch (err) {
        savedResponses = JSON.parse(snapResp);
        savedProfiles = JSON.parse(snapProf);
        throw err;
      }
    }) as any;
  });

  t.after(() => {
    prisma.$transaction = origTransaction;
  });

  await t.test('submission before opening time is rejected with ForbiddenError', async () => {
    // Form opens in 10 minutes
    currentForm.releaseAt = new Date(Date.now() + 10 * 60 * 1000);
    currentForm.closeAt = new Date(Date.now() + 60 * 60 * 1000);

    await assert.rejects(
      async () => {
        await submitEventFormResponses(registeredUserId, eventId, formId, [
          { fieldDefinitionId: fieldDefId, value: 'Answer' },
        ]);
      },
      (err: any) => err instanceof ForbiddenError && err.message.includes('not yet released')
    );

    assert.equal(savedResponses.length, 0);
    assert.equal(savedProfiles.length, 0);
  });

  await t.test('submission exactly at opening time is accepted', async () => {
    // Form opened 1 millisecond ago (effectively at opening)
    currentForm.releaseAt = new Date(Date.now() - 1);
    currentForm.closeAt = new Date(Date.now() + 60 * 60 * 1000);

    const result = await submitEventFormResponses(registeredUserId, eventId, formId, [
      { fieldDefinitionId: fieldDefId, value: 'Answer' },
    ]);

    assert.equal(result.length, 1);
    assert.equal(savedResponses.length, 1);
  });

  await t.test('submission immediately before closing time is accepted', async () => {
    currentForm.releaseAt = new Date(Date.now() - 60 * 60 * 1000);
    currentForm.closeAt = new Date(Date.now() + 5000); // closes in 5 seconds

    const result = await submitEventFormResponses(registeredUserId, eventId, formId, [
      { fieldDefinitionId: fieldDefId, value: 'Answer' },
    ]);

    assert.equal(result.length, 1);
    assert.equal(savedResponses.length, 1);
  });

  await t.test('submission exactly at closing time is rejected with ForbiddenError', async () => {
    // Form closed at current time or 1ms in past
    currentForm.releaseAt = new Date(Date.now() - 60 * 60 * 1000);
    currentForm.closeAt = new Date(Date.now()); // now >= closeAt

    await assert.rejects(
      async () => {
        await submitEventFormResponses(registeredUserId, eventId, formId, [
          { fieldDefinitionId: fieldDefId, value: 'Answer' },
        ]);
      },
      (err: any) => err instanceof ForbiddenError && err.message.includes('closed for submissions')
    );

    assert.equal(savedResponses.length, 0);
  });

  await t.test('submission after closing time is rejected with ForbiddenError', async () => {
    currentForm.releaseAt = new Date(Date.now() - 60 * 60 * 1000);
    currentForm.closeAt = new Date(Date.now() - 10 * 60 * 1000); // closed 10 mins ago

    await assert.rejects(
      async () => {
        await submitEventFormResponses(registeredUserId, eventId, formId, [
          { fieldDefinitionId: fieldDefId, value: 'Answer' },
        ]);
      },
      (err: any) => err instanceof ForbiddenError && err.message.includes('closed for submissions')
    );

    assert.equal(savedResponses.length, 0);
  });

  await t.test('form with valid opening time and no closing time accepts submission', async () => {
    currentForm.releaseAt = new Date(Date.now() - 1000);
    currentForm.closeAt = null;

    const result = await submitEventFormResponses(registeredUserId, eventId, formId, [
      { fieldDefinitionId: fieldDefId, value: 'Answer' },
    ]);

    assert.equal(result.length, 1);
    assert.equal(savedResponses.length, 1);
  });

  await t.test('form with no opening time (immediate) and valid closing time accepts submission', async () => {
    currentForm.releaseAt = null;
    currentForm.closeAt = new Date(Date.now() + 60 * 60 * 1000);

    const result = await submitEventFormResponses(registeredUserId, eventId, formId, [
      { fieldDefinitionId: fieldDefId, value: 'Answer' },
    ]);

    assert.equal(result.length, 1);
    assert.equal(savedResponses.length, 1);
  });

  await t.test('submission by unregistered student is rejected with ForbiddenError', async () => {
    currentForm.releaseAt = null;
    currentForm.closeAt = null;

    await assert.rejects(
      async () => {
        await submitEventFormResponses(unregisteredUserId, eventId, formId, [
          { fieldDefinitionId: fieldDefId, value: 'Answer' },
        ]);
      },
      (err: any) => err instanceof ForbiddenError && err.message.includes('registered students')
    );

    assert.equal(savedResponses.length, 0);
    assert.equal(savedProfiles.length, 0);
  });

  await t.test('form ID belonging to another event is rejected with NotFoundError', async () => {
    currentForm.releaseAt = null;
    currentForm.closeAt = null;

    await assert.rejects(
      async () => {
        await submitEventFormResponses(registeredUserId, otherEventId, formId, [
          { fieldDefinitionId: fieldDefId, value: 'Answer' },
        ]);
      },
      NotFoundError
    );

    assert.equal(savedResponses.length, 0);
  });

  await t.test('createEventForm rejects closeAt <= releaseAt with BadRequestError', async () => {
    const releaseAt = '2026-10-15T10:00:00.000Z';
    const closeAt = '2026-10-15T09:00:00.000Z'; // before releaseAt

    await assert.rejects(
      async () => {
        await createEventForm(registeredUserId, eventId, {
          title: 'Invalid Form',
          purpose: 'FEEDBACK',
          releaseAt,
          closeAt,
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('must be after opening time')
    );

    // Exact equal
    await assert.rejects(
      async () => {
        await createEventForm(registeredUserId, eventId, {
          title: 'Invalid Form',
          purpose: 'FEEDBACK',
          releaseAt,
          closeAt: releaseAt,
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('must be after opening time')
    );
  });

  await t.test('updateEventForm rejects target closeAt <= target releaseAt', async () => {
    currentForm.releaseAt = new Date('2026-10-15T10:00:00.000Z');
    currentForm.closeAt = new Date('2026-10-15T12:00:00.000Z');

    await assert.rejects(
      async () => {
        await updateEventForm(registeredUserId, eventId, formId, {
          closeAt: '2026-10-15T09:00:00.000Z', // earlier than existing releaseAt
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('must be after opening time')
    );
  });
});
