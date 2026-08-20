import { test } from '@playwright/test';

test('Test with REAL existing work item - click todos multiple times', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('\n=== Finding first work item with expandable children ===\n');

  // Get all non-child work items
  const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  console.log(`Found ${workItems.length} work items on page\n`);

  // Find first one that can be expanded (has toggle)
  let targetWI = null;
  for (let i = 0; i < Math.min(5, workItems.length); i++) {
    const wi = workItems[i];
    const title = await wi.locator('.work-item-title').first().textContent();
    const toggleBtn = wi.locator('[data-action="toggle-expand"]');
    const toggleExists = await toggleBtn.isVisible().catch(() => false);
    
    console.log(`Item ${i}: "${title}" - has toggle: ${toggleExists}`);
    
    if (toggleExists) {
      targetWI = wi;
      console.log(`Using this work item\n`);
      break;
    }
  }

  if (!targetWI) {
    console.log('ERROR: No expandable work item found');
    process.exit(1);
  }

  // Expand it
  console.log('=== Expanding work item ===\n');
  await targetWI.locator('[data-action="toggle-expand"]').click();
  await page.waitForTimeout(1500);

  // Find child rows
  const childRows = await targetWI.locator('.child-item-row').all();
  console.log(`Found ${childRows.length} child items\n`);

  if (childRows.length < 2) {
    console.log('ERROR: Need at least 2 child items to test toggle');
    process.exit(1);
  }

  const childPane = page.locator('#childItemEditorPane');

  // Get first and second child
  const child1 = childRows[0];
  const child1Title = await child1.locator('.work-item-title').textContent();
  const child1Type = await child1.getAttribute('data-item-type');

  const child2 = childRows[1];
  const child2Title = await child2.locator('.work-item-title').textContent();
  const child2Type = await child2.getAttribute('data-item-type');

  console.log(`Child 1: ${child1Type} - "${child1Title}"`);
  console.log(`Child 2: ${child2Type} - "${child2Title}"\n`);

  console.log('=== STEP 1: Click Child 1 ===');
  await child1.click();
  await page.waitForTimeout(800);
  const visible1a = await childPane.isVisible();
  const title1a = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Editor visible: ${visible1a}`);
  console.log(`Editor shows: "${title1a}"`);
  console.log(`Expected: "${child1Title}"\n`);

  console.log('=== STEP 2: Click Child 1 again (same row) ===');
  await child1.click();
  await page.waitForTimeout(800);
  const visible1b = await childPane.isVisible().catch(() => false);
  console.log(`Editor visible: ${visible1b} (should be false)`);
  console.log(`Expected: false\n`);

  console.log('=== STEP 3: Click Child 1 again (open it) ===');
  await child1.click();
  await page.waitForTimeout(800);
  const visible1c = await childPane.isVisible();
  const title1c = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Editor visible: ${visible1c}`);
  console.log(`Editor shows: "${title1c}"`);
  console.log(`Expected: "${child1Title}"\n`);

  console.log('=== STEP 4: Click Child 2 (different row) ===');
  await child2.click();
  await page.waitForTimeout(800);
  const visible2 = await childPane.isVisible();
  const title2 = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Editor visible: ${visible2}`);
  console.log(`Editor shows: "${title2}"`);
  console.log(`Expected: "${child2Title}"\n`);

  console.log('=== STEP 5: Click Child 1 again ===');
  await child1.click();
  await page.waitForTimeout(800);
  const visible1d = await childPane.isVisible();
  const title1d = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Editor visible: ${visible1d}`);
  console.log(`Editor shows: "${title1d}"`);
  console.log(`Expected: "${child1Title}"\n`);

  console.log('=== STEP 6: Click Child 2 ===');
  await child2.click();
  await page.waitForTimeout(800);
  const visible2b = await childPane.isVisible();
  const title2b = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Editor visible: ${visible2b}`);
  console.log(`Editor shows: "${title2b}"`);
  console.log(`Expected: "${child2Title}"\n`);

  console.log('\n✅ TEST COMPLETE - COMPARE EXPECTED VS ACTUAL ABOVE');
});
