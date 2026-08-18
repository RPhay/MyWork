# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-entity-type-editor.spec.js >> Entity Type Editor Modal >> should open entity type editor when clicking new type button
- Location: tests/e2e/test-entity-type-editor.spec.js:4:3

# Error details

```
Error: page.goto: net::ERR_EMPTY_RESPONSE at http://localhost:3000/settings?tab=entity-types
Call log:
  - navigating to "http://localhost:3000/settings?tab=entity-types", waiting until "networkidle"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Entity Type Editor Modal', () => {
  4   |   test('should open entity type editor when clicking new type button', async ({ page }) => {
  5   |     // Wait for server to be ready
> 6   |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
      |                ^ Error: page.goto: net::ERR_EMPTY_RESPONSE at http://localhost:3000/settings?tab=entity-types
  7   |       waitUntil: 'networkidle'
  8   |     });
  9   | 
  10  |     // Click "New Type" button
  11  |     const newTypeBtn = page.locator('#createNewTypeBtn');
  12  |     await expect(newTypeBtn).toBeVisible();
  13  |     await newTypeBtn.click();
  14  | 
  15  |     // Check if modal opens
  16  |     const modal = page.locator('.draggable-modal');
  17  |     await expect(modal).toBeVisible();
  18  | 
  19  |     // Check modal title
  20  |     const title = page.locator('.modal-header-bar h3');
  21  |     await expect(title).toContainText('Create New Entity Type');
  22  | 
  23  |     // Check form fields exist
  24  |     await expect(page.locator('#typeName')).toBeVisible();
  25  |     await expect(page.locator('#typeSingular')).toBeVisible();
  26  |     await expect(page.locator('#typeIcon')).toBeVisible();
  27  |     await expect(page.locator('#typeHierarchy')).toBeVisible();
  28  |   });
  29  | 
  30  |   test('should close modal with escape key', async ({ page }) => {
  31  |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  32  |       waitUntil: 'networkidle'
  33  |     });
  34  | 
  35  |     // Click "New Type" button
  36  |     await page.locator('#createNewTypeBtn').click();
  37  | 
  38  |     // Check modal is visible
  39  |     const modal = page.locator('.draggable-modal');
  40  |     await expect(modal).toBeVisible();
  41  | 
  42  |     // Press Escape
  43  |     await page.keyboard.press('Escape');
  44  | 
  45  |     // Modal should be gone
  46  |     await expect(modal).not.toBeVisible();
  47  |   });
  48  | 
  49  |   test('should close modal with close button', async ({ page }) => {
  50  |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  51  |       waitUntil: 'networkidle'
  52  |     });
  53  | 
  54  |     // Click "New Type" button
  55  |     await page.locator('#createNewTypeBtn').click();
  56  | 
  57  |     // Check modal is visible
  58  |     const modal = page.locator('.draggable-modal');
  59  |     await expect(modal).toBeVisible();
  60  | 
  61  |     // Click close button
  62  |     await page.locator('.modal-close-btn').click();
  63  | 
  64  |     // Modal should be gone
  65  |     await expect(modal).not.toBeVisible();
  66  |   });
  67  | 
  68  |   test('should maximize modal on double-click title', async ({ page }) => {
  69  |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  70  |       waitUntil: 'networkidle'
  71  |     });
  72  | 
  73  |     // Click "New Type" button
  74  |     await page.locator('#createNewTypeBtn').click();
  75  | 
  76  |     // Check modal is visible
  77  |     const modal = page.locator('.draggable-modal');
  78  |     await expect(modal).toBeVisible();
  79  | 
  80  |     // Double-click title bar
  81  |     const header = page.locator('.modal-header-bar');
  82  |     await header.dblclick();
  83  | 
  84  |     // Modal should have maximized class
  85  |     await expect(modal).toHaveClass(/maximized/);
  86  | 
  87  |     // Double-click again to restore
  88  |     await header.dblclick();
  89  | 
  90  |     // Modal should not have maximized class
  91  |     const classes = await modal.getAttribute('class');
  92  |     expect(classes).not.toContain('maximized');
  93  |   });
  94  | 
  95  |   test('should display existing entity types in list', async ({ page }) => {
  96  |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  97  |       waitUntil: 'networkidle'
  98  |     });
  99  | 
  100 |     // Check if types list exists
  101 |     const typesList = page.locator('#typesList');
  102 |     await expect(typesList).toBeVisible();
  103 | 
  104 |     // Should have type items
  105 |     const typeItems = page.locator('.type-list-item');
  106 |     const count = await typeItems.count();
```