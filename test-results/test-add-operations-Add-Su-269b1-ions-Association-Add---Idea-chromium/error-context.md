# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-add-operations.spec.js >> Add Submenu Operations (Association) >> Add -> Idea
- Location: tests/e2e/test-add-operations.spec.js:98:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.work-item-header').first()

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - navigation [ref=f1e2]:
    - generic [ref=f1e3]:
      - link "MyWork - v2026.07.28.0" [ref=f1e4] [cursor=pointer]:
        - /url: /
      - generic [ref=f1e5]:
        - button "  Default" [ref=f1e6] [cursor=pointer]:
          - generic [ref=f1e7]: 
          - generic [ref=f1e8]:
            - generic [ref=f1e9]: 
            - text: Default
        - text: 
      - link "Settings" [ref=f1e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=f1e11]: 
  - generic [ref=f1e12]:
    - tablist [ref=f1e13]:
      - tab "⭐ Dailies" [ref=f1e14] [cursor=pointer]:
        - generic [ref=f1e15]: ⭐
        - text: Dailies
      - tab "📌 Projects" [ref=f1e16] [cursor=pointer]:
        - generic [ref=f1e17]: 📌
        - text: Projects
      - tab "📂 Categories" [ref=f1e18] [cursor=pointer]:
        - generic [ref=f1e19]: 📂
        - text: Categories
      - tab "🎯 Goals" [ref=f1e20] [cursor=pointer]:
        - generic [ref=f1e21]: 🎯
        - text: Goals
      - tab "☑ Todos" [ref=f1e22] [cursor=pointer]:
        - generic [ref=f1e23]: ☑
        - text: Todos
      - tab "📋 Tasks" [ref=f1e24] [cursor=pointer]:
        - generic [ref=f1e25]: 📋
        - text: Tasks
      - tab "🎫 Tickets" [ref=f1e26] [cursor=pointer]:
        - generic [ref=f1e27]: 🎫
        - text: Tickets
      - tab "💡 Brainstorming" [ref=f1e28] [cursor=pointer]:
        - generic [ref=f1e29]: 💡
        - text: Brainstorming
      - tab "📑 Templates" [ref=f1e30] [cursor=pointer]:
        - generic [ref=f1e31]: 📑
        - text: Templates
      - tab "📊 Priorities" [ref=f1e32] [cursor=pointer]:
        - generic [ref=f1e33]: 📊
        - text: Priorities
      - tab "📈 Reporting" [ref=f1e34] [cursor=pointer]:
        - generic [ref=f1e35]: 📈
        - text: Reporting
    - generic [ref=f1e36]:
      - generic [ref=f1e37]:
        - generic [ref=f1e39]:
          - generic [ref=f1e40]:
            - tablist [ref=f1e41]:
              - tab "Calendar" [selected] [ref=f1e42] [cursor=pointer]
              - tab "Work Picker" [ref=f1e43] [cursor=pointer]
            - generic [ref=f1e44]:
              - tabpanel "Calendar" [ref=f1e45]:
                - generic [ref=f1e46]:
                  - generic [ref=f1e47]:
                    - button "Previous month" [ref=f1e48] [cursor=pointer]: ‹
                    - heading "August 2026" [level=6] [ref=f1e49]
                    - button "Next month" [ref=f1e50] [cursor=pointer]: ›
                  - table [ref=f1e51]:
                    - rowgroup [ref=f1e52]:
                      - row [ref=f1e53]:
                        - columnheader "Sun" [ref=f1e54]
                        - columnheader "Mon" [ref=f1e55]
                        - columnheader "Tue" [ref=f1e56]
                        - columnheader "Wed" [ref=f1e57]
                        - columnheader "Thu" [ref=f1e58]
                        - columnheader "Fri" [ref=f1e59]
                        - columnheader "Sat" [ref=f1e60]
                      - row [ref=f1e61]:
                        - cell [ref=f1e62]
                        - cell [ref=f1e63]
                        - cell [ref=f1e64]
                        - cell [ref=f1e65]
                        - cell [ref=f1e66]
                        - cell [ref=f1e67]
                        - cell "1" [ref=f1e68] [cursor=pointer]
                      - row [ref=f1e69]:
                        - cell "2" [ref=f1e70] [cursor=pointer]
                        - cell "3" [ref=f1e71] [cursor=pointer]
                        - cell "4" [ref=f1e72] [cursor=pointer]
                        - cell "5" [ref=f1e73] [cursor=pointer]
                        - cell "6" [ref=f1e74] [cursor=pointer]
                        - cell "7" [ref=f1e75] [cursor=pointer]
                        - cell "8" [ref=f1e76] [cursor=pointer]
                      - row [ref=f1e77]:
                        - cell "9" [ref=f1e78] [cursor=pointer]
                        - cell "10" [ref=f1e79] [cursor=pointer]
                        - cell "11" [ref=f1e80] [cursor=pointer]
                        - cell "12" [ref=f1e81] [cursor=pointer]
                        - cell "13" [ref=f1e82] [cursor=pointer]
                        - cell "14" [ref=f1e83] [cursor=pointer]
                        - cell "15" [ref=f1e84] [cursor=pointer]
                      - row [ref=f1e85]:
                        - cell "16" [ref=f1e86] [cursor=pointer]
                        - cell "17" [ref=f1e87] [cursor=pointer]
                        - cell "18" [ref=f1e88] [cursor=pointer]
                        - cell "19" [ref=f1e89] [cursor=pointer]
                        - cell "20" [ref=f1e90] [cursor=pointer]
                        - cell "21" [ref=f1e91] [cursor=pointer]
                        - cell "22" [ref=f1e92] [cursor=pointer]
                      - row [ref=f1e93]:
                        - cell "23" [ref=f1e94] [cursor=pointer]
                        - cell "24" [ref=f1e95] [cursor=pointer]
                        - cell "25" [ref=f1e96] [cursor=pointer]
                        - cell "26" [ref=f1e97] [cursor=pointer]
                        - cell "27" [ref=f1e98] [cursor=pointer]
                        - cell "28" [ref=f1e99] [cursor=pointer]
                        - cell "29" [ref=f1e100] [cursor=pointer]
                      - row [ref=f1e101]:
                        - cell "30" [ref=f1e102] [cursor=pointer]
                        - cell "31" [ref=f1e103] [cursor=pointer]
                        - cell [ref=f1e104]
                        - cell [ref=f1e105]
                        - cell [ref=f1e106]
                        - cell [ref=f1e107]
                        - cell [ref=f1e108]
              - text:       
          - generic [ref=f1e112]:
            - generic [ref=f1e113]:
              - heading "Work Items for Tuesday, Aug 18" [level=6] [ref=f1e114]
              - button "+ Add" [ref=f1e116] [cursor=pointer]
            - generic [ref=f1e117]:
              - generic [ref=f1e118]: Title
              - generic [ref=f1e119]: Oh!
              - generic [ref=f1e120]: Time
              - generic [ref=f1e121]: Status
              - generic [ref=f1e122]: Time Box
              - generic [ref=f1e123]: Claude
              - generic [ref=f1e124]: Notes
              - generic [ref=f1e125]: Actions
            - paragraph [ref=f1e127]: Error loading work items
        - text:                    
      - text: "                            Add notes here... Visit URL: EditRemove                                                                                                                                                                                                                           "
  - contentinfo [ref=f1e128]:
    - paragraph [ref=f1e130]: © 2026 MyWork. Licensed under the MIT License.
  - text:     
  - alert [ref=f1e132]:
    - text: "Error: A required database table is missing. Run the database setup script."
    - button "Close" [ref=f1e133] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { setupTestData, createTestWorkItem } from './setup-test-data.js';
  3   | 
  4   | test.describe('Add Submenu Operations (Association)', () => {
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
  17  |   // Helper to perform Add operation
  18  |   async function testAddAssociation(page, actionType, buttonSelector) {
  19  |     const workItem = await createTestWorkItem(page, `Test Add ${actionType}`);
  20  |     await page.reload();
  21  |     await page.waitForLoadState('networkidle');
  22  |     await page.waitForTimeout(1000);
  23  | 
  24  |     const workItemHeader = page.locator('.work-item-header').first();
> 25  |     await workItemHeader.click({ button: 'right' });
      |                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  26  |     await page.waitForTimeout(500);
  27  | 
  28  |     const addSubmenu = page.locator('[data-submenu="add-items"]');
  29  |     await addSubmenu.click();
  30  |     await page.waitForTimeout(300);
  31  | 
  32  |     const btn = page.locator(buttonSelector);
  33  |     await btn.click();
  34  |     await page.waitForTimeout(1500);
  35  | 
  36  |     const modal = page.locator('.modal.show, .modal.fade.show').first();
  37  |     const isVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
  38  | 
  39  |     if (!isVisible) {
  40  |       console.warn(`⚠️ ${actionType}: Modal did not appear`);
  41  |       return false;
  42  |     }
  43  | 
  44  |     const item = page.locator('.list-group-item').first();
  45  |     const itemVisible = await item.isVisible({ timeout: 1000 }).catch(() => false);
  46  | 
  47  |     if (!itemVisible) {
  48  |       console.warn(`⚠️ ${actionType}: No items in modal`);
  49  |       return false;
  50  |     }
  51  | 
  52  |     await item.click();
  53  |     await page.waitForTimeout(1500);
  54  | 
  55  |     const notification = page.locator('.alert-success').first();
  56  |     const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
  57  | 
  58  |     if (notifVisible) {
  59  |       const text = await notification.textContent();
  60  |       console.log(`✅ ${actionType}: ${text}`);
  61  |       return true;
  62  |     } else {
  63  |       console.warn(`⚠️ ${actionType}: No success notification`);
  64  |       return false;
  65  |     }
  66  |   }
  67  | 
  68  |   test('Add -> Project', async ({ page }) => {
  69  |     const result = await testAddAssociation(page, 'Project', '[data-action="add-project"]');
  70  |     expect(result).toBe(true);
  71  |   });
  72  | 
  73  |   test('Add -> Category', async ({ page }) => {
  74  |     const result = await testAddAssociation(page, 'Category', '[data-action="add-area"]');
  75  |     expect(result).toBe(true);
  76  |   });
  77  | 
  78  |   test('Add -> Goal', async ({ page }) => {
  79  |     const result = await testAddAssociation(page, 'Goal', '[data-action="add-goal"]');
  80  |     expect(result).toBe(true);
  81  |   });
  82  | 
  83  |   test('Add -> Todo', async ({ page }) => {
  84  |     const result = await testAddAssociation(page, 'Todo', '[data-action="add-todo"]');
  85  |     expect(result).toBe(true);
  86  |   });
  87  | 
  88  |   test('Add -> Task', async ({ page }) => {
  89  |     const result = await testAddAssociation(page, 'Task', '[data-action="add-task"]');
  90  |     expect(result).toBe(true);
  91  |   });
  92  | 
  93  |   test('Add -> Ticket', async ({ page }) => {
  94  |     const result = await testAddAssociation(page, 'Ticket', '[data-action="add-ticket"]');
  95  |     expect(result).toBe(true);
  96  |   });
  97  | 
  98  |   test('Add -> Idea', async ({ page }) => {
  99  |     const result = await testAddAssociation(page, 'Idea', '[data-action="add-idea"]');
  100 |     expect(result).toBe(true);
  101 |   });
  102 | });
  103 | 
```