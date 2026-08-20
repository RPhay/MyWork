# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: generic-entity-crud.spec.js >> Generic entity CRUD - Todos >> items nest into folders and folders nest into folders
- Location: tests/e2e/generic-entity-crud.spec.js:338:7

# Error details

```
Error: expect(received).toContainEqual(expected) // deep equality

Expected value: ObjectContaining {"child_entity_id": 7562, "parent_entity_id": 7561}
Received array: [{"child_entity_id": 1656, "order_index": 0, "parent_entity_id": 1650}, {"child_entity_id": 7561, "order_index": 0, "parent_entity_id": 7560}]
```

# Page snapshot

```yaml
- generic [ref=f1e1]:
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
        - text:                                                    
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
              - button "+ New Todo" [ref=f1e174] [cursor=pointer]
          - text: 
          - generic [ref=f1e176]:
            - generic [ref=f1e177]:
              - generic "Drag to reorder columns" [ref=f1e178]:
                - button "Title" [ref=f1e179] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f1e180]:
                - button "Priority" [ref=f1e181] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f1e182]:
                - button "Status" [ref=f1e183] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f1e184]:
                - button "Target Date" [ref=f1e185] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f1e186]:
                - button "Importance" [ref=f1e187] [cursor=pointer]
              - group [ref=f1e189]:
                - button "" [ref=f1e190] [cursor=pointer]
                - button "" [ref=f1e192] [cursor=pointer]
            - generic [ref=f1e194]:
              - generic [ref=f1e195]:
                - generic [ref=f1e197]:
                  - generic [ref=f1e198]:
                    - generic [ref=f1e199] [cursor=pointer]: ▶
                    - generic [ref=f1e200]: 📁
                    - generic: F1
                    - generic "1 item inside" [ref=f1e201]: (1)
                  - generic "Rolled up from the items inside" [ref=f1e203]: Not Started
                  - button "Delete" [ref=f1e205] [cursor=pointer]:
                    - generic [ref=f1e206]: 
                - generic [ref=f1e210]:
                  - generic [ref=f1e211]:
                    - generic [ref=f1e212]: ✅
                    - generic [ref=f1e213]: TD1
                  - button "No priority - click for Low" [ref=f1e215] [cursor=pointer]
                  - button "Not Started" [ref=f1e222] [cursor=pointer]
                  - button "Set date" [ref=f1e224] [cursor=pointer]
                  - combobox "Importance" [ref=f1e226] [cursor=pointer]:
                    - option "—"
                    - option "Low"
                    - option "Medium" [selected]
                    - option "High"
                    - option "Critical"
                  - button "Delete" [ref=f1e228] [cursor=pointer]:
                    - generic [ref=f1e229]: 
              - generic [ref=f1e232]:
                - generic [ref=f1e233]:
                  - generic [ref=f1e234]: 📁
                  - generic [ref=f1e235]: F2
                - button "Delete" [ref=f1e237] [cursor=pointer]:
                  - generic [ref=f1e238]: 
              - generic [ref=f1e241]:
                - generic [ref=f1e242]:
                  - generic [ref=f1e243]: ✅
                  - generic [ref=f1e244]: TD2
                - button "No priority - click for Low" [ref=f1e246] [cursor=pointer]
                - button "In Progress" [ref=f1e253] [cursor=pointer]
                - button "Set date" [ref=f1e255] [cursor=pointer]
                - combobox "Importance" [ref=f1e257] [cursor=pointer]:
                  - option "—"
                  - option "Low"
                  - option "Medium" [selected]
                  - option "High"
                  - option "Critical"
                - button "Delete" [ref=f1e259] [cursor=pointer]:
                  - generic [ref=f1e260]: 
              - generic [ref=f1e261]:
                - generic [ref=f1e263]:
                  - generic [ref=f1e264]:
                    - generic [ref=f1e265] [cursor=pointer]: ▶
                    - generic [ref=f1e266]: 📁
                    - generic: ZZZ e2e to_do outer folder
                    - generic "1 item inside" [ref=f1e267]: (1)
                  - button "Delete" [ref=f1e269] [cursor=pointer]:
                    - generic [ref=f1e270]: 
                - generic [ref=f1e274]:
                  - generic [ref=f1e275]:
                    - generic [ref=f1e276]: 📁
                    - generic [ref=f1e277]: ZZZ e2e to_do inner folder
                  - button "Delete" [ref=f1e279] [cursor=pointer]:
                    - generic [ref=f1e280]: 
              - generic [ref=f1e283]:
                - generic [ref=f1e284]:
                  - generic [ref=f1e285]: ✅
                  - generic [ref=f1e286]: ZZZ e2e to_do nested item
                - button "No priority - click for Low" [ref=f1e288] [cursor=pointer]
                - button "Not Started" [ref=f1e295] [cursor=pointer]
                - button "Set date" [active] [ref=f1e297] [cursor=pointer]
                - combobox "Importance" [ref=f1e299] [cursor=pointer]:
                  - option "—"
                  - option "Low"
                  - option "Medium" [selected]
                  - option "High"
                  - option "Critical"
                - button "Delete" [ref=f1e301] [cursor=pointer]:
                  - generic [ref=f1e302]: 
        - text:                                  
  - contentinfo [ref=f1e303]:
    - paragraph [ref=f1e305]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
  265 | 
  266 |         // Title only - a folder holds no field values, so none of the type's
  267 |         // own fields (status, notes, recurrence...) may be rendered.
  268 |         await expect(page.locator('#entity-editor-form input[name="title"]')).toBeVisible();
  269 |         await expect(page.locator('#entity-editor-form [data-field-type]')).toHaveCount(0);
  270 | 
  271 |         const titleInput = page.locator('#entity-editor-form input[name="title"]');
  272 |         await titleInput.fill(title);
  273 |         await titleInput.dispatchEvent('input');
  274 |         await page.click(`#${type.slug}SaveBtn`);
  275 | 
  276 |         const row = page.locator('.entity-row', { hasText: title });
  277 |         await expect(row).toBeVisible({ timeout: 5000 });
  278 |         await expect(row).toHaveClass(/entity-row-folder/);
  279 |         await expect(row.locator('.entity-row-icon')).toHaveText('📁');
  280 | 
  281 |         // Persisted as a folder of this type, not as some other type.
  282 |         const all = await page.evaluate(
  283 |           async (slug) => (await (await fetch(`/api/entities/${slug}`)).json()).data,
  284 |           type.slug
  285 |         );
  286 |         const stored = all.find((e) => e.title === title);
  287 |         expect(stored).toBeTruthy();
  288 |         expect(Boolean(stored.is_folder)).toBe(true);
  289 |       });
  290 | 
  291 |       test('a folder renders as a folder while a normal item keeps the type icon', async ({ page }) => {
  292 |         await apiCreate(page, type.slug, `${prefix} plain item`, { is_folder: false });
  293 |         await apiCreate(page, type.slug, `${prefix} plain folder`, { is_folder: true });
  294 |         await page.reload({ waitUntil: 'networkidle' });
  295 |         await page.waitForTimeout(800);
  296 | 
  297 |         const itemIcon = page.locator('.entity-row', { hasText: `${prefix} plain item` }).locator('.entity-row-icon');
  298 |         const folderIcon = page.locator('.entity-row', { hasText: `${prefix} plain folder` }).locator('.entity-row-icon');
  299 | 
  300 |         await expect(folderIcon).toHaveText('📁');
  301 |         // The item must show the type's own icon - the original bug was every
  302 |         // row rendering as a folder regardless.
  303 |         await expect(itemIcon).not.toHaveText('📁');
  304 |       });
  305 | 
  306 |       // A node was allowed to become its own ancestor. Nothing caught it at
  307 |       // write time; it surfaced much later as "Maximum call stack size
  308 |       // exceeded" out of hierarchyPath.js#buildPathMap, taking down Dailies,
  309 |       // Projects and Reporting at once - three tabs felled by one bad edge.
  310 |       test('refuses to make an item its own ancestor', async ({ page }) => {
  311 |         const outer = await apiCreate(page, type.slug, `${prefix} cycle outer`);
  312 |         const inner = await apiCreate(page, type.slug, `${prefix} cycle inner`);
  313 |         const token = await getCsrfToken(page);
  314 | 
  315 |         const relate = (parentId, childId) =>
  316 |           page.evaluate(
  317 |             async ({ slug, parentId, childId, csrfToken }) => {
  318 |               const r = await fetch(`/api/entities/${slug}/${childId}/relationships`, {
  319 |                 method: 'POST',
  320 |                 headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  321 |                 body: JSON.stringify({ parentEntityId: parentId, childEntityId: childId, relationshipKind: 'hierarchy' }),
  322 |               });
  323 |               return r.status;
  324 |             },
  325 |             { slug: type.slug, parentId, childId, csrfToken: token }
  326 |           );
  327 | 
  328 |         expect(await relate(outer.id, inner.id)).toBeLessThan(300);
  329 |         // Closing the loop, and self-parenting, must both be refused.
  330 |         expect(await relate(inner.id, outer.id)).toBeGreaterThanOrEqual(400);
  331 |         expect(await relate(outer.id, outer.id)).toBeGreaterThanOrEqual(400);
  332 | 
  333 |         // Path-building endpoints must still respond rather than blow the stack.
  334 |         const status = await page.evaluate(async () => (await fetch('/api/priorities')).status);
  335 |         expect(status).toBe(200);
  336 |       });
  337 | 
  338 |       test('items nest into folders and folders nest into folders', async ({ page }) => {
  339 |         const outer = await apiCreate(page, type.slug, `${prefix} outer folder`, { is_folder: true });
  340 |         const inner = await apiCreate(page, type.slug, `${prefix} inner folder`, { is_folder: true });
  341 |         const item = await apiCreate(page, type.slug, `${prefix} nested item`);
  342 |         await page.reload({ waitUntil: 'networkidle' });
  343 |         await page.waitForTimeout(800);
  344 | 
  345 |         const nest = async (sourceTitle, targetTitle) => {
  346 |           const target = page.locator('.entity-row', { hasText: targetTitle }).first();
  347 |           const source = page.locator('.entity-row', { hasText: sourceTitle }).first();
  348 |           await expect(target).toBeVisible();
  349 |           await expect(source).toBeVisible();
  350 |           const box = await target.boundingBox();
  351 |           await source.dragTo(target, { targetPosition: { x: box.width / 2, y: box.height / 2 } });
  352 |           await page.waitForTimeout(600);
  353 |         };
  354 | 
  355 |         await nest(`${prefix} inner folder`, `${prefix} outer folder`); // folder under folder
  356 |         await nest(`${prefix} nested item`, `${prefix} inner folder`); // item under folder
  357 | 
  358 |         const relationships = await page.evaluate(
  359 |           async (slug) => (await (await fetch(`/api/entities/${slug}/relationships?kind=hierarchy`)).json()).data,
  360 |           type.slug
  361 |         );
  362 |         expect(relationships).toContainEqual(
  363 |           expect.objectContaining({ parent_entity_id: outer.id, child_entity_id: inner.id })
  364 |         );
> 365 |         expect(relationships).toContainEqual(
      |                               ^ Error: expect(received).toContainEqual(expected) // deep equality
  366 |           expect.objectContaining({ parent_entity_id: inner.id, child_entity_id: item.id })
  367 |         );
  368 |       });
  369 |     }
  370 | 
  371 |     // Field values live in entity_field_values, keyed off the type's schema.
  372 |     // This table was empty for every type until the client stopped sending
  373 |     // field values flat alongside `title` instead of nested under `fields`.
  374 |     test('field values entered in the editor survive a reload', async ({ page }) => {
  375 |       const item = await apiCreate(page, type.slug, `${prefix} field values`);
  376 |       await page.reload({ waitUntil: 'networkidle' });
  377 |       await page.waitForTimeout(800);
  378 | 
  379 |       await page.locator('.entity-row', { hasText: item.title }).locator('.entity-title').click();
  380 |       await expect(page.locator(`#${type.slug}EditorPane`)).toBeVisible();
  381 | 
  382 |       const notes = page.locator('#entity-editor-form [name="notes"]');
  383 |       await expect(notes).toBeVisible();
  384 |       await notes.fill('ZZZ persisted note');
  385 |       await notes.dispatchEvent('input');
  386 |       await page.click(`#${type.slug}SaveBtn`);
  387 |       await page.waitForTimeout(600);
  388 | 
  389 |       const stored = await apiGet(page, type.slug, item.id);
  390 |       expect(stored.fields.notes).toBe('ZZZ persisted note');
  391 |     });
  392 |   });
  393 | }
  394 | 
```