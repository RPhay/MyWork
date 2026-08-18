# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-create-item.spec.js >> Goals - Create Item
- Location: tests/e2e/test-create-item.spec.js:44:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.entity-row').first()
Timeout: 5000ms
- Expected substring  -  1
+ Received string     + 12

- New Goal Test
+
+         
+           
+           
+           Test Folder
+           
+           
+             Edit
+             Delete
+           
+         
+       

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.entity-row').first()
    12 × locator resolved to <div data-depth="0" data-entity-id="3" data-entity-type="area" class="entity-row expanded">…</div>
       - unexpected value "
        
          
          
          Test Folder
          
          
            Edit
            Delete
          
        
      "

```

```yaml
- navigation:
  - link "MyWork - v2026.07.28.0":
    - /url: /
  - button "  Default"
  - link "Settings":
    - /url: /settings
    - text: 
- tablist:
  - tab "⭐ Dailies"
  - tab "📍 Projects"
  - listitem
  - tab "📁 Categories"
  - tab "🎯 Goals"
  - tab "✅ Todos"
  - tab "📂 Tasks"
  - tab "🎟️ Tickets"
  - tab "💡 Ideas"
  - tab "📋 Templates"
  - listitem
  - tab "📊 Priority Board"
  - tab "📈 Reporting"
- group:
  - button " Expand All"
  - button " Collapse All"
- button " + Folder"
- button "+ New Goals"
- paragraph: Drag to organize. Click to edit, click again to close.
- text: New Goal Test
- button "Edit"
- button "Delete"
- text: New Goal Test
- button "Edit"
- button "Delete"
- contentinfo:
  - paragraph: © 2026 MyWork. Licensed under the MIT License.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Areas - Create and Edit Item', async ({ page }) => {
  4  |   await page.goto('http://localhost:3000/');
  5  | 
  6  |   // Click Areas tab
  7  |   await page.click('[data-tab="area"]');
  8  |   await page.waitForLoadState('networkidle');
  9  | 
  10 |   // Get initial item count
  11 |   const initialCount = await page.locator('.entity-row').count();
  12 | 
  13 |   // Click add button
  14 |   const addBtn = page.locator('#addareaBtn');
  15 |   await addBtn.click();
  16 | 
  17 |   // Wait for form to appear
  18 |   const form = page.locator('#entity-editor-form');
  19 |   await expect(form).toBeVisible({ timeout: 5000 });
  20 | 
  21 |   // Fill title
  22 |   const titleInput = form.locator('input[name="title"]');
  23 |   await expect(titleInput).toBeVisible();
  24 |   await titleInput.fill('New Area Test');
  25 | 
  26 |   // The save button should enable once input changes
  27 |   const saveBtn = page.locator('#areaSaveBtn');
  28 |   // Wait for button to be enabled (may take a moment for change tracking)
  29 |   await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  30 |   await saveBtn.click();
  31 | 
  32 |   // Wait for reload and new item to appear
  33 |   await page.waitForLoadState('networkidle');
  34 | 
  35 |   // Verify new item was created
  36 |   const finalCount = await page.locator('.entity-row').count();
  37 |   expect(finalCount).toBeGreaterThan(initialCount);
  38 | 
  39 |   // Verify item title appears
  40 |   const newItem = page.locator('.entity-row').first();
  41 |   await expect(newItem).toContainText('New Area Test');
  42 | });
  43 | 
  44 | test('Goals - Create Item', async ({ page }) => {
  45 |   await page.goto('http://localhost:3000/');
  46 | 
  47 |   // Click Goals tab
  48 |   await page.click('[data-tab="goal"]');
  49 |   await page.waitForLoadState('networkidle');
  50 | 
  51 |   // Click add button
  52 |   const addBtn = page.locator('#addgoalBtn');
  53 |   await addBtn.click();
  54 | 
  55 |   // Wait for form
  56 |   const form = page.locator('#entity-editor-form');
  57 |   await expect(form).toBeVisible({ timeout: 5000 });
  58 | 
  59 |   // Fill title
  60 |   const titleInput = form.locator('input[name="title"]');
  61 |   await titleInput.fill('New Goal Test');
  62 | 
  63 |   // Save - wait for button to be enabled
  64 |   const saveBtn = page.locator('#goalSaveBtn');
  65 |   await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  66 |   await saveBtn.click();
  67 | 
  68 |   // Verify
  69 |   await page.waitForLoadState('networkidle');
  70 |   const newItem = page.locator('.entity-row').first();
> 71 |   await expect(newItem).toContainText('New Goal Test');
     |                         ^ Error: expect(locator).toContainText(expected) failed
  72 | });
  73 | 
```