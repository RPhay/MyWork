# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dailies.spec.js >> Priorities Tab >> should not show loading message when no data
- Location: tests/e2e/dailies.spec.js:73:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.textContent: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#prioritiesTableBody')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
      - tab " To Dos" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: 
        - text: To Dos
      - tab " Reporting" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: 
        - text: Reporting
    - generic [ref=e32]:
      - text:                                   
      - generic [ref=e34]:
        - generic [ref=e35]:
          - generic [ref=e36]:
            - heading "Projects" [level=6] [ref=e37]
            - button "+ Add Project" [ref=e38] [cursor=pointer]
          - paragraph [ref=e39]: Drop a project on another to make it a sub-project, between two projects to reorder it there, or onto empty space to make it top-level. Drag a category or goal from the right onto a project to associate it.
          - generic [ref=e40]:
            - generic [ref=e41]: Title
            - generic [ref=e42]: Categories
            - generic [ref=e43]: Goals
            - generic [ref=e44]: Actions
          - paragraph [ref=e46]: No projects yet
        - generic [ref=e47]:
          - list [ref=e48]:
            - listitem [ref=e49]:
              - button "Categories" [ref=e50] [cursor=pointer]
            - listitem [ref=e51]:
              - button "Goals" [ref=e52] [cursor=pointer]
          - generic [ref=e53]:
            - generic [ref=e54]:
              - generic [ref=e55]:
                - generic [ref=e56]: 
                - text: Systems Team
              - generic [ref=e57]: →
            - generic [ref=e58]:
              - generic [ref=e59]:
                - generic [ref=e60]: 
                - text: Meetings
              - generic [ref=e61]: →
            - generic [ref=e62]:
              - generic [ref=e63]:
                - generic [ref=e64]: 
                - text: General Support
              - generic [ref=e65]: →
            - generic [ref=e66]:
              - generic [ref=e67]:
                - generic [ref=e68]: 
                - text: Core IT
              - generic [ref=e69]: →
            - generic [ref=e70]:
              - generic [ref=e71]:
                - generic [ref=e72]: 
                - text: MSL
              - generic [ref=e73]: →
            - generic [ref=e74]:
              - generic [ref=e75]:
                - generic [ref=e76]: 
                - text: All Hands
              - generic [ref=e77]: →
            - generic [ref=e78]:
              - generic [ref=e79]:
                - generic [ref=e80]: 
                - text: AI Communities of Practice
              - generic [ref=e81]: →
          - text: 
      - text:                                                                                            
  - contentinfo [ref=e82]:
    - paragraph [ref=e84]: © 2026 MyWork. Licensed under the MIT License.
  - text:         
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Dailies Tab', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('http://localhost:3000/?tab=dailies');
  6   |     await page.waitForLoadState('networkidle');
  7   |   });
  8   | 
  9   |   test('should display calendar on load', async ({ page }) => {
  10  |     const calendar = await page.locator('#calendar').textContent();
  11  |     expect(calendar).toContain('Jan') || expect(calendar).toContain('Feb') || expect(calendar).toContain('Mar');
  12  |   });
  13  | 
  14  |   test('should not show loading message when no data', async ({ page }) => {
  15  |     await page.waitForTimeout(2000); // Wait for load
  16  |     const loadingText = await page.locator('#workItemsTableBody').textContent();
  17  |     expect(loadingText).not.toContain('Loading');
  18  |   });
  19  | 
  20  |   test('Add Work button should open modal', async ({ page }) => {
  21  |     const addButton = page.locator('button:has-text("+ Add")').first();
  22  |     await addButton.click();
  23  | 
  24  |     const modal = page.locator('#workModal');
  25  |     await expect(modal).toBeVisible();
  26  |   });
  27  | 
  28  |   test('should fill and submit work form', async ({ page }) => {
  29  |     const addButton = page.locator('button:has-text("+ Add")').first();
  30  |     await addButton.click();
  31  | 
  32  |     const modal = page.locator('#workModal');
  33  |     await expect(modal).toBeVisible();
  34  | 
  35  |     const titleInput = page.locator('#workTitle');
  36  |     await titleInput.fill('Test Work Item');
  37  | 
  38  |     const saveButton = page.locator('#workModal button:has-text("Save Work")');
  39  |     await saveButton.click();
  40  | 
  41  |     // Wait for modal to close
  42  |     await expect(modal).toBeHidden();
  43  | 
  44  |     // Check notification
  45  |     const notification = page.locator('.alert-success');
  46  |     await expect(notification).toBeVisible();
  47  |   });
  48  | 
  49  |   test('should show work item in table after creation', async ({ page }) => {
  50  |     // Add a work item
  51  |     const addButton = page.locator('button:has-text("+ Add")').first();
  52  |     await addButton.click();
  53  | 
  54  |     const titleInput = page.locator('#workTitle');
  55  |     await titleInput.fill('My Test Task');
  56  | 
  57  |     const saveButton = page.locator('#workModal button:has-text("Save Work")');
  58  |     await saveButton.click();
  59  | 
  60  |     // Wait and check table
  61  |     await page.waitForTimeout(1000);
  62  |     const tableContent = await page.locator('#workItemsTableBody').textContent();
  63  |     expect(tableContent).toContain('My Test Task');
  64  |   });
  65  | });
  66  | 
  67  | test.describe('Priorities Tab', () => {
  68  |   test.beforeEach(async ({ page }) => {
  69  |     await page.goto('http://localhost:3000/?tab=my-priorities');
  70  |     await page.waitForLoadState('networkidle');
  71  |   });
  72  | 
  73  |   test('should not show loading message when no data', async ({ page }) => {
  74  |     await page.waitForTimeout(2000);
> 75  |     const loadingText = await page.locator('#prioritiesTableBody').textContent();
      |                                                                    ^ Error: locator.textContent: Test timeout of 30000ms exceeded.
  76  |     expect(loadingText).not.toContain('Loading');
  77  |   });
  78  | 
  79  |   test('Add Priority button should open modal', async ({ page }) => {
  80  |     const addButton = page.locator('button:has-text("+ Add Priority")');
  81  |     await addButton.click();
  82  | 
  83  |     const modal = page.locator('#priorityModal');
  84  |     await expect(modal).toBeVisible();
  85  |   });
  86  | 
  87  |   test('should fill and submit priority form', async ({ page }) => {
  88  |     const addButton = page.locator('button:has-text("+ Add Priority")');
  89  |     await addButton.click();
  90  | 
  91  |     const modal = page.locator('#priorityModal');
  92  |     await expect(modal).toBeVisible();
  93  | 
  94  |     const titleInput = page.locator('#priorityTitle');
  95  |     await titleInput.fill('High Priority Task');
  96  | 
  97  |     const saveButton = page.locator('#priorityModal button:has-text("Save Priority")');
  98  |     await saveButton.click();
  99  | 
  100 |     await expect(modal).toBeHidden();
  101 | 
  102 |     const notification = page.locator('.alert-success');
  103 |     await expect(notification).toBeVisible();
  104 |   });
  105 | });
  106 | 
  107 | test.describe('Yearly Goals Tab', () => {
  108 |   test.beforeEach(async ({ page }) => {
  109 |     await page.goto('http://localhost:3000/?tab=yearly-goals');
  110 |     await page.waitForLoadState('networkidle');
  111 |   });
  112 | 
  113 |   test('should not show loading message when no data', async ({ page }) => {
  114 |     await page.waitForTimeout(2000);
  115 |     const loadingText = await page.locator('#goalsTableBody').textContent();
  116 |     expect(loadingText).not.toContain('Loading');
  117 |   });
  118 | 
  119 |   test('Add Goal button should open modal', async ({ page }) => {
  120 |     const addButton = page.locator('button:has-text("+ Add Goal")');
  121 |     await addButton.click();
  122 | 
  123 |     const modal = page.locator('#goalModal');
  124 |     await expect(modal).toBeVisible();
  125 |   });
  126 | 
  127 |   test('should fill and submit goal form', async ({ page }) => {
  128 |     const addButton = page.locator('button:has-text("+ Add Goal")');
  129 |     await addButton.click();
  130 | 
  131 |     const modal = page.locator('#goalModal');
  132 |     await expect(modal).toBeVisible();
  133 | 
  134 |     const nameInput = page.locator('#goalName');
  135 |     await nameInput.fill('2026 Goal');
  136 | 
  137 |     const saveButton = page.locator('#goalModal button:has-text("Save Goal")');
  138 |     await saveButton.click();
  139 | 
  140 |     await expect(modal).toBeHidden();
  141 | 
  142 |     const notification = page.locator('.alert-success');
  143 |     await expect(notification).toBeVisible();
  144 |   });
  145 | });
  146 | 
  147 | test.describe('Settings Tab', () => {
  148 |   test.beforeEach(async ({ page }) => {
  149 |     await page.goto('http://localhost:3000/?tab=settings');
  150 |     await page.waitForLoadState('networkidle');
  151 |   });
  152 | 
  153 |   test('should not show loading message when no data', async ({ page }) => {
  154 |     await page.waitForTimeout(2000);
  155 |     const loadingText = await page.locator('#sourcesTableBody').textContent();
  156 |     expect(loadingText).not.toContain('Loading');
  157 |   });
  158 | 
  159 |   test('Add Data Source button should open modal', async ({ page }) => {
  160 |     const addButton = page.locator('button:has-text("+ Add Data Source")');
  161 |     await addButton.click();
  162 | 
  163 |     const modal = page.locator('#sourceModal');
  164 |     await expect(modal).toBeVisible();
  165 |   });
  166 | 
  167 |   test('should fill and submit source form', async ({ page }) => {
  168 |     const addButton = page.locator('button:has-text("+ Add Data Source")');
  169 |     await addButton.click();
  170 | 
  171 |     const modal = page.locator('#sourceModal');
  172 |     await expect(modal).toBeVisible();
  173 | 
  174 |     const nameInput = page.locator('#sourceName');
  175 |     await nameInput.fill('Test Source');
```