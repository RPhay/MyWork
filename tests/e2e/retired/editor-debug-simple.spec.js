import { test } from '@playwright/test';

test('Debug: Check if child rows render', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  const todoId = (await (await page.request.post('/api/to-dos', {
    data: { title: 'DEBUG_TODO_' + Date.now(), notes: 'Notes' },
    headers
  })).json()).data.id;

  const dailyId = (await (await page.request.post('/api/dailies', {
    data: { title: 'DEBUG_WORK_' + Date.now(), date: '2026-08-14' },
    headers
  })).json()).data.id;

  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });

  console.log(`Created TODO ${todoId}, Work ${dailyId}`);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Find the work item on page
  const allWI = await page.locator('.work-item:not(.child-item-row)').count();
  console.log(`Total work items: ${allWI}`);

  const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  let targetWI = null;
  for (let i = 0; i < workItems.length; i++) {
    const title = await workItems[i].locator('.work-item-title').first().textContent();
    if (title?.includes('DEBUG_WORK_')) {
      targetWI = workItems[i];
      console.log(`Found our work item at index ${i}: "${title}"`);
      break;
    }
  }

  if (!targetWI) {
    console.log('ERROR: Could not find work item');
    return;
  }

  console.log('Expanding...');
  const toggleBtn = targetWI.locator('[data-action="toggle-expand"]');
  const toggleVisible = await toggleBtn.isVisible();
  console.log(`Toggle button visible: ${toggleVisible}`);

  if (toggleVisible) {
    await toggleBtn.click();
    await page.waitForTimeout(2000);
  }

  const childRowsBefore = await targetWI.locator('.child-item-row').count();
  console.log(`Child rows after expand: ${childRowsBefore}`);

  if (childRowsBefore > 0) {
    const firstChild = await targetWI.locator('.child-item-row').first();
    const childTitle = await firstChild.locator('.work-item-title').textContent();
    const childId = await firstChild.getAttribute('data-work-id');
    const childType = await firstChild.getAttribute('data-item-type');
    console.log(`First child: ${childType}/${childId} "${childTitle}"`);
  }

  console.log(`Looking for child with data-work-id="${todoId}"`);
  const specificChild = await targetWI.locator(`.child-item-row[data-work-id="${todoId}"]`);
  const specificExists = await specificChild.isVisible().catch(() => false);
  console.log(`Specific child found: ${specificExists}`);
});
