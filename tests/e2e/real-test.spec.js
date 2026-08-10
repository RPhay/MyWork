import { test } from '@playwright/test';

test('Test ACTUAL broken things', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('[data-tab="todos"]');
  await page.waitForSelector('#toDosList');

  // Screenshot 1: Check if editor pane is visible by default
  let editorPane = await page.locator('#todoEditorPane');
  let editorVisible = await editorPane.isVisible();
  console.log('\n=== ISSUE 1: Editor pane visible by default? ===');
  console.log('Editor pane visible:', editorVisible);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/issue1-editor-default.png' });

  // Create two todos
  console.log('\n=== Creating todos ===');
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Todo A');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1000);

  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Todo B');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1000);

  // Screenshot 2: Both todos visible?
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/issue2-both-todos.png' });

  // ISSUE 2: Click on a todo to edit
  console.log('\n=== ISSUE 2: Click to edit ===');
  const todoTitles = await page.locator('.todo-title').all();
  console.log('Found ' + todoTitles.length + ' todo titles');

  if (todoTitles.length > 0) {
    await todoTitles[0].click();
    await page.waitForTimeout(500);

    const modalVisible = await page.locator('#toDoModal').isVisible();
    const editorFormTitle = await page.locator('#toDoEditorFormTitle').inputValue();
    console.log('Modal open after click?', modalVisible);
    console.log('Editor form title value:', editorFormTitle);
    await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/issue2-after-click.png' });
  }

  // ISSUE 3: Drag and drop
  console.log('\n=== ISSUE 3: Drag and drop ===');
  const todoRows = await page.locator('.todo-row').all();
  console.log('Found ' + todoRows.length + ' todo rows');

  if (todoRows.length >= 2) {
    console.log('Attempting drag: row 1 -> row 0');
    await todoRows[1].dragTo(todoRows[0]);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/4d4e9b81-1706-4723-aad4-52d5cf9cb523/scratchpad/issue3-after-drag.png' });

    const todosList = await page.locator('#toDosList').innerHTML();
    console.log('Todos list changed after drag?', todosList.includes('todo-node-children'));
  }
});
