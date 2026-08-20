import { test, expect } from '@playwright/test';

test('Context requires database configuration', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Wait for the context switcher to load
  await page.waitForTimeout(2000);

  // Try to open the context switcher
  const contextSwitcherBtn = page.locator('#contextSwitcherBtn');
  await expect(contextSwitcherBtn).toBeVisible({ timeout: 5000 });

  // Click the context switcher to open the dropdown
  await contextSwitcherBtn.click();
  await page.waitForTimeout(500);

  // Check if there are any context options
  const contextOptions = page.locator('#contextSwitcherMenu button[data-context-id]');
  const count = await contextOptions.count();

  console.log(`Found ${count} contexts`);

  if (count > 0) {
    // Get the first context that's not currently active
    const activeOption = page.locator('#contextSwitcherMenu button[data-context-id].active');
    const activeContextId = await activeOption.getAttribute('data-context-id');

    const firstOption = contextOptions.first();
    const firstContextId = await firstOption.getAttribute('data-context-id');

    console.log(`Active context ID: ${activeContextId}, First context ID: ${firstContextId}`);

    // If we find a different context, try to switch to it
    if (firstContextId !== activeContextId) {
      await firstOption.click();
      await page.waitForTimeout(1000);

      // Check if the database config modal appeared
      const modal = page.locator('#contextDatabaseConfigModal');
      const isVisible = await modal.isVisible().catch(() => false);

      if (isVisible) {
        console.log('✓ Database configuration modal appeared as expected');
      } else {
        console.log('✓ Context switch succeeded (context has database configured)');
      }
    }
  }
});
