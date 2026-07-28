# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dailies.spec.js >> Dailies Tab >> should fill and submit work form
- Location: tests/e2e/dailies.spec.js:28:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#workModal')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('#workModal')
    14 × locator resolved to <div tabindex="-1" id="workModal" class="modal fade">…</div>
       - unexpected value "hidden"

```

```yaml
- navigation:
  - link "MyWork":
    - /url: /
  - list:
    - listitem:
      - link "Dailies":
        - /url: /?tab=dailies
    - listitem:
      - link "My Priorities":
        - /url: /?tab=my-priorities
    - listitem:
      - link "Yearly Goals":
        - /url: /?tab=yearly-goals
    - listitem:
      - link "Settings":
        - /url: /?tab=settings
- tablist:
  - tab "Dailies"
  - tab "My Priorities"
  - tab "Yearly Goals"
  - tab "Settings"
- group:
  - radio "Day View" [checked]
  - text: Day View
  - radio "Week View"
  - text: Week View
- heading "Select Date" [level=6]
- button "← Previous Day"
- button "Today"
- button "Next Day →"
- heading "Work Items for" [level=6]
- button "+ Add"
- table:
  - rowgroup:
    - row "Title Status Actions":
      - columnheader "Title"
      - columnheader "Status"
      - columnheader "Actions"
  - rowgroup:
    - row "Loading...":
      - cell "Loading..."
- heading "My Priorities" [level=6]
- text: Loading...
- heading "My Goals" [level=6]
- text: Loading...
- contentinfo:
  - paragraph: © 2026 MyWork. All rights reserved.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Dailies Tab', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('http://localhost:3000/?tab=dailies');
  6   |     await page.waitForLoadState('networkidle');
  7   |   });
  8   | 
  9   |   test('should display calendar on load', async ({ page }) => {
  10  |     const calendar = await page.locator('#calendar').textContent();
  11  |     expect(calendar).toContain('Jan') || expect(calendar).toContain('Feb') || expect(calendar).toContain('Mar');
  12  |   });
  13  | 
  14  |   test('should not show loading message when no data', async ({ page }) => {
  15  |     await page.waitForTimeout(2000); // Wait for load
  16  |     const loadingText = await page.locator('#workItemsTableBody').textContent();
  17  |     expect(loadingText).not.toContain('Loading');
  18  |   });
  19  | 
  20  |   test('Add Work button should open modal', async ({ page }) => {
  21  |     const addButton = page.locator('button:has-text("+ Add")').first();
  22  |     await addButton.click();
  23  | 
  24  |     const modal = page.locator('#workModal');
  25  |     await expect(modal).toBeVisible();
  26  |   });
  27  | 
  28  |   test('should fill and submit work form', async ({ page }) => {
  29  |     const addButton = page.locator('button:has-text("+ Add")').first();
  30  |     await addButton.click();
  31  | 
  32  |     const modal = page.locator('#workModal');
> 33  |     await expect(modal).toBeVisible();
      |                         ^ Error: expect(locator).toBeVisible() failed
  34  | 
  35  |     const titleInput = page.locator('#workTitle');
  36  |     await titleInput.fill('Test Work Item');
  37  | 
  38  |     const saveButton = page.locator('#workModal button:has-text("Save Work")');
  39  |     await saveButton.click();
  40  | 
  41  |     // Wait for modal to close
  42  |     await expect(modal).toBeHidden();
  43  | 
  44  |     // Check notification
  45  |     const notification = page.locator('.alert-success');
  46  |     await expect(notification).toBeVisible();
  47  |   });
  48  | 
  49  |   test('should show work item in table after creation', async ({ page }) => {
  50  |     // Add a work item
  51  |     const addButton = page.locator('button:has-text("+ Add")').first();
  52  |     await addButton.click();
  53  | 
  54  |     const titleInput = page.locator('#workTitle');
  55  |     await titleInput.fill('My Test Task');
  56  | 
  57  |     const saveButton = page.locator('#workModal button:has-text("Save Work")');
  58  |     await saveButton.click();
  59  | 
  60  |     // Wait and check table
  61  |     await page.waitForTimeout(1000);
  62  |     const tableContent = await page.locator('#workItemsTableBody').textContent();
  63  |     expect(tableContent).toContain('My Test Task');
  64  |   });
  65  | });
  66  | 
  67  | test.describe('Priorities Tab', () => {
  68  |   test.beforeEach(async ({ page }) => {
  69  |     await page.goto('http://localhost:3000/?tab=my-priorities');
  70  |     await page.waitForLoadState('networkidle');
  71  |   });
  72  | 
  73  |   test('should not show loading message when no data', async ({ page }) => {
  74  |     await page.waitForTimeout(2000);
  75  |     const loadingText = await page.locator('#prioritiesTableBody').textContent();
  76  |     expect(loadingText).not.toContain('Loading');
  77  |   });
  78  | 
  79  |   test('Add Priority button should open modal', async ({ page }) => {
  80  |     const addButton = page.locator('button:has-text("+ Add Priority")');
  81  |     await addButton.click();
  82  | 
  83  |     const modal = page.locator('#priorityModal');
  84  |     await expect(modal).toBeVisible();
  85  |   });
  86  | 
  87  |   test('should fill and submit priority form', async ({ page }) => {
  88  |     const addButton = page.locator('button:has-text("+ Add Priority")');
  89  |     await addButton.click();
  90  | 
  91  |     const modal = page.locator('#priorityModal');
  92  |     await expect(modal).toBeVisible();
  93  | 
  94  |     const titleInput = page.locator('#priorityTitle');
  95  |     await titleInput.fill('High Priority Task');
  96  | 
  97  |     const saveButton = page.locator('#priorityModal button:has-text("Save Priority")');
  98  |     await saveButton.click();
  99  | 
  100 |     await expect(modal).toBeHidden();
  101 | 
  102 |     const notification = page.locator('.alert-success');
  103 |     await expect(notification).toBeVisible();
  104 |   });
  105 | });
  106 | 
  107 | test.describe('Yearly Goals Tab', () => {
  108 |   test.beforeEach(async ({ page }) => {
  109 |     await page.goto('http://localhost:3000/?tab=yearly-goals');
  110 |     await page.waitForLoadState('networkidle');
  111 |   });
  112 | 
  113 |   test('should not show loading message when no data', async ({ page }) => {
  114 |     await page.waitForTimeout(2000);
  115 |     const loadingText = await page.locator('#goalsTableBody').textContent();
  116 |     expect(loadingText).not.toContain('Loading');
  117 |   });
  118 | 
  119 |   test('Add Goal button should open modal', async ({ page }) => {
  120 |     const addButton = page.locator('button:has-text("+ Add Goal")');
  121 |     await addButton.click();
  122 | 
  123 |     const modal = page.locator('#goalModal');
  124 |     await expect(modal).toBeVisible();
  125 |   });
  126 | 
  127 |   test('should fill and submit goal form', async ({ page }) => {
  128 |     const addButton = page.locator('button:has-text("+ Add Goal")');
  129 |     await addButton.click();
  130 | 
  131 |     const modal = page.locator('#goalModal');
  132 |     await expect(modal).toBeVisible();
  133 | 
```