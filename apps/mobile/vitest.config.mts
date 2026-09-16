import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@testing-library/react-native': path.resolve(import.meta.dirname, 'tests/mocks/testing-library-react-native.ts'),
      'react-native': path.resolve(import.meta.dirname, 'tests/mocks/react-native.ts'),
      'expo-constants': path.resolve(import.meta.dirname, 'tests/mocks/expo-constants.ts'),
      'expo-secure-store': path.resolve(import.meta.dirname, 'tests/mocks/expo-secure-store.ts'),
      'react-native-safe-area-context': path.resolve(import.meta.dirname, 'tests/mocks/react-native-safe-area-context.ts'),
    },
  },
});
