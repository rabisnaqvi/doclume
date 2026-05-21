import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const viewerMarkdown = readFileSync('tests/fixtures/basic.md', 'utf8');

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
  await page.addStyleTag({ content: ':root { --reader-width: 560px !important; }' });

  const article = page.locator('article.markdown');

  await expect(article.locator('h1')).toHaveText('Basic document');
  await expect(article.locator('ul')).toBeVisible();
  const codeBlock = article.locator('pre').first();

  await expect(article.locator('button.code-block__copy')).toBeVisible();
  await expect(article.locator('.code-block__label')).toHaveText('typescript');
  await codeBlock.hover();
  await expect(codeBlock).toHaveScreenshot('viewer-code-block.png', { maxDiffPixelRatio: 0.02 });
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('viewer-content.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
});
