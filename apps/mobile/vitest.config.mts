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
      'react-native': path.resolve(import.meta.dirname, 'tests/mocks/react-native.ts'),
      'expo-constants': path.resolve(import.meta.dirname, 'tests/mocks/expo-constants.ts'),
    },
  },
});
