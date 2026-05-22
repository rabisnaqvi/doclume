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

  const article = page.locator('article.markdown');
  const codeBlock = article.locator('pre').first();
  const copyButton = article.locator('button.code-block__copy').first();
  const scroll = codeBlock.locator('.code-block__scroll').first();

  await codeBlock.hover();
  await expect(copyButton).toBeVisible();

  const before = await copyButton.boundingBox();

  await scroll.evaluate((el) => {
    const node = el as HTMLElement;
    node.scrollLeft = Math.min(240, Math.max(0, node.scrollWidth - node.clientWidth));
  });

  const after = await copyButton.boundingBox();
  await expect(copyButton).toBeVisible();
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(5);
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

  await expect(article.locator('button.code-block__copy')).toBeVisible();
  await expect(article.locator('.code-block__label')).toHaveText('typescript');
  await codeBlock.hover();
  await expect(codeBlock).toHaveScreenshot('viewer-code-block.png', { maxDiffPixelRatio: 0.02 });
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('viewer-content.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
});
