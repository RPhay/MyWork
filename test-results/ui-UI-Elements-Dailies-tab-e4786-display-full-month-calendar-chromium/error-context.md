# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui.spec.js >> UI Elements >> Dailies tab should display full month calendar
- Location: tests/e2e/ui.spec.js:16:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#calendar')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('#calendar')
    14 × locator resolved to <div id="calendar">…</div>
       - unexpected value "hidden"

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
  - tab "📌 Projects"
  - tab "📂 Categories"
  - tab "🎯 Goals"
  - tab "☑ Todos"
  - tab "📋 Tasks"
  - tab "🎫 Tickets"
  - tab "💡 Brainstorming"
  - tab "📑 Templates"
  - tab "📊 Priorities"
  - tab "📈 Reporting"
- contentinfo:
  - paragraph: © 2026 MyWork. Licensed under the MIT License.
- alert:
  - text: "Error: A required database table is missing. Run the database setup script."
  - button "Close"
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
> 21 |     await expect(calendar).toBeVisible();
     |                            ^ Error: expect(locator).toBeVisible() failed
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
  40 |     await addButton.click();
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