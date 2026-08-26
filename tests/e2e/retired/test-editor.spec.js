import { test, expect } from '@playwright/test';

test('Test type-specific editor field display', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Create test data
  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create a todo
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'Test Todo for Editor' },
    headers
  });
  const todoData = await todoResp.json();
  const todoId = todoData.data.id;
  console.log('Created todo:', todoId);

  // Create a task
  const taskResp = await page.request.post('/api/tasks', {
    data: { title: 'Test Task for Editor' },
    headers
  });
  const taskData = await taskResp.json();
  const taskId = taskData.data.id;
  console.log('Created task:', taskId);

  // Create a priority/goal
  const priorityResp = await page.request.post('/api/priorities', {
    data: { title: 'Test Priority for Editor' },
    headers
  });
  const priorityData = await priorityResp.json();
  const priorityId = priorityData.data.id;
  console.log('Created priority:', priorityId);

  // Create a work item
  const workResp = await page.request.post('/api/dailies', {
    data: { title: 'Test Work Item Editor', date: '2026-08-14' },
    headers
  });
  const workData = await workResp.json();
  const dailyId = workData.data.id;
  console.log('Created work item:', dailyId);

  // Associate items
  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });
  await page.request.post(`/api/dailies/${dailyId}/tasks/${taskId}`, { headers });
  await page.request.post(`/api/dailies/${dailyId}/priorities/${priorityId}`, { headers });

  // Reload and expand work item
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const expandToggle = page.locator('.work-item-toggle').first();
  await expandToggle.click();
  await page.waitForTimeout(500);

  // Test 1: Click on a todo row
  console.log('\n=== Testing Todo Editor ===');
  const todoRow = page.locator('.child-item-row[data-item-type="todo"]').first();
  const todoVisible = await todoRow.isVisible().catch(() => false);
  console.log('Todo row visible:', todoVisible);

  if (todoVisible) {
    await todoRow.click();
    await page.waitForTimeout(500);

    // Check if editor pane is visible
    const editorPane = page.locator('#childItemEditorPane');
    const editorVisible = await editorPane.isVisible();
    console.log('Editor pane visible:', editorVisible);

    if (editorVisible) {
      // Check which fields are visible
      const notesField = page.locator('#childItemEditorNotesField');
      const statusField = page.locator('#childItemEditorStatusField');
      const descField = page.locator('#childItemEditorDescriptionField');
      const yearField = page.locator('#childItemEditorYearField');

      const notesVisible = await notesField.evaluate(el => el.style.display !== 'none');
      const statusVisible = await statusField.evaluate(el => el.style.display !== 'none');
      const descVisible = await descField.evaluate(el => el.style.display !== 'none');
      const yearVisible = await yearField.evaluate(el => el.style.display !== 'none');

      console.log('Notes field visible:', notesVisible, '(should be true for todo)');
      console.log('Status field visible:', statusVisible, '(should be true for todo)');
      console.log('Description field visible:', descVisible, '(should be false for todo)');
      console.log('Year field visible:', yearVisible, '(should be false for todo)');
    }
  }

  // Test 2: Click on a task row
  console.log('\n=== Testing Task Editor ===');
  const taskRow = page.locator('.child-item-row[data-item-type="task"]').first();
  const taskVisible = await taskRow.isVisible().catch(() => false);
  console.log('Task row visible:', taskVisible);

  if (taskVisible) {
    await taskRow.click();
    await page.waitForTimeout(500);

    // Check which fields are visible
    const notesField = page.locator('#childItemEditorNotesField');
    const statusField = page.locator('#childItemEditorStatusField');
    const descField = page.locator('#childItemEditorDescriptionField');
    const yearField = page.locator('#childItemEditorYearField');

    const notesVisible = await notesField.evaluate(el => el.style.display !== 'none');
    const statusVisible = await statusField.evaluate(el => el.style.display !== 'none');
    const descVisible = await descField.evaluate(el => el.style.display !== 'none');
    const yearVisible = await yearField.evaluate(el => el.style.display !== 'none');

    console.log('Notes field visible:', notesVisible, '(should be true for task)');
    console.log('Status field visible:', statusVisible, '(should be true for task)');
    console.log('Description field visible:', descVisible, '(should be false for task)');
    console.log('Year field visible:', yearVisible, '(should be false for task)');
  }

  // Test 3: Click on a priority row
  console.log('\n=== Testing Priority Editor ===');
  const priorityRow = page.locator('.child-item-row[data-item-type="priority"]').first();
  const priorityVisible = await priorityRow.isVisible().catch(() => false);
  console.log('Priority row visible:', priorityVisible);

  if (priorityVisible) {
    await priorityRow.click();
    await page.waitForTimeout(500);

    // Check which fields are visible
    const notesField = page.locator('#childItemEditorNotesField');
    const statusField = page.locator('#childItemEditorStatusField');
    const descField = page.locator('#childItemEditorDescriptionField');
    const yearField = page.locator('#childItemEditorYearField');

    const notesVisible = await notesField.evaluate(el => el.style.display !== 'none');
    const statusVisible = await statusField.evaluate(el => el.style.display !== 'none');
    const descVisible = await descField.evaluate(el => el.style.display !== 'none');
    const yearVisible = await yearField.evaluate(el => el.style.display !== 'none');

    console.log('Notes field visible:', notesVisible, '(should be false for priority)');
    console.log('Status field visible:', statusVisible, '(should be false for priority)');
    console.log('Description field visible:', descVisible, '(should be true for priority)');
    console.log('Year field visible:', yearVisible, '(should be false for priority)');
  }
});
