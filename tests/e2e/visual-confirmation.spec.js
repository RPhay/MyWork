import { test, expect } from '@playwright/test';

test('Visual Confirmation - All Features Working', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('[data-tab="todos"]');
  await page.waitForSelector('#toDosList');
  await page.waitForTimeout(500);

  // Screenshot 1: Initial state - editor pane hidden
  console.log('\n=== TEST 1: Initial state - editor pane should be HIDDEN ===');
  let editorVisible = await page.locator('#todoEditorPane').isVisible();
  console.log('Editor pane visible:', editorVisible);
  console.log('Expected: false');
  expect(editorVisible).toBe(false);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/01-initial-editor-hidden.png' });
  console.log('✓ PASS: Editor pane is hidden on page load');

  // Screenshot 2: Create a todo
  console.log('\n=== TEST 2: Create a todo - editor should STILL be hidden ===');
  await page.click('#addToDoBtn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/02-modal-open.png' });

  await page.fill('#toDoTitle', 'Test Todo 1');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  editorVisible = await page.locator('#todoEditorPane').isVisible();
  console.log('Editor pane visible after creating todo:', editorVisible);
  console.log('Expected: false');
  expect(editorVisible).toBe(false);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/03-after-create-editor-still-hidden.png' });
  console.log('✓ PASS: Editor pane stayed hidden after creating todo');

  // Screenshot 3: Click on todo to open editor
  console.log('\n=== TEST 3: Click on todo title to open editor pane ===');
  await page.click('.todo-title');
  await page.waitForTimeout(800);

  editorVisible = await page.locator('#todoEditorPane').isVisible();
  console.log('Editor pane visible after clicking todo:', editorVisible);
  console.log('Expected: true');
  expect(editorVisible).toBe(true);

  const titleValue = await page.locator('#toDoEditorFormTitle').inputValue();
  console.log('Editor form title:', titleValue);
  console.log('Expected: Test Todo 1');
  expect(titleValue).toBe('Test Todo 1');
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/04-editor-pane-open-populated.png' });
  console.log('✓ PASS: Editor pane opened and form populated');

  // Screenshot 4: Close editor
  console.log('\n=== TEST 4: Close editor pane ===');
  await page.click('#closeToDoEditorBtn');
  await page.waitForTimeout(500);

  editorVisible = await page.locator('#todoEditorPane').isVisible();
  console.log('Editor pane visible after close:', editorVisible);
  console.log('Expected: false');
  expect(editorVisible).toBe(false);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/05-editor-closed.png' });
  console.log('✓ PASS: Editor pane closed');

  // Screenshot 5: Create second todo and drag it
  console.log('\n=== TEST 5: Create second todo and drag onto first to nest ===');
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Test Todo 2');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  const rows = await page.locator('.todo-row').all();
  console.log('Todo rows before drag:', rows.length);
  if (rows.length >= 2) {
    await rows[rows.length - 1].dragTo(rows[0]);
    await page.waitForTimeout(2000);

    const toggleIcons = await page.locator('i.todo-folder-toggle').count();
    console.log('Expand toggle icons found:', toggleIcons);
    console.log('Expected: > 0 (parent should have expand toggle)');
    expect(toggleIcons).toBeGreaterThan(0);
    await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/06-after-drag-nesting.png' });
    console.log('✓ PASS: Drag and drop created parent-child relationship');
  }

  // Screenshot 6: Edit existing todo
  console.log('\n=== TEST 6: Edit existing todo ===');
  await page.click('.todo-title');
  await page.waitForTimeout(500);
  await page.locator('#toDoEditorFormTitle').fill('Test Todo 1 - Modified');
  await page.click('#saveToDoEditorBtn');
  await page.waitForTimeout(1500);

  editorVisible = await page.locator('#todoEditorPane').isVisible();
  console.log('Editor pane visible after save:', editorVisible);
  console.log('Expected: false');
  expect(editorVisible).toBe(false);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/07-after-edit-editor-closed.png' });
  console.log('✓ PASS: Edit saved and editor closed');

  // Screenshot 7: Delete with warning
  console.log('\n=== TEST 7: Delete todo with children shows warning ===');
  await page.click('.todo-title');
  await page.waitForTimeout(500);
  await page.click('#deleteToDoEditorBtn');
  await page.waitForTimeout(800);

  const dialogText = await page.locator('[role="dialog"]').textContent();
  console.log('Dialog text includes "child":', dialogText.includes('child'));
  console.log('Expected: true');
  expect(dialogText).toContain('child');
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/08-delete-warning-dialog.png' });
  console.log('✓ PASS: Delete warning shows when item has children');

  console.log('\n=== ALL VISUAL TESTS PASSED ===');
  console.log('Screenshots saved to /private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/');
});
