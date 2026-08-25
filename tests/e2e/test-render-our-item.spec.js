import { test } from '@playwright/test';

test('Check if OUR todo renders after association', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create a todo
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'OUR UNIQUE TODO TITLE 12345', notes: 'Our unique notes' },
    headers
  });
  const todoData = await todoResp.json();
  const todoId = todoData.data.id;
  console.log('Created our unique todo:', todoId);

  // Create work item
  const workResp = await page.request.post('/api/dailies', {
    data: { title: 'OUR UNIQUE WORK ITEM 12345', date: '2026-08-14' },
    headers
  });
  const workData = await workResp.json();
  const dailyId = workData.data.id;
  console.log('Created our unique work item:', dailyId);

  // Associate
  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });
  console.log('Associated todo to work item');

  // Reload
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Find and expand OUR work item (not just the first one)
  const workItemRows = await page.locator('.work-item:not(.child-item-row)').all();
  console.log(`Found ${workItemRows.length} work items`);

  let ourWorkItemRow = null;
  for (const row of workItemRows) {
    const title = await row.locator('.work-item-title').first().textContent();
    console.log(`  Work item: ${title}`);
    if (title?.includes('OUR UNIQUE WORK ITEM')) {
      ourWorkItemRow = row;
      break;
    }
  }

  if (!ourWorkItemRow) {
    console.log('ERROR: Could not find our work item!');
    return;
  }

  console.log('\nExpanding our work item...');
  const expandBtn = ourWorkItemRow.locator('[data-action="toggle-expand"]');
  await expandBtn.click();
  await page.waitForTimeout(1000);

  // Check if our todo appears
  const childRows = await ourWorkItemRow.locator('.child-item-row').all();
  console.log(`Found ${childRows.length} child items in our work item`);

  let foundOurTodo = false;
  for (const row of childRows) {
    const title = await row.locator('.work-item-title').textContent();
    const type = await row.getAttribute('data-item-type');
    const dailyId = await row.getAttribute('data-work-id');
    console.log(`  ${type}/${dailyId}: ${title}`);

    if (dailyId === String(todoId)) {
      foundOurTodo = true;
      console.log('  ^^^ THIS IS OUR TODO!');
    }
  }

  if (foundOurTodo) {
    console.log('\n✅ SUCCESS: Our todo is rendered!');
  } else {
    console.log('\n❌ FAIL: Our todo is NOT rendered!');
    console.log(`Expected to find todo ID ${todoId}`);
  }
});
