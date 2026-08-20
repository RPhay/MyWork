import { test, expect } from '@playwright/test';

test('Backup button appears in context database tab', async ({ page }) => {
  await page.goto('http://localhost:3000/settings?tab=contexts');

  // Wait for the page to load
  await page.waitForTimeout(2000);

  // Check if the contexts panel exists
  const contextPanel = page.locator('#contextsList');
  await expect(contextPanel).toBeVisible({ timeout: 5000 });

  // Wait for contexts to load - click the first context in the list
  const firstContext = page.locator('.context-row').first();
  await expect(firstContext).toBeVisible({ timeout: 5000 });

  await firstContext.click();
  await page.waitForTimeout(1000);

  // Navigate to the Database tab by clicking the tab
  const databaseTab = page.locator('button[data-subtab="database"]');
  await expect(databaseTab).toBeVisible({ timeout: 5000 });

  await databaseTab.click();
  await page.waitForTimeout(1000);

  // Check if the backup button exists in the DOM
  const backupBtn = page.locator('#backupContextBtn');

  // The button might not be visible if no database is configured,
  // but it should exist in the DOM
  const count = await backupBtn.count();
  expect(count).toBe(1);
  console.log('✓ Backup button exists in the Database tab');

  // Verify button text
  const btnText = await backupBtn.textContent();
  console.log(`Button text: ${btnText}`);
  expect(btnText).toContain('Create Backup');

  console.log('✓ Backup button has correct text');

  // Check that the status element exists for feedback
  const statusEl = page.locator('#backupContextStatus');
  const statusCount = await statusEl.count();
  expect(statusCount).toBe(1);
  console.log('✓ Backup status element exists');
});
