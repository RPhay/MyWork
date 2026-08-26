import { test, expect } from '@playwright/test';

test('Manual nesting via API', async ({ page }) => {
  // First, go to the page to get CSRF token
  await page.goto('http://localhost:3000?tab=todos');
  await page.waitForSelector('[name="_csrf"]');

  // Get CSRF token
  const csrfToken = await page.getAttribute('[name="_csrf"]', 'value');
  console.log('CSRF token:', csrfToken);

  // Create parent todo via API
  const parentRes = await page.request.post('http://localhost:3000/api/to-dos', {
    headers: {
      'X-CSRF-Token': csrfToken
    },
    data: { title: 'Parent Todo', notes: '' }
  });
  const parentData = await parentRes.json();
  const parentId = parentData.data.id;
  console.log('Created parent:', parentId);

  // Create child todo via API
  const childRes = await page.request.post('http://localhost:3000/api/to-dos', {
    headers: {
      'X-CSRF-Token': csrfToken
    },
    data: { title: 'Child Todo', notes: '', parent_id: parentId }
  });
  const childData = await childRes.json();
  const childId = childData.data.id;
  console.log('Created child:', childId, 'with parent_id:', parentId);

  // Reload todos to see the new items
  await page.reload();
  await page.waitForSelector('#toDosList');
  await page.waitForTimeout(1000);

  // Screenshot BEFORE expand
  await page.screenshot({ path: '/tmp/manual-nesting-before.png' });

  // Check HTML structure
  const htmlBefore = await page.locator('#toDosList').innerHTML();
  console.log('Before expand - has expanded class:', htmlBefore.includes('class="todo-node expanded'));
  console.log('Before expand - has toggle for parent:', htmlBefore.includes(`data-todo-id="${parentId}"`) && htmlBefore.includes('todo-folder-toggle'));

  // Click expand toggle for parent
  const toggles = await page.locator(`[data-todo-id="${parentId}"] .todo-folder-toggle`).all();
  console.log('Found toggles for parent:', toggles.length);

  if (toggles.length > 0) {
    await toggles[0].click();
    await page.waitForTimeout(1000);
  }

  // Screenshot AFTER expand
  await page.screenshot({ path: '/tmp/manual-nesting-after.png' });

  // Check HTML structure after expand
  const htmlAfter = await page.locator('#toDosList').innerHTML();
  console.log('After expand - has expanded class:', htmlAfter.includes('class="todo-node expanded'));
  console.log('After expand - has children div:', htmlAfter.includes('todo-node-children'));

  // Check if child is visible
  const childVisible = await page.locator(`text=Child Todo`).isVisible();
  console.log('Child todo visible:', childVisible);
});
