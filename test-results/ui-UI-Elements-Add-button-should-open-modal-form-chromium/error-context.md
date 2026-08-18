# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui.spec.js >> UI Elements >> Add button should open modal form
- Location: tests/e2e/ui.spec.js:35:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("+ Add Priority")')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.07.28.0" [ref=e4] [cursor=pointer]:
        - /url: /
      - generic [ref=e5]:
        - button "  Default" [ref=e6] [cursor=pointer]:
          - generic [ref=e7]: 
          - generic [ref=e8]:
            - generic [ref=e9]: 
            - text: Default
        - text: 
      - link "Settings" [ref=e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e11]: 
  - generic [ref=e12]:
    - tablist [ref=e13]:
      - tab "⭐ Dailies" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: ⭐
        - text: Dailies
      - tab "📌 Projects" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 📌
        - text: Projects
      - tab "📂 Categories" [ref=e18] [cursor=pointer]:
        - generic [ref=e19]: 📂
        - text: Categories
      - tab "🎯 Goals" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 🎯
        - text: Goals
      - tab "☑ Todos" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: ☑
        - text: Todos
      - tab "📋 Tasks" [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: 📋
        - text: Tasks
      - tab "🎫 Tickets" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: 🎫
        - text: Tickets
      - tab "💡 Brainstorming" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: 💡
        - text: Brainstorming
      - tab "📑 Templates" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: 📑
        - text: Templates
      - tab "📊 Priorities" [ref=e32] [cursor=pointer]:
        - generic [ref=e33]: 📊
        - text: Priorities
      - tab "📈 Reporting" [ref=e34] [cursor=pointer]:
        - generic [ref=e35]: 📈
        - text: Reporting
    - generic: "                                                       Add notes here... Visit URL: EditRemove                                                                                                                                                                                                                           "
  - contentinfo [ref=e36]:
    - paragraph [ref=e38]: © 2026 MyWork. Licensed under the MIT License.
  - text:     
  - alert [ref=e40]:
    - text: "Error: A required database table is missing. Run the database setup script."
    - button "Close" [ref=e41] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('UI Elements', () => {
  4  |   test('should display version in navbar', async ({ page }) => {
  5  |     await page.goto('http://localhost:3000/');
  6  |     await page.waitForLoadState('networkidle');
  7  | 
  8  |     const navbar = page.locator('.navbar-brand');
  9  |     const text = await navbar.textContent();
  10 | 
  11 |     // Should contain "MyWork" and version like "v2026.07.28.0"
  12 |     expect(text).toContain('MyWork');
  13 |     expect(text).toMatch(/v\d{4}\.\d{2}\.\d{2}\.\d+/);
  14 |   });
  15 | 
  16 |   test('Dailies tab should display full month calendar', async ({ page }) => {
  17 |     await page.goto('http://localhost:3000/?tab=dailies');
  18 |     await page.waitForLoadState('networkidle');
  19 | 
  20 |     const calendar = page.locator('#calendar');
  21 |     await expect(calendar).toBeVisible();
  22 | 
  23 |     const calendarText = await calendar.textContent();
  24 | 
  25 |     // Should show month name
  26 |     expect(calendarText).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
  27 | 
  28 |     // Should show year
  29 |     expect(calendarText).toMatch(/\d{4}/);
  30 | 
  31 |     // Should show day numbers
  32 |     expect(calendarText).toMatch(/\d/);
  33 |   });
  34 | 
  35 |   test('Add button should open modal form', async ({ page }) => {
  36 |     await page.goto('http://localhost:3000/?tab=my-priorities');
  37 |     await page.waitForLoadState('networkidle');
  38 | 
  39 |     const addButton = page.locator('button:has-text("+ Add Priority")');
> 40 |     await addButton.click();
     |                     ^ Error: locator.click: Test timeout of 30000ms exceeded.
  41 | 
  42 |     const modal = page.locator('#priorityModal');
  43 |     await expect(modal).toBeVisible();
  44 | 
  45 |     const title = page.locator('#priorityTitle');
  46 |     await expect(title).toBeVisible();
  47 |   });
  48 | });
  49 | 
```