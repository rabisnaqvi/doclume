import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@doclume/core': resolve(process.cwd(), 'packages/core/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/core/**/*.test.ts', 'tests/content/**/*.test.ts', 'tests/scripts/**/*.test.ts'],
    setupFiles: ['tests/setup/vitest.ts'],
  },
});
