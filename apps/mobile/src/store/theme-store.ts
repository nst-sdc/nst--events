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
        Appearance.setColorScheme(stored);
        set({ mode: stored, isInitialized: true });
      } else {
        Appearance.setColorScheme(null as any);
        set({ mode: 'system', isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  setMode: async (mode: ThemeMode) => {
    if (mode === 'system') {
      Appearance.setColorScheme(null as any);
      await SecureStore.deleteItemAsync('app_appearance_mode');
    } else {
      Appearance.setColorScheme(mode as ColorSchemeName);
      await SecureStore.setItemAsync('app_appearance_mode', mode);
    }
    set({ mode });
  },
}));

export function useAppTheme() {
  const mode = useThemeStore((state) => state.mode);
  const systemScheme = useColorScheme() || 'dark';

  const resolvedMode = mode === 'system' ? systemScheme : mode;
  const colors = resolvedMode === 'light' ? lightColors : darkColors;

  return {
    ...theme,
    colors,
    mode: resolvedMode,
  };
}
