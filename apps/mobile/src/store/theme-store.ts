import { create } from 'zustand';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { theme, lightColors, darkColors } from '../ui/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  isInitialized: boolean;
  initTheme: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  isInitialized: false,

  initTheme: async () => {
    try {
      const stored = await SecureStore.getItemAsync('app_appearance_mode') as ThemeMode | null;
      if (stored === 'light' || stored === 'dark') {
        try {
          Appearance.setColorScheme(stored);
        } catch {}
        set({ mode: stored, isInitialized: true });
      } else {
        try {
          Appearance.setColorScheme('unspecified');
        } catch {}
        set({ mode: 'system', isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  setMode: async (mode: ThemeMode) => {
    try {
      if (mode === 'system') {
        Appearance.setColorScheme('unspecified');
        await SecureStore.deleteItemAsync('app_appearance_mode');
      } else {
        Appearance.setColorScheme(mode as ColorSchemeName);
        await SecureStore.setItemAsync('app_appearance_mode', mode);
      }
    } catch {
      // Safe fallback if native appearance module fails
    }
    set({ mode });
  },
}));

export function useAppTheme() {
  const mode = useThemeStore((state) => state.mode);
  const systemScheme = useColorScheme() || (Appearance.getColorScheme() as ColorSchemeName) || 'dark';

  const resolvedMode = mode === 'system' ? systemScheme : mode;
  const colors = resolvedMode === 'light' ? lightColors : darkColors;

  return {
    ...theme,
    colors,
    mode: resolvedMode,
  };
}
