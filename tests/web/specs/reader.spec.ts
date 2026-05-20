import { expect, test } from '@playwright/test';

test('loads the sample document', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /try the sample/i }).click();

  const reader = page.locator('main.reader');
  await page.addStyleTag({ content: ':root { --reader-width: 560px !important; }' });

  await expect(reader.locator('.reader__filename')).toHaveText('sample.md');
  await expect(reader.locator('article.markdown')).toBeVisible();
  await expect(reader).toHaveScreenshot('reader-sample.png');
});
