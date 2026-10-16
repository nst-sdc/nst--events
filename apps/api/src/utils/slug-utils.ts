/**
 * Slug normalization, validation, and generation utilities.
 */

const RESERVED_SLUGS = new Set([
  'create',
  'new',
  'edit',
  'admin',
  'api',
  'login',
  'register',
  'auth',
  'public',
  'feed',
  'clubs',
  'club',
  'settings',
  'profile',
  'leaderboard',
  'manage',
  'student',
  'students',
  'directory',
  'profiles',
  'portfolio',
  'showcase',
  'approvals',
  'events',
  'event',
  'projects',
  'project',
  'submit',
  'my',
  'trending',
  'static',
  'sitemap',
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
  'health',
  'metrics',
  'search',
  'explore',
  'discover',
  'attendance',
  'teams',
  'team',
  'null',
  'undefined',
]);

/**
 * Normalizes a raw string into a clean lowercase URL slug with hyphens.
 */
export function generateSlug(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD') // decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, '') // strip leading and trailing hyphens
    .slice(0, 80); // cap length
}

/**
 * Validates whether a slug conforms to URL slug constraints:
 * - 3 to 100 characters
 * - Only lowercase letters, digits, and single hyphens
 * - No leading or trailing hyphens
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  if (slug.length < 3 || slug.length > 100) return false;
  const regex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return regex.test(slug);
}

/**
 * Checks if a slug is a reserved system path.
 */
export function isReservedSlug(slug: string): boolean {
  if (!slug) return true;
  return RESERVED_SLUGS.has(slug.toLowerCase().trim());
}