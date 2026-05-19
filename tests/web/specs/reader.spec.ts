import { expect, test } from '@playwright/test';

test('loads the sample document', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /try the sample/i }).click();

  await expect(page.getByRole('heading', { name: /on reading plainly/i })).toBeVisible();
});
