import { expect, test } from '@playwright/test';

test('switches to the console theme', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /try the sample/i }).click();

  await page.getByTitle('Change theme').click();
  await page.getByRole('menuitemradio', { name: /console/i }).click();
  await page.addStyleTag({ content: ':root { --reader-width: 560px !important; }' });

  await expect(page.locator('main.reader .reader__filename')).toHaveText('sample.md');
  await expect(page.getByTitle('Change theme')).toContainText('Console');
  await expect(page).toHaveScreenshot('theme-console.png');
});
