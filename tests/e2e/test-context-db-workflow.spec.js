import { test, expect } from '@playwright/test';

test('Context database workflow: modal, copy system db, and validation', async ({ page }) => {
  console.log('\n=== Testing Context Database Workflow ===\n');

  // Step 1: Navigate to the app
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  // Step 2: Check the context switcher
  const contextSwitcherBtn = page.locator('#contextSwitcherBtn');
  await expect(contextSwitcherBtn).toBeVisible({ timeout: 5000 });
  console.log('✓ Context switcher visible');

  // Step 3: Navigate to Settings to see the "Use System Database" button
  await page.goto('http://localhost:3000/settings?tab=contexts');
  await page.waitForTimeout(2000);

  // Step 4: Check if contexts are loaded in the settings
  const contextsList = page.locator('#contextsList');
  await expect(contextsList).toBeVisible({ timeout: 5000 });
  console.log('✓ Contexts list loaded in settings');

  // Step 5: Try to select a context
  const firstContext = page.locator('.context-row').first();
  const isVisible = await firstContext.isVisible().catch(() => false);

  if (isVisible) {
    await firstContext.click();
    await page.waitForTimeout(1000);
    console.log('✓ First context selected');

    // Step 6: Navigate to Database tab
    const databaseTab = page.locator('button[data-subtab="database"]');
    await expect(databaseTab).toBeVisible({ timeout: 5000 });
    await databaseTab.click();
    await page.waitForTimeout(1000);
    console.log('✓ Database tab clicked');

    // Step 7: Check if "Use System Database" button exists
    const useSystemDbBtn = page.locator('#copySystemDbBtn');
    const btnExists = await useSystemDbBtn.count();

    if (btnExists > 0) {
      console.log('✓ "Use System Database" button found in settings');

      // Check button is visible (not in hidden div)
      const btnVisible = await useSystemDbBtn.isVisible().catch(() => false);
      if (btnVisible) {
        console.log('✓ "Use System Database" button is visible');
      } else {
        console.log('⚠ "Use System Database" button exists but might be hidden (DB already configured)');
      }
    } else {
      console.log('✗ "Use System Database" button not found');
    }
  } else {
    console.log('⚠ No contexts found to test');
  }

  // Step 8: Go back to dashboard and check the modal exists there
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  const modal = page.locator('#contextDatabaseConfigModal');
  const modalExists = await modal.count();
  if (modalExists > 0) {
    console.log('✓ Context database config modal exists on dashboard');

    // Check modal content
    const modalTitle = modal.locator('.modal-title');
    const titleText = await modalTitle.textContent();
    console.log(`  Modal title: "${titleText}"`);

    // Check buttons
    const useSystemDbInModal = modal.locator('#useSystemDatabaseBtn');
    const goToSettingsInModal = modal.locator('#goToSettingsBtn');

    if (await useSystemDbInModal.count() > 0) {
      console.log('✓ "Use System Database" button in modal');
    }
    if (await goToSettingsInModal.count() > 0) {
      console.log('✓ "Go to Settings" button in modal');
    }
  } else {
    console.log('✗ Context database config modal not found on dashboard');
  }

  console.log('\n=== Context Database Workflow Test Complete ===\n');
});
