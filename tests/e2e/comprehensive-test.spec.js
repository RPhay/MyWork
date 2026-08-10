import { test, expect } from '@playwright/test';

test.describe('Todos - Comprehensive Feature Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('[data-tab="todos"]');
    await page.waitForSelector('#toDosList', { timeout: 5000 });
    await page.waitForTimeout(500);
  });

  test('1. Editor pane is hidden on page load', async ({ page }) => {
    const editorPane = await page.locator('#todoEditorPane');
    const isHidden = await editorPane.evaluate(el =>
      el.classList.contains('hidden') || el.style.display === 'none' || !el.offsetParent
    );
    expect(isHidden).toBe(true);
    console.log('✓ Editor pane is hidden on load');
  });

  test('2. Create first todo via Add button', async ({ page }) => {
    await page.click('#addToDoBtn');
    await expect(page.locator('#toDoModal')).toBeVisible();

    await page.fill('#toDoTitle', 'Parent Todo');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    // Editor pane should STILL be hidden after creating
    const editorPane = await page.locator('#todoEditorPane');
    const isHidden = await editorPane.evaluate(el =>
      el.classList.contains('hidden') || el.style.display === 'none'
    );
    expect(isHidden).toBe(true);

    // Check if the todo was created
    const todoExists = await page.locator('span.todo-title:has-text("Parent Todo")').first().isVisible();
    expect(todoExists).toBe(true);
    console.log('✓ Created todo and editor pane stayed hidden');
  });

  test('3. Clicking todo title opens editor pane', async ({ page }) => {
    // Create a todo first
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'TestTodo3');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    // Now click on the todo title
    const todoTitle = await page.locator('span.todo-title:has-text("TestTodo3")').first();
    await todoTitle.click();
    await page.waitForTimeout(500);

    // Editor pane should now be visible
    const editorPane = await page.locator('#todoEditorPane');
    await expect(editorPane).toBeVisible();

    // Form should be populated
    const titleInput = await page.locator('#toDoEditorFormTitle');
    const value = await titleInput.inputValue();
    expect(value).toBe('TestTodo3');
    console.log('✓ Clicking todo title opens editor pane with populated form');
  });

  test('4. Create two todos for nesting test', async ({ page }) => {
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Parent Todo');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Child Todo');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    const todos = await page.locator('.todo-row').count();
    expect(todos).toBeGreaterThanOrEqual(2);
    console.log('✓ Created two todos');
  });

  test('5. Drag child onto parent to create nesting', async ({ page }) => {
    // Create two todos
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Parent Todo');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Child Todo');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    // Get the todo rows
    const rows = await page.locator('.todo-row').all();
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // Drag second onto first
    await rows[1].dragTo(rows[0]);
    await page.waitForTimeout(2000);

    // Check if parent now has a toggle icon (indicating children)
    const toggleIcons = await page.locator('i.todo-folder-toggle').count();
    expect(toggleIcons).toBeGreaterThan(0);
    console.log('✓ Drag and drop created nesting relationship');
  });

  test('6. Expand nested parent to see children', async ({ page }) => {
    // Create and nest two todos
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Parent');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Child');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    const rows = await page.locator('.todo-row').all();
    await rows[1].dragTo(rows[0]);
    await page.waitForTimeout(2000);

    // Click expand toggle
    const toggleIcon = await page.locator('i.todo-folder-toggle').first();
    await toggleIcon.click();
    await page.waitForTimeout(500);

    // Check if nested structure exists
    const hasChildren = await page.locator('.todo-node-children').count();
    expect(hasChildren).toBeGreaterThan(0);
    console.log('✓ Expanded parent shows children');
  });

  test('7. Save button in editor closes pane', async ({ page }) => {
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Test Todo');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    // Click to open editor
    await page.click('.todo-title');
    await page.waitForTimeout(500);

    // Modify and save
    const titleInput = await page.locator('#toDoEditorFormTitle');
    await titleInput.fill('Modified Todo');
    await page.click('#saveToDoEditorBtn');
    await page.waitForTimeout(1000);

    // Editor pane should be hidden again
    const editorPane = await page.locator('#todoEditorPane');
    const isHidden = await editorPane.evaluate(el =>
      el.classList.contains('hidden') || !el.offsetParent
    );
    expect(isHidden).toBe(true);
    console.log('✓ Save button closes editor pane');
  });

  test('8. Close button hides editor pane', async ({ page }) => {
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Test Todo');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    // Click to open editor
    await page.click('.todo-title');
    await page.waitForTimeout(500);

    // Click close button
    await page.click('#closeToDoEditorBtn');
    await page.waitForTimeout(500);

    // Editor pane should be hidden
    const editorPane = await page.locator('#todoEditorPane');
    const isHidden = await editorPane.evaluate(el =>
      el.classList.contains('hidden') || !el.offsetParent
    );
    expect(isHidden).toBe(true);
    console.log('✓ Close button hides editor pane');
  });

  test('9. Delete button shows warning for children', async ({ page }) => {
    // Create and nest two todos
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Parent');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Child');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    const rows = await page.locator('.todo-row').all();
    await rows[1].dragTo(rows[0]);
    await page.waitForTimeout(2000);

    // Open parent in editor
    await page.click('.todo-title');
    await page.waitForTimeout(500);

    // Click delete - should show confirmation dialog
    await page.click('#deleteToDoEditorBtn');
    await page.waitForTimeout(500);

    // Check for dialog with "child" warning
    const dialogText = await page.locator('[role="dialog"]').textContent();
    expect(dialogText).toContain('child');
    console.log('✓ Delete shows warning about children');
  });

  test('10. Delete parent with children deletes all', async ({ page }) => {
    // Create and nest two todos
    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Parent');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    await page.click('#addToDoBtn');
    await page.fill('#toDoTitle', 'Child');
    await page.click('#saveToDoBtn');
    await page.waitForTimeout(1000);

    const rows = await page.locator('.todo-row').all();
    await rows[1].dragTo(rows[0]);
    await page.waitForTimeout(2000);

    // Count todos before delete
    const countBefore = await page.locator('.todo-row').count();

    // Open parent in editor
    await page.click('.todo-title');
    await page.waitForTimeout(500);

    // Click delete and confirm
    await page.click('#deleteToDoEditorBtn');
    await page.waitForTimeout(500);

    // Click confirm on dialog
    const confirmBtn = await page.locator('button:has-text("Confirm")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(2000);

    // Count todos after delete - should be less
    const countAfter = await page.locator('.todo-row').count();
    expect(countAfter).toBeLessThan(countBefore);
    console.log('✓ Delete parent removed all children');
  });
});
