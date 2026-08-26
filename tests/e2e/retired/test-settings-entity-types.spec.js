import { test, expect } from '@playwright/test';

test.describe('Settings - Entity Types Page', () => {
  test('Entity types load on settings page', async ({ page }) => {
    // Capture all console messages
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Navigate to settings entity types tab
    await page.goto('http://localhost:3000/settings?tab=entity-types', { waitUntil: 'networkidle' });

    // Wait for page to render
    await page.waitForTimeout(2000);

    // Check if the system types list exists
    const systemTypesList = page.locator('#systemTypesList');
    await expect(systemTypesList).toBeTruthy();

    // Get the text content
    const content = await systemTypesList.textContent();
    console.log('System Types List Content:');
    console.log(content);

    // Print console logs
    console.log('\nConsole logs:');
    consoleLogs.forEach(log => console.log(log));

    // Check if it has type items
    const typeItems = await page.locator('.type-item').count();
    console.log(`\nFound ${typeItems} type items`);

    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/settings-entity-types.png' });
    console.log('Screenshot saved to /tmp/settings-entity-types.png');
  });
});
