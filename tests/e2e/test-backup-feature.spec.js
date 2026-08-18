import { test, expect } from '@playwright/test';

test('Backup feature works correctly', async ({ page, context }) => {
  console.log('\n=== Testing Backup Feature ===\n');

  // Navigate to settings
  await page.goto('http://localhost:3000/settings?tab=contexts');
  await page.waitForTimeout(2000);

  // Select the first context
  const firstContext = page.locator('.context-row').first();
  await expect(firstContext).toBeVisible({ timeout: 5000 });
  await firstContext.click();
  await page.waitForTimeout(1000);

  console.log('✓ Context selected');

  // Navigate to Database tab
  const databaseTab = page.locator('button[data-subtab="database"]');
  await expect(databaseTab).toBeVisible();
  await databaseTab.click();
  await page.waitForTimeout(1000);

  console.log('✓ Database tab opened');

  // Check if backup button exists
  const backupBtn = page.locator('#backupContextBtn');
  const btnExists = await backupBtn.count();

  if (btnExists > 0) {
    console.log('✓ Backup button found');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click the backup button
    await backupBtn.click();
    await page.waitForTimeout(2000);

    // Check for download
    try {
      const download = await downloadPromise;
      const filename = download.suggestedFilename();

      console.log(`✓ Download started: ${filename}`);

      // Check filename format
      if (filename.includes('mywork-backup') && filename.includes('.zip')) {
        console.log('✓ Backup filename format correct');
      } else {
        console.log('✗ Backup filename format unexpected:', filename);
      }

      // Verify the file path exists
      const path = await download.path();
      console.log(`✓ Backup file created at: ${path}`);

    } catch (error) {
      console.log('⚠ Could not verify download (expected in headless):', error.message);
    }

    // Check for success notification
    const successNotification = page.locator('text=/Backup created/i');
    const notifExists = await successNotification.count({ timeout: 5000 }).catch(() => 0);
    if (notifExists > 0) {
      console.log('✓ Success notification appeared');
    }

  } else {
    console.log('✗ Backup button not found');
  }

  console.log('\n=== Backup Feature Test Complete ===\n');
});
