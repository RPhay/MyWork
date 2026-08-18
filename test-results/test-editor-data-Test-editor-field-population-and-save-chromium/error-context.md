# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-editor-data.spec.js >> Test editor field population and save
- Location: tests/e2e/test-editor-data.spec.js:3:1

# Error details

```
TypeError: Cannot read properties of undefined (reading 'id')
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.07.28.0" [ref=e4] [cursor=pointer]:
        - /url: /
      - generic [ref=e5]:
        - button "  Default" [ref=e6] [cursor=pointer]:
          - generic [ref=e7]: 
          - generic [ref=e8]:
            - generic [ref=e9]: 
            - text: Default
        - text: 
      - link "Settings" [ref=e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e11]: 
  - generic [ref=e12]:
    - tablist [ref=e13]:
      - tab "⭐ Dailies" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: ⭐
        - text: Dailies
      - tab "📌 Projects" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 📌
        - text: Projects
      - tab "📂 Categories" [ref=e18] [cursor=pointer]:
        - generic [ref=e19]: 📂
        - text: Categories
      - tab "🎯 Goals" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 🎯
        - text: Goals
      - tab "☑ Todos" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: ☑
        - text: Todos
      - tab "📋 Tasks" [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: 📋
        - text: Tasks
      - tab "🎫 Tickets" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: 🎫
        - text: Tickets
      - tab "💡 Brainstorming" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: 💡
        - text: Brainstorming
      - tab "📑 Templates" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: 📑
        - text: Templates
      - tab "📊 Priorities" [ref=e32] [cursor=pointer]:
        - generic [ref=e33]: 📊
        - text: Priorities
      - tab "📈 Reporting" [ref=e34] [cursor=pointer]:
        - generic [ref=e35]: 📈
        - text: Reporting
    - generic: "                                                       Add notes here... Visit URL: EditRemove                                                                                                                                                                                                                           "
  - contentinfo [ref=e36]:
    - paragraph [ref=e38]: © 2026 MyWork. Licensed under the MIT License.
  - text:     
  - alert [ref=e40]:
    - text: "Error: A required database table is missing. Run the database setup script."
    - button "Close" [ref=e41] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Test editor field population and save', async ({ page }) => {
  4  |   await page.goto('http://localhost:3000');
  5  |   await page.waitForLoadState('networkidle');
  6  | 
  7  |   const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  8  |   const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  9  | 
  10 |   // Create a todo with notes
  11 |   const todoResp = await page.request.post('/api/to-dos', {
  12 |     data: { title: 'Todo with Notes', notes: 'Original notes' },
  13 |     headers
  14 |   });
  15 |   const todoData = await todoResp.json();
> 16 |   const todoId = todoData.data.id;
     |                                ^ TypeError: Cannot read properties of undefined (reading 'id')
  17 | 
  18 |   // Create work item
  19 |   const workResp = await page.request.post('/api/work', {
  20 |     data: { title: 'Test Work Item Data', date: '2026-08-14' },
  21 |     headers
  22 |   });
  23 |   const workData = await workResp.json();
  24 |   const workItemId = workData.data.id;
  25 | 
  26 |   // Associate
  27 |   await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  28 | 
  29 |   // Reload and expand
  30 |   await page.reload();
  31 |   await page.waitForLoadState('networkidle');
  32 |   await page.waitForTimeout(1000);
  33 | 
  34 |   const expandToggle = page.locator('.work-item-toggle').first();
  35 |   await expandToggle.click();
  36 |   await page.waitForTimeout(500);
  37 | 
  38 |   // Click todo row to open editor
  39 |   const todoRow = page.locator('.child-item-row[data-item-type="todo"]').first();
  40 |   await todoRow.click();
  41 |   await page.waitForTimeout(500);
  42 | 
  43 |   // Check if data populated
  44 |   const titleField = page.locator('#childItemEditorTitle');
  45 |   const notesField = page.locator('#childItemEditorNotes');
  46 |   const statusField = page.locator('#childItemEditorStatus');
  47 | 
  48 |   const titleValue = await titleField.inputValue();
  49 |   const notesValue = await notesField.inputValue();
  50 |   const statusValue = await statusField.inputValue();
  51 | 
  52 |   console.log('Editor data population:');
  53 |   console.log('Title:', titleValue, '(should be "Todo with Notes")');
  54 |   console.log('Notes:', notesValue, '(should be "Original notes")');
  55 |   console.log('Status:', statusValue, '(should be "incomplete")');
  56 | 
  57 |   // Test save
  58 |   console.log('\nTesting save...');
  59 |   await notesField.fill('Updated notes from editor');
  60 |   await statusField.selectOption('complete');
  61 | 
  62 |   const saveBtn = page.locator('#saveChildItemEditorBtn');
  63 |   await saveBtn.click();
  64 |   await page.waitForTimeout(2000);
  65 | 
  66 |   // Verify API was called
  67 |   const notificationVisible = await page.locator('.alert-success').isVisible({ timeout: 3000 }).catch(() => false);
  68 |   console.log('Save notification shown:', notificationVisible);
  69 | 
  70 |   // Fetch todo again to verify
  71 |   const verifyResp = await page.request.get(`/api/to-dos/${todoId}`);
  72 |   const verifyData = await verifyResp.json();
  73 |   console.log('Saved notes:', verifyData.data.notes);
  74 |   console.log('Saved status:', verifyData.data.status);
  75 |   console.log('Notes match:', verifyData.data.notes === 'Updated notes from editor');
  76 |   console.log('Status match:', verifyData.data.status === 'complete');
  77 | });
  78 | 
```