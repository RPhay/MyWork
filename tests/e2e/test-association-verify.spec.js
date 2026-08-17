import { test } from '@playwright/test';

test('Verify association actually worked', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create a todo with notes
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'NEW TODO FOR TESTING', notes: 'This is NEW notes' },
    headers
  });
  const todoData = await todoResp.json();
  const todoId = todoData.data.id;
  console.log('Created NEW todo ID:', todoId);
  console.log('Created TODO data:', JSON.stringify(todoData.data));

  // Create work item
  const workResp = await page.request.post('/api/work', {
    data: { title: 'NEW Work Item', date: '2026-08-14' },
    headers
  });
  const workData = await workResp.json();
  const workItemId = workData.data.id;
  console.log('Created NEW work item ID:', workItemId);

  // Associate the NEW todo to the NEW work item
  console.log(`\nAssociating TODO ${todoId} to WORK ITEM ${workItemId}...`);
  const assocResp = await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  const assocData = await assocResp.json();
  console.log('Association response:', JSON.stringify(assocData));

  // Now fetch the work item to see what todos it has
  const fetchResp = await page.request.get(`/api/work/${workItemId}`);
  const fetchData = await fetchResp.json();
  console.log('\nWork item after association:', JSON.stringify(fetchData.data, null, 2));
  console.log('Associated todos:', fetchData.data.todos);
  console.log('Todo IDs:', fetchData.data.todos?.map(t => t.id));
});
