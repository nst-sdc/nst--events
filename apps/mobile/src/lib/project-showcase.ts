import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

export const NST_PROJECTS_BASE_URL = 'https://events.nstsdc.org/projects';

/**
 * Checks whether a given URL is an internal NST project showcase URL.
 */
export function isInternalProjectUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith(NST_PROJECTS_BASE_URL);
}

/**
 * Formats an internal project showcase URL from a slug or path.
 * If slug is omitted or empty, returns the showcase root directory.
 */
export function buildProjectShowcaseUrl(slugOrUrl?: string | null): string {
  if (!slugOrUrl || !slugOrUrl.trim()) {
    return NST_PROJECTS_BASE_URL;
  }
  const trimmed = slugOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanSlug = trimmed.replace(/^\/+/, '');
  return `${NST_PROJECTS_BASE_URL}/${cleanSlug}`;
}

/**
 * Opens an internal NST project showcase page using the in-app browser sheet.
 * Falls back to Linking.openURL if WebBrowser fails, and catches errors gracefully.
 */
export async function openProjectShowcase(slugOrUrl?: string | null): Promise<void> {
  const url = buildProjectShowcaseUrl(slugOrUrl);
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Linking.openURL(url).catch(() => {});
  }
}

/**
 * Routes internal showcase URLs to the in-app browser sheet,
 * and external repository / third-party URLs to the system browser.
 */
export async function openShowcaseOrExternalUrl(url?: string | null): Promise<void> {
  if (!url) return;
  if (isInternalProjectUrl(url)) {
    await openProjectShowcase(url);
  } else {
    Linking.openURL(url).catch(() => {});
  }
}
