import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryStorage = new Map<string, string>();

function getWebSessionStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // sessionStorage access may throw in sandboxed iframes or private modes
  }
  return null;
}

/**
 * Platform-safe storage abstraction.
 * On native platforms (iOS / Android), delegates to expo-secure-store (Keychain / KeyStore).
 * On Web, uses sessionStorage or in-memory fallback.
 * NOTE: In strict accordance with project rules, tokens are NEVER persisted in localStorage.
 */
export const safeSecureStore = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        const session = getWebSessionStorage();
        if (session) {
          const val = session.getItem(key);
          if (val !== null) return val;
        }
      } catch {
        // Restricted storage access or security exception fallback
      }
      return memoryStorage.get(key) ?? null;
    }
    return SecureStore.getItemAsync(key);
  },

  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        const session = getWebSessionStorage();
        if (session) {
          session.setItem(key, value);
          memoryStorage.set(key, value);
          return;
        }
      } catch {
        // QuotaExceededError or restricted storage fallback
      }
      memoryStorage.set(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },

  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        const session = getWebSessionStorage();
        if (session) {
          session.removeItem(key);
        }
      } catch {
        // Restricted storage access or security exception fallback
      }
      memoryStorage.delete(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};
