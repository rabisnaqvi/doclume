import { expect, test } from '@playwright/test';

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

  await page.locator('body').click();
  for (let i = 0; i < 20; i += 1) {
    if (await copyButton.evaluate((element) => element === document.activeElement)) {
      break;
    }
    await page.keyboard.press('Tab');
  }
  await expect(copyButton).toBeFocused();
  await expect(copyButton).toBeVisible();

  await copyButton.click();
  await expect(copyButton).toHaveText('Copied ✓');
  await expect(reader).toHaveScreenshot('reader-sample.png', { maxDiffPixelRatio: 0.06 });
});
