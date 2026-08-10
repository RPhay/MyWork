# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: todos-test.spec.js >> Todos Tab >> should edit a todo by clicking on it
- Location: tests/e2e/todos-test.spec.js:33:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#toDoModal')
Expected: visible
Received: hidden
Timeout:  3000ms

Call log:
  - Expect "toBeVisible" with timeout 3000ms
  - waiting for locator('#toDoModal')
    10 × locator resolved to <div tabindex="-1" id="toDoModal" class="modal fade" aria-hidden="true">…</div>
       - unexpected value "hidden"

```

```yaml
- navigation:
  - link "MyWork - v2026.07.28.0":
    - /url: /
  - button "  Work"
  - link "Settings":
    - /url: /settings
    - text: 
- tablist:
  - tab " Dailies"
  - tab " Projects"
  - tab " Categories"
  - tab " Priorities"
  - tab " Brainstorming"
  - tab " Yearly Goals"
  - tab " Templates"
  - tab " Tasks"
  - tab " To Dos"
  - tab " Tickets"
  - tab " Reporting"
- button "+ Add To Do"
- paragraph: Drag a to do under another to nest it. Drag to the empty space above to unfile it.
- text: Title Notes Actions
- button "Incomplete — click to change"
- text: Todo to Edit -
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Todo 1 Test notes
- button "Delete": 
- button "Incomplete — click to change"
- text: Child Todo -
- button "Delete": 
- button "Incomplete — click to change"
- text: Todo to Edit -
- button "Delete": 
- button "Incomplete — click to change"
- text: Parent Todo -
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Todo 1 Test notes
- button "Delete": 
- button "Incomplete — click to change"
- text: Parent Todo -
- button "Delete": 
- button "Incomplete — click to change"
- text: Todo to Edit -
- button "Delete": 
- button "Incomplete — click to change"
- text: Parent Todo -
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Todo 1 Test notes
- button "Delete": 
- button "Incomplete — click to change"
- text: Todo to Edit -
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Todo 1 Test notes
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Todo 1 Test notes
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Todo 1 Test notes
- button "Delete": 
- button "Incomplete — click to change"
- text: Parent Todo -
- button "Delete": 
- button "Incomplete — click to change"
- text: Todo to Edit -
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Todo 1 Test notes
- button "Delete": 
- button "Incomplete — click to change"
- text: Todo to Edit -
- button "Delete": 
- button "Incomplete — click to change"
- text: Parent Todo -
- button "Delete": 
- button "Incomplete — click to change"
- text: Todo to Edit -
- button "Delete": 
- button "Incomplete — click to change"
- text: Parent Todo -
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Todo 1 Test notes
- button "Delete": 
- button "Incomplete — click to change"
- text: Test Item -
- button "Delete": 
- button "Incomplete — click to change"
- text: "Add SSO toggle for contexts Add ability to enable/configure SSO for a context so if SSO is enabled, users must log in via SSO with a given user. Requirements: Support OAuth2 initially, context-level enforcement, auto user mapping, redirect to SSO login if not authenticated."
- button "Delete": 
- button "Incomplete — click to change"
- text: To do folder context menu Right clicking on a folder in the to dos should open up a context menu that allows me to create a todo under that folder.
- button "Delete": 
- button "Incomplete — click to change"
- text: Context menu on dailys calendar If I right click on a day in the calander I should get a context menu. The first item allows me to highlight that day, that should have sub-menus that allow me to pick a color to highlight it with.
- button "Delete": 
- button "Incomplete — click to change"
- text: Todo Context Menu Right clicking on Todo's should bring up a context menu allowing me to convert the todo to a category or project. Remove the button on the todo that effectively does the same thing
- button "Delete": 
- contentinfo:
  - paragraph: © 2026 MyWork. Licensed under the MIT License.
- alert:
  - text: To do saved!
  - button "Close"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Todos Tab', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('http://localhost:3000');
  6  |     // Click on Todos tab
  7  |     await page.click('[data-tab="todos"]');
  8  |     // Wait for todos to load
  9  |     await page.waitForSelector('#toDosList', { timeout: 5000 });
  10 |   });
  11 | 
  12 |   test('should create a todo and edit it', async ({ page }) => {
  13 |     // Click "Add To Do" button
  14 |     await page.click('#addToDoBtn');
  15 | 
  16 |     // Wait for modal to appear
  17 |     await expect(page.locator('#toDoModal')).toBeVisible({ timeout: 3000 });
  18 | 
  19 |     // Fill in the form
  20 |     await page.fill('#toDoTitle', 'Test Todo 1');
  21 |     await page.fill('#toDoNotes', 'Test notes');
  22 | 
  23 |     // Save
  24 |     await page.click('#saveToDoBtn');
  25 | 
  26 |     // Wait for modal to close and todos to reload
  27 |     await page.waitForSelector('.todo-row', { timeout: 3000 });
  28 | 
  29 |     // Should see the todo in the list
  30 |     await expect(page.locator('.todo-title').first()).toContainText('Test Todo 1');
  31 |   });
  32 | 
  33 |   test('should edit a todo by clicking on it', async ({ page }) => {
  34 |     // Create a todo first
  35 |     await page.click('#addToDoBtn');
  36 |     await page.fill('#toDoTitle', 'Todo to Edit');
  37 |     await page.click('#saveToDoBtn');
  38 |     await page.waitForSelector('.todo-row', { timeout: 3000 });
  39 | 
  40 |     // Click on the todo title to edit it
  41 |     await page.click('.todo-title');
  42 | 
  43 |     // Modal should appear
> 44 |     await expect(page.locator('#toDoModal')).toBeVisible({ timeout: 3000 });
     |                                              ^ Error: expect(locator).toBeVisible() failed
  45 | 
  46 |     // Title field should be populated
  47 |     const titleField = page.locator('#toDoTitle');
  48 |     await expect(titleField).toHaveValue('Todo to Edit');
  49 |   });
  50 | 
  51 |   test('should drag and drop todo under another', async ({ page }) => {
  52 |     // Create first todo
  53 |     await page.click('#addToDoBtn');
  54 |     await page.fill('#toDoTitle', 'Parent Todo');
  55 |     await page.click('#saveToDoBtn');
  56 |     await page.waitForSelector('.todo-row', { timeout: 3000 });
  57 | 
  58 |     // Create second todo
  59 |     await page.click('#addToDoBtn');
  60 |     await page.fill('#toDoTitle', 'Child Todo');
  61 |     await page.click('#saveToDoBtn');
  62 |     await page.waitForSelector('.todo-row:nth-child(2)', { timeout: 3000 });
  63 | 
  64 |     // Get the todo rows
  65 |     const todoRows = await page.locator('.todo-row').all();
  66 |     console.log(`Found ${todoRows.length} todo rows`);
  67 | 
  68 |     if (todoRows.length >= 2) {
  69 |       // Drag second todo onto first
  70 |       const childRow = todoRows[1];
  71 |       const parentRow = todoRows[0];
  72 | 
  73 |       // Perform drag and drop
  74 |       await childRow.dragTo(parentRow);
  75 | 
  76 |       // Wait for reload
  77 |       await page.waitForTimeout(500);
  78 | 
  79 |       // Check if parent now has a toggle (indicating it has children)
  80 |       const toggles = await page.locator('.todo-folder-toggle i').count();
  81 |       console.log(`Found ${toggles} toggle icons (indicating nested items)`);
  82 |     }
  83 |   });
  84 | });
  85 | 
```