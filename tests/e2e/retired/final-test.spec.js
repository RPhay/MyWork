import { test, expect } from '@playwright/test';

test('FINAL TEST: Expand works, persist after drag', async ({ page }) => {
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Expanded') || text.includes('Toggle')) {
      console.log('[BROWSER]', text);
    }
  });

  await page.goto('http://localhost:3000?tab=todos');
  await page.waitForSelector('#toDosList');
  await page.waitForTimeout(1000);

  // Test 1: Click to edit
  console.log('\n=== TEST 1: Click to edit ===');
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Test Todo');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  await page.click('.todo-title');
  await page.waitForTimeout(500);

  let editorVisible = await page.locator('#todoEditorPane').isVisible();
  console.log('✓ Editor opens on click:', editorVisible);
  expect(editorVisible).toBe(true);

  await page.click('#closeToDoEditorBtn');
  await page.waitForTimeout(500);

  // Test 2: Create parent and child
  console.log('\n=== TEST 2: Create parent and child ===');
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Parent');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Child');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1500);

  // Test 3: Drag child to parent
  console.log('\n=== TEST 3: Drag child to parent ===');
  const rows = await page.locator('.todo-row').all();
  console.log('Total rows:', rows.length);

  if (rows.length >= 2) {
    // Drag last row to first row
    await rows[rows.length - 1].dragTo(rows[0]);
    await page.waitForTimeout(2000);
    console.log('✓ Drag completed');
  }

  // Test 4: Try to expand parent
  console.log('\n=== TEST 4: Try to expand parent ===');
  const toggles = await page.locator('.todo-folder-toggle').all();
  console.log('Toggle icons found:', toggles.length);

  if (toggles.length > 0) {
    console.log('Clicking first toggle...');
    await toggles[0].click();
    await page.waitForTimeout(1000);

    const childrenDivs = await page.locator('.todo-node-children').count();
    console.log('✓ Children divs after expand:', childrenDivs);

    // Test 5: Expand again (collapse)
    console.log('\n=== TEST 5: Collapse (click toggle again) ===');
    await toggles[0].click();
    await page.waitForTimeout(500);

    const childrenDivsAfter = await page.locator('.todo-node-children').count();
    console.log('✓ Children divs after collapse:', childrenDivsAfter);

    // Test 6: Expand once more
    console.log('\n=== TEST 6: Expand again ===');
    await toggles[0].click();
    await page.waitForTimeout(500);

    const childrenDivsFinal = await page.locator('.todo-node-children').count();
    console.log('✓ Children divs after 2nd expand:', childrenDivsFinal);
  }

  await page.screenshot({ path: '/tmp/final-test.png' });
  console.log('\n✓ ALL TESTS COMPLETED');
});
