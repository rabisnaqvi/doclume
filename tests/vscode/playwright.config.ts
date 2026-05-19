import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 1440, height: 1200 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'pnpm --filter doclume build:webview && pnpm --filter doclume preview:webview',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
