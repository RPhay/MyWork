# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-settings-edit-types.spec.js >> Settings - Edit System Types >> Can edit system type icon and hierarchy
- Location: tests/e2e/test-settings-edit-types.spec.js:4:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.edit-system-type').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork" [ref=e4] [cursor=pointer]:
        - /url: /
      - button " Context" [ref=e6] [cursor=pointer]:
        - generic [ref=e7]: 
        - text: Context
      - link "Settings" [ref=e8] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e9]: 
  - generic [ref=e10]:
    - generic [ref=e11]:
      - link " Back to Dashboard" [ref=e12] [cursor=pointer]:
        - /url: /
        - generic [ref=e13]: 
        - text: Back to Dashboard
      - heading "Settings" [level=4] [ref=e14]
    - tablist [ref=e15]:
      - tab " Entity Types" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 
        - text: Entity Types
      - tab "System Database" [ref=e18] [cursor=pointer]
      - tab "Contexts" [ref=e19] [cursor=pointer]
      - tab " Theme Editor" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 
        - text: Theme Editor
    - generic [ref=e22]:
      - generic [ref=e24]:
        - generic [ref=e25]:
          - generic [ref=e26]:
            - heading "Entity Types" [level=2] [ref=e27]
            - paragraph [ref=e28]: Create and manage entity types to organize your work.
          - button " New Type" [ref=e29] [cursor=pointer]:
            - generic [ref=e30]: 
            - text: New Type
        - generic [ref=e31]:
          - heading "All Types" [level=5] [ref=e33]
          - generic [ref=e36]:
            - status [ref=e37]:
              - generic [ref=e38]: Loading...
            - paragraph [ref=e39]: Loading types...
      - generic [ref=e40]:
        - generic [ref=e42]:
          - heading "Contexts" [level=4] [ref=e43]
          - paragraph [ref=e44]: Define top-level contexts (e.g. Work, Life, Hobbies) and configure each one's database, data sources, backup, and which tabs it shows.
        - generic [ref=e45]:
          - generic [ref=e46]:
            - generic [ref=e47]:
              - heading "Contexts" [level=6] [ref=e48]
              - generic [ref=e49]:
                - button "+ Folder" [ref=e50] [cursor=pointer]
                - button "+ Context" [ref=e51] [cursor=pointer]
            - paragraph [ref=e52]: Click a context to configure it. Drag to reorder or drop into a folder.
          - generic [ref=e53]:
            - paragraph [ref=e55]: Select a context on the left to configure it.
            - text:                   
        - text:                        
      - generic [ref=e56]:
        - generic [ref=e58]:
          - heading "Theme Editor" [level=4] [ref=e59]
          - paragraph [ref=e60]: Customize the appearance of your MyWork application.
        - generic [ref=e61]:
          - generic [ref=e63]:
            - heading " Theme Mode" [level=6] [ref=e65]:
              - generic [ref=e66]: 
              - text: Theme Mode
            - generic [ref=e67]:
              - group [ref=e68]:
                - radio " Light"
                - generic [ref=e69] [cursor=pointer]:
                  - generic [ref=e70]: 
                  - text: Light
                - radio " Dark"
                - generic [ref=e71] [cursor=pointer]:
                  - generic [ref=e72]: 
                  - text: Dark
                - radio " System" [checked]
                - generic [ref=e73] [cursor=pointer]:
                  - generic [ref=e74]: 
                  - text: System
              - generic [ref=e75]: "System: Follow your device's dark/light preference"
          - generic [ref=e77]:
            - heading " Accent Color" [level=6] [ref=e79]:
              - generic [ref=e80]: 
              - text: Accent Color
            - generic [ref=e81]:
              - generic [ref=e82]:
                - generic [ref=e83]:
                  - radio "Blue" [checked] [ref=e84]
                  - generic [ref=e85]: Blue
                - generic [ref=e87]:
                  - radio "Purple" [ref=e88]
                  - generic [ref=e89]: Purple
                - generic [ref=e91]:
                  - radio "Green" [ref=e92]
                  - generic [ref=e93]: Green
                - generic [ref=e95]:
                  - radio "Red" [ref=e96]
                  - generic [ref=e97]: Red
              - generic [ref=e99]: Choose the primary accent color for UI elements
        - generic [ref=e100]:
          - generic [ref=e102]:
            - heading " Font Size" [level=6] [ref=e104]:
              - generic [ref=e105]: 
              - text: Font Size
            - generic [ref=e106]:
              - generic [ref=e107]:
                - generic [ref=e108]: Smaller
                - slider [ref=e109]: "100"
                - generic [ref=e110]: Larger
                - generic [ref=e111]: 100%
              - generic [ref=e112]: Adjust the base font size for the entire application
          - generic [ref=e114]:
            - heading "Layout" [level=6] [ref=e116]
            - generic [ref=e117]:
              - generic [ref=e118]:
                - checkbox "Enable compact mode" [ref=e119]
                - generic [ref=e120]: Enable compact mode
              - generic [ref=e121]: Reduce spacing and padding for a more compact interface
        - generic [ref=e123]:
          - button " Save Theme Preferences" [ref=e124] [cursor=pointer]:
            - generic [ref=e125]: 
            - text: Save Theme Preferences
          - button " Reset to Defaults" [ref=e126] [cursor=pointer]:
            - generic [ref=e127]: 
            - text: Reset to Defaults
  - contentinfo [ref=e128]:
    - paragraph [ref=e130]: © 2026 MyWork. Licensed under the MIT License.
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
> 12 |     await firstEditBtn.click();
     |                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  48 |     await page.goto('http://localhost:3000/settings?tab=entity-types', { waitUntil: 'networkidle' });
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