import { expect, test } from '@playwright/test';

test('loads the sample document', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /try the sample/i }).click();

  await expect(page.locator('main.reader .reader__filename')).toHaveText('sample.md');
  await expect(page.locator('main.reader article.markdown')).toBeVisible();
});
