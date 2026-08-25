import { test, expect } from '@playwright/test';

test('Test editor field population and save', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create a todo with notes
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'Todo with Notes', notes: 'Original notes' },
    headers
  });
  const todoData = await todoResp.json();
  const todoId = todoData.data.id;

  // Create work item
  const workResp = await page.request.post('/api/dailies', {
    data: { title: 'Test Work Item Data', date: '2026-08-14' },
    headers
  });
  const workData = await workResp.json();
  const dailyId = workData.data.id;

  // Associate
  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });

  // Reload and expand
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const expandToggle = page.locator('.work-item-toggle').first();
  await expandToggle.click();
  await page.waitForTimeout(500);

  // Click todo row to open editor
  const todoRow = page.locator('.child-item-row[data-item-type="todo"]').first();
  await todoRow.click();
  await page.waitForTimeout(500);

  // Check if data populated
  const titleField = page.locator('#childItemEditorTitle');
  const notesField = page.locator('#childItemEditorNotes');
  const statusField = page.locator('#childItemEditorStatus');

  const titleValue = await titleField.inputValue();
  const notesValue = await notesField.inputValue();
  const statusValue = await statusField.inputValue();

  console.log('Editor data population:');
  console.log('Title:', titleValue, '(should be "Todo with Notes")');
  console.log('Notes:', notesValue, '(should be "Original notes")');
  console.log('Status:', statusValue, '(should be "incomplete")');

  // Test save
  console.log('\nTesting save...');
  await notesField.fill('Updated notes from editor');
  await statusField.selectOption('complete');

  const saveBtn = page.locator('#saveChildItemEditorBtn');
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Verify API was called
  const notificationVisible = await page.locator('.alert-success').isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Save notification shown:', notificationVisible);

  // Fetch todo again to verify
  const verifyResp = await page.request.get(`/api/to-dos/${todoId}`);
  const verifyData = await verifyResp.json();
  console.log('Saved notes:', verifyData.data.notes);
  console.log('Saved status:', verifyData.data.status);
  console.log('Notes match:', verifyData.data.notes === 'Updated notes from editor');
  console.log('Status match:', verifyData.data.status === 'complete');
});
