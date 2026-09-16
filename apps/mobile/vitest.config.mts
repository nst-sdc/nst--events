import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      '@testing-library/react-native': path.resolve(__dirname, 'tests/mocks/testing-library-react-native.ts'),
      'react-native': path.resolve(__dirname, 'tests/mocks/react-native.ts'),
      'expo-constants': path.resolve(__dirname, 'tests/mocks/expo-constants.ts'),
      'expo-secure-store': path.resolve(__dirname, 'tests/mocks/expo-secure-store.ts'),
      'react-native-safe-area-context': path.resolve(__dirname, 'tests/mocks/react-native-safe-area-context.ts'),
      'jsdom': path.resolve(__dirname, '../../node_modules/jsdom'),
    },
  },
});
