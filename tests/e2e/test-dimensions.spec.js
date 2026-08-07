import { test } from '@playwright/test';

test('check todo dimensions', async ({ page }) => {
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
  
  // Check dimensions
  const todoRow = await page.locator('.todo-row').first();
  const box = await todoRow.boundingBox();
  const clientRect = await todoRow.evaluate(el => ({
    width: el.clientWidth,
    height: el.clientHeight,
    offsetHeight: el.offsetHeight,
    scrollHeight: el.scrollHeight
  }));
  
  console.log('Bounding box:', box);
  console.log('Client dimensions:', clientRect);
  
  // Check HTML content
  const html = await todoRow.evaluate(el => el.outerHTML.substring(0, 200));
  console.log('HTML:', html);
  
  // Check the container size
  const container = await page.locator('#toDosList');
  const contBox = await container.boundingBox();
  console.log('Container bounding box:', contBox);
});
