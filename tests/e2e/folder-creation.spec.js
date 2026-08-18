import { test, expect } from '@playwright/test';

test('Create folder in Categories type', async ({ page, context }) => {
  // Set up dialog handler to intercept and respond to prompt
  page.on('dialog', async dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    await dialog.accept('Test Folder');
  });

  await page.goto('http://localhost:3000');
  
  // Click on Categories tab
  await page.locator('#area-tab').click();
  await page.waitForTimeout(500);
  
  // Enable console message logging
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'log') {
      console.log(`Browser: ${msg.text()}`);
    }
  });
  
  // Click the "+ Folder" button for areas
  const folderBtn = page.locator('#addAreaFolderBtn');
  await folderBtn.click();
  
  // Wait for the API call
  await page.waitForTimeout(1500);
  
  // Check for notifications
  const alerts = page.locator('[role="alert"], .alert');
  const alertCount = await alerts.count();
  console.log(`Alerts found: ${alertCount}`);
  
  if (alertCount > 0) {
    const text = await alerts.first().textContent();
    console.log(`Alert text: ${text}`);
  }
});
