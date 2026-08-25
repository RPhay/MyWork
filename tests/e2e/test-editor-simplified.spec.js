import { test, expect } from '@playwright/test';

test('Type-specific editor shows correct fields', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create fresh todo and task
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'Fresh Test Todo', notes: 'Test notes', status: 'incomplete' },
    headers
  });
  const todoId = (await todoResp.json()).data.id;

  const taskResp = await page.request.post('/api/tasks', {
    data: { title: 'Fresh Test Task', notes: 'Task notes' },
    headers
  });
  const taskId = (await taskResp.json()).data.id;

  const priorityResp = await page.request.post('/api/priorities', {
    data: { title: 'Fresh Test Priority', description: 'Priority desc' },
    headers
  });
  const priorityId = (await priorityResp.json()).data.id;

  // Create work item and associate
  const workResp = await page.request.post('/api/dailies', {
    data: { title: 'Fresh Test Item', date: '2026-08-14' },
    headers
  });
  const dailyId = (await workResp.json()).data.id;

  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });
  await page.request.post(`/api/dailies/${dailyId}/tasks/${taskId}`, { headers });
  await page.request.post(`/api/dailies/${dailyId}/priorities/${priorityId}`, { headers });

  // Reload and expand
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  let ourWorkItem = null;
  for (const wi of workItems) {
    const title = await wi.locator('.work-item-title').first().textContent();
    if (title?.includes('Fresh Test Item')) {
      ourWorkItem = wi;
      break;
    }
  }
  expect(ourWorkItem).toBeTruthy('Our work item should exist');

  // Expand
  await ourWorkItem.locator('[data-action="toggle-expand"]').click();
  await page.waitForTimeout(800);

  // Find the child rows we just created
  const todoRow = ourWorkItem.locator(`.child-item-row[data-work-id="${todoId}"]`);
  const taskRow = ourWorkItem.locator(`.child-item-row[data-work-id="${taskId}"]`);
  const priorityRow = ourWorkItem.locator(`.child-item-row[data-work-id="${priorityId}"]`);

  expect(await todoRow.isVisible()).toBe(true);
  expect(await taskRow.isVisible()).toBe(true);
  expect(await priorityRow.isVisible()).toBe(true);

  // Test TODO editor
  console.log('Testing TODO editor...');
  await todoRow.click();
  await page.waitForTimeout(400);

  let notesVisible = await page.locator('#childItemEditorNotesField').evaluate(el => el.style.display !== 'none');
  let statusVisible = await page.locator('#childItemEditorStatusField').evaluate(el => el.style.display !== 'none');
  let descVisible = await page.locator('#childItemEditorDescriptionField').evaluate(el => el.style.display !== 'none');

  expect(notesVisible).toBe(true);
  expect(statusVisible).toBe(true);
  expect(descVisible).toBe(false);
  console.log('✅ TODO: notes and status visible');

  // Test TASK editor (should be same as TODO)
  console.log('Testing TASK editor...');
  await taskRow.click();
  await page.waitForTimeout(400);

  notesVisible = await page.locator('#childItemEditorNotesField').evaluate(el => el.style.display !== 'none');
  statusVisible = await page.locator('#childItemEditorStatusField').evaluate(el => el.style.display !== 'none');
  descVisible = await page.locator('#childItemEditorDescriptionField').evaluate(el => el.style.display !== 'none');

  expect(notesVisible).toBe(true);
  expect(statusVisible).toBe(true);
  expect(descVisible).toBe(false);
  console.log('✅ TASK: notes and status visible');

  // Test PRIORITY editor (should show description only)
  console.log('Testing PRIORITY editor...');
  await priorityRow.click();
  await page.waitForTimeout(400);

  notesVisible = await page.locator('#childItemEditorNotesField').evaluate(el => el.style.display !== 'none');
  statusVisible = await page.locator('#childItemEditorStatusField').evaluate(el => el.style.display !== 'none');
  descVisible = await page.locator('#childItemEditorDescriptionField').evaluate(el => el.style.display !== 'none');

  expect(notesVisible).toBe(false);
  expect(statusVisible).toBe(false);
  expect(descVisible).toBe(true);
  console.log('✅ PRIORITY: description visible (not notes/status)');

  console.log('\n✅ All type-specific field tests passed!');
});
