import { test } from '@playwright/test';

test('check todo visibility', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(1000);
  
  // Create items
  await page.click('#addFolderBtn');
  await page.fill('#folderName', 'Test');
  await page.click('#saveFolderBtn');
  await page.waitForTimeout(500);
  
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Test Item');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1000);
  
  // Check visibility
  const todoRow = await page.locator('.todo-row').first();
  const display = await todoRow.evaluate(el => window.getComputedStyle(el).display);
  const visibility = await todoRow.evaluate(el => window.getComputedStyle(el).visibility);
  const opacity = await todoRow.evaluate(el => window.getComputedStyle(el).opacity);
  const hidden = await todoRow.evaluate(el => el.hidden);
  
  console.log('Display:', display);
  console.log('Visibility:', visibility);
  console.log('Opacity:', opacity);
  console.log('Hidden:', hidden);
  
  // Check parent visibility
  const container = await page.locator('#toDosList');
  const contDisplay = await container.evaluate(el => window.getComputedStyle(el).display);
  console.log('Container display:', contDisplay);
  
  // Check if todo is in viewport
  const isInViewport = await todoRow.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
  });
  console.log('In viewport:', isInViewport);
});
