import { test } from '@playwright/test';

test('check todos loading', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(2000);
  
  // Check what's in toDosList
  const html = await page.locator('#toDosList').innerHTML();
  console.log('toDosList HTML length:', html.length);
  console.log('toDosList HTML:', html.substring(0, 300));
  
  // Check if there are any todo-row elements
  const todoCount = await page.locator('.todo-row').count();
  console.log('Todo rows found:', todoCount);
  
  // Check if there are any folder elements
  const folderCount = await page.locator('.todo-folder-node').count();
  console.log('Folder nodes found:', folderCount);
  
  // Check allToDos in memory
  const allTodos = await page.evaluate(() => window.allToDos?.length || 'undefined');
  console.log('allToDos length:', allTodos);
  
  // Try calling loadToDos manually
  await page.evaluate(() => loadToDos());
  await page.waitForTimeout(1000);
  
  const todoCountAfter = await page.locator('.todo-row').count();
  console.log('Todo rows after loadToDos:', todoCountAfter);
  
  // Print errors
  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.forEach(e => console.log(e));
  }
});
