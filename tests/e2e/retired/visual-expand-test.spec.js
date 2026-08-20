import { test } from '@playwright/test';

test('Visual: Expand a nested todo', async ({ page }) => {
  await page.goto('http://localhost:3000?tab=todos');
  await page.waitForSelector('#toDosList');
  await page.waitForTimeout(500);

  // Create parent
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Parent');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  // Create child
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Child');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  // Drag child to parent
  const rows = await page.locator('.todo-row').all();
  if (rows.length >= 2) {
    await rows[rows.length - 1].dragTo(rows[0]);
    await page.waitForTimeout(2000);
  }

  // Take screenshot BEFORE expanding
  await page.screenshot({ path: '/tmp/expand-test-before.png' });

  // Click expand toggle
  const toggles = await page.locator('.todo-folder-toggle').all();
  if (toggles.length > 0) {
    await toggles[0].click();
    await page.waitForTimeout(800);
  }

  // Take screenshot AFTER expanding
  await page.screenshot({ path: '/tmp/expand-test-after.png' });

  console.log('Screenshots saved to /tmp/');
});
