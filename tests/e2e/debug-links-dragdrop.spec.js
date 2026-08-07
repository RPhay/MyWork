import { test, expect } from '@playwright/test';

test('debug links and drag drop', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Go to To Dos tab
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(2000);
  
  // Check what's on the page
  const todoRows = await page.locator('.todo-row').count();
  console.log(`Found ${todoRows} todo rows`);
  
  const folders = await page.locator('.todo-folder-node').count();
  console.log(`Found ${folders} folder nodes`);
  
  // Check if setup drag listeners was called
  const setupDefined = await page.evaluate(() => typeof setupDragListeners);
  console.log(`setupDragListeners: ${setupDefined}`);
  
  // Check for bound drag items
  const dragBound = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-drag-bound="true"]');
    return items.length;
  });
  console.log(`Items with data-drag-bound: ${dragBound}`);
  
  // Check page screenshot for visibility
  await page.screenshot({ path: '/tmp/todo-page.png' });
  console.log('Screenshot saved to /tmp/todo-page.png');
  
  // Print errors
  if (errors.length > 0) {
    console.log('\n=== Console Errors ===');
    errors.forEach(e => console.log(e));
  }
  
  expect(setupDefined).toBe('function');
});
