# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-editor-full-flow.spec.js >> Full type-specific editor flow
- Location: tests/e2e/test-editor-full-flow.spec.js:3:1

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
  3   | test('Full type-specific editor flow', async ({ page }) => {
  4   |   await page.goto('http://localhost:3000');
  5   |   await page.waitForLoadState('networkidle');
  6   | 
  7   |   const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  8   |   const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  9   | 
  10  |   // Create a TODO with notes
  11  |   const todoResp = await page.request.post('/api/to-dos', {
  12  |     data: { title: 'Editor Flow Todo', notes: 'Original todo notes', status: 'incomplete' },
  13  |     headers
  14  |   });
> 15  |   const todoId = (await todoResp.json()).data.id;
      |                                               ^ TypeError: Cannot read properties of undefined (reading 'id')
  16  |   console.log('1. Created todo:', todoId);
  17  | 
  18  |   // Create a TASK with notes (same field structure as todo)
  19  |   const taskResp = await page.request.post('/api/tasks', {
  20  |     data: { title: 'Editor Flow Task', notes: 'Original task notes' },
  21  |     headers
  22  |   });
  23  |   const taskId = (await taskResp.json()).data.id;
  24  |   console.log('2. Created task:', taskId);
  25  | 
  26  |   // Create a work item
  27  |   const workResp = await page.request.post('/api/work', {
  28  |     data: { title: 'Editor Flow Test Item', date: '2026-08-14' },
  29  |     headers
  30  |   });
  31  |   const workItemId = (await workResp.json()).data.id;
  32  |   console.log('3. Created work item:', workItemId);
  33  | 
  34  |   // Associate both
  35  |   await page.request.post(`/api/work/${workItemId}/todos/${todoId}`, { headers });
  36  |   await page.request.post(`/api/work/${workItemId}/tasks/${taskId}`, { headers });
  37  |   console.log('4. Associated items');
  38  | 
  39  |   // Reload
  40  |   await page.reload();
  41  |   await page.waitForLoadState('networkidle');
  42  |   await page.waitForTimeout(1000);
  43  | 
  44  |   // Find our work item and expand it
  45  |   const workItems = await page.locator('.work-item:not(.child-item-row)').all();
  46  |   let ourWorkItem = null;
  47  |   for (const wi of workItems) {
  48  |     const title = await wi.locator('.work-item-title').first().textContent();
  49  |     if (title?.includes('Editor Flow Test Item')) {
  50  |       ourWorkItem = wi;
  51  |       break;
  52  |     }
  53  |   }
  54  |   expect(ourWorkItem).toBeTruthy();
  55  | 
  56  |   const expandBtn = ourWorkItem.locator('[data-action="toggle-expand"]');
  57  |   await expandBtn.click();
  58  |   await page.waitForTimeout(500);
  59  | 
  60  |   // Test 1: Click TODO row and check field visibility
  61  |   console.log('\n=== TEST 1: TODO Type-Specific Fields ===');
  62  |   const todoRow = ourWorkItem.locator(`.child-item-row[data-work-id="${todoId}"]`);
  63  |   expect(await todoRow.isVisible()).toBeTruthy();
  64  | 
  65  |   await todoRow.click();
  66  |   await page.waitForTimeout(500);
  67  | 
  68  |   const editorPane = page.locator('#childItemEditorPane');
  69  |   expect(await editorPane.isVisible()).toBeTruthy();
  70  | 
  71  |   const notesField = page.locator('#childItemEditorNotesField');
  72  |   const statusField = page.locator('#childItemEditorStatusField');
  73  |   const descField = page.locator('#childItemEditorDescriptionField');
  74  |   const yearField = page.locator('#childItemEditorYearField');
  75  | 
  76  |   const notesVisible = await notesField.evaluate(el => el.style.display !== 'none');
  77  |   const statusVisible = await statusField.evaluate(el => el.style.display !== 'none');
  78  |   const descVisible = await descField.evaluate(el => el.style.display !== 'none');
  79  |   const yearVisible = await yearField.evaluate(el => el.style.display !== 'none');
  80  | 
  81  |   expect(notesVisible).toBe(true);
  82  |   expect(statusVisible).toBe(true);
  83  |   expect(descVisible).toBe(false);
  84  |   expect(yearVisible).toBe(false);
  85  |   console.log('✅ Todo shows: notes, status (not desc, year)');
  86  | 
  87  |   // Check if data populated
  88  |   const notesValue = await page.locator('#childItemEditorNotes').inputValue();
  89  |   const statusValue = await page.locator('#childItemEditorStatus').inputValue();
  90  |   console.log('Notes populated:', notesValue === 'Original todo notes');
  91  |   console.log('Status populated:', statusValue === 'incomplete');
  92  | 
  93  |   // Test 2: Click TASK row and check same fields as TODO (both have notes + status)
  94  |   console.log('\n=== TEST 2: TASK Type-Specific Fields ===');
  95  |   const taskRow = ourWorkItem.locator(`.child-item-row[data-work-id="${taskId}"]`);
  96  |   expect(await taskRow.isVisible()).toBeTruthy();
  97  | 
  98  |   await taskRow.click();
  99  |   await page.waitForTimeout(500);
  100 | 
  101 |   const notesVisible2 = await notesField.evaluate(el => el.style.display !== 'none');
  102 |   const statusVisible2 = await statusField.evaluate(el => el.style.display !== 'none');
  103 |   const descVisible2 = await descField.evaluate(el => el.style.display !== 'none');
  104 |   const yearVisible2 = await yearField.evaluate(el => el.style.display !== 'none');
  105 | 
  106 |   expect(notesVisible2).toBe(true);
  107 |   expect(statusVisible2).toBe(true);
  108 |   expect(descVisible2).toBe(false);
  109 |   expect(yearVisible2).toBe(false);
  110 |   console.log('✅ Task shows: notes, status (not desc, year)');
  111 | 
  112 |   // Check if task data populated
  113 |   const taskNotesValue = await page.locator('#childItemEditorNotes').inputValue();
  114 |   console.log('Task notes populated:', taskNotesValue === 'Original task notes');
  115 | 
```