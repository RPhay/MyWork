import { test, expect } from '@playwright/test';

test('Debug: Test clicks on todos', async ({ page }) => {
  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  await page.goto('http://localhost:3000?tab=todos');
  await page.waitForSelector('#toDosList');
  await page.waitForTimeout(1000);

  // Create a todo
  console.log('\n=== Creating first todo ===');
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Parent Todo');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  // Create second todo
  console.log('\n=== Creating second todo ===');
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Child Todo');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  // Drag second onto first
  console.log('\n=== Dragging second todo onto first ===');
  const rows = await page.locator('.todo-row').all();
  if (rows.length >= 2) {
    await rows[rows.length - 1].dragTo(rows[0]);
    await page.waitForTimeout(2000);
  }

  // Take screenshot to see structure
  await page.screenshot({ path: '/tmp/debug-before-clicks.png' });

  // Try clicking on title
  console.log('\n=== Trying to click on todo title ===');
  const todoTitle = await page.locator('.todo-title').first();
  console.log('Todo title text:', await todoTitle.textContent());
  console.log('Clicking on title...');
  await todoTitle.click();
  await page.waitForTimeout(800);

  let editorVisible = await page.locator('#todoEditorPane').isVisible();
  console.log('Editor visible after click:', editorVisible);

  if (!editorVisible) {
    console.log('ERROR: Editor did not open!');
    await page.screenshot({ path: '/tmp/debug-after-title-click-failed.png' });
  } else {
    console.log('SUCCESS: Editor opened!');
    await page.screenshot({ path: '/tmp/debug-after-title-click-success.png' });
  }

  // Check the HTML to see if nesting actually happened
  console.log('\n=== Checking if drag created parent-child relationship ===');
  const html = await page.locator('#toDosList').innerHTML();
  const hasNesting = html.includes('data-todo-id') && html.includes('todo-node-children');
  console.log('HTML has nested structure:', hasNesting);
  console.log('HTML snippet:', html.substring(0, 500));

  // Try clicking expand toggle
  console.log('\n=== Trying to click expand toggle ===');
  const togglesBeforeExpand = await page.locator('i.todo-folder-toggle').all();
  console.log('Found icon toggle elements:', togglesBeforeExpand.length);

  const toggles = await page.locator('.todo-folder-toggle').all();
  console.log('Found toggle elements (any):', toggles.length);

  if (togglesBeforeExpand.length > 0) {
    const firstToggle = togglesBeforeExpand[0];
    console.log('Clicking first icon toggle...');
    await firstToggle.click();
    await page.waitForTimeout(1500);

    const html = await page.locator('#toDosList').innerHTML();
    const hasExpanded = html.includes('class="todo-node expanded');
    console.log('HTML contains "class="todo-node expanded":', hasExpanded);

    const children = await page.locator('.todo-node-children').count();
    console.log('Children elements visible:', children);

    const expandedNodes = await page.locator('.todo-node.expanded').count();
    console.log('Expanded nodes:', expandedNodes);

    // Get the structure of an expanded node
    const expandedHtml = await page.locator('.todo-node.expanded').first().innerHTML();
    console.log('Expanded node HTML:', expandedHtml.substring(0, 300));

    await page.screenshot({ path: '/tmp/debug-after-toggle-click.png' });
  }
});
