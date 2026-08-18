# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-render-our-item.spec.js >> Check if OUR todo renders after association
- Location: tests/e2e/test-render-our-item.spec.js:3:1

# Error details

```
Error: page.goto: net::ERR_EMPTY_RESPONSE at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1  | import { test } from '@playwright/test';
  2  | 
  3  | test('Check if OUR todo renders after association', async ({ page }) => {
> 4  |   await page.goto('http://localhost:3000');
     |              ^ Error: page.goto: net::ERR_EMPTY_RESPONSE at http://localhost:3000/
  5  |   await page.waitForLoadState('networkidle');
  6  | 
  7  |   const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  8  |   const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  9  | 
  10 |   // Create a todo
  11 |   const todoResp = await page.request.post('/api/to-dos', {
  12 |     data: { title: 'OUR UNIQUE TODO TITLE 12345', notes: 'Our unique notes' },
  13 |     headers
  14 |   });
  15 |   const todoData = await todoResp.json();
  16 |   const todoId = todoData.data.id;
  17 |   console.log('Created our unique todo:', todoId);
  18 | 
  19 |   // Create work item
  20 |   const workResp = await page.request.post('/api/work', {
  21 |     data: { title: 'OUR UNIQUE WORK ITEM 12345', date: '2026-08-14' },
  22 |     headers
  23 |   });
  24 |   const workData = await workResp.json();
  25 |   const workItemId = workData.data.id;
  26 |   console.log('Created our unique work item:', workItemId);
  27 | 
  28 |   // Associate
  29 |   await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  30 |   console.log('Associated todo to work item');
  31 | 
  32 |   // Reload
  33 |   await page.reload();
  34 |   await page.waitForLoadState('networkidle');
  35 |   await page.waitForTimeout(1000);
  36 | 
  37 |   // Find and expand OUR work item (not just the first one)
  38 |   const workItemRows = await page.locator('.work-item:not(.child-item-row)').all();
  39 |   console.log(`Found ${workItemRows.length} work items`);
  40 | 
  41 |   let ourWorkItemRow = null;
  42 |   for (const row of workItemRows) {
  43 |     const title = await row.locator('.work-item-title').first().textContent();
  44 |     console.log(`  Work item: ${title}`);
  45 |     if (title?.includes('OUR UNIQUE WORK ITEM')) {
  46 |       ourWorkItemRow = row;
  47 |       break;
  48 |     }
  49 |   }
  50 | 
  51 |   if (!ourWorkItemRow) {
  52 |     console.log('ERROR: Could not find our work item!');
  53 |     return;
  54 |   }
  55 | 
  56 |   console.log('\nExpanding our work item...');
  57 |   const expandBtn = ourWorkItemRow.locator('[data-action="toggle-expand"]');
  58 |   await expandBtn.click();
  59 |   await page.waitForTimeout(1000);
  60 | 
  61 |   // Check if our todo appears
  62 |   const childRows = await ourWorkItemRow.locator('.child-item-row').all();
  63 |   console.log(`Found ${childRows.length} child items in our work item`);
  64 | 
  65 |   let foundOurTodo = false;
  66 |   for (const row of childRows) {
  67 |     const title = await row.locator('.work-item-title').textContent();
  68 |     const type = await row.getAttribute('data-item-type');
  69 |     const workId = await row.getAttribute('data-work-id');
  70 |     console.log(`  ${type}/${workId}: ${title}`);
  71 | 
  72 |     if (workId === String(todoId)) {
  73 |       foundOurTodo = true;
  74 |       console.log('  ^^^ THIS IS OUR TODO!');
  75 |     }
  76 |   }
  77 | 
  78 |   if (foundOurTodo) {
  79 |     console.log('\n✅ SUCCESS: Our todo is rendered!');
  80 |   } else {
  81 |     console.log('\n❌ FAIL: Our todo is NOT rendered!');
  82 |     console.log(`Expected to find todo ID ${todoId}`);
  83 |   }
  84 | });
  85 | 
```