import { test, expect } from '@playwright/test';

test('actual drag and drop test', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Go to To Dos tab
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(1000);
  
  // Create a folder
  console.log('Creating folder...');
  await page.click('#addFolderBtn');
  await page.fill('#folderName', 'Target Folder');
  await page.click('#saveFolderBtn');
  await page.waitForTimeout(1000);
  
  // Create a to-do
  console.log('Creating to-do...');
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Item to Move');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1000);
  
  // Get the to-do row and folder header
  const todoRow = await page.locator('.todo-row').first();
  const folderHeader = await page.locator('.todo-folder-header').first();
  
  console.log('To-do visible:', await todoRow.isVisible());
  console.log('Folder visible:', await folderHeader.isVisible());
  
  // Check their positions
  const todoBox = await todoRow.boundingBox();
  const folderBox = await folderHeader.boundingBox();
  
  console.log('To-do position:', todoBox);
  console.log('Folder position:', folderBox);
  
  // Try to drag and drop
  console.log('Attempting drag and drop...');
  try {
    await todoRow.dragTo(folderHeader);
    console.log('Drag and drop completed');
  } catch (e) {
    console.log('Drag and drop error:', e.message);
  }
  
  await page.waitForTimeout(1000);
  
  // Check if the to-do was moved
  const updatedTodo = await page.evaluate(() => {
    const row = document.querySelector('.todo-row');
    return {
      folderId: row?.dataset.todoId,
      hasAttribute: row?.hasAttribute('data-todo-id')
    };
  });
  
  console.log('Updated to-do:', updatedTodo);
  
  // Print console logs
  console.log('\n=== Console Logs ===');
  consoleLogs.forEach(log => console.log(log));
});
