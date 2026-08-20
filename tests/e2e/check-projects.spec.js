import { test } from '@playwright/test';

test('Projects page loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('http://localhost:3000/?tab=projects');
  await page.waitForTimeout(1000);

  if (errors.length > 0) {
    throw new Error(`Console errors on Projects page:\n${errors.join('\n')}`);
  }
});
