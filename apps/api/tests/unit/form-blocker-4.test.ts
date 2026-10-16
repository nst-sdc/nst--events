import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFieldValue } from '../../src/utils/form-validation';
import { BadRequestError } from '../../src/lib/errors';
import { prisma } from '../../src/lib/prisma';
import { submitEventFormResponses } from '../../src/modules/event-forms/event-forms.service';
import { registerEvent } from '../../src/modules/registrations/registrations.service';

test('Blocker 4: Server-Side Validation for Supported Field Types', async (t) => {
  await t.test('TEXT field validation', () => {
    const textDef = { fieldType: 'TEXT', label: 'Biography' };
    assert.doesNotThrow(() => validateFieldValue(textDef, 'Hello world'));
    assert.doesNotThrow(() => validateFieldValue(textDef, ''));
    assert.doesNotThrow(() => validateFieldValue(textDef, '   '));
  });

  await t.test('URL field validation', () => {
    const urlDef = { fieldType: 'URL', label: 'Portfolio Link' };

    // Valid URLs
    assert.doesNotThrow(() => validateFieldValue(urlDef, 'https://github.com/nst-sdc'));
    assert.doesNotThrow(() => validateFieldValue(urlDef, 'http://example.com/project?id=123'));
    assert.doesNotThrow(() => validateFieldValue(urlDef, 'https://sub.domain.co.in/path/'));

    // Optional / empty values pass
    assert.doesNotThrow(() => validateFieldValue(urlDef, ''));
    assert.doesNotThrow(() => validateFieldValue(urlDef, '   '));

    // Invalid URLs
    assert.throws(
      () => validateFieldValue(urlDef, 'not-a-url'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid URL')
    );
    assert.throws(
      () => validateFieldValue(urlDef, 'ftp://files.example.com'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid URL')
    );
    assert.throws(
      () => validateFieldValue(urlDef, 'javascript:alert(1)'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid URL')
    );
    assert.throws(
      () => validateFieldValue(urlDef, 'www.missing-protocol.com'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid URL')
    );
  });

  await t.test('EMAIL field validation', () => {
    const emailDef = { fieldType: 'EMAIL', label: 'Alternate Email' };

    // Valid emails
    assert.doesNotThrow(() => validateFieldValue(emailDef, 'student@adypu.edu.in'));
    assert.doesNotThrow(() => validateFieldValue(emailDef, 'user.name+tag@example.com'));

    // Optional / empty
    assert.doesNotThrow(() => validateFieldValue(emailDef, ''));
    assert.doesNotThrow(() => validateFieldValue(emailDef, '   '));

    // Invalid emails
    assert.throws(
      () => validateFieldValue(emailDef, 'not-an-email'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid email')
    );
    assert.throws(
      () => validateFieldValue(emailDef, 'user@'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid email')
    );
    assert.throws(
      () => validateFieldValue(emailDef, '@domain.com'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid email')
    );
    assert.throws(
      () => validateFieldValue(emailDef, 'user@domain'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid email')
    );
  });

  await t.test('NUMBER field validation', () => {
    const numDef = { fieldType: 'NUMBER', label: 'Team Size' };

    // Valid finite numbers
    assert.doesNotThrow(() => validateFieldValue(numDef, '42'));
    assert.doesNotThrow(() => validateFieldValue(numDef, '-3.14'));
    assert.doesNotThrow(() => validateFieldValue(numDef, '+100'));
    assert.doesNotThrow(() => validateFieldValue(numDef, '0'));
    assert.doesNotThrow(() => validateFieldValue(numDef, '1e4'));

    // Optional / empty
    assert.doesNotThrow(() => validateFieldValue(numDef, ''));
    assert.doesNotThrow(() => validateFieldValue(numDef, '   '));

    // Invalid numbers
    assert.throws(
      () => validateFieldValue(numDef, 'abc'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid number')
    );
    assert.throws(
      () => validateFieldValue(numDef, 'NaN'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid number')
    );
    assert.throws(
      () => validateFieldValue(numDef, 'Infinity'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid number')
    );
    assert.throws(
      () => validateFieldValue(numDef, '-Infinity'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid number')
    );
    assert.throws(
      () => validateFieldValue(numDef, '42px'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid number')
    );
    assert.throws(
      () => validateFieldValue(numDef, '0x12'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid number')
    );
  });

  await t.test('PHONE field validation', () => {
    const phoneDef = { fieldType: 'PHONE', label: 'Contact Phone' };

    // Reasonably formatted international numbers
    assert.doesNotThrow(() => validateFieldValue(phoneDef, '+91 98765 43210'));
    assert.doesNotThrow(() => validateFieldValue(phoneDef, '+1 (555) 123-4567'));
    assert.doesNotThrow(() => validateFieldValue(phoneDef, '9876543210'));
    assert.doesNotThrow(() => validateFieldValue(phoneDef, '+44 20 7946 0958'));
    assert.doesNotThrow(() => validateFieldValue(phoneDef, '123-456-7890'));

    // Optional / empty
    assert.doesNotThrow(() => validateFieldValue(phoneDef, ''));
    assert.doesNotThrow(() => validateFieldValue(phoneDef, '   '));

    // Invalid phone numbers
    assert.throws(
      () => validateFieldValue(phoneDef, '123'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid phone number')
    );
    assert.throws(
      () => validateFieldValue(phoneDef, 'not-a-phone-number'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid phone number')
    );
    assert.throws(
      () => validateFieldValue(phoneDef, '+91-phone-43210'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid phone number')
    );
    assert.throws(
      () => validateFieldValue(phoneDef, '++1234567890'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid phone number')
    );
  });

  await t.test('SELECT and RADIO field validation', () => {
    const selectDef = { fieldType: 'SELECT', label: 'Experience Level', options: ['Beginner', 'Intermediate', 'Advanced'] };
    const radioDef = { fieldType: 'RADIO', label: 'Gender', options: ['Female', 'Male', 'Other'] };

    // Valid choices
    assert.doesNotThrow(() => validateFieldValue(selectDef, 'Beginner'));
    assert.doesNotThrow(() => validateFieldValue(selectDef, 'Advanced'));
    assert.doesNotThrow(() => validateFieldValue(radioDef, 'Female'));

    // Optional / empty
    assert.doesNotThrow(() => validateFieldValue(selectDef, ''));

    // Invalid choices
    assert.throws(
      () => validateFieldValue(selectDef, 'Expert'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid option')
    );
    assert.throws(
      () => validateFieldValue(radioDef, 'Unknown'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid option')
    );
  });

  await t.test('MULTI_SELECT field validation', () => {
    const multiDef = { fieldType: 'MULTI_SELECT', label: 'Tracks', options: ['Web', 'Mobile', 'AI', 'Cloud'] };

    // Valid choices serialized as JSON array
    assert.doesNotThrow(() => validateFieldValue(multiDef, JSON.stringify(['Web', 'AI'])));
    assert.doesNotThrow(() => validateFieldValue(multiDef, JSON.stringify(['Cloud'])));
    assert.doesNotThrow(() => validateFieldValue(multiDef, '[]')); // empty array passes type validation (handled by required check)

    // Optional / empty
    assert.doesNotThrow(() => validateFieldValue(multiDef, ''));
    assert.doesNotThrow(() => validateFieldValue(multiDef, '   '));

    // Malformed JSON
    assert.throws(
      () => validateFieldValue(multiDef, 'not-json'),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid value for MULTI_SELECT')
    );
    assert.throws(
      () => validateFieldValue(multiDef, '{"key": "value"}'), // not an array
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid value for MULTI_SELECT')
    );

    // Unsupported options
    assert.throws(
      () => validateFieldValue(multiDef, JSON.stringify(['Web', 'Blockchain'])),
      (err: any) => err instanceof BadRequestError && err.message.includes('Invalid value for MULTI_SELECT')
    );
  });

  await t.test('Integration with submitEventFormResponses and registerEvent for required and optional answers', async () => {
    const origTransaction = prisma.$transaction;
    const eventId = '11111111-1111-1111-1111-111111111111';
    const formId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const userId = 'user-123';

    const reqFieldId = 'req-url-field';
    const optFieldId = 'opt-phone-field';

    const fields = [
      {
        id: 'eff-1',
        eventId,
        formId,
        fieldDefinitionId: reqFieldId,
        isRequired: true,
        fieldDefinition: {
          id: reqFieldId,
          label: 'Required GitHub',
          fieldType: 'URL',
          options: null,
          isReusable: true,
        },
      },
      {
        id: 'eff-2',
        eventId,
        formId,
        fieldDefinitionId: optFieldId,
        isRequired: false,
        fieldDefinition: {
          id: optFieldId,
          label: 'Optional Phone',
          fieldType: 'PHONE',
          options: null,
          isReusable: true,
        },
      },
    ];

    prisma.$transaction = (async (fn: any) => {
      const mockTx = {
        $executeRaw: async () => {},
        $queryRaw: async () => [{ register_event: { success: true } }],
        eventForm: {
          findFirst: async () => ({
            id: formId,
            eventId,
            releaseAt: null,
            closeAt: null,
            fields,
          }),
        },
        eventFormField: {
          findMany: async ({ where }: any) => {
            if (where.isRequired) return fields.filter((f) => f.isRequired);
            return fields;
          },
        },
        fieldDefinition: {
          findMany: async () => fields.map((f) => f.fieldDefinition),
        },
        eventRegistration: {
          findFirst: async () => ({
            id: 'reg-1',
            eventId,
            userId,
            registrationStatus: 'REGISTERED',
          }),
        },
        eventRegistrationResponse: {
          findFirst: async () => null,
          create: async ({ data }: any) => data,
          upsert: async ({ create }: any) => create,
        },
        studentProfileValue: {
          upsert: async ({ create }: any) => create,
        },
      };
      return await fn(mockTx);
    }) as any;

    try {
      // Missing required question throws BadRequestError
      await assert.rejects(
        async () => {
          await submitEventFormResponses(userId, eventId, formId, []);
        },
        (err: any) => err instanceof BadRequestError && err.message.includes('Missing required form fields')
      );

      // Empty string for required question throws BadRequestError
      await assert.rejects(
        async () => {
          await submitEventFormResponses(userId, eventId, formId, [
            { fieldDefinitionId: reqFieldId, value: '   ' },
          ]);
        },
        (err: any) => err instanceof BadRequestError && err.message.includes('Missing required form fields')
      );

      // Invalid answer for required field throws BadRequestError
      await assert.rejects(
        async () => {
          await submitEventFormResponses(userId, eventId, formId, [
            { fieldDefinitionId: reqFieldId, value: 'invalid-url' },
          ]);
        },
        (err: any) => err instanceof BadRequestError && err.message.includes('Invalid URL')
      );

      // Valid required answer with optional field omitted succeeds!
      const validPayloadWithoutOpt = [
        { fieldDefinitionId: reqFieldId, value: 'https://github.com/valid-profile' },
      ];
      const res = await submitEventFormResponses(userId, eventId, formId, validPayloadWithoutOpt);
      assert.equal(res.length, 1);

      // Registration workflow: missing required field rejected
      await assert.rejects(
        async () => {
          await registerEvent(userId, eventId, []);
        },
        (err: any) => err instanceof BadRequestError && err.message.includes('Missing required registration fields')
      );

      // Registration workflow: valid answer succeeds
      const regRes = await registerEvent(userId, eventId, validPayloadWithoutOpt);
      assert.ok(regRes);
    } finally {
      prisma.$transaction = origTransaction;
    }
  });
});
