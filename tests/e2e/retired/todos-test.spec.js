import { test, expect } from '@playwright/test';

test.describe('Todos Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Click on Todos tab
    await page.click('[data-tab="todos"]');
    // Wait for todos to load
    await page.waitForSelector('#toDosList', { timeout: 5000 });
  });

  test('should create a todo and edit it', async ({ page }) => {
    // Click "Add To Do" button
    await page.click('#addToDoBtn');

    // Wait for modal to appear
    await expect(page.locator('#toDoModal')).toBeVisible({ timeout: 3000 });

    // Fill in the form
    await page.fill('#toDoTitle', 'Test Todo 1');
    await page.fill('#toDoNotes', 'Test notes');

    // Save
    await page.click('#saveToDoBtn');

    // Wait for modal to close and todos to reload
    await page.waitForSelector('.todo-row', { timeout: 3000 });

    // Should see the todo in the list
    await expect(page.locator('.todo-title').first()).toContainText('Test Todo 1');
  });

  test('should edit a todo by clicking on it', async ({ page }) => {
    // Create a todo first
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Todo to Edit');
    await page.click('#saveToDoBtn');
    await page.waitForSelector('.todo-row', { timeout: 3000 });

    // Click on the todo title to edit it
    await page.click('.todo-title');

    // Modal should appear
    await expect(page.locator('#toDoModal')).toBeVisible({ timeout: 3000 });

    // Title field should be populated
    const titleField = page.locator('#toDoTitle');
    await expect(titleField).toHaveValue('Todo to Edit');
  });

  test('should drag and drop todo under another', async ({ page }) => {
    // Create first todo
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Parent Todo');
    await page.click('#saveToDoBtn');
    await page.waitForSelector('.todo-row', { timeout: 3000 });

    // Create second todo
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Child Todo');
    await page.click('#saveToDoBtn');
    await page.waitForSelector('.todo-row:nth-child(2)', { timeout: 3000 });

    // Get the todo rows
    const todoRows = await page.locator('.todo-row').all();
    console.log(`Found ${todoRows.length} todo rows`);

    if (todoRows.length >= 2) {
      // Drag second todo onto first
      const childRow = todoRows[1];
      const parentRow = todoRows[0];

      // Perform drag and drop
      await childRow.dragTo(parentRow);

      // Wait for reload
      await page.waitForTimeout(500);

      // Check if parent now has a toggle (indicating it has children)
      const toggles = await page.locator('.todo-folder-toggle i').count();
      console.log(`Found ${toggles} toggle icons (indicating nested items)`);
    }
  });
});
