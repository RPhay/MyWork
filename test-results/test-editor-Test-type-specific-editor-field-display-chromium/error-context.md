# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-editor.spec.js >> Test type-specific editor field display
- Location: tests/e2e/test-editor.spec.js:3:1

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
  3   | test('Test type-specific editor field display', async ({ page }) => {
  4   |   await page.goto('http://localhost:3000');
  5   |   await page.waitForLoadState('networkidle');
  6   | 
  7   |   // Create test data
  8   |   const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  9   |   const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  10  | 
  11  |   // Create a todo
  12  |   const todoResp = await page.request.post('/api/to-dos', {
  13  |     data: { title: 'Test Todo for Editor' },
  14  |     headers
  15  |   });
  16  |   const todoData = await todoResp.json();
> 17  |   const todoId = todoData.data.id;
      |                                ^ TypeError: Cannot read properties of undefined (reading 'id')
  18  |   console.log('Created todo:', todoId);
  19  | 
  20  |   // Create a task
  21  |   const taskResp = await page.request.post('/api/tasks', {
  22  |     data: { title: 'Test Task for Editor' },
  23  |     headers
  24  |   });
  25  |   const taskData = await taskResp.json();
  26  |   const taskId = taskData.data.id;
  27  |   console.log('Created task:', taskId);
  28  | 
  29  |   // Create a priority/goal
  30  |   const priorityResp = await page.request.post('/api/priorities', {
  31  |     data: { title: 'Test Priority for Editor' },
  32  |     headers
  33  |   });
  34  |   const priorityData = await priorityResp.json();
  35  |   const priorityId = priorityData.data.id;
  36  |   console.log('Created priority:', priorityId);
  37  | 
  38  |   // Create a work item
  39  |   const workResp = await page.request.post('/api/work', {
  40  |     data: { title: 'Test Work Item Editor', date: '2026-08-14' },
  41  |     headers
  42  |   });
  43  |   const workData = await workResp.json();
  44  |   const workItemId = workData.data.id;
  45  |   console.log('Created work item:', workItemId);
  46  | 
  47  |   // Associate items
  48  |   await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  49  |   await page.request.post(`/api/work/${workItemId}/tasks/${taskId}`, { headers });
  50  |   await page.request.post(`/api/work/${workItemId}/priorities/${priorityId}`, { headers });
  51  | 
  52  |   // Reload and expand work item
  53  |   await page.reload();
  54  |   await page.waitForLoadState('networkidle');
  55  |   await page.waitForTimeout(1000);
  56  | 
  57  |   const expandToggle = page.locator('.work-item-toggle').first();
  58  |   await expandToggle.click();
  59  |   await page.waitForTimeout(500);
  60  | 
  61  |   // Test 1: Click on a todo row
  62  |   console.log('\n=== Testing Todo Editor ===');
  63  |   const todoRow = page.locator('.child-item-row[data-item-type="todo"]').first();
  64  |   const todoVisible = await todoRow.isVisible().catch(() => false);
  65  |   console.log('Todo row visible:', todoVisible);
  66  | 
  67  |   if (todoVisible) {
  68  |     await todoRow.click();
  69  |     await page.waitForTimeout(500);
  70  | 
  71  |     // Check if editor pane is visible
  72  |     const editorPane = page.locator('#childItemEditorPane');
  73  |     const editorVisible = await editorPane.isVisible();
  74  |     console.log('Editor pane visible:', editorVisible);
  75  | 
  76  |     if (editorVisible) {
  77  |       // Check which fields are visible
  78  |       const notesField = page.locator('#childItemEditorNotesField');
  79  |       const statusField = page.locator('#childItemEditorStatusField');
  80  |       const descField = page.locator('#childItemEditorDescriptionField');
  81  |       const yearField = page.locator('#childItemEditorYearField');
  82  | 
  83  |       const notesVisible = await notesField.evaluate(el => el.style.display !== 'none');
  84  |       const statusVisible = await statusField.evaluate(el => el.style.display !== 'none');
  85  |       const descVisible = await descField.evaluate(el => el.style.display !== 'none');
  86  |       const yearVisible = await yearField.evaluate(el => el.style.display !== 'none');
  87  | 
  88  |       console.log('Notes field visible:', notesVisible, '(should be true for todo)');
  89  |       console.log('Status field visible:', statusVisible, '(should be true for todo)');
  90  |       console.log('Description field visible:', descVisible, '(should be false for todo)');
  91  |       console.log('Year field visible:', yearVisible, '(should be false for todo)');
  92  |     }
  93  |   }
  94  | 
  95  |   // Test 2: Click on a task row
  96  |   console.log('\n=== Testing Task Editor ===');
  97  |   const taskRow = page.locator('.child-item-row[data-item-type="task"]').first();
  98  |   const taskVisible = await taskRow.isVisible().catch(() => false);
  99  |   console.log('Task row visible:', taskVisible);
  100 | 
  101 |   if (taskVisible) {
  102 |     await taskRow.click();
  103 |     await page.waitForTimeout(500);
  104 | 
  105 |     // Check which fields are visible
  106 |     const notesField = page.locator('#childItemEditorNotesField');
  107 |     const statusField = page.locator('#childItemEditorStatusField');
  108 |     const descField = page.locator('#childItemEditorDescriptionField');
  109 |     const yearField = page.locator('#childItemEditorYearField');
  110 | 
  111 |     const notesVisible = await notesField.evaluate(el => el.style.display !== 'none');
  112 |     const statusVisible = await statusField.evaluate(el => el.style.display !== 'none');
  113 |     const descVisible = await descField.evaluate(el => el.style.display !== 'none');
  114 |     const yearVisible = await yearField.evaluate(el => el.style.display !== 'none');
  115 | 
  116 |     console.log('Notes field visible:', notesVisible, '(should be true for task)');
  117 |     console.log('Status field visible:', statusVisible, '(should be true for task)');
```