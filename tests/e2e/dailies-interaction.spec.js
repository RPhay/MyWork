import { test } from '@playwright/test';

test('dailies calendar and work items', async ({ page }) => {
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err));

  await page.goto('http://localhost:3000/?tab=dailies', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('=== Initial state ===');
  const workItems = await page.locator('#workItemsList').isVisible();
  console.log('Work items list visible:', workItems);

  // Check if calendar is clickable
  console.log('=== Trying to click calendar date 7 ===');
  const dateCell = page.locator('text=7').nth(0);
  console.log('Found date 7 cell');

  await dateCell.click();
  await page.waitForTimeout(1000);

  // Check if work items loaded after click
  const workItemsText = await page.locator('#workItemsList').textContent();
  console.log('Work items content:', workItemsText?.substring(0, 100) || 'EMPTY');

  // Check selected date display
  const selectedDate = await page.locator('#selectedDateDisplay').textContent();
  console.log('Selected date display:', selectedDate);
});
