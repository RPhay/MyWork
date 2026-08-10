# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: todos-test.spec.js >> Todos Tab >> should drag and drop todo under another
- Location: tests/e2e/todos-test.spec.js:51:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 3000ms exceeded.
Call log:
  - waiting for locator('.todo-row:nth-child(2)') to be visible

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.07.28.0" [ref=e4] [cursor=pointer]:
        - /url: /
      - generic [ref=e5]:
        - button "  Work" [ref=e6] [cursor=pointer]:
          - generic [ref=e7]: 
          - generic [ref=e8]:
            - generic [ref=e9]: 
            - text: Work
        - text: 
      - link "Settings" [ref=e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e11]: 
  - generic [ref=e12]:
    - tablist [ref=e13]:
      - tab " Dailies" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: 
        - text: Dailies
      - tab " Projects" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 
        - text: Projects
      - tab " Categories" [ref=e18] [cursor=pointer]:
        - generic [ref=e19]: 
        - text: Categories
      - tab " Priorities" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 
        - text: Priorities
      - tab " Brainstorming" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: 
        - text: Brainstorming
      - tab " Yearly Goals" [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: 
        - text: Yearly Goals
      - tab " Templates" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: 
        - text: Templates
      - tab " Tasks" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: 
        - text: Tasks
      - tab " To Dos" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: 
        - text: To Dos
      - tab " Tickets" [ref=e32] [cursor=pointer]:
        - generic [ref=e33]: 
        - text: Tickets
      - tab " Reporting" [ref=e34] [cursor=pointer]:
        - generic [ref=e35]: 
        - text: Reporting
    - generic [ref=e36]:
      - text:                                                                                                                                             
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - button "+ Add To Do" [active] [ref=e43] [cursor=pointer]
            - paragraph [ref=e44]: Drag a to do under another to nest it. Drag to the empty space above to unfile it.
            - generic [ref=e45]:
              - generic [ref=e46]: Title
              - generic [ref=e47]: Notes
              - generic [ref=e48]: Actions
            - generic [ref=e49]:
              - generic [ref=e51]:
                - generic [ref=e52]:
                  - button "Incomplete — click to change" [ref=e53] [cursor=pointer]
                  - generic [ref=e54]: Child Todo
                - generic [ref=e55]: "-"
                - button "Delete" [ref=e57] [cursor=pointer]:
                  - generic [ref=e58]: 
              - generic [ref=e60]:
                - generic [ref=e61]:
                  - button "Incomplete — click to change" [ref=e62] [cursor=pointer]
                  - generic [ref=e63]: Parent Todo
                - generic [ref=e64]: "-"
                - button "Delete" [ref=e66] [cursor=pointer]:
                  - generic [ref=e67]: 
              - generic [ref=e69]:
                - generic [ref=e70]:
                  - button "Incomplete — click to change" [ref=e71] [cursor=pointer]
                  - generic [ref=e72]: Test Todo 1
                - generic [ref=e73]: Test notes
                - button "Delete" [ref=e75] [cursor=pointer]:
                  - generic [ref=e76]: 
              - generic [ref=e78]:
                - generic [ref=e79]:
                  - button "Incomplete — click to change" [ref=e80] [cursor=pointer]
                  - generic [ref=e81]: Todo to Edit
                - generic [ref=e82]: "-"
                - button "Delete" [ref=e84] [cursor=pointer]:
                  - generic [ref=e85]: 
              - generic [ref=e87]:
                - generic [ref=e88]:
                  - button "Incomplete — click to change" [ref=e89] [cursor=pointer]
                  - generic [ref=e90]: Todo to Edit
                - generic [ref=e91]: "-"
                - button "Delete" [ref=e93] [cursor=pointer]:
                  - generic [ref=e94]: 
              - generic [ref=e96]:
                - generic [ref=e97]:
                  - button "Incomplete — click to change" [ref=e98] [cursor=pointer]
                  - generic [ref=e99]: Test Todo 1
                - generic [ref=e100]: Test notes
                - button "Delete" [ref=e102] [cursor=pointer]:
                  - generic [ref=e103]: 
              - generic [ref=e105]:
                - generic [ref=e106]:
                  - button "Incomplete — click to change" [ref=e107] [cursor=pointer]
                  - generic [ref=e108]: Child Todo
                - generic [ref=e109]: "-"
                - button "Delete" [ref=e111] [cursor=pointer]:
                  - generic [ref=e112]: 
              - generic [ref=e114]:
                - generic [ref=e115]:
                  - button "Incomplete — click to change" [ref=e116] [cursor=pointer]
                  - generic [ref=e117]: Todo to Edit
                - generic [ref=e118]: "-"
                - button "Delete" [ref=e120] [cursor=pointer]:
                  - generic [ref=e121]: 
              - generic [ref=e123]:
                - generic [ref=e124]:
                  - button "Incomplete — click to change" [ref=e125] [cursor=pointer]
                  - generic [ref=e126]: Parent Todo
                - generic [ref=e127]: "-"
                - button "Delete" [ref=e129] [cursor=pointer]:
                  - generic [ref=e130]: 
              - generic [ref=e132]:
                - generic [ref=e133]:
                  - button "Incomplete — click to change" [ref=e134] [cursor=pointer]
                  - generic [ref=e135]: Test Todo 1
                - generic [ref=e136]: Test notes
                - button "Delete" [ref=e138] [cursor=pointer]:
                  - generic [ref=e139]: 
              - generic [ref=e141]:
                - generic [ref=e142]:
                  - button "Incomplete — click to change" [ref=e143] [cursor=pointer]
                  - generic [ref=e144]: Parent Todo
                - generic [ref=e145]: "-"
                - button "Delete" [ref=e147] [cursor=pointer]:
                  - generic [ref=e148]: 
              - generic [ref=e150]:
                - generic [ref=e151]:
                  - button "Incomplete — click to change" [ref=e152] [cursor=pointer]
                  - generic [ref=e153]: Todo to Edit
                - generic [ref=e154]: "-"
                - button "Delete" [ref=e156] [cursor=pointer]:
                  - generic [ref=e157]: 
              - generic [ref=e159]:
                - generic [ref=e160]:
                  - button "Incomplete — click to change" [ref=e161] [cursor=pointer]
                  - generic [ref=e162]: Parent Todo
                - generic [ref=e163]: "-"
                - button "Delete" [ref=e165] [cursor=pointer]:
                  - generic [ref=e166]: 
              - generic [ref=e168]:
                - generic [ref=e169]:
                  - button "Incomplete — click to change" [ref=e170] [cursor=pointer]
                  - generic [ref=e171]: Test Todo 1
                - generic [ref=e172]: Test notes
                - button "Delete" [ref=e174] [cursor=pointer]:
                  - generic [ref=e175]: 
              - generic [ref=e177]:
                - generic [ref=e178]:
                  - button "Incomplete — click to change" [ref=e179] [cursor=pointer]
                  - generic [ref=e180]: Todo to Edit
                - generic [ref=e181]: "-"
                - button "Delete" [ref=e183] [cursor=pointer]:
                  - generic [ref=e184]: 
              - generic [ref=e186]:
                - generic [ref=e187]:
                  - button "Incomplete — click to change" [ref=e188] [cursor=pointer]
                  - generic [ref=e189]: Test Todo 1
                - generic [ref=e190]: Test notes
                - button "Delete" [ref=e192] [cursor=pointer]:
                  - generic [ref=e193]: 
              - generic [ref=e195]:
                - generic [ref=e196]:
                  - button "Incomplete — click to change" [ref=e197] [cursor=pointer]
                  - generic [ref=e198]: Test Todo 1
                - generic [ref=e199]: Test notes
                - button "Delete" [ref=e201] [cursor=pointer]:
                  - generic [ref=e202]: 
              - generic [ref=e204]:
                - generic [ref=e205]:
                  - button "Incomplete — click to change" [ref=e206] [cursor=pointer]
                  - generic [ref=e207]: Test Todo 1
                - generic [ref=e208]: Test notes
                - button "Delete" [ref=e210] [cursor=pointer]:
                  - generic [ref=e211]: 
              - generic [ref=e213]:
                - generic [ref=e214]:
                  - button "Incomplete — click to change" [ref=e215] [cursor=pointer]
                  - generic [ref=e216]: Parent Todo
                - generic [ref=e217]: "-"
                - button "Delete" [ref=e219] [cursor=pointer]:
                  - generic [ref=e220]: 
              - generic [ref=e222]:
                - generic [ref=e223]:
                  - button "Incomplete — click to change" [ref=e224] [cursor=pointer]
                  - generic [ref=e225]: Todo to Edit
                - generic [ref=e226]: "-"
                - button "Delete" [ref=e228] [cursor=pointer]:
                  - generic [ref=e229]: 
              - generic [ref=e231]:
                - generic [ref=e232]:
                  - button "Incomplete — click to change" [ref=e233] [cursor=pointer]
                  - generic [ref=e234]: Test Todo 1
                - generic [ref=e235]: Test notes
                - button "Delete" [ref=e237] [cursor=pointer]:
                  - generic [ref=e238]: 
              - generic [ref=e240]:
                - generic [ref=e241]:
                  - button "Incomplete — click to change" [ref=e242] [cursor=pointer]
                  - generic [ref=e243]: Todo to Edit
                - generic [ref=e244]: "-"
                - button "Delete" [ref=e246] [cursor=pointer]:
                  - generic [ref=e247]: 
              - generic [ref=e249]:
                - generic [ref=e250]:
                  - button "Incomplete — click to change" [ref=e251] [cursor=pointer]
                  - generic [ref=e252]: Parent Todo
                - generic [ref=e253]: "-"
                - button "Delete" [ref=e255] [cursor=pointer]:
                  - generic [ref=e256]: 
              - generic [ref=e258]:
                - generic [ref=e259]:
                  - button "Incomplete — click to change" [ref=e260] [cursor=pointer]
                  - generic [ref=e261]: Todo to Edit
                - generic [ref=e262]: "-"
                - button "Delete" [ref=e264] [cursor=pointer]:
                  - generic [ref=e265]: 
              - generic [ref=e267]:
                - generic [ref=e268]:
                  - button "Incomplete — click to change" [ref=e269] [cursor=pointer]
                  - generic [ref=e270]: Parent Todo
                - generic [ref=e271]: "-"
                - button "Delete" [ref=e273] [cursor=pointer]:
                  - generic [ref=e274]: 
              - generic [ref=e276]:
                - generic [ref=e277]:
                  - button "Incomplete — click to change" [ref=e278] [cursor=pointer]
                  - generic [ref=e279]: Test Todo 1
                - generic [ref=e280]: Test notes
                - button "Delete" [ref=e282] [cursor=pointer]:
                  - generic [ref=e283]: 
              - generic [ref=e285]:
                - generic [ref=e286]:
                  - button "Incomplete — click to change" [ref=e287] [cursor=pointer]
                  - generic [ref=e288]: Test Item
                - generic [ref=e289]: "-"
                - button "Delete" [ref=e291] [cursor=pointer]:
                  - generic [ref=e292]: 
              - generic [ref=e294]:
                - generic [ref=e295]:
                  - button "Incomplete — click to change" [ref=e296] [cursor=pointer]
                  - generic [ref=e297]: Add SSO toggle for contexts
                - generic [ref=e298]: "Add ability to enable/configure SSO for a context so if SSO is enabled, users must log in via SSO with a given user. Requirements: Support OAuth2 initially, context-level enforcement, auto user mapping, redirect to SSO login if not authenticated."
                - button "Delete" [ref=e300] [cursor=pointer]:
                  - generic [ref=e301]: 
              - generic [ref=e303]:
                - generic [ref=e304]:
                  - button "Incomplete — click to change" [ref=e305] [cursor=pointer]
                  - generic [ref=e306]: To do folder context menu
                - generic [ref=e307]: Right clicking on a folder in the to dos should open up a context menu that allows me to create a todo under that folder.
                - button "Delete" [ref=e309] [cursor=pointer]:
                  - generic [ref=e310]: 
              - generic [ref=e312]:
                - generic [ref=e313]:
                  - button "Incomplete — click to change" [ref=e314] [cursor=pointer]
                  - generic [ref=e315]: Context menu on dailys calendar
                - generic [ref=e316]: If I right click on a day in the calander I should get a context menu. The first item allows me to highlight that day, that should have sub-menus that allow me to pick a color to highlight it with.
                - button "Delete" [ref=e318] [cursor=pointer]:
                  - generic [ref=e319]: 
              - generic [ref=e321]:
                - generic [ref=e322]:
                  - button "Incomplete — click to change" [ref=e323] [cursor=pointer]
                  - generic [ref=e324]: Todo Context Menu
                - generic [ref=e325]: Right clicking on Todo's should bring up a context menu allowing me to convert the todo to a category or project. Remove the button on the todo that effectively does the same thing
                - button "Delete" [ref=e327] [cursor=pointer]:
                  - generic [ref=e328]: 
          - text:  
        - text:       
      - text:                             
  - contentinfo [ref=e330]:
    - paragraph [ref=e332]: © 2026 MyWork. Licensed under the MIT License.
  - text:   
  - generic [ref=e333]:
    - alert [ref=e334]:
      - text: To do saved!
      - button "Close" [ref=e335] [cursor=pointer]
    - alert [ref=e336]:
      - text: To do saved!
      - button "Close" [ref=e337] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Todos Tab', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('http://localhost:3000');
  6  |     // Click on Todos tab
  7  |     await page.click('[data-tab="todos"]');
  8  |     // Wait for todos to load
  9  |     await page.waitForSelector('#toDosList', { timeout: 5000 });
  10 |   });
  11 | 
  12 |   test('should create a todo and edit it', async ({ page }) => {
  13 |     // Click "Add To Do" button
  14 |     await page.click('#addToDoBtn');
  15 | 
  16 |     // Wait for modal to appear
  17 |     await expect(page.locator('#toDoModal')).toBeVisible({ timeout: 3000 });
  18 | 
  19 |     // Fill in the form
  20 |     await page.fill('#toDoTitle', 'Test Todo 1');
  21 |     await page.fill('#toDoNotes', 'Test notes');
  22 | 
  23 |     // Save
  24 |     await page.click('#saveToDoBtn');
  25 | 
  26 |     // Wait for modal to close and todos to reload
  27 |     await page.waitForSelector('.todo-row', { timeout: 3000 });
  28 | 
  29 |     // Should see the todo in the list
  30 |     await expect(page.locator('.todo-title').first()).toContainText('Test Todo 1');
  31 |   });
  32 | 
  33 |   test('should edit a todo by clicking on it', async ({ page }) => {
  34 |     // Create a todo first
  35 |     await page.click('#addToDoBtn');
  36 |     await page.fill('#toDoTitle', 'Todo to Edit');
  37 |     await page.click('#saveToDoBtn');
  38 |     await page.waitForSelector('.todo-row', { timeout: 3000 });
  39 | 
  40 |     // Click on the todo title to edit it
  41 |     await page.click('.todo-title');
  42 | 
  43 |     // Modal should appear
  44 |     await expect(page.locator('#toDoModal')).toBeVisible({ timeout: 3000 });
  45 | 
  46 |     // Title field should be populated
  47 |     const titleField = page.locator('#toDoTitle');
  48 |     await expect(titleField).toHaveValue('Todo to Edit');
  49 |   });
  50 | 
  51 |   test('should drag and drop todo under another', async ({ page }) => {
  52 |     // Create first todo
  53 |     await page.click('#addToDoBtn');
  54 |     await page.fill('#toDoTitle', 'Parent Todo');
  55 |     await page.click('#saveToDoBtn');
  56 |     await page.waitForSelector('.todo-row', { timeout: 3000 });
  57 | 
  58 |     // Create second todo
  59 |     await page.click('#addToDoBtn');
  60 |     await page.fill('#toDoTitle', 'Child Todo');
  61 |     await page.click('#saveToDoBtn');
> 62 |     await page.waitForSelector('.todo-row:nth-child(2)', { timeout: 3000 });
     |                ^ TimeoutError: page.waitForSelector: Timeout 3000ms exceeded.
  63 | 
  64 |     // Get the todo rows
  65 |     const todoRows = await page.locator('.todo-row').all();
  66 |     console.log(`Found ${todoRows.length} todo rows`);
  67 | 
  68 |     if (todoRows.length >= 2) {
  69 |       // Drag second todo onto first
  70 |       const childRow = todoRows[1];
  71 |       const parentRow = todoRows[0];
  72 | 
  73 |       // Perform drag and drop
  74 |       await childRow.dragTo(parentRow);
  75 | 
  76 |       // Wait for reload
  77 |       await page.waitForTimeout(500);
  78 | 
  79 |       // Check if parent now has a toggle (indicating it has children)
  80 |       const toggles = await page.locator('.todo-folder-toggle i').count();
  81 |       console.log(`Found ${toggles} toggle icons (indicating nested items)`);
  82 |     }
  83 |   });
  84 | });
  85 | 
```