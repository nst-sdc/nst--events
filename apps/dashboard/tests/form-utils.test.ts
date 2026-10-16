import { describe, it, expect } from 'vitest';
import {
  validateClientFieldValue,
  validateFormResponses,
  getMissingRequiredFields,
  toResponsePayload,
  isFieldValueEmpty,
  formatFieldValueForDisplay,
  type FormFieldLike,
} from '../lib/form-utils';

function makeDescriptor(fieldType: string, options: string[] | null = null, label = 'Field') {
  return { fieldType, options, label };
}

function makeField(
  fieldType: string,
  options: string[] | null = null,
  isRequired = true,
  label = 'Field',
  id = 'field-1'
): FormFieldLike {
  return {
    isRequired,
    fieldDefinitionId: id,
    fieldDefinition: makeDescriptor(fieldType, options, label),
  };
}

describe('isFieldValueEmpty', () => {
  it('treats undefined, empty, whitespace and empty-array JSON as empty', () => {
    expect(isFieldValueEmpty(undefined)).toBe(true);
    expect(isFieldValueEmpty('')).toBe(true);
    expect(isFieldValueEmpty('   ')).toBe(true);
    expect(isFieldValueEmpty('[]')).toBe(true);
  });

  it('treats real values as non-empty', () => {
    expect(isFieldValueEmpty('hello')).toBe(false);
    expect(isFieldValueEmpty('["A"]')).toBe(false);
  });
});

describe('getMissingRequiredFields', () => {
  const fields = [makeField('TEXT', null, true), makeField('TEXT', null, false)];

  it('returns only unanswered required fields', () => {
    const missing = getMissingRequiredFields(fields, {});
    expect(missing).toHaveLength(1);
    expect(missing[0].fieldDefinitionId).toBe('field-1');
  });

  it('returns nothing when required fields are answered', () => {
    expect(getMissingRequiredFields(fields, { 'field-1': 'answer' })).toHaveLength(0);
  });

  it('handles undefined field lists', () => {
    expect(getMissingRequiredFields(undefined, {})).toEqual([]);
  });
});

describe('toResponsePayload', () => {
  it('drops empty values and preserves answers', () => {
    expect(toResponsePayload({ a: 'hello', b: '', c: '[]', d: '   ' })).toEqual([
      { fieldDefinitionId: 'a', value: 'hello' },
    ]);
  });
});

describe('validateClientFieldValue', () => {
  it('accepts empty values (required handled separately)', () => {
    expect(validateClientFieldValue(makeDescriptor('SELECT', ['A', 'B']), '')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('URL'), '')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('EMAIL'), '')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('NUMBER'), '')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('PHONE'), '')).toBeNull();
  });

  it('validates TEXT length boundaries', () => {
    expect(validateClientFieldValue(makeDescriptor('TEXT'), 'Valid text')).toBeNull();
    const longText = 'a'.repeat(2001);
    expect(validateClientFieldValue(makeDescriptor('TEXT'), longText)).toContain(
      'cannot exceed 2000 characters'
    );
  });

  it('validates URL format requiring http:// or https://', () => {
    expect(validateClientFieldValue(makeDescriptor('URL'), 'https://github.com/nst-events')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('URL'), 'http://localhost:3000')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('URL'), 'ftp://files.example.com')).toContain(
      'must start with http:// or https://'
    );
    expect(validateClientFieldValue(makeDescriptor('URL'), 'not-a-url')).toContain(
      'must start with http:// or https://'
    );
  });

  it('validates EMAIL format', () => {
    expect(validateClientFieldValue(makeDescriptor('EMAIL'), 'student@adypu.edu.in')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('EMAIL'), 'invalid-email')).toContain(
      'valid email address'
    );
    expect(validateClientFieldValue(makeDescriptor('EMAIL'), 'student@')).toContain(
      'valid email address'
    );
  });

  it('validates NUMBER format', () => {
    expect(validateClientFieldValue(makeDescriptor('NUMBER'), '42')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('NUMBER'), '-3.14')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('NUMBER'), '1e5')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('NUMBER'), 'abc')).toContain('valid number');
    expect(validateClientFieldValue(makeDescriptor('NUMBER'), '12px')).toContain('valid number');
  });

  it('validates PHONE format and length (7 to 15 digits)', () => {
    expect(validateClientFieldValue(makeDescriptor('PHONE'), '+91 98765 43210')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('PHONE'), '(555) 123-4567')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('PHONE'), '1234567890')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('PHONE'), '123')).toContain(
      'must contain 7-15 digits'
    );
    expect(validateClientFieldValue(makeDescriptor('PHONE'), 'not-a-phone')).toContain(
      'valid phone number'
    );
  });

  it('validates SELECT/RADIO membership against options', () => {
    expect(validateClientFieldValue(makeDescriptor('SELECT', ['A', 'B']), 'A')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('RADIO', ['A', 'B']), 'C')).toContain(
      'not a valid option'
    );
  });

  it('validates MULTI_SELECT JSON arrays against options', () => {
    expect(validateClientFieldValue(makeDescriptor('MULTI_SELECT', ['A', 'B']), '["A","B"]')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('MULTI_SELECT', ['A', 'B']), '["C"]')).toContain(
      'Invalid selection'
    );
    expect(validateClientFieldValue(makeDescriptor('MULTI_SELECT', ['A']), 'A')).toContain(
      'Invalid selection'
    );
  });
});

describe('validateFormResponses', () => {
  const fields = [
    makeField('TEXT', null, true, 'Name', 'field-1'),
    makeField('EMAIL', null, true, 'Email', 'field-2'),
    makeField('URL', null, false, 'Portfolio', 'field-3'),
  ];

  it('detects missing required fields', () => {
    const res = validateFormResponses(fields, { 'field-1': '' });
    expect(res.isValid).toBe(false);
    expect(res.firstError).toContain('Name');
  });

  it('detects format errors on non-empty values', () => {
    const res = validateFormResponses(fields, {
      'field-1': 'Jane Doe',
      'field-2': 'invalid-email',
    });
    expect(res.isValid).toBe(false);
    expect(res.firstError).toContain('valid email address');
  });

  it('passes when required fields are present and valid', () => {
    const res = validateFormResponses(fields, {
      'field-1': 'Jane Doe',
      'field-2': 'jane@example.com',
      'field-3': 'https://portfolio.com',
    });
    expect(res.isValid).toBe(true);
    expect(res.errors).toEqual({});
    expect(res.firstError).toBeNull();
  });
});

describe('formatFieldValueForDisplay', () => {
  it('joins JSON array values and passes through plain values', () => {
    expect(formatFieldValueForDisplay('["A","B"]')).toBe('A, B');
    expect(formatFieldValueForDisplay('plain')).toBe('plain');
    expect(formatFieldValueForDisplay(undefined)).toBe('-');
  });
});
