# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-entity-type-sections.spec.js >> Entity Types - Section Display >> should show type items in editable section
- Location: tests/e2e/test-entity-type-sections.spec.js:29:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.07.28.0" [ref=e4] [cursor=pointer]:
        - /url: /
      - button " No contexts" [ref=e6] [cursor=pointer]:
        - generic [ref=e7]: 
        - text: No contexts
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
        - heading "Entity Types" [level=2] [ref=e25]
        - paragraph [ref=e26]: Manage editable types and templates that organize your work.
        - generic [ref=e27]:
          - generic [ref=e28]:
            - generic [ref=e29]:
              - heading "Editable Types" [level=4] [ref=e30]
              - text: Types you can create and manage in your dailies
            - button " New Type" [ref=e31] [cursor=pointer]:
              - generic [ref=e32]: 
              - text: New Type
          - generic [ref=e36]:
            - status [ref=e37]:
              - generic [ref=e38]: Loading...
            - paragraph [ref=e39]: Loading types...
        - generic [ref=e40]:
          - generic [ref=e42]:
            - heading "Read-Only Types" [level=4] [ref=e43]
            - text: Templates and special types (Dailies, External integrations)
          - generic [ref=e47]:
            - status [ref=e48]:
              - generic [ref=e49]: Loading...
            - paragraph [ref=e50]: Loading types...
      - text:                                                       
  - contentinfo [ref=e51]:
    - paragraph [ref=e53]: © 2026 MyWork. Licensed under the MIT License.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Entity Types - Section Display', () => {
  4   |   test('should display editable and read-only sections', async ({ page }) => {
  5   |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  6   |       waitUntil: 'networkidle'
  7   |     });
  8   | 
  9   |     // Check for Editable Types section
  10  |     const editableHeading = page.locator('h4', { hasText: /Editable Types/ });
  11  |     await expect(editableHeading).toBeVisible();
  12  | 
  13  |     // Check for Read-Only Types section
  14  |     const readonlyHeading = page.locator('h4', { hasText: /Read-Only Types/ });
  15  |     await expect(readonlyHeading).toBeVisible();
  16  | 
  17  |     // Check for New Type button
  18  |     const createBtn = page.locator('#createNewTypeBtn');
  19  |     await expect(createBtn).toBeVisible();
  20  | 
  21  |     // Check for type lists
  22  |     const editableList = page.locator('#editableTypesList');
  23  |     const readonlyList = page.locator('#readonlyTypesList');
  24  | 
  25  |     await expect(editableList).toBeVisible();
  26  |     await expect(readonlyList).toBeVisible();
  27  |   });
  28  | 
  29  |   test('should show type items in editable section', async ({ page }) => {
  30  |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  31  |       waitUntil: 'networkidle'
  32  |     });
  33  | 
  34  |     // Wait for types to load
  35  |     await page.waitForTimeout(500);
  36  | 
  37  |     // Check if editable types are displayed
  38  |     const editableList = page.locator('#editableTypesList');
  39  |     const typeItems = editableList.locator('.type-list-item');
  40  | 
  41  |     const count = await typeItems.count();
> 42  |     expect(count).toBeGreaterThan(0);
      |                   ^ Error: expect(received).toBeGreaterThan(expected)
  43  | 
  44  |     // Each item should have icon and label
  45  |     for (let i = 0; i < Math.min(count, 3); i++) {
  46  |       const item = typeItems.nth(i);
  47  |       const icon = item.locator('.type-icon');
  48  |       const info = item.locator('.type-info');
  49  | 
  50  |       await expect(icon).toBeVisible();
  51  |       await expect(info).toBeVisible();
  52  |     }
  53  |   });
  54  | 
  55  |   test('should show category badges for non-editable types', async ({ page }) => {
  56  |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  57  |       waitUntil: 'networkidle'
  58  |     });
  59  | 
  60  |     // Wait for types to load
  61  |     await page.waitForTimeout(500);
  62  | 
  63  |     // Check read-only list for category badges
  64  |     const readonlyList = page.locator('#readonlyTypesList');
  65  |     const badges = readonlyList.locator('.type-badge');
  66  | 
  67  |     if (await badges.count() > 0) {
  68  |       // If there are any readonly types, they should have badges
  69  |       const firstBadge = badges.first();
  70  |       const badgeText = await firstBadge.textContent();
  71  |       expect(['template', 'daily', 'external']).toContain(badgeText);
  72  |     }
  73  |   });
  74  | 
  75  |   test('editable types should be clickable to edit', async ({ page }) => {
  76  |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  77  |       waitUntil: 'networkidle'
  78  |     });
  79  | 
  80  |     // Wait for types to load
  81  |     await page.waitForTimeout(500);
  82  | 
  83  |     // Click first editable type
  84  |     const editableList = page.locator('#editableTypesList');
  85  |     const firstType = editableList.locator('.type-list-item').first();
  86  | 
  87  |     if (await firstType.isVisible()) {
  88  |       await firstType.click();
  89  | 
  90  |       // Modal should open
  91  |       const modal = page.locator('.draggable-modal');
  92  |       await expect(modal).toBeVisible();
  93  |     }
  94  |   });
  95  | 
  96  |   test('should have separate lists for editable and readonly types', async ({ page }) => {
  97  |     await page.goto('http://localhost:3000/settings?tab=entity-types', {
  98  |       waitUntil: 'networkidle'
  99  |     });
  100 | 
  101 |     // Verify the two sections exist and are distinct
  102 |     const editableSection = page.locator('text=Editable Types');
  103 |     const readonlySection = page.locator('text=Read-Only Types');
  104 | 
  105 |     await expect(editableSection).toBeVisible();
  106 |     await expect(readonlySection).toBeVisible();
  107 | 
  108 |     // They should be in different containers
  109 |     const editableContainer = editableSection.locator('xpath=//..//..').locator('id=editableTypesList').first();
  110 |     const readonlyContainer = readonlySection.locator('xpath=//..//..').locator('id=readonlyTypesList').first();
  111 | 
  112 |     await expect(editableContainer).toBeVisible();
  113 |     await expect(readonlyContainer).toBeVisible();
  114 |   });
  115 | });
  116 | 
```