# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dailies-drop.spec.js >> Copy vs reference >> dropping as a reference
- Location: tests/e2e/dailies-drop.spec.js:135:3

# Error details

```
Error: an area is linked

expect(received).toBeTruthy()

Received: undefined
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - navigation [ref=f1e2]:
    - generic [ref=f1e3]:
      - link "MyWork - v2026.08.19.57" [ref=f1e4] [cursor=pointer]:
        - /url: /
      - generic [ref=f1e5]:
        - button "  Pygmie Studios" [ref=f1e6] [cursor=pointer]:
          - generic [ref=f1e7]: 
          - generic [ref=f1e8]:
            - generic [ref=f1e9]: 
            - text: Pygmie Studios
        - text: 
      - link "Settings" [ref=f1e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=f1e11]: 
  - generic [ref=f1e12]:
    - tablist [ref=f1e13]:
      - button "⭐ Dailies" [ref=f1e14] [cursor=pointer]:
        - generic [ref=f1e15]: ⭐
        - text: Dailies
      - button "📋 Templates" [ref=f1e16] [cursor=pointer]:
        - generic [ref=f1e17]: 📋
        - text: Templates
      - listitem [ref=f1e18]
      - tab "🏁 Tests" [ref=f1e19] [cursor=pointer]:
        - generic [ref=f1e20]: 🏁
        - text: Tests
      - tab "📍 Projects" [ref=f1e21] [cursor=pointer]:
        - generic [ref=f1e22]: 📍
        - text: Projects
      - tab "🏷️ Categories" [ref=f1e23] [cursor=pointer]:
        - generic [ref=f1e24]: 🏷️
        - text: Categories
      - tab "🎯 Goals" [ref=f1e25] [cursor=pointer]:
        - generic [ref=f1e26]: 🎯
        - text: Goals
      - tab "✅ Todos" [ref=f1e27] [cursor=pointer]:
        - generic [ref=f1e28]: ✅
        - text: Todos
      - tab "📝 Tasks" [ref=f1e29] [cursor=pointer]:
        - generic [ref=f1e30]: 📝
        - text: Tasks
      - tab "🎟️ Tickets" [ref=f1e31] [cursor=pointer]:
        - generic [ref=f1e32]: 🎟️
        - text: Tickets
      - tab "💡 Ideas" [ref=f1e33] [cursor=pointer]:
        - generic [ref=f1e34]: 💡
        - text: Ideas
      - listitem [ref=f1e35]
      - button "📊 Priority Board" [ref=f1e36] [cursor=pointer]:
        - generic [ref=f1e37]: 📊
        - text: Priority Board
      - tab "📈 Reporting" [ref=f1e38] [cursor=pointer]:
        - generic [ref=f1e39]: 📈
        - text: Reporting
    - generic [ref=f1e40]:
      - complementary [ref=f1e41]:
        - generic [ref=f1e42]:
          - button " Calendar" [ref=f1e44] [cursor=pointer]:
            - generic [ref=f1e45]: 
            - text: Calendar
          - generic [ref=f1e46]:
            - tabpanel [ref=f1e49]:
              - generic [ref=f1e50]:
                - generic [ref=f1e51]:
                  - button "Previous month" [ref=f1e52] [cursor=pointer]: ‹
                  - heading "August 2026" [level=6] [ref=f1e53]
                  - button "Next month" [ref=f1e54] [cursor=pointer]: ›
                - table [ref=f1e55]:
                  - rowgroup [ref=f1e56]:
                    - row [ref=f1e57]:
                      - columnheader "Sun" [ref=f1e58]
                      - columnheader "Mon" [ref=f1e59]
                      - columnheader "Tue" [ref=f1e60]
                      - columnheader "Wed" [ref=f1e61]
                      - columnheader "Thu" [ref=f1e62]
                      - columnheader "Fri" [ref=f1e63]
                      - columnheader "Sat" [ref=f1e64]
                    - row [ref=f1e65]:
                      - cell [ref=f1e66]
                      - cell [ref=f1e67]
                      - cell [ref=f1e68]
                      - cell [ref=f1e69]
                      - cell [ref=f1e70]
                      - cell [ref=f1e71]
                      - cell "1" [ref=f1e72] [cursor=pointer]
                    - row [ref=f1e73]:
                      - cell "2" [ref=f1e74] [cursor=pointer]
                      - cell "3" [ref=f1e75] [cursor=pointer]
                      - cell "4" [ref=f1e76] [cursor=pointer]
                      - cell "5" [ref=f1e77] [cursor=pointer]
                      - cell "6" [ref=f1e78] [cursor=pointer]
                      - cell "7" [ref=f1e79] [cursor=pointer]
                      - cell "8" [ref=f1e80] [cursor=pointer]
                    - row [ref=f1e81]:
                      - cell "9" [ref=f1e82] [cursor=pointer]
                      - cell "10" [ref=f1e83] [cursor=pointer]
                      - cell "11" [ref=f1e84] [cursor=pointer]
                      - cell "12" [ref=f1e85] [cursor=pointer]
                      - cell "13" [ref=f1e86] [cursor=pointer]
                      - cell "14" [ref=f1e87] [cursor=pointer]
                      - cell "15" [ref=f1e88] [cursor=pointer]
                    - row [ref=f1e89]:
                      - cell "16" [ref=f1e90] [cursor=pointer]
                      - cell "17" [ref=f1e91] [cursor=pointer]
                      - cell "18" [ref=f1e92] [cursor=pointer]
                      - cell "19" [ref=f1e93] [cursor=pointer]
                      - cell "20" [ref=f1e94] [cursor=pointer]
                      - cell "21" [ref=f1e95] [cursor=pointer]
                      - cell "22" [ref=f1e96] [cursor=pointer]
                    - row [ref=f1e97]:
                      - cell "23" [ref=f1e98] [cursor=pointer]
                      - cell "24" [ref=f1e99] [cursor=pointer]
                      - cell "25" [ref=f1e100] [cursor=pointer]
                      - cell "26" [ref=f1e101] [cursor=pointer]
                      - cell "27" [ref=f1e102] [cursor=pointer]
                      - cell "28" [ref=f1e103] [cursor=pointer]
                      - cell "29" [ref=f1e104] [cursor=pointer]
                    - row [ref=f1e105]:
                      - cell "30" [ref=f1e106] [cursor=pointer]
                      - cell "31" [ref=f1e107] [cursor=pointer]
                      - cell [ref=f1e108]
                      - cell [ref=f1e109]
                      - cell [ref=f1e110]
                      - cell [ref=f1e111]
                      - cell [ref=f1e112]
            - generic [ref=f1e116]:
              - heading "Work Items for Thursday, Aug 20" [level=6] [ref=f1e118]
              - generic [ref=f1e119]:
                - generic "What the work is. Click a row to expand what is linked to it; double-click to edit." [ref=f1e120]: Title
                - generic "Oh! - flag this as something that came up unexpectedly, rather than planned work" [ref=f1e121]: Oh!
                - generic "When the work is scheduled to start" [ref=f1e122]: Time
                - generic "Not Started, In Progress or Complete. Click the badge on a row to cycle it." [ref=f1e123]: Status
                - generic "How long you intend to spend on this, in hours. Totals for the day show beside the date." [ref=f1e124]: Time Box
                - generic "Notes written by Claude for this item" [ref=f1e125]: Claude
                - generic "Your own notes for this item" [ref=f1e126]: Notes
                - generic "Remove this item from the day" [ref=f1e127]: Actions
              - generic [ref=f1e128]:
                - generic "Click to change status, double-click to edit; drag to reorder" [ref=f1e130]:
                  - generic:
                    - generic "Expand/collapse" [ref=f1e131]: 
                    - generic "Work Item" [ref=f1e132]: 
                    - generic: ZZZcr reference src
                  - generic "Oh! Click to pick an emoji"
                  - generic "Meeting start time" [ref=f1e133]: "-"
                  - generic "Click to change status" [ref=f1e134] [cursor=pointer]: Not Started
                  - generic "Click to change time box" [ref=f1e135] [cursor=pointer]: No time box
                  - 'generic "Toggle: worked with Claude" [ref=f1e136] [cursor=pointer]': 
                  - generic "No notes - double-click to add" [ref=f1e138] [cursor=pointer]: 
                  - button "Delete" [ref=f1e141] [cursor=pointer]:
                    - generic [ref=f1e142]: 
                - generic "Click to change status, double-click to edit; drag to reorder" [ref=f1e144]:
                  - generic:
                    - generic "Expand/collapse" [ref=f1e145]: 
                    - generic "Work Item" [ref=f1e146]: 
                    - generic: ZZZcr reference src
                  - generic "Oh! Click to pick an emoji"
                  - generic "Meeting start time" [ref=f1e147]: "-"
                  - generic "Click to change status" [ref=f1e148] [cursor=pointer]: Not Started
                  - generic "Click to change time box" [ref=f1e149] [cursor=pointer]: No time box
                  - 'generic "Toggle: worked with Claude" [ref=f1e150] [cursor=pointer]': 
                  - generic "No notes - double-click to add" [ref=f1e152] [cursor=pointer]: 
                  - button "Delete" [ref=f1e155] [cursor=pointer]:
                    - generic [ref=f1e156]: 
        - text:                    
      - text:            
      - generic [ref=f1e158]:
        - text:                       
        - generic [ref=f1e162]:
          - generic [ref=f1e163]:
            - group [ref=f1e165]:
              - button " Expand All" [ref=f1e166] [cursor=pointer]:
                - generic [ref=f1e167]: 
                - text: Expand All
              - button " Collapse All" [ref=f1e168] [cursor=pointer]:
                - generic [ref=f1e169]: 
                - text: Collapse All
            - group [ref=f1e171]:
              - button " + Folder" [ref=f1e172] [cursor=pointer]:
                - generic [ref=f1e173]: 
                - text: + Folder
              - button "+ New Category" [ref=f1e174] [cursor=pointer]
          - text: 
          - generic [ref=f1e176]:
            - generic [ref=f1e177]:
              - generic "Drag to reorder columns" [ref=f1e178]:
                - button "Title" [ref=f1e179] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f1e180]:
                - button "Priority" [ref=f1e181] [cursor=pointer]
              - group [ref=f1e183]:
                - button "" [ref=f1e184] [cursor=pointer]
                - button "" [ref=f1e186] [cursor=pointer]
            - generic [ref=f1e188]:
              - generic [ref=f1e189]:
                - generic [ref=f1e191]:
                  - generic [ref=f1e192]:
                    - generic [ref=f1e193] [cursor=pointer]: ▶
                    - generic [ref=f1e194]: 📁
                    - generic [ref=f1e195]: F1
                    - generic "1 item inside" [ref=f1e196]: (1)
                  - button "Delete" [ref=f1e198] [cursor=pointer]:
                    - generic [ref=f1e199]: 
                - generic [ref=f1e203]:
                  - generic [ref=f1e204]:
                    - generic [ref=f1e205]: 🏷️
                    - generic [ref=f1e206]: C2
                  - button "No priority - click for Low" [ref=f1e208] [cursor=pointer]
                  - button "Delete" [ref=f1e215] [cursor=pointer]:
                    - generic [ref=f1e216]: 
              - generic [ref=f1e217]:
                - generic [ref=f1e219]:
                  - generic [ref=f1e220]:
                    - generic [ref=f1e221] [cursor=pointer]: ▶
                    - generic [ref=f1e222]: 📁
                    - generic [ref=f1e223]: F2
                    - generic "1 item inside" [ref=f1e224]: (1)
                  - button "Delete" [ref=f1e226] [cursor=pointer]:
                    - generic [ref=f1e227]: 
                - generic [ref=f1e231]:
                  - generic [ref=f1e232]:
                    - generic [ref=f1e233]: 🏷️
                    - generic [ref=f1e234]: C1
                  - button "No priority - click for Low" [ref=f1e236] [cursor=pointer]
                  - button "Delete" [ref=f1e243] [cursor=pointer]:
                    - generic [ref=f1e244]: 
              - generic [ref=f1e247]:
                - generic [ref=f1e248]:
                  - generic [ref=f1e249]: 🏷️
                  - generic [ref=f1e250]: ZZZfull category
                - button "No priority - click for Low" [ref=f1e252] [cursor=pointer]
                - button "Delete" [ref=f1e259] [cursor=pointer]:
                  - generic [ref=f1e260]: 
              - generic [ref=f1e263]:
                - generic [ref=f1e264]:
                  - generic [ref=f1e265]: 🏷️
                  - generic [ref=f1e266]: ZZZfull category
                - button "No priority - click for Low" [ref=f1e268] [cursor=pointer]
                - button "Delete" [ref=f1e275] [cursor=pointer]:
                  - generic [ref=f1e276]: 
              - generic [ref=f1e279]:
                - generic [ref=f1e280]:
                  - generic [ref=f1e281]: 🏷️
                  - generic [ref=f1e282]: ZZZfull category
                - button "No priority - click for Low" [ref=f1e284] [cursor=pointer]
                - button "Delete" [ref=f1e291] [cursor=pointer]:
                  - generic [ref=f1e292]: 
              - generic [ref=f1e295]:
                - generic [ref=f1e296]:
                  - generic [ref=f1e297]: 🏷️
                  - generic [ref=f1e298]: ZZZfull category
                - button "No priority - click for Low" [ref=f1e300] [cursor=pointer]
                - button "Delete" [ref=f1e307] [cursor=pointer]:
                  - generic [ref=f1e308]: 
              - generic [ref=f1e311]:
                - generic [ref=f1e312]:
                  - generic [ref=f1e313]: 🏷️
                  - generic [ref=f1e314]: ZZZtpl child
                - button "No priority - click for Low" [ref=f1e316] [cursor=pointer]
                - button "Delete" [ref=f1e323] [cursor=pointer]:
                  - generic [ref=f1e324]: 
              - generic [ref=f1e325]:
                - generic [ref=f1e327]:
                  - generic [ref=f1e328]:
                    - generic [ref=f1e329] [cursor=pointer]: ▶
                    - generic [ref=f1e330]: 🏷️
                    - generic [ref=f1e331]: ZZZcr reference src
                    - generic "1 item inside" [ref=f1e332]: (1)
                  - button "No priority - click for Low" [ref=f1e334] [cursor=pointer]
                  - button "Delete" [ref=f1e341] [cursor=pointer]:
                    - generic [ref=f1e342]: 
                - generic [ref=f1e346]:
                  - generic [ref=f1e347]:
                    - generic [ref=f1e348]: 🏷️
                    - generic [ref=f1e349]: ZZZcr reference kid
                  - button "No priority - click for Low" [ref=f1e351] [cursor=pointer]
                  - button "Delete" [ref=f1e358] [cursor=pointer]:
                    - generic [ref=f1e359]: 
              - generic [ref=f1e360]:
                - generic [ref=f1e362]:
                  - generic [ref=f1e363]:
                    - generic [ref=f1e364] [cursor=pointer]: ▶
                    - generic [ref=f1e365]: 🏷️
                    - generic [ref=f1e366]: ZZZcr reference src
                    - generic "1 item inside" [ref=f1e367]: (1)
                  - button "No priority - click for Low" [ref=f1e369] [cursor=pointer]
                  - button "Delete" [ref=f1e376] [cursor=pointer]:
                    - generic [ref=f1e377]: 
                - generic [ref=f1e381]:
                  - generic [ref=f1e382]:
                    - generic [ref=f1e383]: 🏷️
                    - generic [ref=f1e384]: ZZZcr reference kid
                  - button "No priority - click for Low" [ref=f1e386] [cursor=pointer]
                  - button "Delete" [ref=f1e393] [cursor=pointer]:
                    - generic [ref=f1e394]: 
        - text:                                                      
  - contentinfo [ref=f1e395]:
    - paragraph [ref=f1e397]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
  52  |   });
  53  | 
  54  |   for (const type of TYPES) {
  55  |     test(`a ${type.slug} row dropped on an empty day becomes a work item holding it`, async ({ page }) => {
  56  |       await page.goto(`/?tab=${type.slug}`);
  57  |       await page.waitForLoadState('networkidle');
  58  |       await page.waitForTimeout(1500);
  59  | 
  60  |       const entity = (await api(page, `/api/entities/${type.slug}`, {
  61  |         method: 'POST', body: JSON.stringify({ title: `ZZZ drop ${type.slug}` }),
  62  |       })).body.data;
  63  |       await page.reload({ waitUntil: 'networkidle' });
  64  |       await page.waitForTimeout(1500);
  65  | 
  66  |       await page.evaluate(({ id, dropType, title }) => {
  67  |         const dt = new DataTransfer();
  68  |         dt.setData('type', dropType);
  69  |         dt.setData('id', String(id));
  70  |         dt.setData('name', title);
  71  |         dt.setData('text/plain', title);
  72  |         document.getElementById('dailiesCenterPane')
  73  |           .dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  74  |         document.getElementById('workItemsList')
  75  |           .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  76  |       }, { id: entity.id, dropType: type.dropType, title: `ZZZ drop ${type.slug}` });
  77  | 
  78  |       // Every typed-row drop now asks copy or reference; take reference, which
  79  |       // is the behaviour these cases were written against.
  80  |       await page.locator('#copyOrReferenceRefBtn').click();
  81  |       await page.waitForTimeout(1400);
  82  | 
  83  |       const items = (await api(page, `/api/work/date/${today()}`)).body.data;
  84  |       const made = items.find(w => w.title === `ZZZ drop ${type.slug}`);
  85  |       expect(made, `dropping a ${type.slug} should create a work item`).toBeTruthy();
  86  |       expect((made[type.key] || []).some(x => x.id === entity.id)).toBe(true);
  87  |     });
  88  |   }
  89  | 
  90  |   test('the generic row drag publishes what Dailies reads', async ({ page }) => {
  91  |     await page.goto('/?tab=area');
  92  |     await page.waitForLoadState('networkidle');
  93  |     await page.waitForTimeout(1500);
  94  |     await api(page, '/api/entities/area', { method: 'POST', body: JSON.stringify({ title: 'ZZZ payload' }) });
  95  |     await page.reload({ waitUntil: 'networkidle' });
  96  |     await page.waitForTimeout(1500);
  97  | 
  98  |     const payload = await page.evaluate(() => {
  99  |       const row = [...document.querySelectorAll('#areaEntityList .entity-row')]
  100 |         .find(r => r.textContent.includes('ZZZ payload'));
  101 |       const dt = new DataTransfer();
  102 |       row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  103 |       return { type: dt.getData('type'), id: dt.getData('id'), name: dt.getData('name') };
  104 |     });
  105 |     expect(payload.type).toBe('area');
  106 |     expect(payload.id).not.toBe('');
  107 |     expect(payload.name).toBe('ZZZ payload');
  108 |   });
  109 | });
  110 | 
  111 | 
  112 | /**
  113 |  * Copy vs reference. A typed row dropped on a day can be either, and the two
  114 |  * behave differently afterwards, so the drop asks:
  115 |  *   - reference -> links the original; editing it here edits the original
  116 |  *   - copy      -> an independent clone of the row AND everything nested in it
  117 |  * Templates never ask - a template is always a full copy.
  118 |  */
  119 | async function drop(page, id, title) {
  120 |   await page.evaluate(({id,title}) => {
  121 |     const dt = new DataTransfer();
  122 |     dt.setData('type','area'); dt.setData('id',String(id)); dt.setData('name',title); dt.setData('text/plain',title);
  123 |     document.getElementById('dailiesCenterPane').dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
  124 |     document.getElementById('workItemsList').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  125 |   }, {id,title});
  126 |   await page.waitForTimeout(500);
  127 | }
  128 | 
  129 | // Serial, and prefixed uniquely: these create and delete Areas, and other specs
  130 | // in this suite do too - run in parallel they delete each other's fixtures.
  131 | test.describe('Copy vs reference', () => {
  132 |   test.describe.configure({ mode: 'serial' });
  133 | 
  134 | for (const mode of ['reference','copy']) {
  135 |   test(`dropping as a ${mode}`, async ({ page }) => {
  136 |     await page.goto('/?tab=area'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1600);
  137 |     const parent = (await api(page,'/api/entities/area',{method:'POST',body:JSON.stringify({title:`ZZZcr ${mode} src`})})).body.data;
  138 |     const child  = (await api(page,'/api/entities/area',{method:'POST',body:JSON.stringify({title:`ZZZcr ${mode} kid`})})).body.data;
  139 |     await api(page,`/api/entities/area/${child.id}/relationships`,{method:'POST',
  140 |       body:JSON.stringify({parentEntityId:parent.id, childEntityId:child.id, relationshipKind:'hierarchy'})});
  141 |     await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(1600);
  142 | 
  143 |     await drop(page, parent.id, `ZZZcr ${mode} src`);
  144 |     await expect(page.locator('#copyOrReferenceModal')).toBeVisible();
  145 |     await page.locator(mode === 'copy' ? '#copyOrReferenceCopyBtn' : '#copyOrReferenceRefBtn').click();
  146 |     await page.waitForTimeout(1600);
  147 | 
  148 |     const items = (await api(page,`/api/work/date/${today()}`)).body.data;
  149 |     const wi = items.find(w => w.title === `ZZZcr ${mode} src`);
  150 |     expect(wi, 'work item created').toBeTruthy();
  151 |     const linked = (wi.areas || [])[0];
> 152 |     expect(linked, 'an area is linked').toBeTruthy();
      |                                         ^ Error: an area is linked
  153 | 
  154 |     const areas = (await api(page,'/api/entities/area')).body.data;
  155 |     if (mode === 'reference') {
  156 |       expect(linked.id).toBe(parent.id);
  157 |       expect(linked.isCopy).toBe(false);
  158 |       expect(areas.filter(a=>a.title===`ZZZcr ${mode} src`).length).toBe(1);   // nothing duplicated
  159 |     } else {
  160 |       expect(linked.id).not.toBe(parent.id);
  161 |       expect(linked.isCopy).toBe(true);
  162 |       expect(areas.filter(a=>a.title===`ZZZcr ${mode} src`).length).toBe(2);   // original + copy
  163 |       expect(areas.filter(a=>a.title===`ZZZcr ${mode} kid`).length).toBe(2);   // child copied too
  164 |     }
  165 |     console.log(mode, '->', JSON.stringify({linkedId: linked.id, srcId: parent.id, isCopy: linked.isCopy}));
  166 | 
  167 |     // badge rendered
  168 |     const badge = await page.locator(`.child-item-row[data-origin="${mode}"] .child-origin`).count();
  169 |     expect(badge).toBeGreaterThan(0);
  170 | 
  171 |     for (const w of items.filter(x=>(x.title||'').startsWith('ZZZcr'))) await api(page,`/api/work/${w.id}`,{method:'DELETE'});
  172 |     for (const a of areas.filter(x=>(x.title||'').startsWith('ZZZcr'))) await api(page,`/api/entities/area/${a.id}`,{method:'DELETE'});
  173 |   });
  174 | }
  175 | });
  176 | 
```