type FieldDescriptor = {
  fieldType: string;
  options?: string[] | null;
  label: string;
};

/**
 * Minimal structural shape shared by both the standalone-form fields
 * (`useEventForms.EventFormField`) and the legacy registration fields
 * (`useEventFormFields.EventFormField`).
 */
export interface FormFieldLike {
  isRequired: boolean;
  fieldDefinitionId: string;
  fieldDefinition: FieldDescriptor;
}

/**
 * Mirrors the backend `validateFieldValue` (apps/api/src/utils/form-validation.ts)
 * so client-side errors surface before a round-trip. Returns an error message
 * or null when the value is acceptable.
 */
export function validateClientFieldValue(fieldDef: FieldDescriptor, value: string): string | null {
  if (!value || value.trim() === '') return null;

  const trimmed = value.trim();

  // Enforce reasonable maximum character length for any field
  if (trimmed.length > 2000) {
    return `"${fieldDef.label}" cannot exceed 2000 characters.`;
  }

  switch (fieldDef.fieldType) {
    case 'URL': {
      try {
        const url = new URL(trimmed);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error();
        }
      } catch {
        return `Invalid URL for "${fieldDef.label}" (must start with http:// or https://)`;
      }
      break;
    }
    case 'EMAIL': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return `Invalid email address for "${fieldDef.label}"`;
      }
      break;
    }
    case 'NUMBER': {
      const isNumericFormat = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed);
      const num = Number(trimmed);
      if (!isNumericFormat || isNaN(num) || !Number.isFinite(num)) {
        return `Invalid number for "${fieldDef.label}"`;
      }
      break;
    }
    case 'PHONE': {
      const phoneRegex = /^\+?[0-9\s().-]{7,25}$/;
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (!phoneRegex.test(trimmed) || digitsOnly.length < 7 || digitsOnly.length > 15) {
        return `Invalid phone number for "${fieldDef.label}" (must contain 7-15 digits)`;
      }
      break;
    }
    case 'SELECT':
    case 'RADIO': {
      if (fieldDef.options && Array.isArray(fieldDef.options)) {
        if (!fieldDef.options.includes(trimmed) && !fieldDef.options.includes(value)) {
          return `"${value}" is not a valid option for "${fieldDef.label}"`;
        }
      }
      break;
    }
    case 'MULTI_SELECT': {
      if (trimmed === '[]') {
        return null;
      }
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) throw new Error();
        if (fieldDef.options && Array.isArray(fieldDef.options)) {
          for (const item of parsed) {
            if (!fieldDef.options.includes(item)) throw new Error();
          }
        }
      } catch {
        return `Invalid selection for "${fieldDef.label}"`;
      }
      break;
    }
    default:
      break;
  }

  return null;
}

export function isFieldValueEmpty(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === '[]';
}

export function getMissingRequiredFields(
  fields: FormFieldLike[] | undefined,
  responses: Record<string, string>
): FormFieldLike[] {
  if (!fields) return [];
  return fields.filter(
    (field) => field.isRequired && isFieldValueEmpty(responses[field.fieldDefinitionId])
  );
}

/**
 * Validates all form responses against both required constraints and type-specific rules.
 * Returns a map of fieldDefinitionId -> errorMessage for precise inline error placement.
 */
export function validateFormResponses(
  fields: FormFieldLike[] | undefined,
  responses: Record<string, string>
): {
  isValid: boolean;
  errors: Record<string, string>;
  firstError: string | null;
} {
  const errors: Record<string, string> = {};
  if (!fields || fields.length === 0) {
    return { isValid: true, errors, firstError: null };
  }

  for (const field of fields) {
    const rawVal = responses[field.fieldDefinitionId];
    if (field.isRequired && isFieldValueEmpty(rawVal)) {
      errors[field.fieldDefinitionId] = `"${field.fieldDefinition.label}" is required.`;
      continue;
    }

    if (!isFieldValueEmpty(rawVal)) {
      const typeError = validateClientFieldValue(field.fieldDefinition, rawVal);
      if (typeError) {
        errors[field.fieldDefinitionId] = typeError;
      }
    }
  }

  const errorKeys = Object.keys(errors);
  return {
    isValid: errorKeys.length === 0,
    errors,
    firstError: errorKeys.length > 0 ? errors[errorKeys[0]] : null,
  };
}

export function toResponsePayload(
  responses: Record<string, string>
): Array<{ fieldDefinitionId: string; value: string }> {
  return Object.entries(responses)
    .filter(([, value]) => !isFieldValueEmpty(value))
    .map(([fieldDefinitionId, value]) => ({ fieldDefinitionId, value }));
}

export function formatFieldValueForDisplay(value: string | undefined): string {
  if (!value) return '-';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(', ');
  } catch {
    // not JSON, fall through to raw value
  }
  return value;
}
