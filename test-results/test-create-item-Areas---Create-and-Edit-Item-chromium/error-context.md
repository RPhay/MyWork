# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-create-item.spec.js >> Areas - Create and Edit Item
- Location: tests/e2e/test-create-item.spec.js:3:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 14
Received:   14
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - navigation [ref=f1e2]:
    - generic [ref=f1e3]:
      - link "MyWork - v2026.07.28.0" [ref=f1e4] [cursor=pointer]:
        - /url: /
      - generic [ref=f1e5]:
        - button "  Default" [ref=f1e6] [cursor=pointer]:
          - generic [ref=f1e7]: 
          - generic [ref=f1e8]:
            - generic [ref=f1e9]: 
            - text: Default
        - text: 
      - link "Settings" [ref=f1e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=f1e11]: 
  - generic [ref=f1e12]:
    - tablist [ref=f1e13]:
      - tab "⭐ Dailies" [ref=f1e14] [cursor=pointer]:
        - generic [ref=f1e15]: ⭐
        - text: Dailies
      - tab "📍 Projects" [ref=f1e16] [cursor=pointer]:
        - generic [ref=f1e17]: 📍
        - text: Projects
      - listitem [ref=f1e18]
      - tab "📁 Categories" [ref=f1e19] [cursor=pointer]:
        - generic [ref=f1e20]: 📁
        - text: Categories
      - tab "🎯 Goals" [ref=f1e21] [cursor=pointer]:
        - generic [ref=f1e22]: 🎯
        - text: Goals
      - tab "✅ Todos" [ref=f1e23] [cursor=pointer]:
        - generic [ref=f1e24]: ✅
        - text: Todos
      - tab "📂 Tasks" [ref=f1e25] [cursor=pointer]:
        - generic [ref=f1e26]: 📂
        - text: Tasks
      - tab "🎟️ Tickets" [ref=f1e27] [cursor=pointer]:
        - generic [ref=f1e28]: 🎟️
        - text: Tickets
      - tab "💡 Ideas" [ref=f1e29] [cursor=pointer]:
        - generic [ref=f1e30]: 💡
        - text: Ideas
      - tab "📋 Templates" [ref=f1e31] [cursor=pointer]:
        - generic [ref=f1e32]: 📋
        - text: Templates
      - listitem [ref=f1e33]
      - tab "📊 Priority Board" [ref=f1e34] [cursor=pointer]:
        - generic [ref=f1e35]: 📊
        - text: Priority Board
      - tab "📈 Reporting" [ref=f1e36] [cursor=pointer]:
        - generic [ref=f1e37]: 📈
        - text: Reporting
    - generic [ref=f1e38]:
      - text:                                                 
      - generic [ref=f1e42]:
        - generic [ref=f1e43]:
          - group [ref=f1e45]:
            - button " Expand All" [ref=f1e46] [cursor=pointer]:
              - generic [ref=f1e47]: 
              - text: Expand All
            - button " Collapse All" [ref=f1e48] [cursor=pointer]:
              - generic [ref=f1e49]: 
              - text: Collapse All
          - generic [ref=f1e50]:
            - button " + Folder" [ref=f1e51] [cursor=pointer]:
              - generic [ref=f1e52]: 
              - text: + Folder
            - button "+ New Categories" [ref=f1e53] [cursor=pointer]
        - paragraph [ref=f1e54]: Drag to organize. Click to edit, click again to close.
        - generic [ref=f1e56]:
          - generic [ref=f1e59] [cursor=pointer]:
            - generic [ref=f1e60]: Test Folder
            - generic [ref=f1e61]:
              - button "Edit" [ref=f1e62]
              - button "Delete" [ref=f1e63]
          - generic [ref=f1e66] [cursor=pointer]:
            - generic [ref=f1e67]: Test Folder
            - generic [ref=f1e68]:
              - button "Edit" [ref=f1e69]
              - button "Delete" [ref=f1e70]
          - generic [ref=f1e73] [cursor=pointer]:
            - generic [ref=f1e74]: Test Folder
            - generic [ref=f1e75]:
              - button "Edit" [ref=f1e76]
              - button "Delete" [ref=f1e77]
          - generic [ref=f1e80] [cursor=pointer]:
            - generic [ref=f1e81]: Test Folder
            - generic [ref=f1e82]:
              - button "Edit" [ref=f1e83]
              - button "Delete" [ref=f1e84]
          - generic [ref=f1e87] [cursor=pointer]:
            - generic [ref=f1e88]: New Area Test
            - generic [ref=f1e89]:
              - button "Edit" [ref=f1e90]
              - button "Delete" [ref=f1e91]
          - generic [ref=f1e94] [cursor=pointer]:
            - generic [ref=f1e95]: Test Area
            - generic [ref=f1e96]:
              - button "Edit" [ref=f1e97]
              - button "Delete" [ref=f1e98]
          - generic [ref=f1e101] [cursor=pointer]:
            - generic [ref=f1e102]: New Area Test
            - generic [ref=f1e103]:
              - button "Edit" [ref=f1e104]
              - button "Delete" [ref=f1e105]
      - text:                  
  - contentinfo [ref=f1e106]:
    - paragraph [ref=f1e108]: © 2026 MyWork. Licensed under the MIT License.
  - text:   
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
> 37 |   expect(finalCount).toBeGreaterThan(initialCount);
     |                      ^ Error: expect(received).toBeGreaterThan(expected)
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
  71 |   await expect(newItem).toContainText('New Goal Test');
  72 | });
  73 | 
```