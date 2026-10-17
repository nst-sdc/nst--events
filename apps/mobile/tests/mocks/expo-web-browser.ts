import { vi } from 'vitest';

export const WebBrowserResultType = {
  CANCEL: 'cancel',
  DISMISSED: 'dismiss',
  OPENED: 'opened',
  LOCKED: 'locked',
} as const;

export const WebBrowserPresentationStyle = {
  FULL_SCREEN: 0,
  PAGE_SHEET: 1,
  FORM_SHEET: 2,
  CURRENT_CONTEXT: 3,
  OVER_FULL_SCREEN: 4,
  OVER_CURRENT_CONTEXT: 5,
  POPOVER: 6,
  AUTOMATIC: 7,
} as const;

export const openBrowserAsync = vi.fn().mockImplementation(async (_url: string) => {
  return { type: 'opened' };
});

export const dismissBrowser = vi.fn().mockImplementation(async () => {
  return { type: 'dismiss' };
});

export const openAuthSessionAsync = vi.fn().mockImplementation(async () => {
  return { type: 'opened' };
});

export const dismissAuthSession = vi.fn().mockImplementation(async () => {});
export const warmUpAsync = vi.fn().mockImplementation(async () => ({}));
export const coolDownAsync = vi.fn().mockImplementation(async () => ({}));
export const mayInitWithUrlAsync = vi.fn().mockImplementation(async () => ({}));

export default {
  openBrowserAsync,
  dismissBrowser,
  openAuthSessionAsync,
  dismissAuthSession,
  warmUpAsync,
  coolDownAsync,
  mayInitWithUrlAsync,
  WebBrowserResultType,
  WebBrowserPresentationStyle,
};
