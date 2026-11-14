/**
 * Canonical Institutional Email and Reviewer Verification Rules.
 * Single source of truth across Backend, Shared Schemas, and Frontend.
 */

export const ALLOWED_INSTITUTIONAL_DOMAINS = [
  'adypu.edu.in',
  'newtonschool.co',
] as const;

export const TEST_EMAIL_DOMAINS = [
  'example.com',
  'test.local',
  'test.com',
  'nst.com',
] as const;

export const REVIEWER_WHITELIST_EMAILS = [
  'nstevents.reviewer@gmail.com',
] as const;

/**
 * Checks whether an email belongs to the whitelisted reviewer accounts.
 */
export function isReviewerEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return (REVIEWER_WHITELIST_EMAILS as readonly string[]).includes(normalized);
}

/**
 * Validates whether an email is an allowed institutional or reviewer email.
 */
export function isInstitutionalEmail(
  email?: string | null,
  options?: { allowTestDomains?: boolean; additionalAllowedDomains?: string[] }
): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();

  // 1. Check reviewer exception
  if (isReviewerEmail(normalized)) return true;

  const parts = normalized.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const domain = parts[1];

  // 2. Check standard institutional domains
  if ((ALLOWED_INSTITUTIONAL_DOMAINS as readonly string[]).includes(domain)) {
    return true;
  }

  // 3. Additional custom allowed domains if passed
  if (options?.additionalAllowedDomains && options.additionalAllowedDomains.includes(domain)) {
    return true;
  }

  // 4. Test domains (only when explicitly enabled)
  if (options?.allowTestDomains || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' && process.env?.ALLOW_TEST_EMAIL_DOMAINS === 'true')) {
    if ((TEST_EMAIL_DOMAINS as readonly string[]).includes(domain)) {
      return true;
    }
  }

  return false;
}

