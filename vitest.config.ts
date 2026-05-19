import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/core/**/*.test.ts', 'tests/content/**/*.test.ts'],
    setupFiles: ['tests/setup/vitest.ts'],
  },
});
