# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: entity-editor-behaviour.spec.js >> the column-toggle legend appears once and lines up with its switches
- Location: tests/e2e/entity-editor-behaviour.spec.js:67:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.editor-field-legend')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('.editor-field-legend')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.08.19.57" [ref=e4] [cursor=pointer]:
        - /url: /
      - generic [ref=e5]:
        - button "  Pygmie Studios" [ref=e6] [cursor=pointer]:
          - generic [ref=e7]: 
          - generic [ref=e8]:
            - generic [ref=e9]: 
            - text: Pygmie Studios
        - text: 
      - link "Settings" [ref=e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e11]: 
  - generic [ref=e12]:
    - tablist [ref=e13]:
      - button "⭐ Dailies" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: ⭐
        - text: Dailies
      - button "📋 Templates" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 📋
        - text: Templates
      - listitem [ref=e18]
      - tab "🏁 Tests" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: 🏁
        - text: Tests
      - tab "📍 Projects" [ref=e21] [cursor=pointer]:
        - generic [ref=e22]: 📍
        - text: Projects
      - tab "🏷️ Categories" [ref=e23] [cursor=pointer]:
        - generic [ref=e24]: 🏷️
        - text: Categories
      - tab "🎯 Goals" [ref=e25] [cursor=pointer]:
        - generic [ref=e26]: 🎯
        - text: Goals
      - tab "✅ Todos" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: ✅
        - text: Todos
      - tab "📝 Tasks" [ref=e29] [cursor=pointer]:
        - generic [ref=e30]: 📝
        - text: Tasks
      - tab "🎟️ Tickets" [ref=e31] [cursor=pointer]:
        - generic [ref=e32]: 🎟️
        - text: Tickets
      - tab "💡 Ideas" [ref=e33] [cursor=pointer]:
        - generic [ref=e34]: 💡
        - text: Ideas
      - listitem [ref=e35]
      - button "📊 Priority Board" [ref=e36] [cursor=pointer]:
        - generic [ref=e37]: 📊
        - text: Priority Board
      - tab "📈 Reporting" [ref=e38] [cursor=pointer]:
        - generic [ref=e39]: 📈
        - text: Reporting
    - generic [ref=e40]:
      - complementary [ref=e41]:
        - generic [ref=e42]:
          - button " Calendar" [ref=e44] [cursor=pointer]:
            - generic [ref=e45]: 
            - text: Calendar
          - generic [ref=e46]:
            - tabpanel [ref=e49]:
              - generic [ref=e50]:
                - generic [ref=e51]:
                  - button "Previous month" [ref=e52] [cursor=pointer]: ‹
                  - heading "August 2026" [level=6] [ref=e53]
                  - button "Next month" [ref=e54] [cursor=pointer]: ›
                - table [ref=e55]:
                  - rowgroup [ref=e56]:
                    - row [ref=e57]:
                      - columnheader "Sun" [ref=e58]
                      - columnheader "Mon" [ref=e59]
                      - columnheader "Tue" [ref=e60]
                      - columnheader "Wed" [ref=e61]
                      - columnheader "Thu" [ref=e62]
                      - columnheader "Fri" [ref=e63]
                      - columnheader "Sat" [ref=e64]
                    - row [ref=e65]:
                      - cell [ref=e66]
                      - cell [ref=e67]
                      - cell [ref=e68]
                      - cell [ref=e69]
                      - cell [ref=e70]
                      - cell [ref=e71]
                      - cell "1" [ref=e72] [cursor=pointer]
                    - row [ref=e73]:
                      - cell "2" [ref=e74] [cursor=pointer]
                      - cell "3" [ref=e75] [cursor=pointer]
                      - cell "4" [ref=e76] [cursor=pointer]
                      - cell "5" [ref=e77] [cursor=pointer]
                      - cell "6" [ref=e78] [cursor=pointer]
                      - cell "7" [ref=e79] [cursor=pointer]
                      - cell "8" [ref=e80] [cursor=pointer]
                    - row [ref=e81]:
                      - cell "9" [ref=e82] [cursor=pointer]
                      - cell "10" [ref=e83] [cursor=pointer]
                      - cell "11" [ref=e84] [cursor=pointer]
                      - cell "12" [ref=e85] [cursor=pointer]
                      - cell "13" [ref=e86] [cursor=pointer]
                      - cell "14" [ref=e87] [cursor=pointer]
                      - cell "15" [ref=e88] [cursor=pointer]
                    - row [ref=e89]:
                      - cell "16" [ref=e90] [cursor=pointer]
                      - cell "17" [ref=e91] [cursor=pointer]
                      - cell "18" [ref=e92] [cursor=pointer]
                      - cell "19" [ref=e93] [cursor=pointer]
                      - cell "20" [ref=e94] [cursor=pointer]
                      - cell "21" [ref=e95] [cursor=pointer]
                      - cell "22" [ref=e96] [cursor=pointer]
                    - row [ref=e97]:
                      - cell "23" [ref=e98] [cursor=pointer]
                      - cell "24" [ref=e99] [cursor=pointer]
                      - cell "25" [ref=e100] [cursor=pointer]
                      - cell "26" [ref=e101] [cursor=pointer]
                      - cell "27" [ref=e102] [cursor=pointer]
                      - cell "28" [ref=e103] [cursor=pointer]
                      - cell "29" [ref=e104] [cursor=pointer]
                    - row [ref=e105]:
                      - cell "30" [ref=e106] [cursor=pointer]
                      - cell "31" [ref=e107] [cursor=pointer]
                      - cell [ref=e108]
                      - cell [ref=e109]
                      - cell [ref=e110]
                      - cell [ref=e111]
                      - cell [ref=e112]
            - generic [ref=e116]:
              - heading "Work Items for Thursday, Aug 20" [level=6] [ref=e118]
              - generic [ref=e119]:
                - generic "What the work is. Click a row to expand what is linked to it; double-click to edit." [ref=e120]: Title
                - generic "Oh! - flag this as something that came up unexpectedly, rather than planned work" [ref=e121]: Oh!
                - generic "When the work is scheduled to start" [ref=e122]: Time
                - generic "Not Started, In Progress or Complete. Click the badge on a row to cycle it." [ref=e123]: Status
                - generic "How long you intend to spend on this, in hours. Totals for the day show beside the date." [ref=e124]: Time Box
                - generic "Notes written by Claude for this item" [ref=e125]: Claude
                - generic "Your own notes for this item" [ref=e126]: Notes
                - generic "Remove this item from the day" [ref=e127]: Actions
              - generic [ref=e128]:
                - generic "Click to change status, double-click to edit; drag to reorder" [ref=e130]:
                  - generic:
                    - generic "Expand/collapse" [ref=e131]: 
                    - generic "Work Item" [ref=e132]: 
                    - generic: ZZZcr reference src
                  - generic "Oh! Click to pick an emoji"
                  - generic "Meeting start time" [ref=e133]: "-"
                  - generic "Click to change status" [ref=e134] [cursor=pointer]: Not Started
                  - generic "Click to change time box" [ref=e135] [cursor=pointer]: No time box
                  - 'generic "Toggle: worked with Claude" [ref=e136] [cursor=pointer]': 
                  - generic "No notes - double-click to add" [ref=e138] [cursor=pointer]: 
                  - button "Delete" [ref=e141] [cursor=pointer]:
                    - generic [ref=e142]: 
                - generic "Click to change status, double-click to edit; drag to reorder" [ref=e144]:
                  - generic:
                    - generic "Expand/collapse" [ref=e145]: 
                    - generic "Work Item" [ref=e146]: 
                    - generic: ZZZcr reference src
                  - generic "Oh! Click to pick an emoji"
                  - generic "Meeting start time" [ref=e147]: "-"
                  - generic "Click to change status" [ref=e148] [cursor=pointer]: Not Started
                  - generic "Click to change time box" [ref=e149] [cursor=pointer]: No time box
                  - 'generic "Toggle: worked with Claude" [ref=e150] [cursor=pointer]': 
                  - generic "No notes - double-click to add" [ref=e152] [cursor=pointer]: 
                  - button "Delete" [ref=e155] [cursor=pointer]:
                    - generic [ref=e156]: 
        - text:                    
      - text:            
      - generic [ref=e158]:
        - text:                                                                                 
        - generic [ref=e161]:
          - generic [ref=e162]:
            - generic [ref=e163]:
              - group [ref=e165]:
                - button " Expand All" [ref=e166] [cursor=pointer]:
                  - generic [ref=e167]: 
                  - text: Expand All
                - button " Collapse All" [ref=e168] [cursor=pointer]:
                  - generic [ref=e169]: 
                  - text: Collapse All
              - group [ref=e171]:
                - button " + Folder" [ref=e172] [cursor=pointer]:
                  - generic [ref=e173]: 
                  - text: + Folder
                - button "+ New Idea" [ref=e174] [cursor=pointer]
            - text: 
            - generic [ref=e176]:
              - generic [ref=e177]:
                - generic "Drag to reorder columns" [ref=e178]:
                  - button "Title" [ref=e179] [cursor=pointer]
                - generic "Drag to reorder columns" [ref=e180]:
                  - button "Priority" [ref=e181] [cursor=pointer]
                - generic "Drag to reorder columns" [ref=e182]:
                  - button "Status" [ref=e183] [cursor=pointer]
                - group [ref=e185]:
                  - button "" [ref=e186] [cursor=pointer]
                  - button "" [ref=e188] [cursor=pointer]
              - generic [ref=e190]:
                - generic [ref=e191]:
                  - generic [ref=e193]:
                    - generic [ref=e194]:
                      - generic [ref=e195] [cursor=pointer]: ▶
                      - generic [ref=e196]: 📁
                      - generic [ref=e197]: F1
                      - generic "2 items inside" [ref=e198]: (2)
                    - generic "Rolled up from the items inside" [ref=e200]: Raw
                    - button "Delete" [ref=e202] [cursor=pointer]:
                      - generic [ref=e203]: 
                  - generic [ref=e204]:
                    - generic [ref=e207]:
                      - generic [ref=e208]:
                        - generic [ref=e209]: 💡
                        - generic [ref=e210]: i1
                      - button "No priority - click for Low" [ref=e212] [cursor=pointer]
                      - button "Raw" [ref=e219] [cursor=pointer]
                      - button "Delete" [ref=e221] [cursor=pointer]:
                        - generic [ref=e222]: 
                    - generic [ref=e225]:
                      - generic [ref=e226]:
                        - generic [ref=e227]: 💡
                        - generic [ref=e228]: i2
                      - button "No priority - click for Low" [ref=e230] [cursor=pointer]
                      - button "Raw" [ref=e237] [cursor=pointer]
                      - button "Delete" [ref=e239] [cursor=pointer]:
                        - generic [ref=e240]: 
                - generic [ref=e243]:
                  - generic [ref=e244]:
                    - generic [ref=e245]: 📁
                    - generic [ref=e246]: F2
                  - button "Delete" [ref=e248] [cursor=pointer]:
                    - generic [ref=e249]: 
          - generic [ref=e252]:
            - generic [ref=e253]:
              - generic [ref=e254]: Edit Idea
              - group [ref=e256]:
                - button "Revert" [disabled]
                - button "Save" [disabled]
            - generic [ref=e259]:
              - generic [ref=e260]: Folder Name *
              - textbox [ref=e261]: F1
        - text:     
  - contentinfo [ref=e262]:
    - paragraph [ref=e264]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | const OUT='/private/tmp/claude-501/-Users-aslynn-git-github-MyWork/825c4ea0-f3d3-4db7-9c88-97ad8e82c12e/scratchpad';
  3  | 
  4  | for (const kind of ['item','folder']) {
  5  |   test(`creating a ${kind} keeps the editor open with it selected`, async ({ page }) => {
  6  |     await page.goto('/?tab=priority');
  7  |     await page.waitForLoadState('networkidle');
  8  |     await page.waitForTimeout(1400);
  9  | 
  10 |     await page.click(kind === 'folder' ? '#addpriorityFolderBtn' : '#addpriorityBtn');
  11 | 
  12 |     // Save must start disabled - nothing has changed yet
  13 |     await expect(page.locator('#prioritySaveBtn')).toBeDisabled();
  14 | 
  15 |     const ti = page.locator('#entity-editor-form input[name="title"]');
  16 |     await ti.fill(`ZZZ keep ${kind}`);
  17 |     await ti.dispatchEvent('input');
  18 |     await expect(page.locator('#prioritySaveBtn')).toBeEnabled();
  19 | 
  20 |     await page.click('#prioritySaveBtn');
  21 |     await page.waitForTimeout(1200);
  22 | 
  23 |     // Editor stays open, showing the item just created, and it is selected
  24 |     await expect(page.locator('#priorityEditorPane')).toBeVisible();
  25 |     await expect(page.locator('#entity-editor-form input[name="title"]')).toHaveValue(`ZZZ keep ${kind}`);
  26 |     const row = page.locator('.entity-row', {hasText:`ZZZ keep ${kind}`}).first();
  27 |     await expect(row).toHaveClass(/selected/);
  28 |     // and Save is disabled again - nothing changed since the save
  29 |     await expect(page.locator('#prioritySaveBtn')).toBeDisabled();
  30 | 
  31 |     await page.screenshot({path:`${OUT}/keepopen-${kind}.png`});
  32 | 
  33 |     await page.evaluate(async () => {
  34 |       const t=document.body.dataset.csrfToken;
  35 |       const all=(await (await fetch('/api/entities/priority')).json()).data||[];
  36 |       for (const e of all.filter(x=>(x.title||'').startsWith('ZZZ keep')))
  37 |         await fetch(`/api/entities/priority/${e.id}`,{method:'DELETE',headers:{'X-CSRF-Token':t}});
  38 |     });
  39 |   });
  40 | }
  41 | 
  42 | test('save stays disabled across reopening different items', async ({ page }) => {
  43 |   await page.goto('/?tab=priority');
  44 |   await page.waitForLoadState('networkidle');
  45 |   await page.waitForTimeout(1400);
  46 | 
  47 |   // Every tab's rows are in the DOM at once (dashboard.ejs renders all panes
  48 |   // upfront), so an unscoped .entity-row can pick a row from a hidden tab.
  49 |   const rows = page.locator('#tab-priority .entity-row:visible');
  50 |   await rows.first().click();
  51 |   await expect(page.locator('#prioritySaveBtn')).toBeDisabled();
  52 |   // make a change -> enabled
  53 |   const ti = page.locator('#entity-editor-form input[name="title"]');
  54 |   await ti.fill('temporary edit'); await ti.dispatchEvent('input');
  55 |   await expect(page.locator('#prioritySaveBtn')).toBeEnabled();
  56 |   // open a different item without saving -> must be disabled again
  57 |   await rows.nth(1).click();
  58 |   await expect(page.locator('#prioritySaveBtn')).toBeDisabled();
  59 | });
  60 | 
  61 | // The two column toggles are labelled once, by a legend above the switch
  62 | // columns rather than a pair of icons repeated on every field. A legend only
  63 | // works if each icon sits over the switch it labels, and that alignment is
  64 | // pure CSS - it silently broke three times while being changed by eye, because
  65 | // the legend and the field rows resolve their em units against different
  66 | // font-sizes. Measured, it cannot drift unnoticed again.
  67 | test('the column-toggle legend appears once and lines up with its switches', async ({ page }) => {
  68 |   await page.goto('/?tab=idea');
  69 |   await page.waitForLoadState('networkidle');
  70 |   await page.waitForTimeout(1500);
  71 | 
  72 |   await page.locator('#ideaEntityList .entity-row').first().locator('.entity-cell-title').click();
> 73 |   await expect(page.locator('.editor-field-legend')).toHaveCount(1);
     |                                                      ^ Error: expect(locator).toHaveCount(expected) failed
  74 |   await expect(page.locator('.editor-field .editor-toggle-icon')).toHaveCount(0);
  75 | 
  76 |   const drift = await page.evaluate(() => {
  77 |     const centre = (el) => { const r = el.getBoundingClientRect(); return r.x + r.width / 2; };
  78 |     const icons = [...document.querySelectorAll('.editor-field-legend .editor-toggle-icon i')].map(centre);
  79 |     const switches = [...document.querySelector('.editor-field').querySelectorAll('.form-check-input')].map(centre);
  80 |     return icons.map((x, i) => Math.abs(x - (switches[i] ?? 0)));
  81 |   });
  82 | 
  83 |   expect(drift).toHaveLength(2);
  84 |   for (const d of drift) expect(d, 'legend icon sits over its switch').toBeLessThanOrEqual(4);
  85 | });
  86 | 
```