import { test } from '@playwright/test';

test('Click on TODOS specifically - multiple clicks', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('\n=== Finding first work item with TODO children ===\n');

  const workItems = await page.locator('.work-item:not(.child-item-row)').all();

  let targetWI = null;
  for (let i = 0; i < Math.min(10, workItems.length); i++) {
    const wi = workItems[i];
    const title = await wi.locator('.work-item-title').first().textContent();
    
    // Expand it
    const toggleBtn = wi.locator('[data-action="toggle-expand"]');
    const toggleExists = await toggleBtn.isVisible().catch(() => false);
    if (!toggleExists) continue;
    
    await toggleBtn.click();
    await page.waitForTimeout(500);
    
    // Check for todos
    const todoRows = await wi.locator('.child-item-row[data-item-type="todo"]').all();
    
    if (todoRows.length >= 2) {
      console.log(`Work item: "${title}" has ${todoRows.length} todos`);
      targetWI = wi;
      break;
    }
  }

  if (!targetWI) {
    console.log('ERROR: No work item with 2+ todos found');
    process.exit(1);
  }

  const todoRows = await targetWI.locator('.child-item-row[data-item-type="todo"]').all();
  const todo1 = todoRows[0];
  const todo2 = todoRows[1];

  const todo1Title = await todo1.locator('.work-item-title').textContent();
  const todo2Title = await todo2.locator('.work-item-title').textContent();

  console.log(`\nTodo 1: "${todo1Title}"`);
  console.log(`Todo 2: "${todo2Title}"\n`);

  const childPane = page.locator('#childItemEditorPane');

  console.log('=== Click Todo 1 ===');
  await todo1.click();
  await page.waitForTimeout(800);
  let v = await childPane.isVisible();
  let t = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Visible: ${v}, Shows: "${t}", Expected: "${todo1Title}"`);
  if (v && t !== todo1Title) console.log('❌ WRONG EDITOR CONTENT!');

  console.log('\n=== Click Todo 1 again ===');
  await todo1.click();
  await page.waitForTimeout(800);
  v = await childPane.isVisible().catch(() => false);
  console.log(`Visible: ${v}, Expected: false`);
  if (v) console.log('❌ SHOULD BE CLOSED!');

  console.log('\n=== Click Todo 1 again ===');
  await todo1.click();
  await page.waitForTimeout(800);
  v = await childPane.isVisible();
  t = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Visible: ${v}, Shows: "${t}", Expected: "${todo1Title}"`);
  if (v && t !== todo1Title) console.log('❌ WRONG EDITOR CONTENT!');

  console.log('\n=== Click Todo 2 ===');
  await todo2.click();
  await page.waitForTimeout(800);
  v = await childPane.isVisible();
  t = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Visible: ${v}, Shows: "${t}", Expected: "${todo2Title}"`);
  if (v && t !== todo2Title) console.log('❌ WRONG EDITOR CONTENT!');

  console.log('\n=== Click Todo 1 again ===');
  await todo1.click();
  await page.waitForTimeout(800);
  v = await childPane.isVisible();
  t = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Visible: ${v}, Shows: "${t}", Expected: "${todo1Title}"`);
  if (v && t !== todo1Title) console.log('❌ WRONG EDITOR CONTENT!');

  console.log('\n=== Click Todo 2 again ===');
  await todo2.click();
  await page.waitForTimeout(800);
  v = await childPane.isVisible();
  t = await page.locator('#childItemEditorTitle').inputValue().catch(() => '');
  console.log(`Visible: ${v}, Shows: "${t}", Expected: "${todo2Title}"`);
  if (v && t !== todo2Title) console.log('❌ WRONG EDITOR CONTENT!');
});
