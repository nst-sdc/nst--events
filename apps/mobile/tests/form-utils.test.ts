import { describe, it, expect } from 'vitest';
import {
  validateClientFieldValue,
  getMissingRequiredFields,
  toResponsePayload,
  isFieldValueEmpty,
  type FormFieldLike,
} from '../src/lib/form-utils';

function makeDescriptor(fieldType: string, options: string[] | null = null, label = 'Field') {
  return { fieldType, options, label };
}

function makeField(
  fieldType: string,
  options: string[] | null = null,
  isRequired = true,
  label = 'Field'
): FormFieldLike {
  return {
    isRequired,
    fieldDefinitionId: 'field-1',
    fieldDefinition: makeDescriptor(fieldType, options, label),
  };
}

describe('mobile form-utils', () => {
  it('detects empty values', () => {
    expect(isFieldValueEmpty(undefined)).toBe(true);
    expect(isFieldValueEmpty('  ')).toBe(true);
    expect(isFieldValueEmpty('[]')).toBe(true);
    expect(isFieldValueEmpty('ok')).toBe(false);
  });

  it('finds unanswered required fields', () => {
    const fields = [makeField('TEXT', null, true), makeField('TEXT', null, false)];
    expect(getMissingRequiredFields(fields, {})).toHaveLength(1);
    expect(getMissingRequiredFields(fields, { 'field-1': 'answer' })).toHaveLength(0);
    expect(getMissingRequiredFields(undefined, {})).toEqual([]);
  });

  it('shapes submission payloads by dropping empties', () => {
    expect(toResponsePayload({ a: 'hello', b: '', c: '[]' })).toEqual([
      { fieldDefinitionId: 'a', value: 'hello' },
    ]);
  });

  it('mirrors backend option validation', () => {
    expect(validateClientFieldValue(makeDescriptor('SELECT', ['A', 'B']), 'A')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('RADIO', ['A', 'B']), 'C')).toContain(
      'not a valid option'
    );
    expect(validateClientFieldValue(makeDescriptor('MULTI_SELECT', ['A', 'B']), '["A"]')).toBeNull();
    expect(validateClientFieldValue(makeDescriptor('MULTI_SELECT', ['A', 'B']), '["C"]')).toContain(
      'Invalid selection'
    );
    expect(validateClientFieldValue(makeDescriptor('TEXT'), 'free text')).toBeNull();
  });
});
