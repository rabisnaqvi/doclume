import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const viewerMarkdown = readFileSync('tests/fixtures/viewer.md', 'utf8');

test.beforeEach(async ({ page }) => {
  await page.addInitScript((markdown) => {
    (globalThis as any).__DOCLUME_INIT__ = {
      markdown,
      theme: 'manual',
    };
    (globalThis as any).acquireVsCodeApi = () => ({ postMessage() {} });
  }, viewerMarkdown);
});

test('renders the viewer content', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const viewer = page.locator('.vsc-viewer');
  const article = page.locator('article.markdown');

  await expect(article.locator('h1')).toHaveText('Viewer coverage');
  await expect(article.locator('table')).toBeVisible();
  await expect(viewer).toHaveScreenshot('viewer-content.png');
});
