# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-editor-simplified.spec.js >> Type-specific editor shows correct fields
- Location: tests/e2e/test-editor-simplified.spec.js:3:1

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test('Type-specific editor shows correct fields', async ({ page }) => {
  4   |   await page.goto('http://localhost:3000');
  5   |   await page.waitForLoadState('networkidle');
  6   | 
  7   |   const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  8   |   const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  9   | 
  10  |   // Create fresh todo and task
  11  |   const todoResp = await page.request.post('/api/to-dos', {
  12  |     data: { title: 'Fresh Test Todo', notes: 'Test notes', status: 'incomplete' },
  13  |     headers
  14  |   });
> 15  |   const todoId = (await todoResp.json()).data.id;
      |                                               ^ TypeError: Cannot read properties of undefined (reading 'id')
  16  | 
  17  |   const taskResp = await page.request.post('/api/tasks', {
  18  |     data: { title: 'Fresh Test Task', notes: 'Task notes' },
  19  |     headers
  20  |   });
  21  |   const taskId = (await taskResp.json()).data.id;
  22  | 
  23  |   const priorityResp = await page.request.post('/api/priorities', {
  24  |     data: { title: 'Fresh Test Priority', description: 'Priority desc' },
  25  |     headers
  26  |   });
  27  |   const priorityId = (await priorityResp.json()).data.id;
  28  | 
  29  |   // Create work item and associate
  30  |   const workResp = await page.request.post('/api/work', {
  31  |     data: { title: 'Fresh Test Item', date: '2026-08-14' },
  32  |     headers
  33  |   });
  34  |   const workItemId = (await workResp.json()).data.id;
  35  | 
  36  |   await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  37  |   await page.request.post(`/api/work/${workItemId}/tasks/${taskId}`, { headers });
  38  |   await page.request.post(`/api/work/${workItemId}/priorities/${priorityId}`, { headers });
  39  | 
  40  |   // Reload and expand
  41  |   await page.reload();
  42  |   await page.waitForLoadState('networkidle');
  43  |   await page.waitForTimeout(1000);
  44  | 
  45  |   const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  46  |   let ourWorkItem = null;
  47  |   for (const wi of workItems) {
  48  |     const title = await wi.locator('.work-item-title').first().textContent();
  49  |     if (title?.includes('Fresh Test Item')) {
  50  |       ourWorkItem = wi;
  51  |       break;
  52  |     }
  53  |   }
  54  |   expect(ourWorkItem).toBeTruthy('Our work item should exist');
  55  | 
  56  |   // Expand
  57  |   await ourWorkItem.locator('[data-action="toggle-expand"]').click();
  58  |   await page.waitForTimeout(800);
  59  | 
  60  |   // Find the child rows we just created
  61  |   const todoRow = ourWorkItem.locator(`.child-item-row[data-work-id="${todoId}"]`);
  62  |   const taskRow = ourWorkItem.locator(`.child-item-row[data-work-id="${taskId}"]`);
  63  |   const priorityRow = ourWorkItem.locator(`.child-item-row[data-work-id="${priorityId}"]`);
  64  | 
  65  |   expect(await todoRow.isVisible()).toBe(true);
  66  |   expect(await taskRow.isVisible()).toBe(true);
  67  |   expect(await priorityRow.isVisible()).toBe(true);
  68  | 
  69  |   // Test TODO editor
  70  |   console.log('Testing TODO editor...');
  71  |   await todoRow.click();
  72  |   await page.waitForTimeout(400);
  73  | 
  74  |   let notesVisible = await page.locator('#childItemEditorNotesField').evaluate(el => el.style.display !== 'none');
  75  |   let statusVisible = await page.locator('#childItemEditorStatusField').evaluate(el => el.style.display !== 'none');
  76  |   let descVisible = await page.locator('#childItemEditorDescriptionField').evaluate(el => el.style.display !== 'none');
  77  | 
  78  |   expect(notesVisible).toBe(true);
  79  |   expect(statusVisible).toBe(true);
  80  |   expect(descVisible).toBe(false);
  81  |   console.log('✅ TODO: notes and status visible');
  82  | 
  83  |   // Test TASK editor (should be same as TODO)
  84  |   console.log('Testing TASK editor...');
  85  |   await taskRow.click();
  86  |   await page.waitForTimeout(400);
  87  | 
  88  |   notesVisible = await page.locator('#childItemEditorNotesField').evaluate(el => el.style.display !== 'none');
  89  |   statusVisible = await page.locator('#childItemEditorStatusField').evaluate(el => el.style.display !== 'none');
  90  |   descVisible = await page.locator('#childItemEditorDescriptionField').evaluate(el => el.style.display !== 'none');
  91  | 
  92  |   expect(notesVisible).toBe(true);
  93  |   expect(statusVisible).toBe(true);
  94  |   expect(descVisible).toBe(false);
  95  |   console.log('✅ TASK: notes and status visible');
  96  | 
  97  |   // Test PRIORITY editor (should show description only)
  98  |   console.log('Testing PRIORITY editor...');
  99  |   await priorityRow.click();
  100 |   await page.waitForTimeout(400);
  101 | 
  102 |   notesVisible = await page.locator('#childItemEditorNotesField').evaluate(el => el.style.display !== 'none');
  103 |   statusVisible = await page.locator('#childItemEditorStatusField').evaluate(el => el.style.display !== 'none');
  104 |   descVisible = await page.locator('#childItemEditorDescriptionField').evaluate(el => el.style.display !== 'none');
  105 | 
  106 |   expect(notesVisible).toBe(false);
  107 |   expect(statusVisible).toBe(false);
  108 |   expect(descVisible).toBe(true);
  109 |   console.log('✅ PRIORITY: description visible (not notes/status)');
  110 | 
  111 |   console.log('\n✅ All type-specific field tests passed!');
  112 | });
  113 | 
```