# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-old-comp.spec.js >> Editable Types - Comprehensive Functionality >> Ticket Type >> [Ticket] Can create a new item
- Location: tests/e2e/zzz-old-comp.spec.js:26:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#addTicketBtn')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.08.19.42" [ref=e4] [cursor=pointer]:
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
      - button "⭐ Work Items" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: ⭐
        - text: Work Items
      - button "📋 Templates" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 📋
        - text: Templates
      - listitem [ref=e18]
      - tab "📍 Projects" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: 📍
        - text: Projects
      - tab "🏷️ Categories" [ref=e21] [cursor=pointer]:
        - generic [ref=e22]: 🏷️
        - text: Categories
      - tab "🎯 Goals" [ref=e23] [cursor=pointer]:
        - generic [ref=e24]: 🎯
        - text: Goals
      - tab "✅ Todos" [ref=e25] [cursor=pointer]:
        - generic [ref=e26]: ✅
        - text: Todos
      - tab "📝 Tasks" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: 📝
        - text: Tasks
      - tab "🎟️ Tickets" [active] [ref=e29] [cursor=pointer]:
        - generic [ref=e30]: 🎟️
        - text: Tickets
      - tab "💡 Ideas" [ref=e31] [cursor=pointer]:
        - generic [ref=e32]: 💡
        - text: Ideas
      - listitem [ref=e33]
      - button "📊 Priority Board" [ref=e34] [cursor=pointer]:
        - generic [ref=e35]: 📊
        - text: Priority Board
      - tab "📈 Reporting" [ref=e36] [cursor=pointer]:
        - generic [ref=e37]: 📈
        - text: Reporting
    - generic [ref=e38]:
      - complementary [ref=e39]:
        - generic [ref=e40]:
          - button " Calendar" [ref=e42] [cursor=pointer]:
            - generic [ref=e43]: 
            - text: Calendar
          - generic [ref=e44]:
            - tabpanel [ref=e47]:
              - generic [ref=e48]:
                - generic [ref=e49]:
                  - button "Previous month" [ref=e50] [cursor=pointer]: ‹
                  - heading "August 2026" [level=6] [ref=e51]
                  - button "Next month" [ref=e52] [cursor=pointer]: ›
                - table [ref=e53]:
                  - rowgroup [ref=e54]:
                    - row [ref=e55]:
                      - columnheader "Sun" [ref=e56]
                      - columnheader "Mon" [ref=e57]
                      - columnheader "Tue" [ref=e58]
                      - columnheader "Wed" [ref=e59]
                      - columnheader "Thu" [ref=e60]
                      - columnheader "Fri" [ref=e61]
                      - columnheader "Sat" [ref=e62]
                    - row [ref=e63]:
                      - cell [ref=e64]
                      - cell [ref=e65]
                      - cell [ref=e66]
                      - cell [ref=e67]
                      - cell [ref=e68]
                      - cell [ref=e69]
                      - cell "1" [ref=e70] [cursor=pointer]
                    - row [ref=e71]:
                      - cell "2" [ref=e72] [cursor=pointer]
                      - cell "3" [ref=e73] [cursor=pointer]
                      - cell "4" [ref=e74] [cursor=pointer]
                      - cell "5" [ref=e75] [cursor=pointer]
                      - cell "6" [ref=e76] [cursor=pointer]
                      - cell "7" [ref=e77] [cursor=pointer]
                      - cell "8" [ref=e78] [cursor=pointer]
                    - row [ref=e79]:
                      - cell "9" [ref=e80] [cursor=pointer]
                      - cell "10" [ref=e81] [cursor=pointer]
                      - cell "11" [ref=e82] [cursor=pointer]
                      - cell "12" [ref=e83] [cursor=pointer]
                      - cell "13" [ref=e84] [cursor=pointer]
                      - cell "14" [ref=e85] [cursor=pointer]
                      - cell "15" [ref=e86] [cursor=pointer]
                    - row [ref=e87]:
                      - cell "16" [ref=e88] [cursor=pointer]
                      - cell "17" [ref=e89] [cursor=pointer]
                      - cell "18" [ref=e90] [cursor=pointer]
                      - cell "19" [ref=e91] [cursor=pointer]
                      - cell "20" [ref=e92] [cursor=pointer]
                      - cell "21" [ref=e93] [cursor=pointer]
                      - cell "22" [ref=e94] [cursor=pointer]
                    - row [ref=e95]:
                      - cell "23" [ref=e96] [cursor=pointer]
                      - cell "24" [ref=e97] [cursor=pointer]
                      - cell "25" [ref=e98] [cursor=pointer]
                      - cell "26" [ref=e99] [cursor=pointer]
                      - cell "27" [ref=e100] [cursor=pointer]
                      - cell "28" [ref=e101] [cursor=pointer]
                      - cell "29" [ref=e102] [cursor=pointer]
                    - row [ref=e103]:
                      - cell "30" [ref=e104] [cursor=pointer]
                      - cell "31" [ref=e105] [cursor=pointer]
                      - cell [ref=e106]
                      - cell [ref=e107]
                      - cell [ref=e108]
                      - cell [ref=e109]
                      - cell [ref=e110]
            - generic [ref=e114]:
              - heading "Work Items for Thursday, Aug 20" [level=6] [ref=e116]
              - paragraph [ref=e118]: Nothing on this day yet - drag a type or a template in to get started.
        - text:                    
      - text:                 
      - generic [ref=e120]:
        - text:                                                                                                                                                                                                                                                              
        - generic [ref=e124]:
          - generic [ref=e125]:
            - group [ref=e127]:
              - button " Expand All" [ref=e128] [cursor=pointer]:
                - generic [ref=e129]: 
                - text: Expand All
              - button " Collapse All" [ref=e130] [cursor=pointer]:
                - generic [ref=e131]: 
                - text: Collapse All
            - group [ref=e133]:
              - button " + Folder" [ref=e134] [cursor=pointer]:
                - generic [ref=e135]: 
                - text: + Folder
              - button "+ New Ticket" [ref=e136] [cursor=pointer]
          - text: 
          - generic [ref=e138]:
            - generic [ref=e139]:
              - generic "Drag to reorder columns" [ref=e140]:
                - button "Title" [ref=e141] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e142]:
                - button "Priority" [ref=e143] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e144]:
                - button "Status" [ref=e145] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e146]:
                - button "Ticket Type" [ref=e147] [cursor=pointer]
              - group [ref=e149]:
                - button "" [ref=e150] [cursor=pointer]
                - button "" [ref=e152] [cursor=pointer]
            - generic [ref=e157]:
              - generic [ref=e158]:
                - generic [ref=e159]: 🎟️
                - generic [ref=e160]: test
              - button "No priority - click for Low" [ref=e162] [cursor=pointer]
              - button "Not Started" [ref=e169] [cursor=pointer]
              - button "Delete" [ref=e171] [cursor=pointer]:
                - generic [ref=e172]: 
        - text:                                                                                                                                                             
  - contentinfo [ref=e173]:
    - paragraph [ref=e175]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Editable Types - Comprehensive Functionality', () => {
  4   |   // Test all editable types: areas, goals, todos, tasks, tickets, ideas
  5   |   const editableTypes = [
  6   |     { slug: 'area', label: 'Area', buttonId: 'addareaBtnote' },
  7   |     { slug: 'goal', label: 'Goal', buttonId: 'addgoalBtnote' },
  8   |     { slug: 'todo', label: 'Todo', buttonId: 'addtodoBtnote' },
  9   |     { slug: 'task', label: 'Task', buttonId: 'addtaskBtnote' },
  10  |     { slug: 'ticket', label: 'Ticket', buttonId: 'addticketBtnote' },
  11  |     { slug: 'idea', label: 'Idea', buttonId: 'addideaBtnote' }
  12  |   ];
  13  | 
  14  |   editableTypes.forEach(type => {
  15  |     test.describe(`${type.label} Type`, () => {
  16  |       let page;
  17  | 
  18  |       test.beforeEach(async ({ page: p }) => {
  19  |         page = p;
  20  |         await page.goto('http://localhost:3000/');
  21  |         // Click the type tab
  22  |         await page.click(`[data-tab="${type.slug}"]`);
  23  |         await page.waitForLoadState('networkidle');
  24  |       });
  25  | 
  26  |       test(`[${type.label}] Can create a new item`, async () => {
  27  |         // Click add button
  28  |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
> 29  |         await addBtn.click();
      |                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  30  | 
  31  |         // Wait for editor form
  32  |         const form = page.locator('#entity-editor-form');
  33  |         await expect(form).toBeVisible({ timeout: 5000 });
  34  | 
  35  |         // Fill title
  36  |         const titleInput = form.locator('input[name="title"]');
  37  |         await titleInput.fill(`Test ${type.label}`);
  38  | 
  39  |         // Save
  40  |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  41  |         await saveBtn.click();
  42  | 
  43  |         // Wait for page reload and verify item appears
  44  |         await page.waitForLoadState('networkidle');
  45  |         const itemRow = page.locator(`[data-entity-type="${type.slug}"][data-entity-id="1"]`);
  46  |         await expect(itemRow).toBeDefined();
  47  |       });
  48  | 
  49  |       test(`[${type.label}] Can edit an existing item`, async () => {
  50  |         // Create an item first
  51  |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  52  |         await addBtn.click();
  53  |         const form = page.locator('#entity-editor-form');
  54  |         await expect(form).toBeVisible();
  55  |         const titleInput = form.locator('input[name="title"]');
  56  |         await titleInput.fill(`Edit Test ${type.label}`);
  57  |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  58  |         await saveBtn.click();
  59  |         await page.waitForLoadState('networkidle');
  60  | 
  61  |         // Now click on the item to edit it
  62  |         const itemRow = page.locator('.entity-row').first();
  63  |         await itemRow.click();
  64  |         const editForm = page.locator('#entity-editor-form');
  65  |         await expect(editForm).toBeVisible();
  66  | 
  67  |         // Change title
  68  |         const titleInputEdit = editForm.locator('input[name="title"]');
  69  |         const currentTitle = await titleInputEdit.inputValue();
  70  |         await titleInputEdit.fill(`${currentTitle} (edited)`);
  71  | 
  72  |         // Save
  73  |         const saveBtnEdit = page.locator(`#${type.slug}SaveBtn`);
  74  |         await saveBtnEdit.click();
  75  |         await page.waitForLoadState('networkidle');
  76  | 
  77  |         // Verify title changed
  78  |         const updatedItemRow = page.locator('.entity-row').first();
  79  |         await expect(updatedItemRow).toContainText('(edited)');
  80  |       });
  81  | 
  82  |       test(`[${type.label}] Toggle close works - click same row again closes editor`, async () => {
  83  |         // Create item
  84  |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  85  |         await addBtn.click();
  86  |         const form = page.locator('#entity-editor-form');
  87  |         await expect(form).toBeVisible();
  88  |         const titleInput = form.locator('input[name="title"]');
  89  |         await titleInput.fill(`Toggle Test ${type.label}`);
  90  |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  91  |         await saveBtn.click();
  92  |         await page.waitForLoadState('networkidle');
  93  | 
  94  |         // Click row to open editor
  95  |         const itemRow = page.locator('.entity-row').first();
  96  |         await itemRow.click();
  97  |         const editForm = page.locator('#entity-editor-form');
  98  |         await expect(editForm).toBeVisible();
  99  | 
  100 |         // Click same row again (should close)
  101 |         await itemRow.click();
  102 |         await expect(editForm).not.toBeVisible({ timeout: 2000 });
  103 | 
  104 |         // Click row again (should reopen)
  105 |         await itemRow.click();
  106 |         await expect(editForm).toBeVisible({ timeout: 2000 });
  107 |       });
  108 | 
  109 |       test(`[${type.label}] Can delete an item`, async () => {
  110 |         // Create item
  111 |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  112 |         await addBtn.click();
  113 |         const form = page.locator('#entity-editor-form');
  114 |         await expect(form).toBeVisible();
  115 |         const titleInput = form.locator('input[name="title"]');
  116 |         await titleInput.fill(`Delete Test ${type.label}`);
  117 |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  118 |         await saveBtn.click();
  119 |         await page.waitForLoadState('networkidle');
  120 | 
  121 |         // Get initial count
  122 |         const initialRows = await page.locator('.entity-row').count();
  123 | 
  124 |         // Click delete button
  125 |         const deleteBtn = page.locator('[data-action="delete"]').first();
  126 |         page.once('dialog', async dialog => {
  127 |           await dialog.accept();
  128 |         });
  129 |         await deleteBtn.click();
```