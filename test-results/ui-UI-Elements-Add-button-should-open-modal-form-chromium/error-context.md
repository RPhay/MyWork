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
        - button "  Work" [ref=e6] [cursor=pointer]:
          - generic [ref=e7]: 
          - generic [ref=e8]:
            - generic [ref=e9]: 
            - text: Work
        - text: 
      - link "Settings" [ref=e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e11]: 
  - generic [ref=e12]:
    - tablist [ref=e13]:
      - tab " Dailies" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: 
        - text: Dailies
      - tab " Projects" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 
        - text: Projects
      - tab " Categories" [ref=e18] [cursor=pointer]:
        - generic [ref=e19]: 
        - text: Categories
      - tab " Priorities" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 
        - text: Priorities
      - tab " Brainstorming" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: 
        - text: Brainstorming
      - tab " Yearly Goals" [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: 
        - text: Yearly Goals
      - tab " Templates" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: 
        - text: Templates
      - tab " To Dos" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: 
        - text: To Dos
      - tab " Reporting" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: 
        - text: Reporting
    - generic [ref=e32]:
      - text:                                           
      - generic [ref=e34]:
        - generic [ref=e35]:
          - generic [ref=e36]:
            - heading "Projects" [level=6] [ref=e37]
            - button "+ Add Project" [ref=e38] [cursor=pointer]
          - paragraph [ref=e39]: Drop a project on another to make it a sub-project, between two projects to reorder it there, or onto empty space to make it top-level. Drag a category or goal from the right onto a project to associate it.
          - generic [ref=e40]:
            - generic [ref=e41]: Title
            - generic [ref=e42]: Categories
            - generic [ref=e43]: Goals
            - generic [ref=e44]: Actions
          - paragraph [ref=e46]: No projects yet
        - generic [ref=e47]:
          - list [ref=e48]:
            - listitem [ref=e49]:
              - button "Categories" [ref=e50] [cursor=pointer]
            - listitem [ref=e51]:
              - button "Goals" [ref=e52] [cursor=pointer]
          - generic [ref=e53]:
            - generic [ref=e54]:
              - generic [ref=e55]:
                - generic [ref=e56]: 
                - text: Systems Team
              - generic [ref=e57]: →
            - generic [ref=e58]:
              - generic [ref=e59]:
                - generic [ref=e60]: 
                - text: Meetings
              - generic [ref=e61]: →
            - generic [ref=e62]:
              - generic [ref=e63]:
                - generic [ref=e64]: 
                - text: General Support
              - generic [ref=e65]: →
            - generic [ref=e66]:
              - generic [ref=e67]:
                - generic [ref=e68]: 
                - text: Core IT
              - generic [ref=e69]: →
            - generic [ref=e70]:
              - generic [ref=e71]:
                - generic [ref=e72]: 
                - text: MSL
              - generic [ref=e73]: →
            - generic [ref=e74]:
              - generic [ref=e75]:
                - generic [ref=e76]: 
                - text: All Hands
              - generic [ref=e77]: →
            - generic [ref=e78]:
              - generic [ref=e79]:
                - generic [ref=e80]: 
                - text: AI Communities of Practice
              - generic [ref=e81]: →
          - text: 
      - text:                                                                                            
  - contentinfo [ref=e82]:
    - paragraph [ref=e84]: © 2026 MyWork. Licensed under the MIT License.
  - text:         
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