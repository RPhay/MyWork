import { test } from '@playwright/test';
import { createTestWorkItem } from './setup-test-data.js';

test('Debug: Check API response after todo association', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Create a test todo
  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'Debug Todo' },
    headers
  });
  const todoData = await todoResp.json();
  const todoId = todoData.data.id;
  console.log('Created todo:', todoId);

  // Create a work item
  const workItem = await createTestWorkItem(page, 'Debug Association');
  const dailyId = workItem.id;
  console.log('Created work item:', dailyId);

  // Associate the todo
  const assocResp = await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, {
    headers
  });
  const assocData = await assocResp.json();
  console.log('Association response status:', assocResp.status());
  console.log('Association success:', assocData.success);
  console.log('Association data:', JSON.stringify(assocData.data, null, 2));

  // Check if todos array exists
  if (assocData.data) {
    console.log('Has todos property:', !!assocData.data.todos);
    console.log('Todos array:', assocData.data.todos);
    console.log('Todos count:', assocData.data.todos?.length || 0);
  }

  // Now fetch the work item directly
  const getResp = await page.request.get(`/api/dailies/${dailyId}`);
  const getData = await getResp.json();
  console.log('Fetched work item todos:', getData.data.todos);
  console.log('Fetched work item todos count:', getData.data.todos?.length || 0);
});
