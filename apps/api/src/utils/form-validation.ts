import { BadRequestError } from '../lib/errors';

export function validateFieldValue(fieldDef: { fieldType: string, options?: any, label: string }, value: string) {
  if (!value) return; // Empty values are validated by required field checks

  if (fieldDef.fieldType === 'MULTI_SELECT') {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error();
      }
      if (fieldDef.options && Array.isArray(fieldDef.options)) {
        for (const item of parsed) {
          if (!fieldDef.options.includes(item)) {
            throw new Error();
          }
        }
      }
    } catch {
      throw new BadRequestError(`Invalid value for MULTI_SELECT field "${fieldDef.label}"`);
    }
  } else if (fieldDef.fieldType === 'RADIO' || fieldDef.fieldType === 'SELECT') {
    if (fieldDef.options && Array.isArray(fieldDef.options)) {
      if (!fieldDef.options.includes(value)) {
        throw new BadRequestError(`Invalid option for field "${fieldDef.label}"`);
      }
    }
  }
}
