import { describe, it, expect } from 'vitest';
import {
  QUESTION_PRESETS,
  generateFieldKey,
  getFormAvailability,
  validateScheduleTimeRange,
  getLocalTimezoneDisplay,
  sanitizeCSVCell,
  validateFormTitle,
  validateQuestionChoices,
} from '../lib/form-studio-utils';

describe('form-studio-utils', () => {
  describe('QUESTION_PRESETS', () => {
    it('defines all 6 required question presets with supported field types', () => {
      const ids = QUESTION_PRESETS.map((p) => p.id);
      expect(ids).toContain('github_url');
      expect(ids).toContain('linkedin_url');
      expect(ids).toContain('portfolio_url');
      expect(ids).toContain('tshirt_size');
      expect(ids).toContain('dietary_requirements');
      expect(ids).toContain('experience_level');

      // T-shirt size must be event-specific (not reusable globally)
      const tshirt = QUESTION_PRESETS.find((p) => p.id === 'tshirt_size');
      expect(tshirt?.isReusable).toBe(false);
      expect(tshirt?.fieldType).toBe('SELECT');
      expect(tshirt?.options).toContain('M');

      // GitHub URL must be reusable
      const github = QUESTION_PRESETS.find((p) => p.id === 'github_url');
      expect(github?.isReusable).toBe(true);
      expect(github?.fieldType).toBe('URL');

      // Experience level must be RADIO
      const exp = QUESTION_PRESETS.find((p) => p.id === 'experience_level');
      expect(exp?.fieldType).toBe('RADIO');
      expect(exp?.options).toEqual(['Beginner', 'Intermediate', 'Advanced']);
    });
  });

  describe('generateFieldKey', () => {
    it('slugifies human labels into snake_case keys', () => {
      expect(generateFieldKey('Discord Handle', new Set())).toBe('discord_handle');
      expect(generateFieldKey('Favorite Programming Language?!', new Set())).toBe(
        'favorite_programming_language'
      );
      expect(generateFieldKey('  Leading and trailing   ', new Set())).toBe('leading_and_trailing');
    });

    it('generates unique collision-free keys when key already exists', () => {
      const existing = new Set(['discord_handle', 'discord_handle_1']);
      expect(generateFieldKey('Discord Handle', existing)).toBe('discord_handle_2');
    });

    it('handles empty or special character only labels safely', () => {
      expect(generateFieldKey('???', new Set())).toBe('custom_field');
    });

    it('caps generated slug length to guarantee total key is <= 50 characters', () => {
      const veryLongLabel = 'What is your primary programming language or technology stack in software engineering?';
      const key = generateFieldKey(veryLongLabel, new Set());
      expect(key.length).toBeLessThanOrEqual(50);
      expect(key).toBe('what_is_your_primary_programming_languag');

      // Even with collision counter suffix, remains <= 50
      const collisionKey = generateFieldKey(veryLongLabel, new Set([key]));
      expect(collisionKey.length).toBeLessThanOrEqual(50);
      expect(collisionKey).toBe(`${key}_1`);
    });
  });

  describe('getFormAvailability', () => {
    const fixedNow = new Date('2026-10-15T12:00:00.000Z');

    it('detects draft forms when publishedAt is null', () => {
      const form = {
        releaseAt: '2026-10-15T11:00:00.000Z',
        closeAt: '2026-10-15T15:00:00.000Z',
        publishedAt: null,
      };
      const res = getFormAvailability(form, fixedNow);
      expect(res.status).toBe('draft');
      expect(res.isOpenNow).toBe(false);
      expect(res.isPublished).toBe(false);
      expect(res.label).toBe('Draft');
    });

    it('detects scheduled forms when releaseAt is in the future', () => {
      const form = {
        releaseAt: '2026-10-15T13:00:00.000Z',
        closeAt: '2026-10-15T15:00:00.000Z',
        publishedAt: '2026-10-14T00:00:00.000Z',
      };
      const res = getFormAvailability(form, fixedNow);
      expect(res.status).toBe('scheduled');
      expect(res.isOpenNow).toBe(false);
      expect(res.isPublished).toBe(true);
      expect(res.label).toBe('Scheduled');
    });

    it('detects open forms when current time is within [releaseAt, closeAt)', () => {
      const form = {
        releaseAt: '2026-10-15T11:00:00.000Z',
        closeAt: '2026-10-15T13:00:00.000Z',
        publishedAt: '2026-10-14T00:00:00.000Z',
      };
      const res = getFormAvailability(form, fixedNow);
      expect(res.status).toBe('open');
      expect(res.isOpenNow).toBe(true);
      expect(res.label).toBe('Open');
    });

    it('detects closed forms when current time is at or after closeAt', () => {
      const form = {
        releaseAt: '2026-10-15T10:00:00.000Z',
        closeAt: '2026-10-15T12:00:00.000Z', // exactly now
        publishedAt: '2026-10-14T00:00:00.000Z',
      };
      const res = getFormAvailability(form, fixedNow);
      expect(res.status).toBe('closed');
      expect(res.isOpenNow).toBe(false);
      expect(res.label).toBe('Closed');
    });

    it('detects closed forms even if publishedAt is null when closeAt is in past', () => {
      const form = {
        releaseAt: '2026-10-15T10:00:00.000Z',
        closeAt: '2026-10-15T11:00:00.000Z',
        publishedAt: null,
      };
      const res = getFormAvailability(form, fixedNow);
      expect(res.status).toBe('closed');
      expect(res.isOpenNow).toBe(false);
    });

    it('detects open form with releaseAt and no closeAt', () => {
      const form = {
        releaseAt: '2026-10-15T10:00:00.000Z',
        closeAt: null,
        publishedAt: '2026-10-14T00:00:00.000Z',
      };
      const res = getFormAvailability(form, fixedNow);
      expect(res.status).toBe('open');
      expect(res.isOpenNow).toBe(true);
    });

    it('detects open form when neither releaseAt nor closeAt are set', () => {
      const form = { releaseAt: null, closeAt: null, publishedAt: '2026-10-14T00:00:00.000Z' };
      const res = getFormAvailability(form, fixedNow);
      expect(res.status).toBe('open');
      expect(res.isOpenNow).toBe(true);
    });
  });

  describe('sanitizeCSVCell', () => {
    it('sanitizes formula injection characters (=, +, -, @, \\t, \\r)', () => {
      expect(sanitizeCSVCell('=SUM(A1:B2)')).toBe('"\'=SUM(A1:B2)"');
      expect(sanitizeCSVCell('+12345')).toBe('"\'+12345"');
      expect(sanitizeCSVCell('-50')).toBe('"\' -50"'.replace(' -', '-'));
      expect(sanitizeCSVCell('@SUM(1)')).toBe('"\'@SUM(1)"');
      expect(sanitizeCSVCell('\tsecret')).toBe('"\'\tsecret"');
      expect(sanitizeCSVCell('\rsecret')).toBe('"\'\rsecret"');
    });

    it('preserves normal strings and escapes double quotes', () => {
      expect(sanitizeCSVCell('Hello World')).toBe('"Hello World"');
      expect(sanitizeCSVCell('Quotes "here"')).toBe('"Quotes ""here"""');
    });

    it('handles null and undefined', () => {
      expect(sanitizeCSVCell(null)).toBe('""');
      expect(sanitizeCSVCell(undefined)).toBe('""');
    });
  });

  describe('validateScheduleTimeRange', () => {
    it('returns error when closeAt is earlier than releaseAt', () => {
      const error = validateScheduleTimeRange(
        '2026-10-15T14:00:00.000Z',
        '2026-10-15T12:00:00.000Z'
      );
      expect(error).toContain('must be strictly after');
    });

    it('returns error when closeAt is equal to releaseAt', () => {
      const error = validateScheduleTimeRange(
        '2026-10-15T12:00:00.000Z',
        '2026-10-15T12:00:00.000Z'
      );
      expect(error).toContain('must be strictly after');
    });

    it('returns null when closeAt is strictly after releaseAt', () => {
      const error = validateScheduleTimeRange(
        '2026-10-15T12:00:00.000Z',
        '2026-10-15T13:00:00.000Z'
      );
      expect(error).toBeNull();
    });

    it('returns null when one or both boundaries are empty', () => {
      expect(validateScheduleTimeRange(null, '2026-10-15T13:00:00.000Z')).toBeNull();
      expect(validateScheduleTimeRange('2026-10-15T13:00:00.000Z', null)).toBeNull();
      expect(validateScheduleTimeRange(null, null)).toBeNull();
    });
  });

  describe('getLocalTimezoneDisplay', () => {
    it('returns a non-empty string representing local timezone', () => {
      const tz = getLocalTimezoneDisplay();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe('validateFormTitle', () => {
    const existingForms = [
      { id: 'form-1', title: 'Midterm Project Submission' },
      { id: 'form-2', title: 'Hackathon Feedback' },
    ];

    it('rejects empty and whitespace-only titles', () => {
      expect(validateFormTitle('', existingForms).isValid).toBe(false);
      expect(validateFormTitle('   ', existingForms).isValid).toBe(false);
      expect(validateFormTitle('   ', existingForms).error).toContain('cannot be empty');
    });

    it('rejects titles longer than 100 characters', () => {
      const longTitle = 'A'.repeat(101);
      const res = validateFormTitle(longTitle, existingForms);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('cannot exceed 100 characters');
    });

    it('rejects duplicate titles case-insensitively', () => {
      const res = validateFormTitle('midterm project submission', existingForms);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('already exists');
    });

    it('allows updating a form with its own title', () => {
      const res = validateFormTitle('Midterm Project Submission', existingForms, 'form-1');
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
    });

    it('accepts valid unique titles', () => {
      const res = validateFormTitle('Final Demo Submission', existingForms);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
    });
  });

  describe('validateQuestionChoices', () => {
    it('allows non-choice field types without choices', () => {
      expect(validateQuestionChoices('TEXT', '').isValid).toBe(true);
      expect(validateQuestionChoices('NUMBER', undefined).isValid).toBe(true);
      expect(validateQuestionChoices('URL', null).isValid).toBe(true);
    });

    it('rejects empty or whitespace-only choices for choice fields', () => {
      const res = validateQuestionChoices('SELECT', '');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('at least 2 distinct choices');
    });

    it('rejects choices with fewer than 2 distinct options', () => {
      const res = validateQuestionChoices('RADIO', 'Single Option');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('at least 2 distinct choices');
    });

    it('deduplicates choices and trims whitespace', () => {
      const res = validateQuestionChoices('MULTI_SELECT', '  Red , Blue , red ,  Green ');
      expect(res.isValid).toBe(true);
      expect(res.options).toEqual(['Red', 'Blue', 'Green']);
      expect(res.cleanedOptions).toEqual(['Red', 'Blue', 'Green']);
    });
  });
});
