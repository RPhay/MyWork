# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify-associations.spec.js >> Verify Associations Persist and Display >> Add -> Todo and verify display
- Location: tests/e2e/verify-associations.spec.js:89:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.work-item-header').first()
    - locator resolved to <div draggable="true" class="work-item-header" data-status="Not Started" title="Click to expand/collapse, double-click to edit; drag to reorder">…</div>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    50 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - navigation [ref=f1e2]:
    - generic [ref=f1e3]:
      - link "MyWork - v2026.08.20.4" [ref=f1e4] [cursor=pointer]:
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
      - button "📊 Priorities" [ref=f1e16] [cursor=pointer]:
        - generic [ref=f1e17]: 📊
        - text: Priorities
      - button "📋 Templates" [ref=f1e18] [cursor=pointer]:
        - generic [ref=f1e19]: 📋
        - text: Templates
      - listitem [ref=f1e20]
      - tab "🗓️ Projects" [ref=f1e21] [cursor=pointer]:
        - generic [ref=f1e22]: 🗓️
        - text: Projects
      - tab "🏁 Tests" [ref=f1e23] [cursor=pointer]:
        - generic [ref=f1e24]: 🏁
        - text: Tests
      - tab "🏷️ Categories" [ref=f1e25] [cursor=pointer]:
        - generic [ref=f1e26]: 🏷️
        - text: Categories
      - tab "🎯 Goals" [ref=f1e27] [cursor=pointer]:
        - generic [ref=f1e28]: 🎯
        - text: Goals
      - tab "✅ Todos" [ref=f1e29] [cursor=pointer]:
        - generic [ref=f1e30]: ✅
        - text: Todos
      - tab "📝 Tasks" [ref=f1e31] [cursor=pointer]:
        - generic [ref=f1e32]: 📝
        - text: Tasks
      - tab "🎟️ Tickets" [ref=f1e33] [cursor=pointer]:
        - generic [ref=f1e34]: 🎟️
        - text: Tickets
      - tab "💡 Ideas" [ref=f1e35] [cursor=pointer]:
        - generic [ref=f1e36]: 💡
        - text: Ideas
      - listitem [ref=f1e37]
      - tab "📈 Reporting" [ref=f1e38] [cursor=pointer]:
        - generic [ref=f1e39]: 📈
        - text: Reporting
    - generic [ref=f1e40]:
      - text:                                                                                                       
      - generic [ref=f1e41]:
        - generic [ref=f1e45]:
          - generic [ref=f1e46]:
            - group [ref=f1e48]:
              - button " Expand All" [ref=f1e49] [cursor=pointer]:
                - generic [ref=f1e50]: 
                - text: Expand All
              - button " Collapse All" [ref=f1e51] [cursor=pointer]:
                - generic [ref=f1e52]: 
                - text: Collapse All
            - group [ref=f1e54]:
              - button " + Folder" [ref=f1e55] [cursor=pointer]:
                - generic [ref=f1e56]: 
                - text: + Folder
              - button "+ New Project" [ref=f1e57] [cursor=pointer]
          - text: 
          - generic [ref=f1e59]:
            - generic [ref=f1e60]:
              - generic "Drag to reorder columns" [ref=f1e61]:
                - button "Priority" [ref=f1e62] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f1e63]:
                - button "Title" [ref=f1e64] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f1e65]:
                - button "Status" [ref=f1e66] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=f1e67]:
                - button "Links" [ref=f1e68] [cursor=pointer]
              - group [ref=f1e70]:
                - button "" [ref=f1e71] [cursor=pointer]
                - button "" [ref=f1e73] [cursor=pointer]
            - generic [ref=f1e75]:
              - generic [ref=f1e76]:
                - generic [ref=f1e78]:
                  - generic [ref=f1e79]:
                    - generic [ref=f1e80] [cursor=pointer]: ▶
                    - generic [ref=f1e81]: 📁
                    - generic [ref=f1e82]: F1
                    - generic "2 items inside" [ref=f1e83]: (2)
                  - generic "Rolled up from the items inside" [ref=f1e85] [cursor=pointer]: Failed
                  - button "Delete" [ref=f1e87] [cursor=pointer]:
                    - generic [ref=f1e88]: 
                - generic [ref=f1e89]:
                  - generic [ref=f1e90]:
                    - generic [ref=f1e92]:
                      - generic [ref=f1e93]:
                        - generic [ref=f1e94] [cursor=pointer]: ▶
                        - generic [ref=f1e95]: 📁
                        - generic [ref=f1e96]: F2
                        - generic "1 item inside" [ref=f1e97]: (1)
                      - generic "Rolled up from the items inside" [ref=f1e99] [cursor=pointer]: In Progress
                      - button "Delete" [ref=f1e101] [cursor=pointer]:
                        - generic [ref=f1e102]: 
                    - generic [ref=f1e104]:
                      - generic [ref=f1e106]:
                        - button "High - click for Critical" [ref=f1e108] [cursor=pointer]
                        - generic [ref=f1e114]:
                          - generic [ref=f1e115] [cursor=pointer]: ▶
                          - generic [ref=f1e116]: 🗓️
                          - generic [ref=f1e117]: TP2
                          - generic "1 item inside" [ref=f1e118]: (1)
                        - button "In Progress" [ref=f1e120] [cursor=pointer]
                        - button "Delete" [ref=f1e122] [cursor=pointer]:
                          - generic [ref=f1e123]: 
                      - generic [ref=f1e127]:
                        - button "No priority - click for Low" [ref=f1e129] [cursor=pointer]
                        - generic [ref=f1e135]:
                          - generic [ref=f1e136]: 🗓️
                          - generic [ref=f1e137]: TP1
                        - button "Not Started" [ref=f1e139] [cursor=pointer]
                        - link " http://localhost:3000/?tab=priority" [ref=f1e141] [cursor=pointer]:
                          - /url: http://localhost:3000/?tab=priority
                          - generic [ref=f1e142]: 
                          - text: http://localhost:3000/?tab=priority
                        - button "Delete" [ref=f1e144] [cursor=pointer]:
                          - generic [ref=f1e145]: 
                  - generic [ref=f1e146]:
                    - generic [ref=f1e148]:
                      - button "High - click for Critical" [ref=f1e150] [cursor=pointer]
                      - generic [ref=f1e156]:
                        - generic [ref=f1e157] [cursor=pointer]: ▶
                        - generic [ref=f1e158]: 🗓️
                        - generic [ref=f1e159]: TP2
                        - generic "1 item inside" [ref=f1e160]: (1)
                      - button "Complete" [ref=f1e162] [cursor=pointer]
                      - button "Delete" [ref=f1e164] [cursor=pointer]:
                        - generic [ref=f1e165]: 
                    - generic [ref=f1e169]:
                      - button "No priority - click for Low" [ref=f1e171] [cursor=pointer]
                      - generic [ref=f1e177]:
                        - generic [ref=f1e178]: 🗓️
                        - generic [ref=f1e179]: TP1
                      - button "Failed" [ref=f1e181] [cursor=pointer]
                      - link " http://localhost:3000/?tab=priority" [ref=f1e183] [cursor=pointer]:
                        - /url: http://localhost:3000/?tab=priority
                        - generic [ref=f1e184]: 
                        - text: http://localhost:3000/?tab=priority
                      - button "Delete" [ref=f1e186] [cursor=pointer]:
                        - generic [ref=f1e187]: 
              - generic [ref=f1e190]:
                - button "No priority - click for Low" [ref=f1e192] [cursor=pointer]
                - generic [ref=f1e198]:
                  - generic [ref=f1e199]: 🗓️
                  - generic [ref=f1e200]: COMPREHENSIVE_TEST_PRIORITY_1787205454193
                - button "Not Started" [ref=f1e202] [cursor=pointer]
                - button "Delete" [ref=f1e204] [cursor=pointer]:
                  - generic [ref=f1e205]: 
              - generic [ref=f1e208]:
                - button "No priority - click for Low" [ref=f1e210] [cursor=pointer]
                - generic [ref=f1e216]:
                  - generic [ref=f1e217]: 🗓️
                  - generic [ref=f1e218]: Test Project for Context Menu
                - button "Not Started" [ref=f1e220] [cursor=pointer]
                - button "Delete" [ref=f1e222] [cursor=pointer]:
                  - generic [ref=f1e223]: 
              - generic [ref=f1e226]:
                - button "No priority - click for Low" [ref=f1e228] [cursor=pointer]
                - generic [ref=f1e234]:
                  - generic [ref=f1e235]: 🗓️
                  - generic [ref=f1e236]: Test Project for Context Menu
                - button "Not Started" [ref=f1e238] [cursor=pointer]
                - button "Delete" [ref=f1e240] [cursor=pointer]:
                  - generic [ref=f1e241]: 
              - generic [ref=f1e244]:
                - button "No priority - click for Low" [ref=f1e246] [cursor=pointer]
                - generic [ref=f1e252]:
                  - generic [ref=f1e253]: 🗓️
                  - generic [ref=f1e254]: Test Project for Context Menu
                - button "Not Started" [ref=f1e256] [cursor=pointer]
                - button "Delete" [ref=f1e258] [cursor=pointer]:
                  - generic [ref=f1e259]: 
              - generic [ref=f1e262]:
                - button "No priority - click for Low" [ref=f1e264] [cursor=pointer]
                - generic [ref=f1e270]:
                  - generic [ref=f1e271]: 🗓️
                  - generic [ref=f1e272]: Test Project for Context Menu
                - button "Not Started" [ref=f1e274] [cursor=pointer]
                - button "Delete" [ref=f1e276] [cursor=pointer]:
                  - generic [ref=f1e277]: 
              - generic [ref=f1e280]:
                - button "No priority - click for Low" [ref=f1e282] [cursor=pointer]
                - generic [ref=f1e288]:
                  - generic [ref=f1e289]: 🗓️
                  - generic [ref=f1e290]: Test Project for Context Menu
                - button "Not Started" [ref=f1e292] [cursor=pointer]
                - button "Delete" [ref=f1e294] [cursor=pointer]:
                  - generic [ref=f1e295]: 
              - generic [ref=f1e298]:
                - button "No priority - click for Low" [ref=f1e300] [cursor=pointer]
                - generic [ref=f1e306]:
                  - generic [ref=f1e307]: 🗓️
                  - generic [ref=f1e308]: Test Project for Context Menu
                - button "Not Started" [ref=f1e310] [cursor=pointer]
                - button "Delete" [ref=f1e312] [cursor=pointer]:
                  - generic [ref=f1e313]: 
              - generic [ref=f1e316]:
                - button "No priority - click for Low" [ref=f1e318] [cursor=pointer]
                - generic [ref=f1e324]:
                  - generic [ref=f1e325]: 🗓️
                  - generic [ref=f1e326]: Test Project for Context Menu
                - button "Not Started" [ref=f1e328] [cursor=pointer]
                - button "Delete" [ref=f1e330] [cursor=pointer]:
                  - generic [ref=f1e331]: 
              - generic [ref=f1e334]:
                - button "No priority - click for Low" [ref=f1e336] [cursor=pointer]
                - generic [ref=f1e342]:
                  - generic [ref=f1e343]: 🗓️
                  - generic [ref=f1e344]: Test Project for Context Menu
                - button "Not Started" [ref=f1e346] [cursor=pointer]
                - button "Delete" [ref=f1e348] [cursor=pointer]:
                  - generic [ref=f1e349]: 
              - generic [ref=f1e352]:
                - button "No priority - click for Low" [ref=f1e354] [cursor=pointer]
                - generic [ref=f1e360]:
                  - generic [ref=f1e361]: 🗓️
                  - generic [ref=f1e362]: Test Project for Context Menu
                - button "Not Started" [ref=f1e364] [cursor=pointer]
                - button "Delete" [ref=f1e366] [cursor=pointer]:
                  - generic [ref=f1e367]: 
              - generic [ref=f1e370]:
                - button "No priority - click for Low" [ref=f1e372] [cursor=pointer]
                - generic [ref=f1e378]:
                  - generic [ref=f1e379]: 🗓️
                  - generic [ref=f1e380]: Test Project for Context Menu
                - button "Not Started" [ref=f1e382] [cursor=pointer]
                - button "Delete" [ref=f1e384] [cursor=pointer]:
                  - generic [ref=f1e385]: 
              - generic [ref=f1e388]:
                - button "No priority - click for Low" [ref=f1e390] [cursor=pointer]
                - generic [ref=f1e396]:
                  - generic [ref=f1e397]: 🗓️
                  - generic [ref=f1e398]: Test Project for Context Menu
                - button "Not Started" [ref=f1e400] [cursor=pointer]
                - button "Delete" [ref=f1e402] [cursor=pointer]:
                  - generic [ref=f1e403]: 
              - generic [ref=f1e406]:
                - button "No priority - click for Low" [ref=f1e408] [cursor=pointer]
                - generic [ref=f1e414]:
                  - generic [ref=f1e415]: 🗓️
                  - generic [ref=f1e416]: Test Project for Context Menu
                - button "Not Started" [ref=f1e418] [cursor=pointer]
                - button "Delete" [ref=f1e420] [cursor=pointer]:
                  - generic [ref=f1e421]: 
              - generic [ref=f1e424]:
                - button "No priority - click for Low" [ref=f1e426] [cursor=pointer]
                - generic [ref=f1e432]:
                  - generic [ref=f1e433]: 🗓️
                  - generic [ref=f1e434]: Test Project for Context Menu
                - button "Not Started" [ref=f1e436] [cursor=pointer]
                - button "Delete" [ref=f1e438] [cursor=pointer]:
                  - generic [ref=f1e439]: 
              - generic [ref=f1e442]:
                - button "No priority - click for Low" [ref=f1e444] [cursor=pointer]
                - generic [ref=f1e450]:
                  - generic [ref=f1e451]: 🗓️
                  - generic [ref=f1e452]: Test Project for Context Menu
                - button "Not Started" [ref=f1e454] [cursor=pointer]
                - button "Delete" [ref=f1e456] [cursor=pointer]:
                  - generic [ref=f1e457]: 
              - generic [ref=f1e460]:
                - button "No priority - click for Low" [ref=f1e462] [cursor=pointer]
                - generic [ref=f1e468]:
                  - generic [ref=f1e469]: 🗓️
                  - generic [ref=f1e470]: Test Project for Context Menu
                - button "Not Started" [ref=f1e472] [cursor=pointer]
                - button "Delete" [ref=f1e474] [cursor=pointer]:
                  - generic [ref=f1e475]: 
              - generic [ref=f1e478]:
                - button "No priority - click for Low" [ref=f1e480] [cursor=pointer]
                - generic [ref=f1e486]:
                  - generic [ref=f1e487]: 🗓️
                  - generic [ref=f1e488]: Test Project for Context Menu
                - button "Not Started" [ref=f1e490] [cursor=pointer]
                - button "Delete" [ref=f1e492] [cursor=pointer]:
                  - generic [ref=f1e493]: 
              - generic [ref=f1e496]:
                - button "No priority - click for Low" [ref=f1e498] [cursor=pointer]
                - generic [ref=f1e504]:
                  - generic [ref=f1e505]: 🗓️
                  - generic [ref=f1e506]: Test Project for Context Menu
                - button "Not Started" [ref=f1e508] [cursor=pointer]
                - button "Delete" [ref=f1e510] [cursor=pointer]:
                  - generic [ref=f1e511]: 
              - generic [ref=f1e514]:
                - button "No priority - click for Low" [ref=f1e516] [cursor=pointer]
                - generic [ref=f1e522]:
                  - generic [ref=f1e523]: 🗓️
                  - generic [ref=f1e524]: Test Project for Context Menu
                - button "Not Started" [ref=f1e526] [cursor=pointer]
                - button "Delete" [ref=f1e528] [cursor=pointer]:
                  - generic [ref=f1e529]: 
              - generic [ref=f1e532]:
                - button "No priority - click for Low" [ref=f1e534] [cursor=pointer]
                - generic [ref=f1e540]:
                  - generic [ref=f1e541]: 🗓️
                  - generic [ref=f1e542]: Test Project for Context Menu
                - button "Not Started" [ref=f1e544] [cursor=pointer]
                - button "Delete" [ref=f1e546] [cursor=pointer]:
                  - generic [ref=f1e547]: 
              - generic [ref=f1e550]:
                - button "No priority - click for Low" [ref=f1e552] [cursor=pointer]
                - generic [ref=f1e558]:
                  - generic [ref=f1e559]: 🗓️
                  - generic [ref=f1e560]: Test Project for Context Menu
                - button "Not Started" [ref=f1e562] [cursor=pointer]
                - button "Delete" [ref=f1e564] [cursor=pointer]:
                  - generic [ref=f1e565]: 
              - generic [ref=f1e568]:
                - button "No priority - click for Low" [ref=f1e570] [cursor=pointer]
                - generic [ref=f1e576]:
                  - generic [ref=f1e577]: 🗓️
                  - generic [ref=f1e578]: Test Project for Context Menu
                - button "Not Started" [ref=f1e580] [cursor=pointer]
                - button "Delete" [ref=f1e582] [cursor=pointer]:
                  - generic [ref=f1e583]: 
              - generic [ref=f1e586]:
                - button "No priority - click for Low" [ref=f1e588] [cursor=pointer]
                - generic [ref=f1e594]:
                  - generic [ref=f1e595]: 🗓️
                  - generic [ref=f1e596]: Test Project for Context Menu
                - button "Not Started" [ref=f1e598] [cursor=pointer]
                - button "Delete" [ref=f1e600] [cursor=pointer]:
                  - generic [ref=f1e601]: 
              - generic [ref=f1e604]:
                - button "No priority - click for Low" [ref=f1e606] [cursor=pointer]
                - generic [ref=f1e612]:
                  - generic [ref=f1e613]: 🗓️
                  - generic [ref=f1e614]: Test Project for Context Menu
                - button "Not Started" [ref=f1e616] [cursor=pointer]
                - button "Delete" [ref=f1e618] [cursor=pointer]:
                  - generic [ref=f1e619]: 
              - generic [ref=f1e622]:
                - button "No priority - click for Low" [ref=f1e624] [cursor=pointer]
                - generic [ref=f1e630]:
                  - generic [ref=f1e631]: 🗓️
                  - generic [ref=f1e632]: Fresh Test Priority
                - button "Not Started" [ref=f1e634] [cursor=pointer]
                - button "Delete" [ref=f1e636] [cursor=pointer]:
                  - generic [ref=f1e637]: 
              - generic [ref=f1e640]:
                - button "No priority - click for Low" [ref=f1e642] [cursor=pointer]
                - generic [ref=f1e648]:
                  - generic [ref=f1e649]: 🗓️
                  - generic [ref=f1e650]: Test Priority for Editor
                - button "Not Started" [ref=f1e652] [cursor=pointer]
                - button "Delete" [ref=f1e654] [cursor=pointer]:
                  - generic [ref=f1e655]: 
              - generic [ref=f1e658]:
                - button "No priority - click for Low" [ref=f1e660] [cursor=pointer]
                - generic [ref=f1e666]:
                  - generic [ref=f1e667]: 🗓️
                  - generic [ref=f1e668]: Test Project for Context Menu
                - button "Not Started" [ref=f1e670] [cursor=pointer]
                - button "Delete" [ref=f1e672] [cursor=pointer]:
                  - generic [ref=f1e673]: 
              - generic [ref=f1e676]:
                - button "No priority - click for Low" [ref=f1e678] [cursor=pointer]
                - generic [ref=f1e684]:
                  - generic [ref=f1e685]: 🗓️
                  - generic [ref=f1e686]: Test Project for Context Menu
                - button "Not Started" [ref=f1e688] [cursor=pointer]
                - button "Delete" [ref=f1e690] [cursor=pointer]:
                  - generic [ref=f1e691]: 
              - generic [ref=f1e694]:
                - button "No priority - click for Low" [ref=f1e696] [cursor=pointer]
                - generic [ref=f1e702]:
                  - generic [ref=f1e703]: 🗓️
                  - generic [ref=f1e704]: Test Project for Context Menu
                - button "Not Started" [ref=f1e706] [cursor=pointer]
                - button "Delete" [ref=f1e708] [cursor=pointer]:
                  - generic [ref=f1e709]: 
              - generic [ref=f1e712]:
                - button "No priority - click for Low" [ref=f1e714] [cursor=pointer]
                - generic [ref=f1e720]:
                  - generic [ref=f1e721]: 🗓️
                  - generic [ref=f1e722]: Test Project for Context Menu
                - button "Not Started" [ref=f1e724] [cursor=pointer]
                - button "Delete" [ref=f1e726] [cursor=pointer]:
                  - generic [ref=f1e727]: 
        - text:                                                                                                                                                                                                                               
  - contentinfo [ref=f1e728]:
    - paragraph [ref=f1e730]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { setupTestData, createTestWorkItem } from './setup-test-data.js';
  3   | 
  4   | test.describe('Verify Associations Persist and Display', () => {
  5   |   test.beforeEach(async ({ page }) => {
  6   |     await page.goto('http://localhost:3000');
  7   |     await page.waitForLoadState('networkidle');
  8   | 
  9   |     const dailiesTab = page.locator('button:has-text("Dailies")').first();
  10  |     await dailiesTab.click();
  11  |     await page.waitForTimeout(1000);
  12  | 
  13  |     await setupTestData(page);
  14  |     await page.waitForTimeout(500);
  15  |   });
  16  | 
  17  |   async function testAssociation(page, type, actionSelector, expectedDisplayType) {
  18  |     // Create work item
  19  |     const workItem = await createTestWorkItem(page, `Test ${type} Association`);
  20  |     await page.reload();
  21  |     await page.waitForLoadState('networkidle');
  22  |     await page.waitForTimeout(1000);
  23  | 
  24  |     // Open context menu
  25  |     const workItemHeader = page.locator('.work-item-header').first();
> 26  |     await workItemHeader.click({ button: 'right' });
      |                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  27  |     await page.waitForTimeout(500);
  28  | 
  29  |     // Click Add submenu
  30  |     const addSubmenu = page.locator('[data-submenu="add-items"]');
  31  |     await addSubmenu.click();
  32  |     await page.waitForTimeout(300);
  33  | 
  34  |     // Click the specific action
  35  |     const btn = page.locator(actionSelector);
  36  |     await btn.click();
  37  |     await page.waitForTimeout(1500);
  38  | 
  39  |     // Select first item from modal
  40  |     const modal = page.locator('.modal.show, .modal.fade.show').first();
  41  |     const itemExists = await modal.isVisible({ timeout: 3000 }).catch(() => false);
  42  | 
  43  |     if (!itemExists) {
  44  |       console.log(`❌ ${type}: Modal did not appear`);
  45  |       return false;
  46  |     }
  47  | 
  48  |     const item = page.locator('.list-group-item').first();
  49  |     await item.click();
  50  |     await page.waitForTimeout(1500);
  51  | 
  52  |     // Close any notification
  53  |     await page.waitForTimeout(500);
  54  | 
  55  |     // Now expand the work item to see if association appears
  56  |     const expandToggle = page.locator('.work-item-toggle').first();
  57  |     await expandToggle.click();
  58  |     await page.waitForTimeout(500);
  59  | 
  60  |     // Look for the associated child item
  61  |     const childItem = page.locator(`.child-item-row[data-item-type="${expectedDisplayType}"]`);
  62  |     const childExists = await childItem.isVisible({ timeout: 2000 }).catch(() => false);
  63  | 
  64  |     if (childExists) {
  65  |       const text = await childItem.textContent();
  66  |       console.log(`✅ ${type}: Association displayed - ${text?.trim().substring(0, 50)}`);
  67  |       return true;
  68  |     } else {
  69  |       console.log(`❌ ${type}: Association not displayed after expansion`);
  70  |       return false;
  71  |     }
  72  |   }
  73  | 
  74  |   test('Add -> Project and verify display', async ({ page }) => {
  75  |     const result = await testAssociation(page, 'Project', '[data-action="add-project"]', 'priority');
  76  |     expect(result).toBe(true);
  77  |   });
  78  | 
  79  |   test('Add -> Category and verify display', async ({ page }) => {
  80  |     const result = await testAssociation(page, 'Category', '[data-action="add-area"]', 'area');
  81  |     expect(result).toBe(true);
  82  |   });
  83  | 
  84  |   test('Add -> Goal and verify display', async ({ page }) => {
  85  |     const result = await testAssociation(page, 'Goal', '[data-action="add-goal"]', 'goal');
  86  |     expect(result).toBe(true);
  87  |   });
  88  | 
  89  |   test('Add -> Todo and verify display', async ({ page }) => {
  90  |     const result = await testAssociation(page, 'Todo', '[data-action="add-todo"]', 'todo');
  91  |     expect(result).toBe(true);
  92  |   });
  93  | 
  94  |   test('Add -> Task and verify display', async ({ page }) => {
  95  |     const result = await testAssociation(page, 'Task', '[data-action="add-task"]', 'task');
  96  |     expect(result).toBe(true);
  97  |   });
  98  | 
  99  |   test('Add -> Ticket and verify display', async ({ page }) => {
  100 |     const result = await testAssociation(page, 'Ticket', '[data-action="add-ticket"]', 'ticket');
  101 |     expect(result).toBe(true);
  102 |   });
  103 | 
  104 |   test('Add -> Idea and verify display', async ({ page }) => {
  105 |     const result = await testAssociation(page, 'Idea', '[data-action="add-idea"]', 'idea');
  106 |     expect(result).toBe(true);
  107 |   });
  108 | });
  109 | 
```