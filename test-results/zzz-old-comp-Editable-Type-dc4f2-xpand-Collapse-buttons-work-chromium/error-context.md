# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-old-comp.spec.js >> Editable Types - Comprehensive Functionality >> Area Type >> [Area] Expand/Collapse buttons work
- Location: tests/e2e/zzz-old-comp.spec.js:152:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#addAreaBtn')

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
      - tab "🏷️ Categories" [active] [ref=e21] [cursor=pointer]:
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
        - text:                                             
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
              - button "+ New Category" [ref=e136] [cursor=pointer]
          - text: 
          - generic [ref=e138]:
            - generic [ref=e139]:
              - generic "Drag to reorder columns" [ref=e140]:
                - button "Title" [ref=e141] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e142]:
                - button "Priority" [ref=e143] [cursor=pointer]
              - group [ref=e145]:
                - button "" [ref=e146] [cursor=pointer]
                - button "" [ref=e148] [cursor=pointer]
            - generic [ref=e150]:
              - generic [ref=e151]:
                - generic [ref=e153]:
                  - generic [ref=e154]:
                    - generic [ref=e155] [cursor=pointer]: ▶
                    - generic [ref=e156]: 🏷️
                    - generic [ref=e157]: atst
                    - generic "1 item inside" [ref=e158]: (1)
                  - button "No priority - click for Low" [ref=e160] [cursor=pointer]
                  - button "Delete" [ref=e167] [cursor=pointer]:
                    - generic [ref=e168]: 
                - generic [ref=e172]:
                  - generic [ref=e173]:
                    - generic [ref=e174]: 🏷️
                    - generic [ref=e175]: Test Area
                  - button "No priority - click for Low" [ref=e177] [cursor=pointer]
                  - button "Delete" [ref=e184] [cursor=pointer]:
                    - generic [ref=e185]: 
              - generic [ref=e188]:
                - generic [ref=e189]:
                  - generic [ref=e190]: 🏷️
                  - generic [ref=e191]: asdf
                - button "No priority - click for Low" [ref=e193] [cursor=pointer]
                - button "Delete" [ref=e200] [cursor=pointer]:
                  - generic [ref=e201]: 
              - generic [ref=e204]:
                - generic [ref=e205]:
                  - generic [ref=e206]: 🏷️
                  - generic [ref=e207]: This should be a fucking category
                - button "No priority - click for Low" [ref=e209] [cursor=pointer]
                - button "Delete" [ref=e216] [cursor=pointer]:
                  - generic [ref=e217]: 
              - generic [ref=e220]:
                - generic [ref=e221]:
                  - generic [ref=e222]: 🏷️
                  - generic [ref=e223]: asdf
                - button "No priority - click for Low" [ref=e225] [cursor=pointer]
                - button "Delete" [ref=e232] [cursor=pointer]:
                  - generic [ref=e233]: 
              - generic [ref=e236]:
                - generic [ref=e237]:
                  - generic [ref=e238]: 🏷️
                  - generic [ref=e239]: New Area Test
                - button "No priority - click for Low" [ref=e241] [cursor=pointer]
                - button "Delete" [ref=e248] [cursor=pointer]:
                  - generic [ref=e249]: 
              - generic [ref=e252]:
                - generic [ref=e253]:
                  - generic [ref=e254]: 🏷️
                  - generic [ref=e255]: Test Area
                - button "No priority - click for Low" [ref=e257] [cursor=pointer]
                - button "Delete" [ref=e264] [cursor=pointer]:
                  - generic [ref=e265]: 
              - generic [ref=e268]:
                - generic [ref=e269]:
                  - generic [ref=e270]: 🏷️
                  - generic [ref=e271]: New Area Test
                - button "No priority - click for Low" [ref=e273] [cursor=pointer]
                - button "Delete" [ref=e280] [cursor=pointer]:
                  - generic [ref=e281]: 
              - generic [ref=e284]:
                - generic [ref=e285]:
                  - generic [ref=e286]: 🏷️
                  - generic [ref=e287]: Test Area
                - button "No priority - click for Low" [ref=e289] [cursor=pointer]
                - button "Delete" [ref=e296] [cursor=pointer]:
                  - generic [ref=e297]: 
              - generic [ref=e300]:
                - generic [ref=e301]:
                  - generic [ref=e302]: 🏷️
                  - generic [ref=e303]: New Area Test
                - button "No priority - click for Low" [ref=e305] [cursor=pointer]
                - button "Delete" [ref=e312] [cursor=pointer]:
                  - generic [ref=e313]: 
              - generic [ref=e316]:
                - generic [ref=e317]:
                  - generic [ref=e318]: 🏷️
                  - generic [ref=e319]: Test Area
                - button "No priority - click for Low" [ref=e321] [cursor=pointer]
                - button "Delete" [ref=e328] [cursor=pointer]:
                  - generic [ref=e329]: 
              - generic [ref=e330]:
                - generic [ref=e332]:
                  - generic [ref=e333]:
                    - generic [ref=e334] [cursor=pointer]: ▶
                    - generic [ref=e335]: 📁
                    - generic [ref=e336]: Folder
                    - generic "2 items inside" [ref=e337]: (2)
                  - button "Delete" [ref=e339] [cursor=pointer]:
                    - generic [ref=e340]: 
                - generic [ref=e341]:
                  - generic [ref=e344]:
                    - generic [ref=e345]:
                      - generic [ref=e346]: 🏷️
                      - generic [ref=e347]: test
                    - button "No priority - click for Low" [ref=e349] [cursor=pointer]
                    - button "Delete" [ref=e356] [cursor=pointer]:
                      - generic [ref=e357]: 
                  - generic [ref=e360]:
                    - generic [ref=e361]:
                      - generic [ref=e362]: 🏷️
                      - generic [ref=e363]: adsf
                    - button "No priority - click for Low" [ref=e365] [cursor=pointer]
                    - button "Delete" [ref=e372] [cursor=pointer]:
                      - generic [ref=e373]: 
              - generic [ref=e376]:
                - generic [ref=e377]:
                  - generic [ref=e378]: 🏷️
                  - generic [ref=e379]: New Area Test
                - button "No priority - click for Low" [ref=e381] [cursor=pointer]
                - button "Delete" [ref=e388] [cursor=pointer]:
                  - generic [ref=e389]: 
              - generic [ref=e392]:
                - generic [ref=e393]:
                  - generic [ref=e394]: 🏷️
                  - generic [ref=e395]: Test Area
                - button "No priority - click for Low" [ref=e397] [cursor=pointer]
                - button "Delete" [ref=e404] [cursor=pointer]:
                  - generic [ref=e405]: 
              - generic [ref=e408]:
                - generic [ref=e409]:
                  - generic [ref=e410]: 🏷️
                  - generic [ref=e411]: atst
                - button "No priority - click for Low" [ref=e413] [cursor=pointer]
                - button "Delete" [ref=e420] [cursor=pointer]:
                  - generic [ref=e421]: 
              - generic [ref=e424]:
                - generic [ref=e425]:
                  - generic [ref=e426]: 🏷️
                  - generic [ref=e427]: ZZZfull category
                - button "No priority - click for Low" [ref=e429] [cursor=pointer]
                - button "Delete" [ref=e436] [cursor=pointer]:
                  - generic [ref=e437]: 
              - generic [ref=e440]:
                - generic [ref=e441]:
                  - generic [ref=e442]: 🏷️
                  - generic [ref=e443]: ZZZfull category
                - button "No priority - click for Low" [ref=e445] [cursor=pointer]
                - button "Delete" [ref=e452] [cursor=pointer]:
                  - generic [ref=e453]: 
              - generic [ref=e456]:
                - generic [ref=e457]:
                  - generic [ref=e458]: 🏷️
                  - generic [ref=e459]: ZZZ payload
                - button "No priority - click for Low" [ref=e461] [cursor=pointer]
                - button "Delete" [ref=e468] [cursor=pointer]:
                  - generic [ref=e469]: 
              - generic [ref=e472]:
                - generic [ref=e473]:
                  - generic [ref=e474]: 🏷️
                  - generic [ref=e475]: ZZZfull category
                - button "No priority - click for Low" [ref=e477] [cursor=pointer]
                - button "Delete" [ref=e484] [cursor=pointer]:
                  - generic [ref=e485]: 
              - generic [ref=e488]:
                - generic [ref=e489]:
                  - generic [ref=e490]: 🏷️
                  - generic [ref=e491]: ZZZfull category
                - button "No priority - click for Low" [ref=e493] [cursor=pointer]
                - button "Delete" [ref=e500] [cursor=pointer]:
                  - generic [ref=e501]: 
              - generic [ref=e504]:
                - generic [ref=e505]:
                  - generic [ref=e506]: 🏷️
                  - generic [ref=e507]: ZZZ payload
                - button "No priority - click for Low" [ref=e509] [cursor=pointer]
                - button "Delete" [ref=e516] [cursor=pointer]:
                  - generic [ref=e517]: 
              - generic [ref=e520]:
                - generic [ref=e521]:
                  - generic [ref=e522]: 🏷️
                  - generic [ref=e523]: ZZZfull category
                - button "No priority - click for Low" [ref=e525] [cursor=pointer]
                - button "Delete" [ref=e532] [cursor=pointer]:
                  - generic [ref=e533]: 
              - generic [ref=e536]:
                - generic [ref=e537]:
                  - generic [ref=e538]: 🏷️
                  - generic [ref=e539]: ZZZfull category
                - button "No priority - click for Low" [ref=e541] [cursor=pointer]
                - button "Delete" [ref=e548] [cursor=pointer]:
                  - generic [ref=e549]: 
              - generic [ref=e552]:
                - generic [ref=e553]:
                  - generic [ref=e554]: 🏷️
                  - generic [ref=e555]: ZZZ payload
                - button "No priority - click for Low" [ref=e557] [cursor=pointer]
                - button "Delete" [ref=e564] [cursor=pointer]:
                  - generic [ref=e565]: 
              - generic [ref=e568]:
                - generic [ref=e569]:
                  - generic [ref=e570]: 🏷️
                  - generic [ref=e571]: ZZZfull category
                - button "No priority - click for Low" [ref=e573] [cursor=pointer]
                - button "Delete" [ref=e580] [cursor=pointer]:
                  - generic [ref=e581]: 
              - generic [ref=e584]:
                - generic [ref=e585]:
                  - generic [ref=e586]: 🏷️
                  - generic [ref=e587]: ZZZfull category
                - button "No priority - click for Low" [ref=e589] [cursor=pointer]
                - button "Delete" [ref=e596] [cursor=pointer]:
                  - generic [ref=e597]: 
              - generic [ref=e600]:
                - generic [ref=e601]:
                  - generic [ref=e602]: 🏷️
                  - generic [ref=e603]: ZZZ payload
                - button "No priority - click for Low" [ref=e605] [cursor=pointer]
                - button "Delete" [ref=e612] [cursor=pointer]:
                  - generic [ref=e613]: 
              - generic [ref=e616]:
                - generic [ref=e617]:
                  - generic [ref=e618]: 🏷️
                  - generic [ref=e619]: ZZZfull category
                - button "No priority - click for Low" [ref=e621] [cursor=pointer]
                - button "Delete" [ref=e628] [cursor=pointer]:
                  - generic [ref=e629]: 
              - generic [ref=e632]:
                - generic [ref=e633]:
                  - generic [ref=e634]: 🏷️
                  - generic [ref=e635]: ZZZfull category
                - button "No priority - click for Low" [ref=e637] [cursor=pointer]
                - button "Delete" [ref=e644] [cursor=pointer]:
                  - generic [ref=e645]: 
              - generic [ref=e648]:
                - generic [ref=e649]:
                  - generic [ref=e650]: 🏷️
                  - generic [ref=e651]: ZZZtpl child
                - button "No priority - click for Low" [ref=e653] [cursor=pointer]
                - button "Delete" [ref=e660] [cursor=pointer]:
                  - generic [ref=e661]: 
              - generic [ref=e664]:
                - generic [ref=e665]:
                  - generic [ref=e666]: 🏷️
                  - generic [ref=e667]: New Area Test
                - button "No priority - click for Low" [ref=e669] [cursor=pointer]
                - button "Delete" [ref=e676] [cursor=pointer]:
                  - generic [ref=e677]: 
              - generic [ref=e680]:
                - generic [ref=e681]:
                  - generic [ref=e682]: 🏷️
                  - generic [ref=e683]: Test Area
                - button "No priority - click for Low" [ref=e685] [cursor=pointer]
                - button "Delete" [ref=e692] [cursor=pointer]:
                  - generic [ref=e693]: 
        - text:                                                                                                                                                                                                                                                                                                                                             
  - contentinfo [ref=e694]:
    - paragraph [ref=e696]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
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
> 155 |         await addBtn.click();
      |                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  174 |         await addBtn.click();
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