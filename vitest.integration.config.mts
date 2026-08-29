import { defineConfig } from 'vitest/config';
import path from 'path';

// Separate config for npm run test:integration: only the Sheets integration suite, which
// talks to a real (dedicated, non-production) Google Sheet. See docs/TEST_DESIGN.md.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    globals: true,
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
