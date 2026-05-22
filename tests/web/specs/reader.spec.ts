import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const scrollableMarkdown = readFileSync('tests/fixtures/scrollable-code.md', 'utf8');
const mermaidMarkdown = readFileSync('tests/fixtures/mermaid.md', 'utf8');

test('keeps code block controls pinned while scrolling horizontally', async ({ page }) => {
  await page.addInitScript((markdown) => {
    localStorage.setItem('doclume-prefs-v1', JSON.stringify({ theme: 'manual' }));
    localStorage.setItem('doclume-last-doc-v1', JSON.stringify({ markdown, name: 'scrollable-code.md' }));
  }, scrollableMarkdown);

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const reader = page.locator('main.reader');
  const codeBlock = reader.locator('article.markdown pre').first();
  const copyButton = codeBlock.locator('button.code-block__copy');
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

test.describe('mobile code blocks', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('lays code block controls out in flow on touch screens', async ({ page }) => {
    await page.addInitScript((markdown) => {
      localStorage.setItem('doclume-prefs-v1', JSON.stringify({ theme: 'manual' }));
      localStorage.setItem('doclume-last-doc-v1', JSON.stringify({ markdown, name: 'scrollable-code.md' }));
    }, scrollableMarkdown);

    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    const codeBlock = page.locator('article.markdown pre').first();
    const overlay = codeBlock.locator('.code-block__overlay');
    const scroll = codeBlock.locator('.code-block__scroll').first();

    await expect(overlay).toBeVisible();

    const overlayBox = await overlay.boundingBox();
    const scrollBox = await scroll.boundingBox();

    expect(overlayBox).not.toBeNull();
    expect(scrollBox).not.toBeNull();
    expect(Math.abs((overlayBox?.x ?? 0) - (scrollBox?.x ?? 0))).toBeLessThan(4);
    expect(overlayBox?.width ?? 0).toBeGreaterThan((scrollBox?.width ?? 0) * 0.8);
  });
});

test('renders Mermaid on first open', async ({ page }) => {
  await page.addInitScript((markdown) => {
    localStorage.setItem('doclume-prefs-v1', JSON.stringify({ theme: 'manual' }));
    localStorage.setItem('doclume-last-doc-v1', JSON.stringify({ markdown, name: 'mermaid.md' }));
  }, mermaidMarkdown);

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const article = page.locator('article.markdown');
  await expect(article.locator('.mermaid svg')).toBeVisible();
  await expect(article.locator('.mermaid')).not.toContainText('flowchart TD');
});

test('loads the sample document', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
  await page.getByRole('button', { name: /try the sample/i }).click();

  const reader = page.locator('main.reader');
  const firstCodeBlock = reader.locator('article.markdown pre').first();
  const copyButton = firstCodeBlock.locator('button.code-block__copy');
  const languageLabel = firstCodeBlock.locator('.code-block__label');
  await page.addStyleTag({ content: ':root { --reader-width: 560px !important; }' });

  await expect(reader.locator('.reader__filename')).toHaveText('sample.md');
  await expect(reader.locator('article.markdown')).toBeVisible();
  await firstCodeBlock.hover();
  await expect(copyButton).toBeVisible();
  await expect(languageLabel).toHaveText('typescript');

  await copyButton.focus();
  await expect(copyButton).toBeFocused();
  await expect(copyButton).toBeVisible();

  await copyButton.click();
  await expect(copyButton).toHaveText('Copied ✓');
  await expect(reader).toHaveScreenshot('reader-sample.png', { maxDiffPixelRatio: 0.06 });
});
