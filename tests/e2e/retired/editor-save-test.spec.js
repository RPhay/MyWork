import { test, expect } from '@playwright/test';

test('Editor save functionality', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create fresh TODO
  const timestamp = Date.now();
  const uniqueId = 'SAVEPERFECT_' + timestamp;

  const todoId = (await (await page.request.post('/api/to-dos', {
    data: { title: uniqueId + '_TODO', notes: 'ORIGINAL_NOTES', status: 'incomplete' },
    headers
  })).json()).data.id;

  // Create fresh work item
  const dailyId = (await (await page.request.post('/api/dailies', {
    data: { title: uniqueId + '_WORK', date: '2026-08-14' },
    headers
  })).json()).data.id;

  // Associate
  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });

  // Load page, find and expand work item
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Find our work item by iterating through all work items
  const allWorkItems = await page.locator('.work-item:not(.child-item-row)').all();
  console.log(`Found ${allWorkItems.length} work items on page`);

  let workItem = null;
  for (const wi of allWorkItems) {
    const titleEl = wi.locator('.work-item-title').first();
    const title = await titleEl.textContent().catch(() => '');
    if (title.includes(uniqueId)) {
      workItem = wi;
      console.log(`Found work item: "${title}"`);
      break;
    }
  }

  if (!workItem) throw new Error('Work item not found');

  // Expand
  await workItem.locator('[data-action="toggle-expand"]').click();
  await page.waitForTimeout(1000);

  // Click TODO row
  const todoRow = workItem.locator(`.child-item-row[data-work-id="${todoId}"]`);
  await todoRow.click();
  await page.waitForTimeout(500);

  // Verify initial data
  const notesInput = page.locator('#childItemEditorNotes');
  const statusInput = page.locator('#childItemEditorStatus');

  let initialNotes = await notesInput.inputValue();
  let initialStatus = await statusInput.inputValue();

  console.log('Initial state:', { notes: initialNotes, status: initialStatus });

  // Edit
  await notesInput.fill('SAVED_NEW_NOTES_VALUE_' + Date.now());
  await statusInput.selectOption('complete');

  // Wait for change tracking
  await page.waitForTimeout(500);

  // Verify change tracking enabled save button
  const saveBtn = page.locator('#saveChildItemEditorBtn');
  const isSaveEnabled = await saveBtn.isEnabled();
  console.log('Save button enabled:', isSaveEnabled);
  expect(isSaveEnabled).toBe(true);

  // Save
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Verify via API
  const verifyResp = await page.request.get(`/api/to-dos/${todoId}`);
  const verifyData = (await verifyResp.json()).data;

  console.log('Verified via API:', { notes: verifyData.notes, status: verifyData.status });

  expect(verifyData.notes).toContain('SAVED_NEW_NOTES_VALUE_');
  expect(verifyData.status).toBe('complete');

  console.log('✅ SAVE TEST PASSED!');
});
