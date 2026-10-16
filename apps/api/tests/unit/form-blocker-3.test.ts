import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/lib/prisma';
import { submitEventFormResponses } from '../../src/modules/event-forms/event-forms.service';
import { registerEvent } from '../../src/modules/registrations/registrations.service';

test('Blocker 3: Correct Reusable Student Profile Synchronization', async (t) => {
  const origTransaction = prisma.$transaction;

  const eventId = '11111111-1111-1111-1111-111111111111';
  const formId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  const studentA = 'student-A';
  const studentB = 'student-B';

  const reusableFieldId = 'fd-reusable-github';
  const nonReusableFieldId = 'fd-nonreusable-tshirt';
  const multiSelectFieldId = 'fd-reusable-interests';

  interface StoredProfile {
    userId: string;
    fieldDefinitionId: string;
    value: string;
  }

  interface StoredResponse {
    eventRegistrationId: string;
    formId: string | null;
    fieldDefinitionId: string;
    value: string;
  }

  let inMemoryProfiles: StoredProfile[] = [];
  let inMemoryResponses: StoredResponse[] = [];

  const fieldDefs = [
    {
      id: reusableFieldId,
      label: 'GitHub URL',
      fieldType: 'URL',
      options: null,
      isReusable: true,
    },
    {
      id: nonReusableFieldId,
      label: 'T-Shirt Size',
      fieldType: 'TEXT',
      options: null,
      isReusable: false,
    },
    {
      id: multiSelectFieldId,
      label: 'Interests',
      fieldType: 'MULTI_SELECT',
      options: ['AI', 'Web', 'Mobile'],
      isReusable: true,
    },
  ];

  function createMockTx() {
    return {
      $executeRaw: async () => {},
      $queryRaw: async (query: any) => {
        // SELECT register_event(...)
        return [{ register_event: { success: true } }];
      },
      eventForm: {
        findFirst: async ({ where }: any) => {
          if (where.id === formId && where.eventId === eventId) {
            return {
              id: formId,
              eventId,
              releaseAt: null,
              closeAt: null,
              fields: fieldDefs.map((fd, idx) => ({
                id: `eff-${idx}`,
                eventId,
                formId,
                fieldDefinitionId: fd.id,
                isRequired: false,
                fieldDefinition: fd,
              })),
            };
          }
          return null;
        },
      },
      eventFormField: {
        findMany: async ({ where }: any) => {
          // registration form fields
          return fieldDefs
            .filter((fd) => {
              if (where.isRequired !== undefined && where.isRequired === true) {
                return false; // all test fields are optional by default
              }
              return true;
            })
            .map((fd, idx) => ({
              id: `eff-${idx}`,
              eventId,
              formId: null,
              fieldDefinitionId: fd.id,
              isRequired: false,
              fieldDefinition: fd,
            }));
        },
      },
      fieldDefinition: {
        findMany: async ({ where }: any) => {
          if (where?.id?.in) {
            return fieldDefs.filter((fd) => where.id.in.includes(fd.id));
          }
          return fieldDefs;
        },
      },
      eventRegistration: {
        findFirst: async ({ where }: any) => {
          return {
            id: `reg-${where.userId}`,
            eventId: where.eventId,
            userId: where.userId,
            registrationStatus: 'REGISTERED',
          };
        },
      },
      eventRegistrationResponse: {
        findFirst: async ({ where }: any) => {
          const found = inMemoryResponses.find(
            (r) =>
              r.eventRegistrationId === where.eventRegistrationId &&
              r.formId === where.formId &&
              r.fieldDefinitionId === where.fieldDefinitionId
          );
          return found ? { id: 'resp-id', ...found } : null;
        },
        create: async ({ data }: any) => {
          inMemoryResponses.push({ ...data });
          return { id: 'resp-id', ...data };
        },
        update: async ({ where, data }: any) => {
          return { id: where.id, ...data };
        },
        upsert: async ({ where, create, update }: any) => {
          const existingIdx = inMemoryResponses.findIndex(
            (r) =>
              r.eventRegistrationId === create.eventRegistrationId &&
              r.formId === create.formId &&
              r.fieldDefinitionId === create.fieldDefinitionId
          );
          if (existingIdx >= 0) {
            inMemoryResponses[existingIdx].value = update.value;
            return { id: 'resp-id', ...inMemoryResponses[existingIdx] };
          }
          inMemoryResponses.push({ ...create });
          return { id: 'resp-id', ...create };
        },
      },
      studentProfileValue: {
        upsert: async ({ where, create, update }: any) => {
          const existingIdx = inMemoryProfiles.findIndex(
            (p) =>
              p.userId === create.userId &&
              p.fieldDefinitionId === create.fieldDefinitionId
          );
          if (existingIdx >= 0) {
            inMemoryProfiles[existingIdx].value = update.value;
            return { id: 'prof-id', ...inMemoryProfiles[existingIdx] };
          }
          inMemoryProfiles.push({ ...create });
          return { id: 'prof-id', ...create };
        },
      },
    };
  }

  t.beforeEach(() => {
    inMemoryProfiles = [];
    inMemoryResponses = [];

    prisma.$transaction = (async (fn: any) => {
      const snapProfiles = JSON.stringify(inMemoryProfiles);
      const snapResponses = JSON.stringify(inMemoryResponses);
      try {
        const mockTx = createMockTx();
        return await fn(mockTx);
      } catch (err) {
        inMemoryProfiles = JSON.parse(snapProfiles);
        inMemoryResponses = JSON.parse(snapResponses);
        throw err;
      }
    }) as any;
  });

  t.after(() => {
    prisma.$transaction = origTransaction;
  });

  await t.test('Scheduled form: reusable field updates/creates StudentProfileValue', async () => {
    await submitEventFormResponses(studentA, eventId, formId, [
      { fieldDefinitionId: reusableFieldId, value: 'https://github.com/student-a' },
    ]);

    // Check response is saved
    assert.equal(inMemoryResponses.length, 1);
    assert.equal(inMemoryResponses[0].value, 'https://github.com/student-a');

    // Check profile value is created
    assert.equal(inMemoryProfiles.length, 1);
    assert.equal(inMemoryProfiles[0].userId, studentA);
    assert.equal(inMemoryProfiles[0].fieldDefinitionId, reusableFieldId);
    assert.equal(inMemoryProfiles[0].value, 'https://github.com/student-a');
  });

  await t.test(
    'Scheduled form: non-reusable field saves response but does NOT create or update StudentProfileValue',
    async () => {
      // Pre-populate a profile value for non-reusable field if it somehow existed
      await submitEventFormResponses(studentA, eventId, formId, [
        { fieldDefinitionId: nonReusableFieldId, value: 'Size L' },
      ]);

      // Check response is saved in EventRegistrationResponse
      assert.equal(inMemoryResponses.length, 1);
      assert.equal(inMemoryResponses[0].fieldDefinitionId, nonReusableFieldId);
      assert.equal(inMemoryResponses[0].value, 'Size L');

      // Check profile value was NOT created!
      const profile = inMemoryProfiles.find((p) => p.fieldDefinitionId === nonReusableFieldId);
      assert.equal(profile, undefined, 'Non-reusable field must not create StudentProfileValue');
    }
  );

  await t.test(
    'Scheduled form: non-reusable field does not overwrite existing student profile value',
    async () => {
      // Suppose student has an existing profile value for some reason
      inMemoryProfiles.push({
        userId: studentA,
        fieldDefinitionId: nonReusableFieldId,
        value: 'Original Size M',
      });

      await submitEventFormResponses(studentA, eventId, formId, [
        { fieldDefinitionId: nonReusableFieldId, value: 'Event Specific XL' },
      ]);

      // Event response saved
      assert.equal(inMemoryResponses.find((r) => r.value === 'Event Specific XL') !== undefined, true);

      // Profile value untouched
      const profile = inMemoryProfiles.find(
        (p) => p.userId === studentA && p.fieldDefinitionId === nonReusableFieldId
      );
      assert.equal(profile?.value, 'Original Size M');
    }
  );

  await t.test('Registration: respects isReusable identically to scheduled forms', async () => {
    await registerEvent(studentA, eventId, [
      { fieldDefinitionId: reusableFieldId, value: 'https://github.com/student-a-reg' },
      { fieldDefinitionId: nonReusableFieldId, value: 'Size XXL' },
    ]);

    // Both responses recorded in EventRegistrationResponse
    assert.equal(inMemoryResponses.length, 2);

    // Only reusable field updated StudentProfileValue
    assert.equal(inMemoryProfiles.length, 1);
    assert.equal(inMemoryProfiles[0].fieldDefinitionId, reusableFieldId);
    assert.equal(inMemoryProfiles[0].value, 'https://github.com/student-a-reg');
  });

  await t.test('Failed submission does not update student profile value', async () => {
    await assert.rejects(async () => {
      // Invalid URL triggers validation failure
      await submitEventFormResponses(studentA, eventId, formId, [
        { fieldDefinitionId: reusableFieldId, value: 'invalid-not-a-url' },
      ]);
    });

    assert.equal(inMemoryProfiles.length, 0);
    assert.equal(inMemoryResponses.length, 0);
  });

  await t.test('Two different students never share profile values', async () => {
    // Student A submits
    await submitEventFormResponses(studentA, eventId, formId, [
      { fieldDefinitionId: reusableFieldId, value: 'https://github.com/student-a' },
    ]);

    // Student B submits
    await submitEventFormResponses(studentB, eventId, formId, [
      { fieldDefinitionId: reusableFieldId, value: 'https://github.com/student-b' },
    ]);

    const profileA = inMemoryProfiles.find((p) => p.userId === studentA);
    const profileB = inMemoryProfiles.find((p) => p.userId === studentB);

    assert.equal(profileA?.value, 'https://github.com/student-a');
    assert.equal(profileB?.value, 'https://github.com/student-b');
    assert.notEqual(profileA?.value, profileB?.value);
  });

  await t.test('Multi-select responses preserve serialization format in profile', async () => {
    const multiSelectVal = JSON.stringify(['AI', 'Web']);
    await submitEventFormResponses(studentA, eventId, formId, [
      { fieldDefinitionId: multiSelectFieldId, value: multiSelectVal },
    ]);

    const prof = inMemoryProfiles.find((p) => p.fieldDefinitionId === multiSelectFieldId);
    assert.equal(prof?.value, multiSelectVal);
    assert.deepEqual(JSON.parse(prof!.value), ['AI', 'Web']);
  });
});
