import { test } from '@playwright/test';

test('dailies page elements visible', async ({ page }) => {
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err));

  await page.goto('http://localhost:3000/?tab=dailies', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const calendarPane = await page.locator('#dailiesCalendarPane').isVisible();
  const contentRight = await page.locator('#dailiesContentRight').isVisible();
  const workItems = await page.locator('#workItemsList').isVisible();

  console.log('Calendar pane visible:', calendarPane);
  console.log('Content right visible:', contentRight);
  console.log('Work items visible:', workItems);

  // Get dimensions
  const calBox = await page.locator('#dailiesCalendarPane').boundingBox();
  const contentBox = await page.locator('#dailiesContentRight').boundingBox();

  console.log('Calendar pane box:', calBox);
  console.log('Content right box:', contentBox);
});
