import { Platform } from 'react-native';

/**
 * Disciplined, fatigue-free haptic feedback wrapper (Prism Mobile Standard v3.6.0).
 *
 * Policy:
 * - Only triggered by direct user actions (selection, commit tap) or terminal outcomes (scan success/error/warning).
 * - Never triggered on screen mount, passive state updates, or scroll events.
 * - Gracefully no-ops on unsupported platforms (web, simulators without haptics) or when disabled via in-app setting.
 */

let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

async function getHapticsModule(): Promise<typeof import('expo-haptics') | null> {
  if (!hapticsEnabled || Platform.OS === 'web') {
    return null;
  }
  try {
    return await import('expo-haptics');
  } catch {
    return null;
  }
}

export const haptics = {
  /** Subtle tick for tab switches and segmented control changes. */
  async selection(): Promise<void> {
    const mod = await getHapticsModule();
    if (!mod?.selectionAsync) return;
    try {
      await mod.selectionAsync();
    } catch {
      // Unsupported device or OS haptics disabled — fail silently
    }
  },

  /** Medium impact for primary commit button presses (Register, Confirm, Submit). */
  async impactMedium(): Promise<void> {
    const mod = await getHapticsModule();
    if (!mod?.impactAsync || !mod?.ImpactFeedbackStyle) return;
    try {
      await mod.impactAsync(mod.ImpactFeedbackStyle.Medium);
    } catch {
      // Unsupported device — fail silently
    }
  },

  /** Success notification for confirmed attendance check-in or submission. */
  async notifySuccess(): Promise<void> {
    const mod = await getHapticsModule();
    if (!mod?.notificationAsync || !mod?.NotificationFeedbackType) return;
    try {
      await mod.notificationAsync(mod.NotificationFeedbackType.Success);
    } catch {
      // Unsupported device — fail silently
    }
  },

  /** Warning notification for soft/recoverable failures (rotated QR, duplicate scan, weak GPS). */
  async notifyWarning(): Promise<void> {
    const mod = await getHapticsModule();
    if (!mod?.notificationAsync || !mod?.NotificationFeedbackType) return;
    try {
      await mod.notificationAsync(mod.NotificationFeedbackType.Warning);
    } catch {
      // Unsupported device — fail silently
    }
  },

  /** Error notification strictly for hard terminal failures (location verification failure, session closed). */
  async notifyError(): Promise<void> {
    const mod = await getHapticsModule();
    if (!mod?.notificationAsync || !mod?.NotificationFeedbackType) return;
    try {
      await mod.notificationAsync(mod.NotificationFeedbackType.Error);
    } catch {
      // Unsupported device — fail silently
    }
  },
};

