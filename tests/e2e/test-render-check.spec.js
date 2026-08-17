import { test } from '@playwright/test';

test('Check if child rows are rendered', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create a todo
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'TODO FOR RENDER TEST', notes: 'Render test notes' },
    headers
  });
  const todoData = await todoResp.json();
  const todoId = todoData.data.id;
  console.log('Created todo:', todoId);

  // Create work item
  const workResp = await page.request.post('/api/work', {
    data: { title: 'RENDER TEST Work Item', date: '2026-08-14' },
    headers
  });
  const workData = await workResp.json();
  const workItemId = workData.data.id;
  console.log('Created work item:', workItemId);

  // Associate
  await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  console.log('Associated todo to work item');

  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Expand work item
  const expandToggle = page.locator('.work-item-toggle').first();
  await expandToggle.click();
  await page.waitForTimeout(1000);

  // Check what child rows exist
  const childRows = await page.locator('.child-item-row').all();
  console.log(`\nFound ${childRows.length} child rows total`);

  // Check specifically for todo type rows
  const todoRows = await page.locator('.child-item-row[data-item-type="todo"]').all();
  console.log(`Found ${todoRows.length} TODO type rows`);

  // Get details of first todo row
  if (todoRows.length > 0) {
    const firstTodoRow = todoRows[0];
    const workId = await firstTodoRow.getAttribute('data-work-id');
    const itemType = await firstTodoRow.getAttribute('data-item-type');
    const title = await firstTodoRow.locator('.work-item-title').textContent();
    console.log(`First todo row: workId=${workId}, type=${itemType}, title=${title}`);
  }

  // List all child row data-work-ids
  console.log('\nAll child row IDs and types:');
  for (const row of childRows) {
    const workId = await row.getAttribute('data-work-id');
    const type = await row.getAttribute('data-item-type');
    const title = await row.locator('.work-item-title').textContent();
    console.log(`  ${type}/${workId}: ${title}`);
  }

  // Check if our specific todo is in the list
  const ourTodoRow = await page.locator(`.child-item-row[data-work-id="${todoId}"]`);
  const ourTodoExists = await ourTodoRow.isVisible().catch(() => false);
  console.log(`\nOur todo (${todoId}) rendered: ${ourTodoExists}`);
});
