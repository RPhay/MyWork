# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-editor-debug.spec.js >> Debug editor data loading
- Location: tests/e2e/test-editor-debug.spec.js:3:1

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
  1  | import { test } from '@playwright/test';
  2  | 
  3  | test('Debug editor data loading', async ({ page }) => {
  4  |   await page.goto('http://localhost:3000');
  5  |   await page.waitForLoadState('networkidle');
  6  | 
  7  |   const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  8  |   const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  9  | 
  10 |   // Create a todo with notes
  11 |   const todoResp = await page.request.post('/api/to-dos', {
  12 |     data: { title: 'Debug Todo', notes: 'Debug notes here' },
  13 |     headers
  14 |   });
  15 |   const todoData = await todoResp.json();
> 16 |   const todoId = todoData.data.id;
     |                                ^ TypeError: Cannot read properties of undefined (reading 'id')
  17 |   console.log('Created todo ID:', todoId);
  18 | 
  19 |   // Create work item
  20 |   const workResp = await page.request.post('/api/work', {
  21 |     data: { title: 'Debug Work Item', date: '2026-08-14' },
  22 |     headers
  23 |   });
  24 |   const workData = await workResp.json();
  25 |   const workItemId = workData.data.id;
  26 | 
  27 |   // Associate
  28 |   await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  29 | 
  30 |   // Reload and expand
  31 |   await page.reload();
  32 |   await page.waitForLoadState('networkidle');
  33 |   await page.waitForTimeout(1000);
  34 | 
  35 |   // Listen for console logs
  36 |   page.on('console', msg => {
  37 |     if (msg.text().includes('loadChildItemForEditing') || msg.text().includes('Set notes')) {
  38 |       console.log('[PAGE LOG]', msg.text());
  39 |     }
  40 |   });
  41 | 
  42 |   const expandToggle = page.locator('.work-item-toggle').first();
  43 |   await expandToggle.click();
  44 |   await page.waitForTimeout(500);
  45 | 
  46 |   // Click todo row
  47 |   const todoRow = page.locator('.child-item-row[data-item-type="todo"]').first();
  48 |   console.log('Clicking todo row...');
  49 |   await todoRow.click();
  50 |   await page.waitForTimeout(1000);
  51 | 
  52 |   // Check field values
  53 |   const titleValue = await page.locator('#childItemEditorTitle').inputValue();
  54 |   const notesValue = await page.locator('#childItemEditorNotes').inputValue();
  55 | 
  56 |   console.log('Title:', titleValue);
  57 |   console.log('Notes:', notesValue);
  58 | });
  59 | 
```