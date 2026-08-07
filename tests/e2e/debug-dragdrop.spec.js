import { test, expect } from '@playwright/test';

test('debug drag and drop - create and drag', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Capture all console messages and errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.waitForLoadState('networkidle');
  
  // Click on To Dos tab
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(1000);
  
  // Create a folder first
  console.log('Creating folder...');
  await page.click('#addFolderBtn');
  await page.waitForSelector('#folderModal');
  await page.fill('#folderName', 'Test Folder');
  await page.click('#saveFolderBtn');
  await page.waitForTimeout(500);
  
  // Create a to-do
  console.log('Creating to-do...');
  await page.click('#addToDoBtn');
  await page.waitForSelector('#toDoModal');
  await page.fill('#toDoTitle', 'Test To-Do');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1000);
  
  // Check for to-dos in the list
  const todoRows = await page.locator('.todo-row').count();
  console.log(`Found ${todoRows} todo rows`);
  
  // Check for folders
  const folderRows = await page.locator('.todo-folder-header').count();
  console.log(`Found ${folderRows} folder rows`);
  
  // Look for draggable items in the todos list
  const todosDraggables = await page.locator('#toDosList [draggable="true"]').count();
  console.log(`Found ${todosDraggables} draggable items in todos list`);
  
  // Get details on first draggable
  const firstDraggable = await page.locator('#toDosList [draggable="true"]').first();
  if (await firstDraggable.isVisible()) {
    const type = await firstDraggable.getAttribute('data-type');
    const id = await firstDraggable.getAttribute('data-id');
    const bound = await firstDraggable.getAttribute('data-drag-bound');
    const text = await firstDraggable.textContent();
    console.log(`First draggable: type=${type}, id=${id}, bound=${bound}, text=${text?.substring(0, 30)}`);
  }
  
  // Check if setupDragListeners was called
  const dragListenersSetup = await page.evaluate(() => {
    const draggables = document.querySelectorAll('#toDosList [draggable="true"][data-drag-bound="true"]');
    return draggables.length;
  });
  console.log(`Draggables with data-drag-bound=true: ${dragListenersSetup}`);
  
  // Print errors
  if (errors.length > 0) {
    console.log('\n=== Errors Found ===');
    errors.forEach(err => console.log(err));
  }
  
  expect(todoRows).toBeGreaterThan(0);
  expect(folderRows).toBeGreaterThan(0);
  expect(errors).toHaveLength(0);
});
