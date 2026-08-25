import { test, expect } from '@playwright/test';

test('Full type-specific editor flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create a TODO with notes
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'Editor Flow Todo', notes: 'Original todo notes', status: 'incomplete' },
    headers
  });
  const todoId = (await todoResp.json()).data.id;
  console.log('1. Created todo:', todoId);

  // Create a TASK with notes (same field structure as todo)
  const taskResp = await page.request.post('/api/tasks', {
    data: { title: 'Editor Flow Task', notes: 'Original task notes' },
    headers
  });
  const taskId = (await taskResp.json()).data.id;
  console.log('2. Created task:', taskId);

  // Create a work item
  const workResp = await page.request.post('/api/dailies', {
    data: { title: 'Editor Flow Test Item', date: '2026-08-14' },
    headers
  });
  const dailyId = (await workResp.json()).data.id;
  console.log('3. Created work item:', dailyId);

  // Associate both
  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });
  await page.request.post(`/api/dailies/${dailyId}/tasks/${taskId}`, { headers });
  console.log('4. Associated items');

  // Reload
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Find our work item and expand it
  const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  let ourWorkItem = null;
  for (const wi of workItems) {
    const title = await wi.locator('.work-item-title').first().textContent();
    if (title?.includes('Editor Flow Test Item')) {
      ourWorkItem = wi;
      break;
    }
  }
  expect(ourWorkItem).toBeTruthy();

  const expandBtn = ourWorkItem.locator('[data-action="toggle-expand"]');
  await expandBtn.click();
  await page.waitForTimeout(500);

  // Test 1: Click TODO row and check field visibility
  console.log('\n=== TEST 1: TODO Type-Specific Fields ===');
  const todoRow = ourWorkItem.locator(`.child-item-row[data-work-id="${todoId}"]`);
  expect(await todoRow.isVisible()).toBeTruthy();

  await todoRow.click();
  await page.waitForTimeout(500);

  const editorPane = page.locator('#childItemEditorPane');
  expect(await editorPane.isVisible()).toBeTruthy();

  const notesField = page.locator('#childItemEditorNotesField');
  const statusField = page.locator('#childItemEditorStatusField');
  const descField = page.locator('#childItemEditorDescriptionField');
  const yearField = page.locator('#childItemEditorYearField');

  const notesVisible = await notesField.evaluate(el => el.style.display !== 'none');
  const statusVisible = await statusField.evaluate(el => el.style.display !== 'none');
  const descVisible = await descField.evaluate(el => el.style.display !== 'none');
  const yearVisible = await yearField.evaluate(el => el.style.display !== 'none');

  expect(notesVisible).toBe(true);
  expect(statusVisible).toBe(true);
  expect(descVisible).toBe(false);
  expect(yearVisible).toBe(false);
  console.log('✅ Todo shows: notes, status (not desc, year)');

  // Check if data populated
  const notesValue = await page.locator('#childItemEditorNotes').inputValue();
  const statusValue = await page.locator('#childItemEditorStatus').inputValue();
  console.log('Notes populated:', notesValue === 'Original todo notes');
  console.log('Status populated:', statusValue === 'incomplete');

  // Test 2: Click TASK row and check same fields as TODO (both have notes + status)
  console.log('\n=== TEST 2: TASK Type-Specific Fields ===');
  const taskRow = ourWorkItem.locator(`.child-item-row[data-work-id="${taskId}"]`);
  expect(await taskRow.isVisible()).toBeTruthy();

  await taskRow.click();
  await page.waitForTimeout(500);

  const notesVisible2 = await notesField.evaluate(el => el.style.display !== 'none');
  const statusVisible2 = await statusField.evaluate(el => el.style.display !== 'none');
  const descVisible2 = await descField.evaluate(el => el.style.display !== 'none');
  const yearVisible2 = await yearField.evaluate(el => el.style.display !== 'none');

  expect(notesVisible2).toBe(true);
  expect(statusVisible2).toBe(true);
  expect(descVisible2).toBe(false);
  expect(yearVisible2).toBe(false);
  console.log('✅ Task shows: notes, status (not desc, year)');

  // Check if task data populated
  const taskNotesValue = await page.locator('#childItemEditorNotes').inputValue();
  console.log('Task notes populated:', taskNotesValue === 'Original task notes');

  // Test 3: Edit and save todo
  console.log('\n=== TEST 3: Edit and Save ===');
  await todoRow.click();
  await page.waitForTimeout(500);

  const notesInput = page.locator('#childItemEditorNotes');
  const statusInput = page.locator('#childItemEditorStatus');
  const saveBtn = page.locator('#saveChildItemEditorBtn');

  await notesInput.fill('UPDATED NOTES FROM EDITOR');
  await statusInput.selectOption('complete');

  // Save button should now be enabled
  expect(await saveBtn.isEnabled()).toBe(true);
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Verify API was updated
  const fetchResp = await page.request.get(`/api/to-dos/${todoId}`);
  const fetchData = await fetchResp.json();
  expect(fetchData.data.notes).toBe('UPDATED NOTES FROM EDITOR');
  expect(fetchData.data.status).toBe('complete');
  console.log('✅ Todo saved with updated notes and status');

  console.log('\n✅ ALL TESTS PASSED!');
});
