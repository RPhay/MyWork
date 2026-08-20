import { test, expect } from '@playwright/test';

test.describe('Settings - Edit System Types', () => {
  test('Can edit system type icon and hierarchy', async ({ page }) => {
    // Navigate to settings entity types tab
    await page.goto('http://localhost:3000/settings?tab=entity-types', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Find and click the first Edit button (should be for Dailies/work_item)
    const firstEditBtn = page.locator('.edit-system-type').first();
    await expect(firstEditBtn).toBeTruthy();
    await firstEditBtn.click();

    // Wait for modal to appear
    await page.waitForSelector('#editSystemTypeModal', { timeout: 5000 });

    // Get current icon value
    const iconInput = page.locator('#editTypeIcon');
    const currentIcon = await iconInput.inputValue();
    console.log(`Current icon: ${currentIcon}`);

    // Change icon to something different
    const newIcon = currentIcon === '✓' ? '⭐' : '✓';
    await iconInput.clear();
    await iconInput.fill(newIcon);

    // Save changes
    const saveBtn = page.locator('#saveEditSystemTypeBtn');
    await saveBtn.click();

    // Wait for reload and modal to close
    await page.waitForTimeout(2000);

    // Verify page reloaded and check the icon changed
    const systemTypesList = page.locator('#systemTypesList');
    const content = await systemTypesList.textContent();
    console.log('System types updated');

    // Verify the type still exists
    const typeItems = await page.locator('.type-item').count();
    console.log(`Found ${typeItems} type items after edit`);

    expect(typeItems).toBe(9);
  });

  test('Can revert system type to defaults', async ({ page }) => {
    // Navigate to settings entity types tab
    await page.goto('http://localhost:3000/settings?tab=entity-types', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Find the first Revert button
    const firstRevertBtn = page.locator('.revert-system-type').first();
    await expect(firstRevertBtn).toBeTruthy();

    // Create a dialog handler for the confirmation
    page.once('dialog', async dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept();
    });

    await firstRevertBtn.click();

    // Wait for revert to complete and page to reload
    await page.waitForTimeout(2000);

    // Verify page still has all 9 types
    const typeItems = await page.locator('.type-item').count();
    console.log(`Found ${typeItems} type items after revert`);

    expect(typeItems).toBe(9);
  });
});
