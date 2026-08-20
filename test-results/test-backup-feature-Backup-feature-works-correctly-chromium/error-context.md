# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-backup-feature.spec.js >> Backup feature works correctly
- Location: tests/e2e/test-backup-feature.spec.js:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.context-row').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.context-row').first()

```

```yaml
- navigation:
  - link "MyWork - v2026.08.19.141":
    - /url: /
  - toolbar "Currently working on"
  - button "  Pygmie Studios"
  - link "Settings":
    - /url: /settings
    - text: 
- link " Back to Dashboard":
  - /url: /
- heading "Settings" [level=4]
- tablist:
  - tab " Entity Types"
  - tab "System Database"
  - tab "Contexts"
  - tab " Theme Editor"
  - tab " Miscellaneous"
- heading "Contexts" [level=4]
- paragraph: Define top-level contexts (e.g. Work, Life, Hobbies) and configure each one's database, data sources, backup, and which tabs it shows.
- heading "Contexts" [level=6]
- button "+ Folder"
- button "+ Context"
- paragraph: Click a context to configure it. Drag to reorder or drop into a folder.
- text: 
- button "Change icon": 
- text: Web Sites
- button "Rename": 
- button "Delete": 
- paragraph: Select a context on the left to configure it.
- contentinfo:
  - paragraph: © 2026 MyWork. Licensed under the MIT License.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Backup feature works correctly', async ({ page, context }) => {
  4  |   console.log('\n=== Testing Backup Feature ===\n');
  5  | 
  6  |   // Navigate to settings
  7  |   await page.goto('http://localhost:3000/settings?tab=contexts');
  8  |   await page.waitForTimeout(2000);
  9  | 
  10 |   // Select the first context
  11 |   const firstContext = page.locator('.context-row').first();
> 12 |   await expect(firstContext).toBeVisible({ timeout: 5000 });
     |                              ^ Error: expect(locator).toBeVisible() failed
  13 |   await firstContext.click();
  14 |   await page.waitForTimeout(1000);
  15 | 
  16 |   console.log('✓ Context selected');
  17 | 
  18 |   // Navigate to Database tab
  19 |   const databaseTab = page.locator('button[data-subtab="database"]');
  20 |   await expect(databaseTab).toBeVisible();
  21 |   await databaseTab.click();
  22 |   await page.waitForTimeout(1000);
  23 | 
  24 |   console.log('✓ Database tab opened');
  25 | 
  26 |   // Check if backup button exists
  27 |   const backupBtn = page.locator('#backupContextBtn');
  28 |   const btnExists = await backupBtn.count();
  29 | 
  30 |   if (btnExists > 0) {
  31 |     console.log('✓ Backup button found');
  32 | 
  33 |     // Set up download listener
  34 |     const downloadPromise = page.waitForEvent('download');
  35 | 
  36 |     // Click the backup button
  37 |     await backupBtn.click();
  38 |     await page.waitForTimeout(2000);
  39 | 
  40 |     // Check for download
  41 |     try {
  42 |       const download = await downloadPromise;
  43 |       const filename = download.suggestedFilename();
  44 | 
  45 |       console.log(`✓ Download started: ${filename}`);
  46 | 
  47 |       // Check filename format
  48 |       if (filename.includes('mywork-backup') && filename.includes('.zip')) {
  49 |         console.log('✓ Backup filename format correct');
  50 |       } else {
  51 |         console.log('✗ Backup filename format unexpected:', filename);
  52 |       }
  53 | 
  54 |       // Verify the file path exists
  55 |       const path = await download.path();
  56 |       console.log(`✓ Backup file created at: ${path}`);
  57 | 
  58 |     } catch (error) {
  59 |       console.log('⚠ Could not verify download (expected in headless):', error.message);
  60 |     }
  61 | 
  62 |     // Check for success notification
  63 |     const successNotification = page.locator('text=/Backup created/i');
  64 |     const notifExists = await successNotification.count({ timeout: 5000 }).catch(() => 0);
  65 |     if (notifExists > 0) {
  66 |       console.log('✓ Success notification appeared');
  67 |     }
  68 | 
  69 |   } else {
  70 |     console.log('✗ Backup button not found');
  71 |   }
  72 | 
  73 |   console.log('\n=== Backup Feature Test Complete ===\n');
  74 | });
  75 | 
```