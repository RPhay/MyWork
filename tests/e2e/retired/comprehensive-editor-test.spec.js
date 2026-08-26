import { test, expect } from '@playwright/test';

test('Comprehensive child item editor test - REAL USER FLOW', async ({ page }) => {
  // Start fresh
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  console.log('\n========== SETUP ==========\n');

  // Create TODO
  const todoResp = await page.request.post('/api/to-dos', {
    data: {
      title: 'COMPREHENSIVE_TEST_TODO_' + Date.now(),
      notes: 'ORIGINAL_TODO_NOTES_HERE',
      status: 'incomplete'
    },
    headers
  });
  const todoData = (await todoResp.json()).data;
  const todoId = todoData.id;
  console.log(`✓ Created TODO: ID=${todoId}, title="${todoData.title}", notes="${todoData.notes}"`);

  // Create PRIORITY
  const priorityResp = await page.request.post('/api/priorities', {
    data: {
      title: 'COMPREHENSIVE_TEST_PRIORITY_' + Date.now(),
      description: 'ORIGINAL_PRIORITY_DESC_HERE'
    },
    headers
  });
  const priorityData = (await priorityResp.json()).data;
  const priorityId = priorityData.id;
  console.log(`✓ Created PRIORITY: ID=${priorityId}, title="${priorityData.title}", description="${priorityData.description}"`);

  // Create WORK ITEM
  const workResp = await page.request.post('/api/dailies', {
    data: {
      title: 'COMPREHENSIVE_TEST_WORK_' + Date.now(),
      date: '2026-08-14'
    },
    headers
  });
  const workData = (await workResp.json()).data;
  const dailyId = workData.id;
  console.log(`✓ Created WORK ITEM: ID=${dailyId}, title="${workData.title}"`);

  // Associate
  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });
  await page.request.post(`/api/dailies/${dailyId}/priorities/${priorityId}`, { headers });
  console.log(`✓ Associated TODO and PRIORITY to work item`);

  console.log('\n========== LOAD PAGE ==========\n');

  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Page reloaded and loaded');

  console.log('\n========== FIND WORK ITEM ==========\n');

  // Find our work item
  const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  console.log(`Found ${workItems.length} work items on page`);

  let targetWorkItem = null;
  for (const wi of workItems) {
    const title = await wi.locator('.work-item-title').first().textContent();
    if (title?.includes('COMPREHENSIVE_TEST_WORK_')) {
      targetWorkItem = wi;
      console.log(`✓ Found our work item: "${title}"`);
      break;
    }
  }

  if (!targetWorkItem) {
    console.log('❌ ERROR: Could not find our work item!');
    process.exit(1);
  }

  console.log('\n========== EXPAND WORK ITEM ==========\n');

  // Expand
  const expandToggle = targetWorkItem.locator('[data-action="toggle-expand"]');
  console.log('Clicking expand toggle...');
  await expandToggle.click();
  await page.waitForTimeout(1500);

  // Check for child items
  const childRows = await targetWorkItem.locator('.child-item-row').all();
  console.log(`✓ Found ${childRows.length} child items after expand`);

  for (const row of childRows) {
    const type = await row.getAttribute('data-item-type');
    const id = await row.getAttribute('data-work-id');
    const title = await row.locator('.work-item-title').textContent();
    console.log(`  - ${type}/${id}: "${title}"`);
  }

  console.log('\n========== TEST 1: CLICK TODO ROW ==========\n');

  const todoRow = await targetWorkItem.locator(`.child-item-row[data-item-type="todo"]`).first();
  const todoVisible = await todoRow.isVisible().catch(() => false);

  if (!todoVisible) {
    console.log('❌ ERROR: TODO row not visible!');
    process.exit(1);
  }

  console.log('Clicking TODO row...');
  await todoRow.click();
  await page.waitForTimeout(1000);

  // Check if editor pane is visible
  const editorPane = page.locator('#childItemEditorPane');
  const editorVisible = await editorPane.isVisible();
  console.log(`✓ Editor pane visible: ${editorVisible}`);

  if (!editorVisible) {
    console.log('❌ ERROR: Editor pane is not visible!');
    process.exit(1);
  }

  // Check field visibility
  const notesField = page.locator('#childItemEditorNotesField');
  const statusField = page.locator('#childItemEditorStatusField');
  const descField = page.locator('#childItemEditorDescriptionField');
  const yearField = page.locator('#childItemEditorYearField');

  const notesDisplay = await notesField.evaluate(el => window.getComputedStyle(el).display);
  const statusDisplay = await statusField.evaluate(el => window.getComputedStyle(el).display);
  const descDisplay = await descField.evaluate(el => window.getComputedStyle(el).display);
  const yearDisplay = await yearField.evaluate(el => window.getComputedStyle(el).display);

  console.log('Field visibility (computed style):');
  console.log(`  Notes: ${notesDisplay} (should be "block")`);
  console.log(`  Status: ${statusDisplay} (should be "block")`);
  console.log(`  Description: ${descDisplay} (should be "none")`);
  console.log(`  Year: ${yearDisplay} (should be "none")`);

  if (notesDisplay !== 'block' || statusDisplay !== 'block') {
    console.log('❌ ERROR: TODO fields are not showing correctly!');
  }
  if (descDisplay !== 'none' || yearDisplay !== 'none') {
    console.log('❌ ERROR: Wrong fields are showing for TODO!');
  }

  // Check if data populated
  const notesInput = page.locator('#childItemEditorNotes');
  const statusSelect = page.locator('#childItemEditorStatus');
  const titleInput = page.locator('#childItemEditorTitle');

  const notesValue = await notesInput.inputValue();
  const statusValue = await statusSelect.inputValue();
  const titleValue = await titleInput.inputValue();

  console.log('\nField values:');
  console.log(`  Title: "${titleValue}"`);
  console.log(`  Notes: "${notesValue}"`);
  console.log(`  Status: "${statusValue}"`);

  if (notesValue !== 'ORIGINAL_TODO_NOTES_HERE') {
    console.log(`❌ ERROR: Notes not populated! Expected "ORIGINAL_TODO_NOTES_HERE", got "${notesValue}"`);
  }

  console.log('\n========== TEST 2: CLICK PRIORITY ROW ==========\n');

  const priorityRow = await targetWorkItem.locator(`.child-item-row[data-item-type="priority"]`).first();
  const priorityVisible = await priorityRow.isVisible().catch(() => false);

  if (!priorityVisible) {
    console.log('❌ ERROR: PRIORITY row not visible!');
    process.exit(1);
  }

  console.log('Clicking PRIORITY row...');
  await priorityRow.click();
  await page.waitForTimeout(1000);

  // Check fields for priority
  const notesDisplay2 = await notesField.evaluate(el => window.getComputedStyle(el).display);
  const statusDisplay2 = await statusField.evaluate(el => window.getComputedStyle(el).display);
  const descDisplay2 = await descField.evaluate(el => window.getComputedStyle(el).display);

  console.log('Field visibility for PRIORITY:');
  console.log(`  Notes: ${notesDisplay2} (should be "none")`);
  console.log(`  Status: ${statusDisplay2} (should be "none")`);
  console.log(`  Description: ${descDisplay2} (should be "block")`);

  if (notesDisplay2 !== 'none' || statusDisplay2 !== 'none') {
    console.log('❌ ERROR: Wrong fields showing for PRIORITY!');
  }
  if (descDisplay2 !== 'block') {
    console.log('❌ ERROR: Description field not showing for PRIORITY!');
  }

  const descInput = page.locator('#childItemEditorDescription');
  const descValue = await descInput.inputValue();
  console.log(`  Description value: "${descValue}"`);

  if (descValue !== 'ORIGINAL_PRIORITY_DESC_HERE') {
    console.log(`❌ ERROR: Description not populated! Expected "ORIGINAL_PRIORITY_DESC_HERE", got "${descValue}"`);
  }

  console.log('\n========== TEST 3: EDIT AND SAVE ==========\n');

  // Click TODO again
  await todoRow.click();
  await page.waitForTimeout(800);

  console.log('Editing TODO...');

  // Change notes
  await notesInput.fill('EDITED_NOTES_NEW_VALUE');
  console.log(`✓ Changed notes to "EDITED_NOTES_NEW_VALUE"`);

  // Change status
  await statusSelect.selectOption('complete');
  console.log(`✓ Changed status to "complete"`);

  // Check if save button is enabled
  const saveBtn = page.locator('#saveChildItemEditorBtn');
  const saveEnabled = await saveBtn.isEnabled();
  console.log(`✓ Save button enabled: ${saveEnabled}`);

  if (!saveEnabled) {
    console.log('❌ ERROR: Save button is not enabled!');
    process.exit(1);
  }

  // Click save
  console.log('Clicking save...');
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Verify API was updated
  const verifyResp = await page.request.get(`/api/to-dos/${todoId}`);
  const verifyData = (await verifyResp.json()).data;

  console.log('Verifying API changes:');
  console.log(`  Saved notes: "${verifyData.notes}"`);
  console.log(`  Saved status: "${verifyData.status}"`);

  if (verifyData.notes === 'EDITED_NOTES_NEW_VALUE') {
    console.log('✅ Notes saved correctly');
  } else {
    console.log(`❌ ERROR: Notes not saved! Expected "EDITED_NOTES_NEW_VALUE", got "${verifyData.notes}"`);
  }

  if (verifyData.status === 'complete') {
    console.log('✅ Status saved correctly');
  } else {
    console.log(`❌ ERROR: Status not saved! Expected "complete", got "${verifyData.status}"`);
  }

  console.log('\n========== SUMMARY ==========\n');
  console.log('✅ All tests completed. Check output above for any ❌ errors.');
});

test('Check console for save errors', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Collect console messages
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};

  // Create TODO
  const todoResp = await page.request.post('/api/to-dos', {
    data: { title: 'Console Test Todo', notes: 'Original', status: 'incomplete' },
    headers
  });
  const todoId = (await todoResp.json()).data.id;

  // Create work item and associate
  const workResp = await page.request.post('/api/dailies', {
    data: { title: 'Console Test Work', date: '2026-08-14' },
    headers
  });
  const dailyId = (await workResp.json()).data.id;

  await page.request.post(`/api/dailies/${dailyId}/todos/${todoId}`, { headers });

  // Reload and find work item
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  let targetWI = null;
  for (const wi of workItems) {
    const title = await wi.locator('.work-item-title').first().textContent();
    if (title?.includes('Console Test Work')) {
      targetWI = wi;
      break;
    }
  }

  if (!targetWI) return;

  // Expand and click todo
  await targetWI.locator('[data-action="toggle-expand"]').click();
  await page.waitForTimeout(800);

  const todoRow = targetWI.locator('.child-item-row[data-item-type="todo"]').first();
  await todoRow.click();
  await page.waitForTimeout(600);

  // Edit and save
  await page.locator('#childItemEditorNotes').fill('NEW NOTES VALUE');
  await page.locator('#saveChildItemEditorBtn').click();
  await page.waitForTimeout(2000);

  // Print console logs
  console.log('\n=== CONSOLE LOGS ===\n');
  for (const log of logs) {
    if (log.includes('Save') || log.includes('Error') || log.includes('Response')) {
      console.log(log);
    }
  }
});
