# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: todos-test.spec.js >> Todos Tab >> should create a todo and edit it
- Location: tests/e2e/todos-test.spec.js:12:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.todo-title').first()
Expected substring: "Test Todo 1"
Received string:    "Parent Todo"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.todo-title').first()
    7 × locator resolved to <span class="todo-title">Child Todo</span>
      - unexpected value "Child Todo"
    7 × locator resolved to <span class="todo-title">Parent Todo</span>
      - unexpected value "Parent Todo"

```

```yaml
- text: Parent Todo
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
> 30 |     await expect(page.locator('.todo-title').first()).toContainText('Test Todo 1');
     |                                                       ^ Error: expect(locator).toContainText(expected) failed
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
  44 |     await expect(page.locator('#toDoModal')).toBeVisible({ timeout: 3000 });
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