# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dailies-drop.spec.js >> Dropping onto Dailies >> a area row dropped on an empty day becomes a work item holding it
- Location: tests/e2e/dailies-drop.spec.js:55:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - navigation [ref=f2e2]:
    - generic [ref=f2e3]:
      - link "MyWork - v2026.08.19.57" [ref=f2e4] [cursor=pointer]:
        - /url: /
      - generic [ref=f2e5]:
        - button "  Pygmie Studios" [ref=f2e6] [cursor=pointer]:
          - generic [ref=f2e7]: 
          - generic [ref=f2e8]:
            - generic [ref=f2e9]: 
            - text: Pygmie Studios
        - text: 
      - link "Settings" [ref=f2e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=f2e11]: 
  - generic [ref=f2e12]:
    - tablist [ref=f2e13]:
      - button "⭐ Dailies" [ref=f2e14] [cursor=pointer]:
        - generic [ref=f2e15]: ⭐
        - text: Dailies
      - button "📋 Templates" [ref=f2e16] [cursor=pointer]:
        - generic [ref=f2e17]: 📋
        - text: Templates
      - listitem [ref=f2e18]
      - tab "🏁 Tests" [ref=f2e19] [cursor=pointer]:
        - generic [ref=f2e20]: 🏁
        - text: Tests
      - tab "📍 Projects" [ref=f2e21] [cursor=pointer]:
        - generic [ref=f2e22]: 📍
        - text: Projects
      - tab "🏷️ Categories" [ref=f2e23] [cursor=pointer]:
        - generic [ref=f2e24]: 🏷️
        - text: Categories
      - tab "🎯 Goals" [ref=f2e25] [cursor=pointer]:
        - generic [ref=f2e26]: 🎯
        - text: Goals
      - tab "✅ Todos" [ref=f2e27] [cursor=pointer]:
        - generic [ref=f2e28]: ✅
        - text: Todos
      - tab "📝 Tasks" [ref=f2e29] [cursor=pointer]:
        - generic [ref=f2e30]: 📝
        - text: Tasks
      - tab "🎟️ Tickets" [ref=f2e31] [cursor=pointer]:
        - generic [ref=f2e32]: 🎟️
        - text: Tickets
      - tab "💡 Ideas" [ref=f2e33] [cursor=pointer]:
        - generic [ref=f2e34]: 💡
        - text: Ideas
      - listitem [ref=f2e35]
      - button "📊 Priority Board" [ref=f2e36] [cursor=pointer]:
        - generic [ref=f2e37]: 📊
        - text: Priority Board
      - tab "📈 Reporting" [ref=f2e38] [cursor=pointer]:
        - generic [ref=f2e39]: 📈
        - text: Reporting
    - generic [ref=f2e40]:
      - complementary [ref=f2e41]:
        - generic [ref=f2e42]:
          - button " Calendar" [ref=f2e44] [cursor=pointer]:
            - generic [ref=f2e45]: 
            - text: Calendar
          - generic [ref=f2e46]:
            - tabpanel [ref=f2e49]:
              - generic [ref=f2e50]:
                - generic [ref=f2e51]:
                  - button "Previous month" [ref=f2e52] [cursor=pointer]: ‹
                  - heading "August 2026" [level=6] [ref=f2e53]
                  - button "Next month" [ref=f2e54] [cursor=pointer]: ›
                - table [ref=f2e55]:
                  - rowgroup [ref=f2e56]:
                    - row [ref=f2e57]:
                      - columnheader "Sun" [ref=f2e58]
                      - columnheader "Mon" [ref=f2e59]
                      - columnheader "Tue" [ref=f2e60]
                      - columnheader "Wed" [ref=f2e61]
                      - columnheader "Thu" [ref=f2e62]
                      - columnheader "Fri" [ref=f2e63]
                      - columnheader "Sat" [ref=f2e64]
                    - row [ref=f2e65]:
                      - cell [ref=f2e66]
                      - cell [ref=f2e67]
                      - cell [ref=f2e68]
                      - cell [ref=f2e69]
                      - cell [ref=f2e70]
                      - cell [ref=f2e71]
                      - cell "1" [ref=f2e72] [cursor=pointer]
                    - row [ref=f2e73]:
                      - cell "2" [ref=f2e74] [cursor=pointer]
                      - cell "3" [ref=f2e75] [cursor=pointer]
                      - cell "4" [ref=f2e76] [cursor=pointer]
                      - cell "5" [ref=f2e77] [cursor=pointer]
                      - cell "6" [ref=f2e78] [cursor=pointer]
                      - cell "7" [ref=f2e79] [cursor=pointer]
                      - cell "8" [ref=f2e80] [cursor=pointer]
                    - row [ref=f2e81]:
                      - cell "9" [ref=f2e82] [cursor=pointer]
                      - cell "10" [ref=f2e83] [cursor=pointer]
                      - cell "11" [ref=f2e84] [cursor=pointer]
                      - cell "12" [ref=f2e85] [cursor=pointer]
                      - cell "13" [ref=f2e86] [cursor=pointer]
                      - cell "14" [ref=f2e87] [cursor=pointer]
                      - cell "15" [ref=f2e88] [cursor=pointer]
                    - row [ref=f2e89]:
                      - cell "16" [ref=f2e90] [cursor=pointer]
                      - cell "17" [ref=f2e91] [cursor=pointer]
                      - cell "18" [ref=f2e92] [cursor=pointer]
                      - cell "19" [ref=f2e93] [cursor=pointer]
                      - cell "20" [ref=f2e94] [cursor=pointer]
                      - cell "21" [ref=f2e95] [cursor=pointer]
                      - cell "22" [ref=f2e96] [cursor=pointer]
                    - row [ref=f2e97]:
                      - cell "23" [ref=f2e98] [cursor=pointer]
                      - cell "24" [ref=f2e99] [cursor=pointer]
                      - cell "25" [ref=f2e100] [cursor=pointer]
                      - cell "26" [ref=f2e101] [cursor=pointer]
                      - cell "27" [ref=f2e102] [cursor=pointer]
                      - cell "28" [ref=f2e103] [cursor=pointer]
                      - cell "29" [ref=f2e104] [cursor=pointer]
                    - row [ref=f2e105]:
                      - cell "30" [ref=f2e106] [cursor=pointer]
                      - cell "31" [ref=f2e107] [cursor=pointer]
                      - cell [ref=f2e108]
                      - cell [ref=f2e109]
                      - cell [ref=f2e110]
                      - cell [ref=f2e111]
                      - cell [ref=f2e112]
            - generic [ref=f2e116]:
              - heading "Work Items for Thursday, Aug 20" [level=6] [ref=f2e118]
              - generic [ref=f2e119]:
                - generic "What the work is. Click a row to expand what is linked to it; double-click to edit." [ref=f2e120]: Title
                - generic "Oh! - flag this as something that came up unexpectedly, rather than planned work" [ref=f2e121]: Oh!
                - generic "When the work is scheduled to start" [ref=f2e122]: Time
                - generic "Not Started, In Progress or Complete. Click the badge on a row to cycle it." [ref=f2e123]: Status
                - generic "How long you intend to spend on this, in hours. Totals for the day show beside the date." [ref=f2e124]: Time Box
                - generic "Notes written by Claude for this item" [ref=f2e125]: Claude
                - generic "Your own notes for this item" [ref=f2e126]: Notes
                - generic "Remove this item from the day" [ref=f2e127]: Actions
              - generic [ref=f2e128]:
                - generic "Click to change status, double-click to edit; drag to reorder" [ref=f2e130]:
                  - generic:
                    - generic "Expand/collapse" [ref=f2e131]: 
                    - generic "Work Item" [ref=f2e132]: 
                    - generic: ZZZcr reference src
                  - generic "Oh! Click to pick an emoji"
                  - generic "Meeting start time" [ref=f2e133]: "-"
                  - generic "Click to change status" [ref=f2e134] [cursor=pointer]: Not Started
                  - generic "Click to change time box" [ref=f2e135] [cursor=pointer]: No time box
                  - 'generic "Toggle: worked with Claude" [ref=f2e136] [cursor=pointer]': 
                  - generic "No notes - double-click to add" [ref=f2e138] [cursor=pointer]: 
                  - button "Delete" [ref=f2e141] [cursor=pointer]:
                    - generic [ref=f2e142]: 
                - generic "Click to change status, double-click to edit; drag to reorder" [ref=f2e144]:
                  - generic:
                    - generic "Expand/collapse" [ref=f2e145]: 
                    - generic "Work Item" [ref=f2e146]: 
                    - generic: ZZZ drop area
                  - generic "Oh! Click to pick an emoji"
                  - generic "Meeting start time" [ref=f2e147]: "-"
                  - generic "Click to change status" [ref=f2e148] [cursor=pointer]: Not Started
                  - generic "Click to change time box" [ref=f2e149] [cursor=pointer]: No time box
                  - 'generic "Toggle: worked with Claude" [ref=f2e150] [cursor=pointer]': 
                  - generic "No notes - double-click to add" [ref=f2e152] [cursor=pointer]: 
                  - button "Delete" [ref=f2e155] [cursor=pointer]:
                    - generic [ref=f2e156]: 
        - text:                    
      - text:            
      - generic [ref=f2e158]:
        - text:            
        - generic [ref=f2e162]:
          - generic [ref=f2e163]:
            - group [ref=f2e165]:
              - button " Expand All" [ref=f2e166] [cursor=pointer]:
                - generic [ref=f2e167]: 
                - text: Expand All
              - button " Collapse All" [ref=f2e168] [cursor=pointer]:
                - generic [ref=f2e169]: 
                - text: Collapse All
            - group [ref=f2e171]:
              - button " + Folder" [ref=f2e172] [cursor=pointer]:
                - generic [ref=f2e173]: 
                - text: + Folder
              - button "+ New Project" [ref=f2e174] [cursor=pointer]
          - text: 
          - generic [ref=f2e176]:
            - generic [ref=f2e177]:
              - generic "Drag to reorder columns" [ref=f2e178]:
                - button "Priority" [ref=f2e179] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f2e180]:
                - button "Title" [ref=f2e181] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f2e182]:
                - button "Status" [ref=f2e183] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f2e184]:
                - button "Links" [ref=f2e185] [cursor=pointer]
              - group [ref=f2e187]:
                - button "" [ref=f2e188] [cursor=pointer]
                - button "" [ref=f2e190] [cursor=pointer]
            - generic [ref=f2e193]:
              - generic [ref=f2e195]:
                - generic [ref=f2e196]:
                  - generic [ref=f2e197] [cursor=pointer]: ▶
                  - generic [ref=f2e198]: 📁
                  - generic [ref=f2e199]: F1
                  - generic "1 item inside" [ref=f2e200]: (1)
                - generic "Rolled up from the items inside" [ref=f2e202]: In Progress
                - button "Delete" [ref=f2e204] [cursor=pointer]:
                  - generic [ref=f2e205]: 
              - generic [ref=f2e207]:
                - generic [ref=f2e209]:
                  - generic [ref=f2e210]:
                    - generic [ref=f2e211] [cursor=pointer]: ▶
                    - generic [ref=f2e212]: 📁
                    - generic [ref=f2e213]: F2
                    - generic "1 item inside" [ref=f2e214]: (1)
                  - generic "Rolled up from the items inside" [ref=f2e216]: In Progress
                  - button "Delete" [ref=f2e218] [cursor=pointer]:
                    - generic [ref=f2e219]: 
                - generic [ref=f2e221]:
                  - generic [ref=f2e223]:
                    - button "No priority - click for Low" [ref=f2e225] [cursor=pointer]
                    - generic [ref=f2e231]:
                      - generic [ref=f2e232] [cursor=pointer]: ▶
                      - generic [ref=f2e233]: 📍
                      - generic [ref=f2e234]: TP2
                      - generic "1 item inside" [ref=f2e235]: (1)
                    - button "Complete" [ref=f2e237] [cursor=pointer]
                    - button "Delete" [ref=f2e239] [cursor=pointer]:
                      - generic [ref=f2e240]: 
                  - generic [ref=f2e244]:
                    - button "No priority - click for Low" [ref=f2e246] [cursor=pointer]
                    - generic [ref=f2e252]:
                      - generic [ref=f2e253]: 📍
                      - generic [ref=f2e254]: TP1
                    - button "Not Started" [ref=f2e256] [cursor=pointer]
                    - link " http://localhost:3000/?tab=priority" [ref=f2e258] [cursor=pointer]:
                      - /url: http://localhost:3000/?tab=priority
                      - generic [ref=f2e259]: 
                      - text: http://localhost:3000/?tab=priority
                    - button "Delete" [ref=f2e261] [cursor=pointer]:
                      - generic [ref=f2e262]: 
        - text:                                          
  - contentinfo [ref=f2e263]:
    - paragraph [ref=f2e265]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Dragging a typed row or a template onto the Dailies rail is how work gets
  5   |  * onto a day - the "+ Add" button is gone.
  6   |  *
  7   |  * This broke because the two ends disagreed about the payload: Dailies reads
  8   |  * `type`/`id`/`name` off the dataTransfer, the generic row drag set nothing at
  9   |  * all, and the template drag set only `template-id`. Dropping did nothing,
  10  |  * silently, in both cases.
  11  |  *
  12  |  * Driven with a real DataTransfer through the app's own handlers rather than
  13  |  * locator.dragTo(): the drag data and acceptance are verifiable that way, and
  14  |  * Playwright's HTML5 drag emulation does not deliver the drop here.
  15  |  */
  16  | 
  17  | const TYPES = [
  18  |   { slug: 'area', dropType: 'area', key: 'areas' },
  19  |   { slug: 'goal', dropType: 'goal', key: 'goals' },
  20  |   { slug: 'idea', dropType: 'idea', key: 'ideas' },
  21  |   // to_do/task/ticket were unlinkable until their junctions were bridged to
  22  |   // `entities` - the drop created the work item and lost the link, silently.
  23  |   { slug: 'to_do', dropType: 'todo', key: 'todos' },
  24  |   { slug: 'task', dropType: 'task', key: 'tasks' },
  25  |   { slug: 'ticket', dropType: 'ticket', key: 'tickets' },
  26  | ];
  27  | 
  28  | async function api(page, path, options = {}) {
  29  |   return page.evaluate(async ({ path, options, t }) => {
  30  |     const r = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(options.headers || {}) } });
  31  |     return { status: r.status, body: await r.json().catch(() => null) };
  32  |   }, { path, options, t: await page.evaluate(() => document.body.dataset.csrfToken) });
  33  | }
  34  | 
  35  | const today = () => new Date().toISOString().slice(0, 10);
  36  | 
  37  | test.describe('Dropping onto Dailies', () => {
  38  |   test.describe.configure({ mode: 'serial' });
  39  | 
  40  |   test.afterEach(async ({ page }) => {
  41  |     await page.goto('/');
  42  |     const { body } = await api(page, `/api/work/date/${today()}`);
  43  |     for (const w of (body?.data || []).filter(x => (x.title || '').startsWith('ZZZ drop'))) {
  44  |       await api(page, `/api/work/${w.id}`, { method: 'DELETE' });
  45  |     }
  46  |     for (const slug of TYPES.map(t => t.slug)) {
  47  |       const all = (await api(page, `/api/entities/${slug}`)).body?.data || [];
  48  |       for (const e of all.filter(x => (x.title || '').startsWith('ZZZ drop'))) {
  49  |         await api(page, `/api/entities/${slug}/${e.id}`, { method: 'DELETE' });
  50  |       }
  51  |     }
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
> 86  |       expect((made[type.key] || []).some(x => x.id === entity.id)).toBe(true);
      |                                                                    ^ Error: expect(received).toBe(expected) // Object.is equality
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
  152 |     expect(linked, 'an area is linked').toBeTruthy();
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