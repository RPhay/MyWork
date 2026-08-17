import { test } from '@playwright/test';

test('Debug editor data loading', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create a todo with notes
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'Debug Todo', notes: 'Debug notes here' },
    headers
  });
  const todoData = await todoResp.json();
  const todoId = todoData.data.id;
  console.log('Created todo ID:', todoId);

  // Create work item
  const workResp = await page.request.post('/api/work', {
    data: { title: 'Debug Work Item', date: '2026-08-14' },
    headers
  });
  const workData = await workResp.json();
  const workItemId = workData.data.id;

  // Associate
  await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });

  // Reload and expand
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Listen for console logs
  page.on('console', msg => {
    if (msg.text().includes('loadChildItemForEditing') || msg.text().includes('Set notes')) {
      console.log('[PAGE LOG]', msg.text());
    }
  });

  const expandToggle = page.locator('.work-item-toggle').first();
  await expandToggle.click();
  await page.waitForTimeout(500);

  // Click todo row
  const todoRow = page.locator('.child-item-row[data-item-type="todo"]').first();
  console.log('Clicking todo row...');
  await todoRow.click();
  await page.waitForTimeout(1000);

  // Check field values
  const titleValue = await page.locator('#childItemEditorTitle').inputValue();
  const notesValue = await page.locator('#childItemEditorNotes').inputValue();

  console.log('Title:', titleValue);
  console.log('Notes:', notesValue);
});
