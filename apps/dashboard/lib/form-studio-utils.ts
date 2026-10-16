import dayjs from 'dayjs';
import type { FieldType } from '../hooks/useFieldDefinitions';

export interface QuestionPreset {
  id: string;
  label: string;
  key: string;
  fieldType: FieldType;
  options: string[] | null;
  isReusable: boolean;
  description: string;
  category: 'profile' | 'logistics' | 'technical';
}

export const QUESTION_PRESETS: QuestionPreset[] = [
  {
    id: 'github_url',
    label: 'GitHub Profile / Repository',
    key: 'github_url',
    fieldType: 'URL',
    options: null,
    isReusable: true,
    description: 'Link to student GitHub account or project repo (reusable in profile)',
    category: 'profile',
  },
  {
    id: 'linkedin_url',
    label: 'LinkedIn Profile',
    key: 'linkedin_url',
    fieldType: 'URL',
    options: null,
    isReusable: true,
    description: 'Link to student professional network profile (reusable in profile)',
    category: 'profile',
  },
  {
    id: 'portfolio_url',
    label: 'Portfolio / Personal Website',
    key: 'portfolio_url',
    fieldType: 'URL',
    options: null,
    isReusable: true,
    description: 'Personal portfolio, blog, or resume site (reusable in profile)',
    category: 'profile',
  },
  {
    id: 'tshirt_size',
    label: 'T-Shirt Size',
    key: 'tshirt_size',
    fieldType: 'SELECT',
    options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    isReusable: false,
    description: 'Event-specific swag size (saved per event only, not in global profile)',
    category: 'logistics',
  },
  {
    id: 'dietary_requirements',
    label: 'Dietary Requirements',
    key: 'dietary_requirements',
    fieldType: 'SELECT',
    options: ['None / Standard', 'Vegetarian', 'Vegan', 'Jain', 'Halal', 'Gluten-Free', 'Other'],
    isReusable: true,
    description: 'Food preferences and allergy alerts for catering (reusable in profile)',
    category: 'logistics',
  },
  {
    id: 'experience_level',
    label: 'Experience Level',
    key: 'experience_level',
    fieldType: 'RADIO',
    options: ['Beginner', 'Intermediate', 'Advanced'],
    isReusable: true,
    description: 'Prior domain or hackathon experience (reusable in profile)',
    category: 'technical',
  },
];

/**
 * Automatically generates a unique, snake_case machine key from a human label.
 * Avoids colliding with any keys already present in the system.
 * Truncates base key to ensure final key never exceeds 50 characters.
 */
export function generateFieldKey(label: string, existingKeys: Set<string> | string[]): string {
  const keysSet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);

  let base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'custom_field';

  // Ensure base leaves room for suffix and does not exceed 40 chars
  if (base.length > 40) {
    base = base.slice(0, 40).replace(/_+$/, '');
  }

  if (!keysSet.has(base)) {
    return base;
  }

  let counter = 1;
  while (keysSet.has(`${base}_${counter}`)) {
    counter++;
  }
  return `${base}_${counter}`;
}

/**
 * Validates form title on creation or update.
 * Enforces non-empty, non-whitespace, maximum length, and duplicate title checks.
 * Accepts either string[] or object array with { id, title }.
 */
export function validateFormTitle(
  title: string | undefined | null,
  existingFormsOrTitles?: Array<string | { id: string; title: string }>,
  excludeFormId?: string
): { isValid: boolean; error: string | null } {
  if (!title || !title.trim()) {
    return { isValid: false, error: 'Form title cannot be empty.' };
  }

  const trimmed = title.trim();
  if (trimmed.length > 100) {
    return { isValid: false, error: 'Form title cannot exceed 100 characters.' };
  }

  if (existingFormsOrTitles && existingFormsOrTitles.length > 0) {
    const lower = trimmed.toLowerCase();
    const isDuplicate = existingFormsOrTitles.some((item) => {
      if (typeof item === 'string') {
        return item.trim().toLowerCase() === lower;
      }
      if (item && typeof item === 'object') {
        if (excludeFormId && item.id === excludeFormId) {
          return false;
        }
        return (item.title || '').trim().toLowerCase() === lower;
      }
      return false;
    });

    if (isDuplicate) {
      return { isValid: false, error: 'A form with this title already exists for this event.' };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validates and deduplicates choice options for SELECT, RADIO, and MULTI_SELECT fields.
 * Ensures at least two distinct choices are provided.
 */
export function validateQuestionChoices(
  fieldType: FieldType,
  rawOptions: string | string[] | null | undefined
): {
  isValid: boolean;
  valid: boolean;
  error: string | null;
  options: string[];
  cleanedOptions: string[];
} {
  if (!['SELECT', 'RADIO', 'MULTI_SELECT'].includes(fieldType)) {
    return { isValid: true, valid: true, error: null, options: [], cleanedOptions: [] };
  }

  let list: string[] = [];
  if (typeof rawOptions === 'string') {
    list = rawOptions.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(rawOptions)) {
    list = rawOptions.map((s) => s.trim()).filter(Boolean);
  }

  // Deduplicate while preserving first occurrence casing
  const seen = new Set<string>();
  const deduplicated: string[] = [];
  for (const opt of list) {
    const key = opt.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(opt);
    }
  }

  if (deduplicated.length < 2) {
    const errorMsg = 'Choice questions require at least 2 distinct choices (comma-separated).';
    return {
      isValid: false,
      valid: false,
      error: errorMsg,
      options: deduplicated,
      cleanedOptions: deduplicated,
    };
  }

  return {
    isValid: true,
    valid: true,
    error: null,
    options: deduplicated,
    cleanedOptions: deduplicated,
  };
}

export type FormAvailabilityStatus = 'draft' | 'scheduled' | 'open' | 'closed';

export interface FormAvailabilityInfo {
  status: FormAvailabilityStatus;
  label: string;
  badgeColor: string;
  description: string;
  isOpenNow: boolean;
  isPublished: boolean;
}

/**
 * Calculates current form availability based on publishedAt, releaseAt, and closeAt.
 * Follows the server-enforced half-open availability interval [releaseAt, closeAt)
 * and strict Draft -> Scheduled -> Open -> Closed lifecycle.
 */
export function getFormAvailability(
  form: { releaseAt?: string | null; closeAt?: string | null; publishedAt?: string | null },
  currentDate = new Date()
): FormAvailabilityInfo {
  const now = currentDate.getTime();
  const releaseTime = form.releaseAt ? new Date(form.releaseAt).getTime() : null;
  const closeTime = form.closeAt ? new Date(form.closeAt).getTime() : null;
  const isExplicitlyDraft = form.publishedAt === null;
  const isPublished = form.publishedAt !== null && form.publishedAt !== undefined;

  // Closed: now >= close_at (regardless of published_at)
  if (closeTime && now >= closeTime) {
    return {
      status: 'closed',
      label: 'Closed',
      badgeColor: 'default',
      description: `Closed ${dayjs(form.closeAt).format('MMM D, YYYY h:mm A')}`,
      isOpenNow: false,
      isPublished,
    };
  }

  // Draft: published_at IS NULL (not visible to students, no submissions accepted)
  if (isExplicitlyDraft) {
    return {
      status: 'draft',
      label: 'Draft',
      badgeColor: 'gold',
      description: 'Draft form (not published to students, questions can be edited)',
      isOpenNow: false,
      isPublished: false,
    };
  }

  // Scheduled: published_at IS NOT NULL AND now < release_at
  if (releaseTime && now < releaseTime) {
    return {
      status: 'scheduled',
      label: 'Scheduled',
      badgeColor: 'cyan',
      description: `Opens ${dayjs(form.releaseAt).format('MMM D, YYYY h:mm A')}`,
      isOpenNow: false,
      isPublished: true,
    };
  }

  // Open: published_at IS NOT NULL AND (release_at <= now < close_at OR close_at IS NULL)
  return {
    status: 'open',
    label: 'Open',
    badgeColor: 'green',
    description: closeTime
      ? `Open until ${dayjs(form.closeAt).format('MMM D, YYYY h:mm A')}`
      : 'Open with no closing deadline',
    isOpenNow: true,
    isPublished: true,
  };
}

/**
 * Validates scheduling time window before calling API.
 * Ensures closeAt is strictly after releaseAt when both are provided.
 */
export function validateScheduleTimeRange(
  releaseAt?: string | null,
  closeAt?: string | null
): string | null {
  if (!releaseAt || !closeAt) return null;

  const release = new Date(releaseAt).getTime();
  const close = new Date(closeAt).getTime();

  if (isNaN(release) || isNaN(close)) {
    return 'Please enter valid date and time values.';
  }

  if (close <= release) {
    return 'Form closing time must be strictly after the release opening time.';
  }

  return null;
}

/**
 * Returns formatted local timezone name and UTC offset for clear UI communication.
 */
export function getLocalTimezoneDisplay(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offsetMin) % 60).padStart(2, '0');
    return `${tz} (UTC${sign}${hours}:${minutes})`;
  } catch {
    return 'Local Time';
  }
}

/**
 * Sanitizes cell values against CSV formula injection (CSV Injection / Formula Injection).
 * Any cell value starting with =, +, -, @, \t, or \r is prefixed with a single quote (')
 * before standard CSV double-quote escaping.
 */
export function sanitizeCSVCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Exports submissions data to a CSV file in the browser with proper quoting,
 * formula sanitization, and Blob download support for arbitrary sizes and special characters.
 */
export function exportSubmissionsToCSV(
  formTitle: string,
  fieldColumns: Array<{ id: string; label: string }>,
  submissions: Array<{
    user: { fullName: string; email: string };
    submittedAt: string;
    answers: Record<string, { value: string }>;
  }>
): boolean {
  if (submissions.length === 0 || typeof document === 'undefined') return false;

  const headers = [
    'Student Name',
    'Student Email',
    'Submitted At',
    ...fieldColumns.map((f) => sanitizeCSVCell(f.label)),
  ];

  const rows = submissions.map((sub) => {
    const answersPart = fieldColumns.map((f) => {
      let val = sub.answers[f.id]?.value ?? '';
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          val = parsed.join(', ');
        }
      } catch {
        // use raw value
      }
      return sanitizeCSVCell(val);
    });

    return [
      sanitizeCSVCell(sub.user.fullName),
      sanitizeCSVCell(sub.user.email),
      sanitizeCSVCell(new Date(sub.submittedAt).toLocaleString()),
      ...answersPart,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('data-csv', csvContent);
  link.setAttribute('href', url);
  link.setAttribute('download', `${formTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_responses.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
