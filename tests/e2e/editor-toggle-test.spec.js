import { test, expect } from '@playwright/test';

test('Editor toggle behavior - click to open, click to close, switch between rows', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  const ts = Date.now();

  // Create two todos
  const todo1Id = (await (await page.request.post('/api/to-dos', {
    data: { title: `TOGGLE_TODO1_${ts}`, notes: 'Notes 1' },
    headers
  })).json()).data.id;

  const todo2Id = (await (await page.request.post('/api/to-dos', {
    data: { title: `TOGGLE_TODO2_${ts}`, notes: 'Notes 2' },
    headers
  })).json()).data.id;

  // Create work item
  const workItemId = (await (await page.request.post('/api/work', {
    data: { title: `TOGGLE_WORK_${ts}`, date: '2026-08-14' },
    headers
  })).json()).data.id;

  // Associate both todos
  await page.request.post(`/api/work/${workItemId}/todos/${todo1Id}`, { headers });
  await page.request.post(`/api/work/${workItemId}/todos/${todo2Id}`, { headers });

  // Load page
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Find and expand work item
  const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  let workItem = null;
  for (const wi of workItems) {
    const title = await wi.locator('.work-item-title').first().textContent();
    if (title?.includes('TOGGLE_WORK_')) {
      workItem = wi;
      break;
    }
  }
  expect(workItem).toBeTruthy();

  await workItem.locator('[data-action="toggle-expand"]').click();
  await page.waitForTimeout(800);

  const editorPane = page.locator('#childItemEditorPane');
  const workEditorPane = page.locator('#workItemEditorPane');

  console.log('\n=== TEST 1: Editors closed initially ===');
  let childEditorVisible = await editorPane.isVisible().catch(() => false);
  let workEditorVisible = await workEditorPane.isVisible().catch(() => false);
  console.log(`Child editor visible: ${childEditorVisible}`);
  console.log(`Work editor visible: ${workEditorVisible}`);
  expect(childEditorVisible).toBe(false);

  console.log('\n=== TEST 2: Click TODO1 - editor opens ===');
  const todo1Row = workItem.locator(`.child-item-row[data-work-id="${todo1Id}"]`);
  await todo1Row.click();
  await page.waitForTimeout(600);

  childEditorVisible = await editorPane.isVisible();
  workEditorVisible = await workEditorPane.isVisible();
  console.log(`Child editor visible: ${childEditorVisible}`);
  console.log(`Work editor visible: ${workEditorVisible}`);
  expect(childEditorVisible).toBe(true);
  expect(workEditorVisible).toBe(false);

  let title1 = await page.locator('#childItemEditorTitle').inputValue();
  console.log(`Editor showing: "${title1}"`);
  expect(title1).toContain('TOGGLE_TODO1_');

  console.log('\n=== TEST 3: Click TODO1 again - editor closes ===');
  await todo1Row.click();
  await page.waitForTimeout(600);

  childEditorVisible = await editorPane.isVisible().catch(() => false);
  workEditorVisible = await workEditorPane.isVisible();
  console.log(`Child editor visible: ${childEditorVisible}`);
  console.log(`Work editor visible: ${workEditorVisible}`);
  expect(childEditorVisible).toBe(false);
  expect(workEditorVisible).toBe(true);

  console.log('\n=== TEST 4: Click TODO2 - editor opens with different data ===');
  const todo2Row = workItem.locator(`.child-item-row[data-work-id="${todo2Id}"]`);
  await todo2Row.click();
  await page.waitForTimeout(600);

  childEditorVisible = await editorPane.isVisible();
  workEditorVisible = await workEditorPane.isVisible();
  console.log(`Child editor visible: ${childEditorVisible}`);
  console.log(`Work editor visible: ${workEditorVisible}`);
  expect(childEditorVisible).toBe(true);
  expect(workEditorVisible).toBe(false);

  let title2 = await page.locator('#childItemEditorTitle').inputValue();
  console.log(`Editor showing: "${title2}"`);
  expect(title2).toContain('TOGGLE_TODO2_');

  console.log('\n=== TEST 5: Click TODO1 again - editor switches content ===');
  await todo1Row.click();
  await page.waitForTimeout(600);

  childEditorVisible = await editorPane.isVisible();
  console.log(`Child editor still visible: ${childEditorVisible}`);
  expect(childEditorVisible).toBe(true);

  let title1Again = await page.locator('#childItemEditorTitle').inputValue();
  console.log(`Editor now showing: "${title1Again}"`);
  expect(title1Again).toContain('TOGGLE_TODO1_');

  console.log('\n✅ ALL TOGGLE TESTS PASSED!');
});
