import { BadRequestError } from '../lib/errors';

export function validateFieldValue(
  fieldDef: { fieldType: string; options?: any; label: string },
  value: string
) {
  if (!value || value.trim() === '') return; // Empty values are validated by required field checks

  if (value.length > 5000) {
    throw new BadRequestError(`Value for field "${fieldDef.label}" exceeds maximum allowed length of 5000 characters`);
  }

  const trimmed = value.trim();

  switch (fieldDef.fieldType) {
    case 'TEXT': {
      // Free text string is accepted
      break;
    }
    case 'URL': {
      try {
        const url = new URL(trimmed);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error();
        }
      } catch {
        throw new BadRequestError(`Invalid URL for field "${fieldDef.label}"`);
      }
      break;
    }
    case 'EMAIL': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        throw new BadRequestError(`Invalid email address for field "${fieldDef.label}"`);
      }
      break;
    }
    case 'NUMBER': {
      const isNumericFormat = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed);
      const num = Number(trimmed);
      if (!isNumericFormat || isNaN(num) || !Number.isFinite(num)) {
        throw new BadRequestError(`Invalid number for field "${fieldDef.label}"`);
      }
      break;
    }
    case 'PHONE': {
      const phoneRegex = /^\+?[0-9\s().-]{7,25}$/;
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (!phoneRegex.test(trimmed) || digitsOnly.length < 7 || digitsOnly.length > 15) {
        throw new BadRequestError(`Invalid phone number for field "${fieldDef.label}"`);
      }
      break;
    }
    case 'SELECT':
    case 'RADIO': {
      if (fieldDef.options && Array.isArray(fieldDef.options)) {
        if (!fieldDef.options.includes(trimmed) && !fieldDef.options.includes(value)) {
          throw new BadRequestError(`Invalid option for field "${fieldDef.label}"`);
        }
      }
      break;
    }
    case 'MULTI_SELECT': {
      if (trimmed === '[]') {
        return;
      }
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
      break;
    }
    default:
      break;
  }
}

