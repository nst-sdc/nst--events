import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      'react-native': path.resolve(import.meta.dirname, 'tests/mocks/react-native.ts'),
    },
  },
});
