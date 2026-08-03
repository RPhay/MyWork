# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dailies.spec.js >> Settings Tab >> Add Data Source button should open modal
- Location: tests/e2e/dailies.spec.js:159:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("+ Add Data Source")')

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
    - generic:                                                                                                                                               
  - contentinfo [ref=e32]:
    - paragraph [ref=e34]: © 2026 MyWork. Licensed under the MIT License.
  - text:         
```

# Test source

```ts
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
  75  |     const loadingText = await page.locator('#prioritiesTableBody').textContent();
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
> 161 |     await addButton.click();
      |                     ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  176 | 
  177 |     const typeSelect = page.locator('#sourceType');
  178 |     await typeSelect.selectOption('github');
  179 | 
  180 |     const saveButton = page.locator('#sourceModal button:has-text("Save Source")');
  181 |     await saveButton.click();
  182 | 
  183 |     await expect(modal).toBeHidden();
  184 | 
  185 |     const notification = page.locator('.alert-success');
  186 |     await expect(notification).toBeVisible();
  187 |   });
  188 | });
  189 | 
```