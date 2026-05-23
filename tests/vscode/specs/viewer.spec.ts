import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const viewerMarkdown = readFileSync('tests/fixtures/basic.md', 'utf8');
const scrollableMarkdown = readFileSync('tests/fixtures/scrollable-code.md', 'utf8');
const mermaidMarkdown = readFileSync('tests/fixtures/mermaid.md', 'utf8');

test.beforeEach(async ({ page }) => {
  await page.addInitScript((markdown) => {
    (globalThis as any).__DOCLUME_INIT__ = {
      markdown,
      theme: 'manual',
    };
    (globalThis as any).acquireVsCodeApi = () => ({ postMessage() {} });
  }, viewerMarkdown);
});

test('keeps code block controls pinned while scrolling horizontally', async ({ page }) => {
  await page.addInitScript((markdown) => {
    (globalThis as any).__DOCLUME_INIT__ = {
      markdown,
      theme: 'manual',
    };
    (globalThis as any).acquireVsCodeApi = () => ({ postMessage() {} });
  }, scrollableMarkdown);

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });

  const article = page.locator('article.markdown');
  const codeBlock = article.locator('pre').first();
  const copyButton = article.locator('button.code-block__copy').first();
  const overlay = codeBlock.locator('.code-block__overlay').first();
  const copyIcon = codeBlock.locator('.code-block__copy-icon').first();
  const languageLabel = codeBlock.locator('.code-block__label').first();
  const scroll = codeBlock.locator('.code-block__scroll').first();

  await expect(overlay).toBeVisible();
  await expect(copyIcon).toBeVisible();
  await expect(copyButton).toHaveText('Copy');
  await expect(languageLabel).toHaveText('typescript');

  const overlayBox = await overlay.boundingBox();
  const scrollBox = await scroll.boundingBox();
  expect(overlayBox).not.toBeNull();
  expect(scrollBox).not.toBeNull();
  expect(Math.abs((overlayBox?.x ?? 0) - (scrollBox?.x ?? 0))).toBeLessThan(4);
  expect((overlayBox?.y ?? 0)).toBeLessThan((scrollBox?.y ?? 0));

  const before = await copyButton.boundingBox();

  await scroll.evaluate((el) => {
    const node = el as HTMLElement;
    node.scrollLeft = Math.min(240, Math.max(0, node.scrollWidth - node.clientWidth));
  });

  const after = await copyButton.boundingBox();
  await expect(copyButton).toBeVisible();
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(5);

  await copyButton.click();
  await expect(copyButton).toHaveText('Copied ✓');
});

test('renders Mermaid on first open', async ({ page }) => {
  await page.addInitScript((markdown) => {
    (globalThis as any).__DOCLUME_INIT__ = {
      markdown,
      theme: 'manual',
    };
    (globalThis as any).acquireVsCodeApi = () => ({ postMessage() {} });
  }, mermaidMarkdown);

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const article = page.locator('article.markdown');
  await expect(article.locator('.mermaid svg')).toBeVisible();
  await expect(article.locator('.mermaid')).not.toContainText('flowchart TD');
});

test('renders the viewer content', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: ':root { --reader-width: 560px !important; }' });

  const article = page.locator('article.markdown');

  await expect(article.locator('h1')).toHaveText('Basic document');
  await expect(article.locator('ul')).toBeVisible();
  const codeBlock = article.locator('pre').first();
  const overlay = codeBlock.locator('.code-block__overlay').first();
  const copyButton = article.locator('button.code-block__copy').first();
  const copyIcon = codeBlock.locator('.code-block__copy-icon').first();

  await expect(overlay).toBeVisible();
  await expect(copyIcon).toBeVisible();
  await expect(article.locator('.code-block__label')).toHaveText('typescript');
  await expect(copyButton).toHaveText('Copy');
  await expect(codeBlock).toHaveScreenshot('viewer-code-block.png', { maxDiffPixelRatio: 0.02 });
  await expect(page).toHaveScreenshot('viewer-content.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
});
