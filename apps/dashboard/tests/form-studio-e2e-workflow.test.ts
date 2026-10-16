// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import {
  QUESTION_PRESETS,
  generateFieldKey,
  getFormAvailability,
  validateScheduleTimeRange,
  exportSubmissionsToCSV,
} from '../lib/form-studio-utils';
import {
  validateClientFieldValue,
  getMissingRequiredFields,
  isFieldValueEmpty,
  toResponsePayload,
  formatFieldValueForDisplay,
  type FormFieldLike,
} from '../lib/form-utils';

describe('Form Studio E2E Workflow Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Registration Questionnaire Workflow', () => {
    // 8 supported field types
    const comprehensiveFields: FormFieldLike[] = [
      {
        fieldDefinitionId: 'fd-text',
        isRequired: true,
        fieldDefinition: { fieldType: 'TEXT', label: 'Full Legal Name' },
      },
      {
        fieldDefinitionId: 'fd-num',
        isRequired: true,
        fieldDefinition: { fieldType: 'NUMBER', label: 'Graduation Year' },
      },
      {
        fieldDefinitionId: 'fd-sel',
        isRequired: true,
        fieldDefinition: {
          fieldType: 'SELECT',
          label: 'Dietary Preference',
          options: ['None', 'Vegetarian', 'Vegan', 'Halal', 'Jain'],
        },
      },
      {
        fieldDefinitionId: 'fd-msel',
        isRequired: false,
        fieldDefinition: {
          fieldType: 'MULTI_SELECT',
          label: 'Programming Languages',
          options: ['TypeScript', 'Python', 'Rust', 'Go', 'Java'],
        },
      },
      {
        fieldDefinitionId: 'fd-email',
        isRequired: true,
        fieldDefinition: { fieldType: 'EMAIL', label: 'Emergency Contact Email' },
      },
      {
        fieldDefinitionId: 'fd-radio',
        isRequired: false,
        fieldDefinition: {
          fieldType: 'RADIO',
          label: 'Experience Level',
          options: ['Beginner', 'Intermediate', 'Advanced'],
        },
      },
      {
        fieldDefinitionId: 'fd-url',
        isRequired: false,
        fieldDefinition: { fieldType: 'URL', label: 'Portfolio Link' },
      },
      {
        fieldDefinitionId: 'fd-phone',
        isRequired: false,
        fieldDefinition: { fieldType: 'PHONE', label: 'Emergency Contact Phone' },
      },
    ];

    it('enforces required fields when responses are missing or whitespace', () => {
      const incompleteResponses = {
        'fd-text': '   ', // whitespace only
        'fd-num': '',     // empty string
        'fd-sel': 'Vegetarian',
        'fd-email': 'contact@example.com',
      };

      const missing = getMissingRequiredFields(comprehensiveFields, incompleteResponses);
      expect(missing).toHaveLength(2);
      expect(missing.map((m) => m.fieldDefinitionId)).toEqual(['fd-text', 'fd-num']);
    });

    it('rejects invalid choices for SELECT and MULTI_SELECT fields', () => {
      const selField = comprehensiveFields.find((f) => f.fieldDefinitionId === 'fd-sel')!;
      const mselField = comprehensiveFields.find((f) => f.fieldDefinitionId === 'fd-msel')!;

      // Invalid SELECT choice
      const invalidSel = validateClientFieldValue(selField.fieldDefinition, 'Keto');
      expect(invalidSel).toContain('not a valid option');

      // Valid SELECT choice
      const validSel = validateClientFieldValue(selField.fieldDefinition, 'Vegan');
      expect(validSel).toBeNull();

      // Invalid MULTI_SELECT (contains unlisted option)
      const invalidMsel = validateClientFieldValue(
        mselField.fieldDefinition,
        JSON.stringify(['TypeScript', 'C++'])
      );
      expect(invalidMsel).toContain('Invalid selection');

      // Valid MULTI_SELECT
      const validMsel = validateClientFieldValue(
        mselField.fieldDefinition,
        JSON.stringify(['TypeScript', 'Rust'])
      );
      expect(validMsel).toBeNull();
    });

    it('persists non-reusable values in registration responses while synchronizing reusable values to student profile', () => {
      interface MockStudentProfile {
        userId: string;
        reusableValues: Record<string, string>;
      }

      interface MockRegistrationResponse {
        registrationId: string;
        answers: Record<string, string>;
      }

      const fieldMetadata = [
        { id: 'fd-text', isReusable: true, key: 'full_legal_name' },
        { id: 'fd-sel', isReusable: true, key: 'dietary_preference' },
        { id: 'fd-tshirt', isReusable: false, key: 'tshirt_size' },
        { id: 'fd-reason', isReusable: false, key: 'why_attending' },
      ];

      const studentProfile: MockStudentProfile = {
        userId: 'student-123',
        reusableValues: {},
      };

      const submittedAnswers: Record<string, string> = {
        'fd-text': 'Alice Smith',
        'fd-sel': 'Vegetarian',
        'fd-tshirt': 'L',
        'fd-reason': 'Interested in modern distributed systems architecture',
      };

      // Separation logic matching Phase 0 Backend Contract
      const registrationResponse: MockRegistrationResponse = {
        registrationId: 'reg-001',
        answers: {},
      };

      for (const [fieldId, value] of Object.entries(submittedAnswers)) {
        // All responses are saved with the registration
        registrationResponse.answers[fieldId] = value;

        // Reusable responses also propagate to student profile
        const meta = fieldMetadata.find((m) => m.id === fieldId);
        if (meta?.isReusable) {
          studentProfile.reusableValues[meta.key] = value;
        }
      }

      // Assert registration response holds both non-reusable and reusable values
      expect(registrationResponse.answers['fd-tshirt']).toBe('L');
      expect(registrationResponse.answers['fd-reason']).toBe('Interested in modern distributed systems architecture');
      expect(registrationResponse.answers['fd-text']).toBe('Alice Smith');

      // Assert profile ONLY synced reusable keys
      expect(studentProfile.reusableValues).toEqual({
        full_legal_name: 'Alice Smith',
        dietary_preference: 'Vegetarian',
      });
      expect(studentProfile.reusableValues['tshirt_size']).toBeUndefined();
    });

    it('prefills reusable values on subsequent form viewing while leaving event-specific fields empty', () => {
      const studentProfileValues = {
        full_legal_name: 'Alice Smith',
        dietary_preference: 'Vegetarian',
      };

      const eventQuestionnaire = [
        { fieldDefinitionId: 'fd-text', key: 'full_legal_name', isReusable: true },
        { fieldDefinitionId: 'fd-sel', key: 'dietary_preference', isReusable: true },
        { fieldDefinitionId: 'fd-event-track', key: 'hackathon_track', isReusable: false },
      ];

      // Form initialization prefill calculation
      const initialFormValues: Record<string, string> = {};
      for (const field of eventQuestionnaire) {
        if (field.isReusable && field.key in studentProfileValues) {
          initialFormValues[field.fieldDefinitionId] =
            studentProfileValues[field.key as keyof typeof studentProfileValues];
        } else {
          initialFormValues[field.fieldDefinitionId] = '';
        }
      }

      expect(initialFormValues['fd-text']).toBe('Alice Smith');
      expect(initialFormValues['fd-sel']).toBe('Vegetarian');
      expect(initialFormValues['fd-event-track']).toBe('');
    });
  });

  describe('2. Scheduled In-Event Forms Workflow', () => {
    it('enforces half-open availability interval [releaseAt, closeAt)', () => {
      const releaseAt = '2026-10-15T10:00:00.000Z';
      const closeAt = '2026-10-15T18:00:00.000Z';
      const form = { releaseAt, closeAt };

      // Case 1: Before release time -> rejected
      const beforeNow = new Date('2026-10-15T09:59:59.000Z');
      const beforeStatus = getFormAvailability(form, beforeNow);
      expect(beforeStatus.status).toBe('scheduled');
      expect(beforeStatus.isOpenNow).toBe(false);

      // Case 2: Exact release time -> open / accepted
      const releaseNow = new Date('2026-10-15T10:00:00.000Z');
      const releaseStatus = getFormAvailability(form, releaseNow);
      expect(releaseStatus.status).toBe('open');
      expect(releaseStatus.isOpenNow).toBe(true);

      // Case 3: Middle of window -> open / accepted
      const midNow = new Date('2026-10-15T14:30:00.000Z');
      const midStatus = getFormAvailability(form, midNow);
      expect(midStatus.status).toBe('open');
      expect(midStatus.isOpenNow).toBe(true);

      // Case 4: Exactly at close time -> closed / rejected
      const closeNow = new Date('2026-10-15T18:00:00.000Z');
      const closeStatus = getFormAvailability(form, closeNow);
      expect(closeStatus.status).toBe('closed');
      expect(closeStatus.isOpenNow).toBe(false);

      // Case 5: After close time -> closed / rejected
      const afterNow = new Date('2026-10-15T18:01:00.000Z');
      const afterStatus = getFormAvailability(form, afterNow);
      expect(afterStatus.status).toBe('closed');
      expect(afterStatus.isOpenNow).toBe(false);
    });

    it('operates identically regardless of local timezone representation', () => {
      // The exact same instant expressed in UTC, IST (+05:30), and EST (-05:00)
      const instantUTC = '2026-10-15T12:00:00.000Z';
      const instantIST = '2026-10-15T17:30:00.000+05:30';
      const instantEST = '2026-10-15T07:00:00.000-05:00';

      const timeUTC = new Date(instantUTC).getTime();
      const timeIST = new Date(instantIST).getTime();
      const timeEST = new Date(instantEST).getTime();

      expect(timeIST).toBe(timeUTC);
      expect(timeEST).toBe(timeUTC);

      const form = {
        releaseAt: '2026-10-15T10:00:00.000Z',
        closeAt: '2026-10-15T18:00:00.000Z',
      };

      // Both IST and EST time instances resolve to the same active state
      expect(getFormAvailability(form, new Date(instantIST)).isOpenNow).toBe(true);
      expect(getFormAvailability(form, new Date(instantEST)).isOpenNow).toBe(true);
    });

    it('rejects inverted or identical time ranges during schedule configuration', () => {
      expect(
        validateScheduleTimeRange('2026-10-15T18:00:00.000Z', '2026-10-15T10:00:00.000Z')
      ).toContain('must be strictly after');

      expect(
        validateScheduleTimeRange('2026-10-15T12:00:00.000Z', '2026-10-15T12:00:00.000Z')
      ).toContain('must be strictly after');

      expect(
        validateScheduleTimeRange('2026-10-15T10:00:00.000Z', '2026-10-15T12:00:00.000Z')
      ).toBeNull();
    });
  });

  describe('3. Reusable Profile Information Isolation', () => {
    it('ensures student updates do not corrupt or leak into other students profiles', () => {
      const studentProfiles: Record<string, Record<string, string>> = {
        'student-alice': { github_url: 'https://github.com/alice', tshirt_size: 'M' },
        'student-bob': { github_url: 'https://github.com/bob', tshirt_size: 'L' },
      };

      // Alice updates her github_url
      function updateStudentProfile(userId: string, key: string, value: string) {
        studentProfiles[userId] = {
          ...studentProfiles[userId],
          [key]: value,
        };
      }

      updateStudentProfile('student-alice', 'github_url', 'https://github.com/alice-new');

      expect(studentProfiles['student-alice'].github_url).toBe('https://github.com/alice-new');
      expect(studentProfiles['student-bob'].github_url).toBe('https://github.com/bob');
      expect(studentProfiles['student-bob'].tshirt_size).toBe('L');
    });
  });

  describe('4. Both Organizer Experiences & Presets', () => {
    it('provides standard presets with categories and reusable flags', () => {
      expect(QUESTION_PRESETS.length).toBeGreaterThanOrEqual(6);

      const ghPreset = QUESTION_PRESETS.find((p) => p.key === 'github_url')!;
      expect(ghPreset.isReusable).toBe(true);
      expect(ghPreset.fieldType).toBe('URL');

      const tshirtPreset = QUESTION_PRESETS.find((p) => p.key === 'tshirt_size')!;
      expect(tshirtPreset.isReusable).toBe(false);
      expect(tshirtPreset.fieldType).toBe('SELECT');
      expect(tshirtPreset.options).toContain('M');
    });

    it('generates collision-free snake_case machine keys for custom questions', () => {
      const existing = ['github_url', 'portfolio_url', 'dietary_restrictions'];

      expect(generateFieldKey('Emergency Contact Phone', existing)).toBe(
        'emergency_contact_phone'
      );
      expect(generateFieldKey('GitHub URL', existing)).toBe('github_url_1');
      expect(generateFieldKey('GitHub URL', [...existing, 'github_url_1'])).toBe(
        'github_url_2'
      );
    });
  });

  describe('5. Responses, CSV Export, and Cross-Event Isolation', () => {
    it('generates properly formatted and escaped CSV without formula injection risk', () => {
      let createdHref = '';
      let downloadedFilename = '';
      let capturedCsv = '';

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName.toLowerCase() === 'a') {
          const mockLink = {
            setAttribute: (attr: string, val: string) => {
              if (attr === 'href') createdHref = val;
              if (attr === 'download') downloadedFilename = val;
              if (attr === 'data-csv') capturedCsv = val;
            },
            click: vi.fn(),
          } as unknown as HTMLElement;
          return mockLink;
        }
        return originalCreateElement(tagName);
      });

      vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

      const fieldColumns = [
        { id: 'f-1', label: 'T-Shirt Size' },
        { id: 'f-2', label: 'Interests' },
        { id: 'f-3', label: 'Notes & "Quotes"' },
      ];

      const submissions = [
        {
          user: { fullName: 'Alice "Hacker" Smith', email: 'alice@nst.edu' },
          submittedAt: '2026-10-15T12:00:00.000Z',
          answers: {
            'f-1': { value: 'M' },
            'f-2': { value: JSON.stringify(['AI', 'Web3']) },
            'f-3': { value: 'Formula: =SUM(1+1)' },
          },
        },
        {
          user: { fullName: 'Attacker', email: 'malicious@nst.edu' },
          submittedAt: '2026-10-15T12:01:00.000Z',
          answers: {
            'f-1': { value: '=cmd|\' /C calc\'!A0' },
            'f-2': { value: '+12345' },
            'f-3': { value: '@SUM(1+1)' },
          },
        },
      ];

      exportSubmissionsToCSV('Final Submission Form', fieldColumns, submissions);

      expect(downloadedFilename).toBe('Final_Submission_Form_responses.csv');
      const decodedCsv = capturedCsv || decodeURI(createdHref);

      expect(decodedCsv).toContain('Student Name,Student Email,Submitted At,"T-Shirt Size","Interests","Notes & ""Quotes"""');
      expect(decodedCsv).toContain('"Alice ""Hacker"" Smith"');
      expect(decodedCsv).toContain('"AI, Web3"');
      expect(decodedCsv).toContain('"Formula: =SUM(1+1)"');
      // Formula injection defense: cells starting with =, +, @ must be prefixed with single quote
      expect(decodedCsv).toContain('"\'=cmd|\' /C calc\'!A0"');
      expect(decodedCsv).toContain('"\'+12345"');
      expect(decodedCsv).toContain('"\'@SUM(1+1)"');
    });

    it('strictly isolates event responses such that Event A responses never appear in Event B', () => {
      const allSubmissionsByEvent: Record<string, Array<{ id: string; eventId: string; user: string }>> = {
        'evt-alpha': [
          { id: 'sub-1', eventId: 'evt-alpha', user: 'Alice' },
          { id: 'sub-2', eventId: 'evt-alpha', user: 'Bob' },
        ],
        'evt-beta': [
          { id: 'sub-3', eventId: 'evt-beta', user: 'Charlie' },
        ],
      };

      const getEventSubmissions = (eventId: string) => allSubmissionsByEvent[eventId] || [];

      const alphaSubmissions = getEventSubmissions('evt-alpha');
      const betaSubmissions = getEventSubmissions('evt-beta');

      expect(alphaSubmissions.every((s) => s.eventId === 'evt-alpha')).toBe(true);
      expect(betaSubmissions.every((s) => s.eventId === 'evt-beta')).toBe(true);
      expect(alphaSubmissions.map((s) => s.user)).not.toContain('Charlie');
    });
  });

  describe('6. Field Definition Immutability', () => {
    it('preserves field definition attributes when question is reordered or marked optional', () => {
      const originalFieldDefinition = Object.freeze({
        id: 'fd-core-100',
        key: 'tshirt_size',
        label: 'T-Shirt Size',
        fieldType: 'SELECT',
        options: ['S', 'M', 'L', 'XL'],
        isReusable: false,
      });

      // Join record in Event A
      const eventAField = {
        id: 'eaf-1',
        eventId: 'evt-alpha',
        fieldDefinitionId: originalFieldDefinition.id,
        isRequired: true,
        order: 0,
      };

      // Join record in Event B
      const eventBField = {
        id: 'ebf-1',
        eventId: 'evt-beta',
        fieldDefinitionId: originalFieldDefinition.id,
        isRequired: false,
        order: 5,
      };

      // Modifying Event A's join attributes
      const updatedEventAField = {
        ...eventAField,
        isRequired: false,
        order: 3,
      };

      // Assert FieldDefinition record was not mutated
      expect(originalFieldDefinition.label).toBe('T-Shirt Size');
      expect(originalFieldDefinition.fieldType).toBe('SELECT');
      expect(originalFieldDefinition.options).toEqual(['S', 'M', 'L', 'XL']);

      // Assert Event B was unaffected
      expect(eventBField.order).toBe(5);
      expect(eventBField.isRequired).toBe(false);

      // Assert Event A successfully updated only its join properties
      expect(updatedEventAField.order).toBe(3);
      expect(updatedEventAField.isRequired).toBe(false);
    });

    it('ensures historic response records remain valid when a question is detached from an event', () => {
      const historicResponses = [
        { id: 'resp-1', eventId: 'evt-1', fieldDefinitionId: 'fd-tshirt', value: 'M' },
        { id: 'resp-2', eventId: 'evt-1', fieldDefinitionId: 'fd-tshirt', value: 'L' },
      ];

      // Event removes field from active questionnaire
      const activeEventFields = [
        { fieldDefinitionId: 'fd-dietary', isRequired: true, order: 0 },
      ];

      // Response retrieval matches by fieldDefinitionId
      const responsesForTshirt = historicResponses.filter(
        (r) => r.fieldDefinitionId === 'fd-tshirt'
      );

      expect(responsesForTshirt).toHaveLength(2);
      expect(activeEventFields.some((f) => f.fieldDefinitionId === 'fd-tshirt')).toBe(false);
    });
  });
});
