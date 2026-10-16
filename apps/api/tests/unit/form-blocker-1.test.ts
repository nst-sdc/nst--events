import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/lib/prisma';
import { getEventFormFields, updateEventFormFields } from '../../src/modules/events/events.service';
import { NotFoundError } from '../../src/lib/errors';

interface StoredField {
  id: string;
  eventId: string;
  formId: string | null;
  fieldDefinitionId: string;
  isRequired: boolean;
  order: number;
}

test('Blocker 1: Prevent Registration Field Updates from Deleting Scheduled-Form Questions', async (t) => {
  const origTransaction = prisma.$transaction;
  const origFindMany = prisma.eventFormField.findMany;

  // Test Fixture Setup
  const eventAId = '11111111-1111-1111-1111-111111111111';
  const eventBId = '22222222-2222-2222-2222-222222222222';
  const scheduledFormAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const regField1Id = 'fd-reg-1';
  const regField2Id = 'fd-reg-2';
  const regField3Id = 'fd-reg-3'; // New replacement field

  const schedField1Id = 'fd-sched-1';
  const schedField2Id = 'fd-sched-2';

  const otherEventFieldId = 'fd-other-1';

  let inMemoryFields: StoredField[] = [];

  function resetDatabase() {
    inMemoryFields = [
      // Event A: 2 Registration Questions (formId === null)
      {
        id: 'ef-1',
        eventId: eventAId,
        formId: null,
        fieldDefinitionId: regField1Id,
        isRequired: true,
        order: 1,
      },
      {
        id: 'ef-2',
        eventId: eventAId,
        formId: null,
        fieldDefinitionId: regField2Id,
        isRequired: false,
        order: 2,
      },
      // Event A: Scheduled Form A with 2 questions (formId !== null)
      {
        id: 'ef-3',
        eventId: eventAId,
        formId: scheduledFormAId,
        fieldDefinitionId: schedField1Id,
        isRequired: true,
        order: 1,
      },
      {
        id: 'ef-4',
        eventId: eventAId,
        formId: scheduledFormAId,
        fieldDefinitionId: schedField2Id,
        isRequired: true,
        order: 2,
      },
      // Event B: Field belonging to another event
      {
        id: 'ef-5',
        eventId: eventBId,
        formId: null,
        fieldDefinitionId: otherEventFieldId,
        isRequired: true,
        order: 1,
      },
    ];
  }

  function createMockTx(rollbackState: () => void) {
    return {
      $executeRaw: async () => {},
      user: {
        findUnique: async () => ({ globalRole: 'PLATFORM_ADMIN' }),
      },
      clubMembership: {
        findFirst: async () => null,
      },
      event: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (where.id === eventAId || where.id === eventBId) {
            return { id: where.id, deletedAt: null, eventClubs: [] };
          }
          return null;
        },
      },
      eventFormField: {
        deleteMany: async ({ where }: { where: { eventId: string; formId?: string | null } }) => {
          inMemoryFields = inMemoryFields.filter((item) => {
            const matchesEvent = item.eventId === where.eventId;
            const matchesForm = where.formId !== undefined ? item.formId === where.formId : true;
            return !(matchesEvent && matchesForm);
          });
          return { count: 1 };
        },
        createMany: async ({ data }: { data: any[] }) => {
          for (const item of data) {
            inMemoryFields.push({
              id: 'ef-' + Math.random().toString(36).substring(7),
              eventId: item.eventId,
              formId: item.formId ?? null,
              fieldDefinitionId: item.fieldDefinitionId,
              isRequired: item.isRequired,
              order: item.order,
            });
          }
          return { count: data.length };
        },
        findMany: async ({ where, orderBy }: { where: { eventId: string; formId?: string | null }; orderBy?: any }) => {
          return inMemoryFields
            .filter((item) => {
              const matchesEvent = item.eventId === where.eventId;
              const matchesForm = where.formId !== undefined ? item.formId === where.formId : true;
              return matchesEvent && matchesForm;
            })
            .sort((a, b) => a.order - b.order)
            .map((item) => ({ ...item, fieldDefinition: { id: item.fieldDefinitionId } }));
        },
      },
    };
  }

  t.beforeEach(() => {
    resetDatabase();
    prisma.$transaction = (async (fn: any) => {
      const snapshot = JSON.stringify(inMemoryFields);
      try {
        const mockTx = createMockTx(() => {
          inMemoryFields = JSON.parse(snapshot);
        });
        return await fn(mockTx);
      } catch (err) {
        inMemoryFields = JSON.parse(snapshot);
        throw err;
      }
    }) as any;

    (prisma.eventFormField as any).findMany = async ({ where }: any) => {
      return inMemoryFields
        .filter((item) => {
          const matchesEvent = item.eventId === where.eventId;
          const matchesForm = where.formId !== undefined ? item.formId === where.formId : true;
          return matchesEvent && matchesForm;
        })
        .sort((a, b) => a.order - b.order)
        .map((item) => ({ ...item, fieldDefinition: { id: item.fieldDefinitionId } }));
    };
  });

  t.after(() => {
    prisma.$transaction = origTransaction;
    prisma.eventFormField.findMany = origFindMany;
  });

  await t.test('getEventFormFields only returns registration questions (formId is null)', async () => {
    const fields = await getEventFormFields(eventAId);
    assert.equal(fields.length, 2, 'Should only return 2 registration questions, excluding scheduled forms');
    assert.deepEqual(fields.map((f) => f.fieldDefinitionId), [regField1Id, regField2Id]);
  });

  await t.test(
    'updating registration questions replaces only formId=null fields and preserves scheduled-form questions',
    async () => {
      // Remove regField2 and add regField3
      const updatedFieldsInput = {
        fields: [
          { fieldDefinitionId: regField1Id, isRequired: true, order: 1 },
          { fieldDefinitionId: regField3Id, isRequired: true, order: 2 },
        ],
      };

      const result = await updateEventFormFields('caller-user-id', eventAId, updatedFieldsInput);

      // Verify the returned result matches updated registration configuration
      assert.equal(result.length, 2);
      assert.deepEqual(result.map((f) => f.fieldDefinitionId), [regField1Id, regField3Id]);

      // Verify all scheduled-form questions remain intact in storage
      const scheduledFormQuestions = inMemoryFields.filter(
        (f) => f.eventId === eventAId && f.formId === scheduledFormAId
      );
      assert.equal(scheduledFormQuestions.length, 2, 'Scheduled form questions must remain attached');
      assert.equal(scheduledFormQuestions[0].fieldDefinitionId, schedField1Id);
      assert.equal(scheduledFormQuestions[0].isRequired, true);
      assert.equal(scheduledFormQuestions[0].order, 1);
      assert.equal(scheduledFormQuestions[1].fieldDefinitionId, schedField2Id);
      assert.equal(scheduledFormQuestions[1].isRequired, true);
      assert.equal(scheduledFormQuestions[1].order, 2);

      // Verify questions belonging to Event B were untouched
      const eventBQuestions = inMemoryFields.filter((f) => f.eventId === eventBId);
      assert.equal(eventBQuestions.length, 1);
      assert.equal(eventBQuestions[0].fieldDefinitionId, otherEventFieldId);
    }
  );

  await t.test('an invalid update rolls back without destroying existing configuration', async () => {
    const initialSnapshot = JSON.stringify(inMemoryFields);

    await assert.rejects(
      async () => {
        await updateEventFormFields('caller-user-id', 'non-existent-event-id', {
          fields: [{ fieldDefinitionId: 'new-field', isRequired: true, order: 1 }],
        });
      },
      NotFoundError
    );

    assert.equal(JSON.stringify(inMemoryFields), initialSnapshot, 'Database state must be preserved on failure');
  });

  await t.test('a transaction failure during field insertion rolls back deleted fields', async () => {
    const initialSnapshot = JSON.stringify(inMemoryFields);

    prisma.$transaction = (async (fn: any) => {
      const snapshot = JSON.stringify(inMemoryFields);
      try {
        const mockTx = createMockTx(() => {});
        // Mock createMany to fail
        mockTx.eventFormField.createMany = async () => {
          throw new Error('Database constraint violation');
        };
        return await fn(mockTx);
      } catch (err) {
        inMemoryFields = JSON.parse(snapshot);
        throw err;
      }
    }) as any;

    await assert.rejects(async () => {
      await updateEventFormFields('caller-user-id', eventAId, {
        fields: [{ fieldDefinitionId: regField3Id, isRequired: true, order: 1 }],
      });
    });

    assert.equal(JSON.stringify(inMemoryFields), initialSnapshot, 'Fields must not be wiped if insert fails');
    prisma.$transaction = origTransaction;
  });
});
