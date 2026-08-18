# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: manual-nesting-test.spec.js >> Manual nesting via API
- Location: tests/e2e/manual-nesting-test.spec.js:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[name="_csrf"]') to be visible
    62 × locator resolved to 22 elements. Proceeding with the first one: <input name="_csrf" type="hidden" value="CCJIjIDR-Z0pzY1N4cmX8lE7rNI6iIi4QhbM"/>

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
    - generic: "                                                       Add notes here... Visit URL: EditRemove                                                                                                                                                                          "
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
  3  | test('Manual nesting via API', async ({ page }) => {
  4  |   // First, go to the page to get CSRF token
  5  |   await page.goto('http://localhost:3000?tab=todos');
> 6  |   await page.waitForSelector('[name="_csrf"]');
     |              ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  7  | 
  8  |   // Get CSRF token
  9  |   const csrfToken = await page.getAttribute('[name="_csrf"]', 'value');
  10 |   console.log('CSRF token:', csrfToken);
  11 | 
  12 |   // Create parent todo via API
  13 |   const parentRes = await page.request.post('http://localhost:3000/api/to-dos', {
  14 |     headers: {
  15 |       'X-CSRF-Token': csrfToken
  16 |     },
  17 |     data: { title: 'Parent Todo', notes: '' }
  18 |   });
  19 |   const parentData = await parentRes.json();
  20 |   const parentId = parentData.data.id;
  21 |   console.log('Created parent:', parentId);
  22 | 
  23 |   // Create child todo via API
  24 |   const childRes = await page.request.post('http://localhost:3000/api/to-dos', {
  25 |     headers: {
  26 |       'X-CSRF-Token': csrfToken
  27 |     },
  28 |     data: { title: 'Child Todo', notes: '', parent_id: parentId }
  29 |   });
  30 |   const childData = await childRes.json();
  31 |   const childId = childData.data.id;
  32 |   console.log('Created child:', childId, 'with parent_id:', parentId);
  33 | 
  34 |   // Reload todos to see the new items
  35 |   await page.reload();
  36 |   await page.waitForSelector('#toDosList');
  37 |   await page.waitForTimeout(1000);
  38 | 
  39 |   // Screenshot BEFORE expand
  40 |   await page.screenshot({ path: '/tmp/manual-nesting-before.png' });
  41 | 
  42 |   // Check HTML structure
  43 |   const htmlBefore = await page.locator('#toDosList').innerHTML();
  44 |   console.log('Before expand - has expanded class:', htmlBefore.includes('class="todo-node expanded'));
  45 |   console.log('Before expand - has toggle for parent:', htmlBefore.includes(`data-todo-id="${parentId}"`) && htmlBefore.includes('todo-folder-toggle'));
  46 | 
  47 |   // Click expand toggle for parent
  48 |   const toggles = await page.locator(`[data-todo-id="${parentId}"] .todo-folder-toggle`).all();
  49 |   console.log('Found toggles for parent:', toggles.length);
  50 | 
  51 |   if (toggles.length > 0) {
  52 |     await toggles[0].click();
  53 |     await page.waitForTimeout(1000);
  54 |   }
  55 | 
  56 |   // Screenshot AFTER expand
  57 |   await page.screenshot({ path: '/tmp/manual-nesting-after.png' });
  58 | 
  59 |   // Check HTML structure after expand
  60 |   const htmlAfter = await page.locator('#toDosList').innerHTML();
  61 |   console.log('After expand - has expanded class:', htmlAfter.includes('class="todo-node expanded'));
  62 |   console.log('After expand - has children div:', htmlAfter.includes('todo-node-children'));
  63 | 
  64 |   // Check if child is visible
  65 |   const childVisible = await page.locator(`text=Child Todo`).isVisible();
  66 |   console.log('Child todo visible:', childVisible);
  67 | });
  68 | 
```