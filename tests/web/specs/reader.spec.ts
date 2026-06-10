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
  const overlay = codeBlock.locator('.code-block__overlay');
  const copyButton = codeBlock.locator('button.code-block__copy');
  const copyIcon = codeBlock.locator('.code-block__copy-icon');
  const languageLabel = codeBlock.locator('.code-block__label');
  const scroll = codeBlock.locator('.code-block__scroll').first();

  await expect(overlay).toBeVisible();
  await expect(copyIcon).toBeVisible();
  await expect(languageLabel).toHaveText('typescript');
  await expect(copyButton).toHaveText('Copy');

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
    const copyButton = codeBlock.locator('button.code-block__copy');
    const copyIcon = codeBlock.locator('.code-block__copy-icon');
    const languageLabel = codeBlock.locator('.code-block__label');
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
  const mermaid = article.locator('.mermaid').first();
  await expect(mermaid.locator('svg')).toBeVisible();
  await expect(mermaid).not.toContainText('flowchart TD');
  await page.addStyleTag({ content: 'article.markdown .mermaid { box-sizing: border-box !important; height: 374px !important; overflow: hidden !important; }' });
  await expect(mermaid).toHaveScreenshot('reader-mermaid.png', {
    maxDiffPixelRatio: 0.02,
  });
});

test('does not double-divider headings after horizontal rules', async ({ page }) => {
  await page.addInitScript((markdown) => {
    localStorage.setItem('doclume-prefs-v1', JSON.stringify({ theme: 'manual' }));
    localStorage.setItem('doclume-last-doc-v1', JSON.stringify({ markdown, name: 'divider.md' }));
  }, `# CARE GitLab-based code review workflow

**Date:** 2026-06-02  
**Status:** Draft  
**Scope:** CARE workflow only

---

## Goal

Move the CARE \`code-review\` stage from Jira comments to GitLab MR comments.`);

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const article = page.locator('article.markdown');
  const goal = article.locator('h2').filter({ hasText: 'Goal' }).first();

  await expect(article.locator('hr')).toHaveCount(1);
  await expect(goal).toBeVisible();
  expect(await goal.evaluate((el) => {
    const style = getComputedStyle(el);
    return { borderTopWidth: style.borderTopWidth, borderBottomWidth: style.borderBottomWidth };
  })).toEqual({ borderTopWidth: '0px', borderBottomWidth: '0px' });
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
  const overlay = firstCodeBlock.locator('.code-block__overlay');
  const copyIcon = firstCodeBlock.locator('.code-block__copy-icon');

  await expect(overlay).toBeVisible();
  await expect(copyIcon).toBeVisible();
  await expect(copyButton).toBeVisible();
  await expect(languageLabel).toHaveText('typescript');
  await expect(firstCodeBlock).toHaveScreenshot('reader-sample-code-block.png', {
    maxDiffPixelRatio: 0.07,
  });
  await page.addStyleTag({ content: 'article.markdown .mermaid { box-sizing: border-box !important; height: 374px !important; overflow: hidden !important; }' });
  await page.addStyleTag({ content: 'main.reader { height: 1400px !important; overflow: hidden !important; }' });
  await page.addStyleTag({ content: `
    .topbar {
      display: none !important;
    }
  ` });

  await expect(reader).toHaveScreenshot('reader-sample.png', { maxDiffPixelRatio: 0.11 });

  await copyButton.focus();
  await expect(copyButton).toBeFocused();
  await expect(copyButton).toBeVisible();

  await copyButton.click();
  await expect(copyButton).toHaveText('Copied ✓');
  await expect(reader.locator('article.markdown .mermaid svg')).toHaveCount(2);
});
