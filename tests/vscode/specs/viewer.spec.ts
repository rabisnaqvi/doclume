import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (globalThis as any).__DOCLUME_INIT__ = {
      markdown: '',
      theme: 'manual',
    };
    (globalThis as any).acquireVsCodeApi = () => ({ postMessage() {} });
  });
});

test('shows the empty-state prompt', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/open a \.md/i)).toBeVisible();
});
