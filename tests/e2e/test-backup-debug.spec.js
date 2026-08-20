import { test, expect } from '@playwright/test';

test('Debug backup feature', async ({ page }) => {
  console.log('\n=== Debugging Backup Feature ===\n');

  // Navigate to settings
  await page.goto('http://localhost:3000/settings?tab=contexts');
  await page.waitForTimeout(2000);

  // Select the first context
  const firstContext = page.locator('.context-row').first();
  await firstContext.click();
  await page.waitForTimeout(1000);

  // Navigate to Database tab
  const databaseTab = page.locator('button[data-subtab="database"]');
  await databaseTab.click();
  await page.waitForTimeout(1000);

  // Listen for console messages
  page.on('console', msg => console.log(`Browser: ${msg.text()}`));

  // Check for errors
  page.on('pageerror', error => console.log(`Page Error: ${error.message}`));

  // Look for the backup button and check its state
  const backupBtn = page.locator('#backupContextBtn');
  console.log(`Backup button exists: ${await backupBtn.count() > 0}`);
  console.log(`Backup button visible: ${await backupBtn.isVisible().catch(() => false)}`);
  console.log(`Backup button enabled: ${await backupBtn.isEnabled().catch(() => false)}`);

  // Try clicking it
  await backupBtn.click();
  console.log('✓ Backup button clicked');

  // Wait and check for any response/error
  await page.waitForTimeout(3000);

  // Check the status element
  const statusEl = page.locator('#backupContextStatus');
  const statusText = await statusEl.textContent();
  console.log(`Status element text: ${statusText}`);

  console.log('\n=== Debug Complete ===\n');
});
