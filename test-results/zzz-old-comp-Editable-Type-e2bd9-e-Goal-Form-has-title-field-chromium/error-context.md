# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-old-comp.spec.js >> Editable Types - Comprehensive Functionality >> Goal Type >> [Goal] Form has title field
- Location: tests/e2e/zzz-old-comp.spec.js:171:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#addGoalBtn')

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
      - tab "🎯 Goals" [active] [ref=e23] [cursor=pointer]:
        - generic [ref=e24]: 🎯
        - text: Goals
      - tab "✅ Todos" [ref=e25] [cursor=pointer]:
        - generic [ref=e26]: ✅
        - text: Todos
      - tab "📝 Tasks" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: 📝
        - text: Tasks
      - tab "🎟️ Tickets" [ref=e29] [cursor=pointer]:
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
        - text:                                                                                     
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
              - button "+ New Goal" [ref=e136] [cursor=pointer]
          - text: 
          - generic [ref=e138]:
            - generic [ref=e139]:
              - generic "Drag to reorder columns" [ref=e140]:
                - button "Title" [ref=e141] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e142]:
                - button "Priority" [ref=e143] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e144]:
                - button "Year" [ref=e145] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e146]:
                - button "Status" [ref=e147] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e148]:
                - button "Due Date" [ref=e149] [cursor=pointer]
              - group [ref=e151]:
                - button "" [ref=e152] [cursor=pointer]
                - button "" [ref=e154] [cursor=pointer]
            - generic [ref=e156]:
              - generic [ref=e159]:
                - generic [ref=e160]:
                  - generic [ref=e161]: 🎯
                  - generic [ref=e162]: New Goal Test
                - button "No priority - click for Low" [ref=e164] [cursor=pointer]
                - button "Not Started" [ref=e171] [cursor=pointer]
                - button "Set date" [ref=e173] [cursor=pointer]
                - button "Delete" [ref=e175] [cursor=pointer]:
                  - generic [ref=e176]: 
              - generic [ref=e179]:
                - generic [ref=e180]:
                  - generic [ref=e181]: 🎯
                  - generic [ref=e182]: New Goal Test
                - button "No priority - click for Low" [ref=e184] [cursor=pointer]
                - button "Not Started" [ref=e191] [cursor=pointer]
                - button "Set date" [ref=e193] [cursor=pointer]
                - button "Delete" [ref=e195] [cursor=pointer]:
                  - generic [ref=e196]: 
              - generic [ref=e199]:
                - generic [ref=e200]:
                  - generic [ref=e201]: 🎯
                  - generic [ref=e202]: New Goal Test
                - button "No priority - click for Low" [ref=e204] [cursor=pointer]
                - button "Not Started" [ref=e211] [cursor=pointer]
                - button "Set date" [ref=e213] [cursor=pointer]
                - button "Delete" [ref=e215] [cursor=pointer]:
                  - generic [ref=e216]: 
              - generic [ref=e219]:
                - generic [ref=e220]:
                  - generic [ref=e221]: 🎯
                  - generic [ref=e222]: New Goal Test
                - button "No priority - click for Low" [ref=e224] [cursor=pointer]
                - button "Not Started" [ref=e231] [cursor=pointer]
                - button "Set date" [ref=e233] [cursor=pointer]
                - button "Delete" [ref=e235] [cursor=pointer]:
                  - generic [ref=e236]: 
              - generic [ref=e239]:
                - generic [ref=e240]:
                  - generic [ref=e241]: 🎯
                  - generic [ref=e242]: New Goal Test
                - button "No priority - click for Low" [ref=e244] [cursor=pointer]
                - button "Not Started" [ref=e251] [cursor=pointer]
                - button "Set date" [ref=e253] [cursor=pointer]
                - button "Delete" [ref=e255] [cursor=pointer]:
                  - generic [ref=e256]: 
              - generic [ref=e259]:
                - generic [ref=e260]:
                  - generic [ref=e261]: 🎯
                  - generic [ref=e262]: New Goal Test
                - button "No priority - click for Low" [ref=e264] [cursor=pointer]
                - button "Not Started" [ref=e271] [cursor=pointer]
                - button "Set date" [ref=e273] [cursor=pointer]
                - button "Delete" [ref=e275] [cursor=pointer]:
                  - generic [ref=e276]: 
              - generic [ref=e279]:
                - generic [ref=e280]:
                  - generic [ref=e281]: 🎯
                  - generic [ref=e282]: New Goal Test
                - button "No priority - click for Low" [ref=e284] [cursor=pointer]
                - button "Not Started" [ref=e291] [cursor=pointer]
                - button "Set date" [ref=e293] [cursor=pointer]
                - button "Delete" [ref=e295] [cursor=pointer]:
                  - generic [ref=e296]: 
              - generic [ref=e299]:
                - generic [ref=e300]:
                  - generic [ref=e301]: 🎯
                  - generic [ref=e302]: New Goal Test
                - button "No priority - click for Low" [ref=e304] [cursor=pointer]
                - button "Not Started" [ref=e311] [cursor=pointer]
                - button "Set date" [ref=e313] [cursor=pointer]
                - button "Delete" [ref=e315] [cursor=pointer]:
                  - generic [ref=e316]: 
        - text:                                                                                                                                                                                                                                                                                                                               
  - contentinfo [ref=e317]:
    - paragraph [ref=e319]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
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
  130 |         await page.waitForLoadState('networkidle');
  131 | 
  132 |         // Verify count decreased
  133 |         const finalRows = await page.locator('.entity-row').count();
  134 |         expect(finalRows).toBeLessThan(initialRows);
  135 |       });
  136 | 
  137 |       test(`[${type.label}] Can create a folder`, async () => {
  138 |         // Click + Folder button
  139 |         const folderBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}FolderBtn`);
  140 |         page.once('dialog', async dialog => {
  141 |           await dialog.type('Test Folder');
  142 |           await dialog.accept();
  143 |         });
  144 |         await folderBtn.click();
  145 |         await page.waitForLoadState('networkidle');
  146 | 
  147 |         // Verify folder appears
  148 |         const folderRow = page.locator('.entity-row').first();
  149 |         await expect(folderRow).toContainText('Test Folder');
  150 |       });
  151 | 
  152 |       test(`[${type.label}] Expand/Collapse buttons work`, async () => {
  153 |         // Create a parent item first
  154 |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  155 |         await addBtn.click();
  156 |         const form = page.locator('#entity-editor-form');
  157 |         await expect(form).toBeVisible();
  158 |         const titleInput = form.locator('input[name="title"]');
  159 |         await titleInput.fill('Parent Item');
  160 |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  161 |         await saveBtn.click();
  162 |         await page.waitForLoadState('networkidle');
  163 | 
  164 |         // Check that expand/collapse buttons exist
  165 |         const expandBtn = page.locator(`#expandAll${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  166 |         const collapseBtn = page.locator(`#collapseAll${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  167 |         await expect(expandBtn).toBeVisible();
  168 |         await expect(collapseBtn).toBeVisible();
  169 |       });
  170 | 
  171 |       test(`[${type.label}] Form has title field`, async () => {
  172 |         // Click add button
  173 |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
> 174 |         await addBtn.click();
      |                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  175 | 
  176 |         // Wait for form
  177 |         const form = page.locator('#entity-editor-form');
  178 |         await expect(form).toBeVisible();
  179 | 
  180 |         // Check title field exists
  181 |         const titleField = form.locator('input[name="title"]');
  182 |         await expect(titleField).toBeVisible();
  183 | 
  184 |         // Check label
  185 |         const titleLabel = form.locator('label').first();
  186 |         await expect(titleLabel).toContainText('Title');
  187 |       });
  188 | 
  189 |       test(`[${type.label}] Save button is disabled until changes made`, async () => {
  190 |         // Click add button
  191 |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  192 |         await addBtn.click();
  193 | 
  194 |         // Wait for form
  195 |         const form = page.locator('#entity-editor-form');
  196 |         await expect(form).toBeVisible();
  197 | 
  198 |         // Check save button is disabled initially
  199 |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  200 |         await expect(saveBtn).toBeDisabled();
  201 | 
  202 |         // Make a change
  203 |         const titleInput = form.locator('input[name="title"]');
  204 |         await titleInput.fill('New Item');
  205 | 
  206 |         // Check save button is now enabled
  207 |         await expect(saveBtn).toBeEnabled();
  208 |       });
  209 |     });
  210 |   });
  211 | });
  212 | 
```