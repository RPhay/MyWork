# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-settings-edit-types.spec.js >> Settings - Edit System Types >> Can revert system type to defaults
- Location: tests/e2e/test-settings-edit-types.spec.js:46:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/settings?tab=entity-types
Call log:
  - navigating to "http://localhost:3000/settings?tab=entity-types", waiting until "networkidle"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Settings - Edit System Types', () => {
  4  |   test('Can edit system type icon and hierarchy', async ({ page }) => {
  5  |     // Navigate to settings entity types tab
  6  |     await page.goto('http://localhost:3000/settings?tab=entity-types', { waitUntil: 'networkidle' });
  7  |     await page.waitForTimeout(1000);
  8  | 
  9  |     // Find and click the first Edit button (should be for Dailies/work_item)
  10 |     const firstEditBtn = page.locator('.edit-system-type').first();
  11 |     await expect(firstEditBtn).toBeTruthy();
  12 |     await firstEditBtn.click();
  13 | 
  14 |     // Wait for modal to appear
  15 |     await page.waitForSelector('#editSystemTypeModal', { timeout: 5000 });
  16 | 
  17 |     // Get current icon value
  18 |     const iconInput = page.locator('#editTypeIcon');
  19 |     const currentIcon = await iconInput.inputValue();
  20 |     console.log(`Current icon: ${currentIcon}`);
  21 | 
  22 |     // Change icon to something different
  23 |     const newIcon = currentIcon === '✓' ? '⭐' : '✓';
  24 |     await iconInput.clear();
  25 |     await iconInput.fill(newIcon);
  26 | 
  27 |     // Save changes
  28 |     const saveBtn = page.locator('#saveEditSystemTypeBtn');
  29 |     await saveBtn.click();
  30 | 
  31 |     // Wait for reload and modal to close
  32 |     await page.waitForTimeout(2000);
  33 | 
  34 |     // Verify page reloaded and check the icon changed
  35 |     const systemTypesList = page.locator('#systemTypesList');
  36 |     const content = await systemTypesList.textContent();
  37 |     console.log('System types updated');
  38 | 
  39 |     // Verify the type still exists
  40 |     const typeItems = await page.locator('.type-item').count();
  41 |     console.log(`Found ${typeItems} type items after edit`);
  42 | 
  43 |     expect(typeItems).toBe(9);
  44 |   });
  45 | 
  46 |   test('Can revert system type to defaults', async ({ page }) => {
  47 |     // Navigate to settings entity types tab
> 48 |     await page.goto('http://localhost:3000/settings?tab=entity-types', { waitUntil: 'networkidle' });
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/settings?tab=entity-types
  49 |     await page.waitForTimeout(1000);
  50 | 
  51 |     // Find the first Revert button
  52 |     const firstRevertBtn = page.locator('.revert-system-type').first();
  53 |     await expect(firstRevertBtn).toBeTruthy();
  54 | 
  55 |     // Create a dialog handler for the confirmation
  56 |     page.once('dialog', async dialog => {
  57 |       console.log(`Dialog message: ${dialog.message()}`);
  58 |       await dialog.accept();
  59 |     });
  60 | 
  61 |     await firstRevertBtn.click();
  62 | 
  63 |     // Wait for revert to complete and page to reload
  64 |     await page.waitForTimeout(2000);
  65 | 
  66 |     // Verify page still has all 9 types
  67 |     const typeItems = await page.locator('.type-item').count();
  68 |     console.log(`Found ${typeItems} type items after revert`);
  69 | 
  70 |     expect(typeItems).toBe(9);
  71 |   });
  72 | });
  73 | 
```