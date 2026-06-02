import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@doclume\/core$/, replacement: resolve(process.cwd(), 'packages/core/src/index.ts') },
      { find: /^@doclume\/core\/css\/(.*)$/, replacement: resolve(process.cwd(), 'packages/core/css/$1') },
      { find: /^react$/, replacement: resolve(process.cwd(), 'packages/web/node_modules/react/index.js') },
      { find: /^react-dom\/client$/, replacement: resolve(process.cwd(), 'packages/web/node_modules/react-dom/client.js') },
      { find: /^react-dom\/test-utils$/, replacement: resolve(process.cwd(), 'packages/web/node_modules/react-dom/test-utils.js') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup/vitest.ts'],
  },
});
