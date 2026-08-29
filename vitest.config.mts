import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // .tsx tests are component tests and opt into jsdom individually via a
    // `// @vitest-environment jsdom` docblock at the top of the file; everything else stays on
    // the default 'node' environment above so existing lib/route tests are unaffected.
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', 'src/__tests__/integration/**'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // A few shadcn/ui files (generated, not hand-written) import via the bare `src/...`
      // path that tsconfig's baseUrl resolves in Next.js; Vite needs its own alias for it.
      src: path.resolve(import.meta.dirname, './src'),
    },
  },
});
