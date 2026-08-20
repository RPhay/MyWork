# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-old-comp.spec.js >> Editable Types - Comprehensive Functionality >> Todo Type >> [Todo] Can create a folder
- Location: tests/e2e/zzz-old-comp.spec.js:137:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-tab="todo"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
              - button "+ New Project" [ref=e136] [cursor=pointer]
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
                - button "Links" [ref=e147] [cursor=pointer]
              - group [ref=e149]:
                - button "" [ref=e150] [cursor=pointer]
                - button "" [ref=e152] [cursor=pointer]
            - generic [ref=e154]:
              - generic [ref=e157]:
                - generic [ref=e158]:
                  - generic [ref=e159]: 📍
                  - generic [ref=e160]: Test Project for Context Menu
                - button "Low - click for Medium" [ref=e162] [cursor=pointer]
                - button "Not Started" [ref=e169] [cursor=pointer]
                - button "Delete" [ref=e171] [cursor=pointer]:
                  - generic [ref=e172]: 
              - generic [ref=e173]:
                - generic [ref=e175]:
                  - generic [ref=e176]:
                    - generic [ref=e177] [cursor=pointer]: ▶
                    - generic [ref=e178]: 📁
                    - generic [ref=e179]: Test
                    - generic "2 items inside" [ref=e180]: (2)
                  - button "Delete" [ref=e182] [cursor=pointer]:
                    - generic [ref=e183]: 
                - generic [ref=e184]:
                  - generic [ref=e185]:
                    - generic [ref=e187]:
                      - generic [ref=e188]:
                        - generic [ref=e189] [cursor=pointer]: ▶
                        - generic [ref=e190]: 📁
                        - generic [ref=e191]: T2
                        - generic "1 item inside" [ref=e192]: (1)
                      - button "Delete" [ref=e194] [cursor=pointer]:
                        - generic [ref=e195]: 
                    - generic [ref=e199]:
                      - generic [ref=e200]:
                        - generic [ref=e201]: 📍
                        - generic [ref=e202]: Test Project for Context Menu
                      - button "No priority - click for Low" [ref=e204] [cursor=pointer]
                      - button "Not Started" [ref=e211] [cursor=pointer]
                      - button "Delete" [ref=e213] [cursor=pointer]:
                        - generic [ref=e214]: 
                  - generic [ref=e217]:
                    - generic [ref=e218]:
                      - generic [ref=e219]: 📍
                      - generic [ref=e220]: test
                    - button "No priority - click for Low" [ref=e222] [cursor=pointer]
                    - button "Not Started" [ref=e229] [cursor=pointer]
                    - button "Delete" [ref=e231] [cursor=pointer]:
                      - generic [ref=e232]: 
              - generic [ref=e235]:
                - generic [ref=e236]:
                  - generic [ref=e237]: 📍
                  - generic [ref=e238]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e240] [cursor=pointer]
                - button "Not Started" [ref=e247] [cursor=pointer]
                - button "Delete" [ref=e249] [cursor=pointer]:
                  - generic [ref=e250]: 
              - generic [ref=e253]:
                - generic [ref=e254]:
                  - generic [ref=e255]: 📍
                  - generic [ref=e256]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e258] [cursor=pointer]
                - button "Not Started" [ref=e265] [cursor=pointer]
                - button "Delete" [ref=e267] [cursor=pointer]:
                  - generic [ref=e268]: 
              - generic [ref=e271]:
                - generic [ref=e272]:
                  - generic [ref=e273]: 📍
                  - generic [ref=e274]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e276] [cursor=pointer]
                - button "Not Started" [ref=e283] [cursor=pointer]
                - button "Delete" [ref=e285] [cursor=pointer]:
                  - generic [ref=e286]: 
              - generic [ref=e289]:
                - generic [ref=e290]:
                  - generic [ref=e291]: 📍
                  - generic [ref=e292]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e294] [cursor=pointer]
                - button "Not Started" [ref=e301] [cursor=pointer]
                - button "Delete" [ref=e303] [cursor=pointer]:
                  - generic [ref=e304]: 
              - generic [ref=e307]:
                - generic [ref=e308]:
                  - generic [ref=e309]: 📍
                  - generic [ref=e310]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e312] [cursor=pointer]
                - button "Not Started" [ref=e319] [cursor=pointer]
                - button "Delete" [ref=e321] [cursor=pointer]:
                  - generic [ref=e322]: 
              - generic [ref=e325]:
                - generic [ref=e326]:
                  - generic [ref=e327]: 📍
                  - generic [ref=e328]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e330] [cursor=pointer]
                - button "Not Started" [ref=e337] [cursor=pointer]
                - button "Delete" [ref=e339] [cursor=pointer]:
                  - generic [ref=e340]: 
              - generic [ref=e343]:
                - generic [ref=e344]:
                  - generic [ref=e345]: 📍
                  - generic [ref=e346]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e348] [cursor=pointer]
                - button "Not Started" [ref=e355] [cursor=pointer]
                - button "Delete" [ref=e357] [cursor=pointer]:
                  - generic [ref=e358]: 
              - generic [ref=e361]:
                - generic [ref=e362]:
                  - generic [ref=e363]: 📍
                  - generic [ref=e364]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e366] [cursor=pointer]
                - button "Not Started" [ref=e373] [cursor=pointer]
                - button "Delete" [ref=e375] [cursor=pointer]:
                  - generic [ref=e376]: 
              - generic [ref=e379]:
                - generic [ref=e380]:
                  - generic [ref=e381]: 📍
                  - generic [ref=e382]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e384] [cursor=pointer]
                - button "Not Started" [ref=e391] [cursor=pointer]
                - button "Delete" [ref=e393] [cursor=pointer]:
                  - generic [ref=e394]: 
              - generic [ref=e397]:
                - generic [ref=e398]:
                  - generic [ref=e399]: 📍
                  - generic [ref=e400]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e402] [cursor=pointer]
                - button "Not Started" [ref=e409] [cursor=pointer]
                - button "Delete" [ref=e411] [cursor=pointer]:
                  - generic [ref=e412]: 
              - generic [ref=e415]:
                - generic [ref=e416]:
                  - generic [ref=e417]: 📍
                  - generic [ref=e418]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e420] [cursor=pointer]
                - button "Not Started" [ref=e427] [cursor=pointer]
                - button "Delete" [ref=e429] [cursor=pointer]:
                  - generic [ref=e430]: 
              - generic [ref=e433]:
                - generic [ref=e434]:
                  - generic [ref=e435]: 📍
                  - generic [ref=e436]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e438] [cursor=pointer]
                - button "Not Started" [ref=e445] [cursor=pointer]
                - button "Delete" [ref=e447] [cursor=pointer]:
                  - generic [ref=e448]: 
              - generic [ref=e451]:
                - generic [ref=e452]:
                  - generic [ref=e453]: 📍
                  - generic [ref=e454]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e456] [cursor=pointer]
                - button "Not Started" [ref=e463] [cursor=pointer]
                - button "Delete" [ref=e465] [cursor=pointer]:
                  - generic [ref=e466]: 
              - generic [ref=e469]:
                - generic [ref=e470]:
                  - generic [ref=e471]: 📍
                  - generic [ref=e472]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e474] [cursor=pointer]
                - button "Not Started" [ref=e481] [cursor=pointer]
                - button "Delete" [ref=e483] [cursor=pointer]:
                  - generic [ref=e484]: 
              - generic [ref=e487]:
                - generic [ref=e488]:
                  - generic [ref=e489]: 📍
                  - generic [ref=e490]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e492] [cursor=pointer]
                - button "Not Started" [ref=e499] [cursor=pointer]
                - button "Delete" [ref=e501] [cursor=pointer]:
                  - generic [ref=e502]: 
              - generic [ref=e505]:
                - generic [ref=e506]:
                  - generic [ref=e507]: 📍
                  - generic [ref=e508]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e510] [cursor=pointer]
                - button "Not Started" [ref=e517] [cursor=pointer]
                - button "Delete" [ref=e519] [cursor=pointer]:
                  - generic [ref=e520]: 
              - generic [ref=e523]:
                - generic [ref=e524]:
                  - generic [ref=e525]: 📍
                  - generic [ref=e526]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e528] [cursor=pointer]
                - button "Not Started" [ref=e535] [cursor=pointer]
                - button "Delete" [ref=e537] [cursor=pointer]:
                  - generic [ref=e538]: 
              - generic [ref=e541]:
                - generic [ref=e542]:
                  - generic [ref=e543]: 📍
                  - generic [ref=e544]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e546] [cursor=pointer]
                - button "Not Started" [ref=e553] [cursor=pointer]
                - button "Delete" [ref=e555] [cursor=pointer]:
                  - generic [ref=e556]: 
              - generic [ref=e559]:
                - generic [ref=e560]:
                  - generic [ref=e561]: 📍
                  - generic [ref=e562]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e564] [cursor=pointer]
                - button "Not Started" [ref=e571] [cursor=pointer]
                - button "Delete" [ref=e573] [cursor=pointer]:
                  - generic [ref=e574]: 
              - generic [ref=e577]:
                - generic [ref=e578]:
                  - generic [ref=e579]: 📍
                  - generic [ref=e580]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e582] [cursor=pointer]
                - button "Not Started" [ref=e589] [cursor=pointer]
                - button "Delete" [ref=e591] [cursor=pointer]:
                  - generic [ref=e592]: 
              - generic [ref=e595]:
                - generic [ref=e596]:
                  - generic [ref=e597]: 📍
                  - generic [ref=e598]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e600] [cursor=pointer]
                - button "Not Started" [ref=e607] [cursor=pointer]
                - button "Delete" [ref=e609] [cursor=pointer]:
                  - generic [ref=e610]: 
              - generic [ref=e613]:
                - generic [ref=e614]:
                  - generic [ref=e615]: 📍
                  - generic [ref=e616]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e618] [cursor=pointer]
                - button "Not Started" [ref=e625] [cursor=pointer]
                - button "Delete" [ref=e627] [cursor=pointer]:
                  - generic [ref=e628]: 
              - generic [ref=e631]:
                - generic [ref=e632]:
                  - generic [ref=e633]: 📍
                  - generic [ref=e634]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e636] [cursor=pointer]
                - button "Not Started" [ref=e643] [cursor=pointer]
                - button "Delete" [ref=e645] [cursor=pointer]:
                  - generic [ref=e646]: 
              - generic [ref=e649]:
                - generic [ref=e650]:
                  - generic [ref=e651]: 📍
                  - generic [ref=e652]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e654] [cursor=pointer]
                - button "Not Started" [ref=e661] [cursor=pointer]
                - button "Delete" [ref=e663] [cursor=pointer]:
                  - generic [ref=e664]: 
              - generic [ref=e667]:
                - generic [ref=e668]:
                  - generic [ref=e669]: 📍
                  - generic [ref=e670]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e672] [cursor=pointer]
                - button "Not Started" [ref=e679] [cursor=pointer]
                - button "Delete" [ref=e681] [cursor=pointer]:
                  - generic [ref=e682]: 
              - generic [ref=e685]:
                - generic [ref=e686]:
                  - generic [ref=e687]: 📍
                  - generic [ref=e688]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e690] [cursor=pointer]
                - button "Not Started" [ref=e697] [cursor=pointer]
                - button "Delete" [ref=e699] [cursor=pointer]:
                  - generic [ref=e700]: 
              - generic [ref=e703]:
                - generic [ref=e704]:
                  - generic [ref=e705]: 📍
                  - generic [ref=e706]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e708] [cursor=pointer]
                - button "Not Started" [ref=e715] [cursor=pointer]
                - button "Delete" [ref=e717] [cursor=pointer]:
                  - generic [ref=e718]: 
              - generic [ref=e721]:
                - generic [ref=e722]:
                  - generic [ref=e723]: 📍
                  - generic [ref=e724]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e726] [cursor=pointer]
                - button "Not Started" [ref=e733] [cursor=pointer]
                - button "Delete" [ref=e735] [cursor=pointer]:
                  - generic [ref=e736]: 
              - generic [ref=e739]:
                - generic [ref=e740]:
                  - generic [ref=e741]: 📍
                  - generic [ref=e742]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e744] [cursor=pointer]
                - button "Not Started" [ref=e751] [cursor=pointer]
                - button "Delete" [ref=e753] [cursor=pointer]:
                  - generic [ref=e754]: 
              - generic [ref=e757]:
                - generic [ref=e758]:
                  - generic [ref=e759]: 📍
                  - generic [ref=e760]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e762] [cursor=pointer]
                - button "Not Started" [ref=e769] [cursor=pointer]
                - button "Delete" [ref=e771] [cursor=pointer]:
                  - generic [ref=e772]: 
              - generic [ref=e775]:
                - generic [ref=e776]:
                  - generic [ref=e777]: 📍
                  - generic [ref=e778]: Test Project for Context Menu
                - button "No priority - click for Low" [ref=e780] [cursor=pointer]
                - button "Not Started" [ref=e787] [cursor=pointer]
                - button "Delete" [ref=e789] [cursor=pointer]:
                  - generic [ref=e790]: 
              - generic [ref=e793]:
                - generic [ref=e794]:
                  - generic [ref=e795]: 📍
                  - generic [ref=e796]: COMPREHENSIVE_TEST_PRIORITY_1787182792913
                - button "No priority - click for Low" [ref=e798] [cursor=pointer]
                - button "Not Started" [ref=e805] [cursor=pointer]
                - button "Delete" [ref=e807] [cursor=pointer]:
                  - generic [ref=e808]: 
              - generic [ref=e811]:
                - generic [ref=e812]:
                  - generic [ref=e813]: 📍
                  - generic [ref=e814]: Fresh Test Priority
                - button "No priority - click for Low" [ref=e816] [cursor=pointer]
                - button "Not Started" [ref=e823] [cursor=pointer]
                - button "Delete" [ref=e825] [cursor=pointer]:
                  - generic [ref=e826]: 
              - generic [ref=e829]:
                - generic [ref=e830]:
                  - generic [ref=e831]: 📍
                  - generic [ref=e832]: Test Priority for Editor
                - button "No priority - click for Low" [ref=e834] [cursor=pointer]
                - button "Not Started" [ref=e841] [cursor=pointer]
                - button "Delete" [ref=e843] [cursor=pointer]:
                  - generic [ref=e844]: 
        - text:                                                                                                                                                                                                                                                                                                                                                                                     
  - contentinfo [ref=e845]:
    - paragraph [ref=e847]: © 2026 MyWork. Licensed under the MIT License.
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
> 22  |         await page.click(`[data-tab="${type.slug}"]`);
      |                    ^ Error: page.click: Test timeout of 30000ms exceeded.
  23  |         await page.waitForLoadState('networkidle');
  24  |       });
  25  | 
  26  |       test(`[${type.label}] Can create a new item`, async () => {
  27  |         // Click add button
  28  |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  29  |         await addBtn.click();
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
```