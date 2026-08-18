# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-association-verify.spec.js >> Verify association actually worked
- Location: tests/e2e/test-association-verify.spec.js:3:1

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
  3  | test('Verify association actually worked', async ({ page }) => {
  4  |   await page.goto('http://localhost:3000');
  5  |   await page.waitForLoadState('networkidle');
  6  | 
  7  |   const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  8  |   const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  9  | 
  10 |   // Create a todo with notes
  11 |   const todoResp = await page.request.post('/api/to-dos', {
  12 |     data: { title: 'NEW TODO FOR TESTING', notes: 'This is NEW notes' },
  13 |     headers
  14 |   });
  15 |   const todoData = await todoResp.json();
> 16 |   const todoId = todoData.data.id;
     |                                ^ TypeError: Cannot read properties of undefined (reading 'id')
  17 |   console.log('Created NEW todo ID:', todoId);
  18 |   console.log('Created TODO data:', JSON.stringify(todoData.data));
  19 | 
  20 |   // Create work item
  21 |   const workResp = await page.request.post('/api/work', {
  22 |     data: { title: 'NEW Work Item', date: '2026-08-14' },
  23 |     headers
  24 |   });
  25 |   const workData = await workResp.json();
  26 |   const workItemId = workData.data.id;
  27 |   console.log('Created NEW work item ID:', workItemId);
  28 | 
  29 |   // Associate the NEW todo to the NEW work item
  30 |   console.log(`\nAssociating TODO ${todoId} to WORK ITEM ${workItemId}...`);
  31 |   const assocResp = await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  32 |   const assocData = await assocResp.json();
  33 |   console.log('Association response:', JSON.stringify(assocData));
  34 | 
  35 |   // Now fetch the work item to see what todos it has
  36 |   const fetchResp = await page.request.get(`/api/work/${workItemId}`);
  37 |   const fetchData = await fetchResp.json();
  38 |   console.log('\nWork item after association:', JSON.stringify(fetchData.data, null, 2));
  39 |   console.log('Associated todos:', fetchData.data.todos);
  40 |   console.log('Todo IDs:', fetchData.data.todos?.map(t => t.id));
  41 | });
  42 | 
```