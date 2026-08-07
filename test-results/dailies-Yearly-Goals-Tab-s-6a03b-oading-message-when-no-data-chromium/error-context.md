# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dailies.spec.js >> Yearly Goals Tab >> should not show loading message when no data
- Location: tests/e2e/dailies.spec.js:114:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.textContent: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#goalsList')

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
    - generic:                                                                                                                                                                               
    - contentinfo [ref=e36]:
      - paragraph [ref=e38]: © 2026 MyWork. Licensed under the MIT License.
  - text:     
```

# Test source

```ts
  16  |     await page.waitForTimeout(2000); // Wait for load
  17  |     const loadingText = await page.locator('#workItemsList').textContent();
  18  |     expect(loadingText).not.toContain('Loading');
  19  |   });
  20  | 
  21  |   test('Add Work button should open modal', async ({ page }) => {
  22  |     const addButton = page.locator('button:has-text("+ Add")').first();
  23  |     await addButton.click();
  24  | 
  25  |     const modal = page.locator('#workModal');
  26  |     await expect(modal).toBeVisible();
  27  |   });
  28  | 
  29  |   test('should fill and submit work form', async ({ page }) => {
  30  |     const addButton = page.locator('button:has-text("+ Add")').first();
  31  |     await addButton.click();
  32  | 
  33  |     const modal = page.locator('#workModal');
  34  |     await expect(modal).toBeVisible();
  35  | 
  36  |     const titleInput = page.locator('#workTitle');
  37  |     await titleInput.fill('Test Work Item');
  38  | 
  39  |     const saveButton = page.locator('#workModal button:has-text("Save Work")');
  40  |     await saveButton.click();
  41  | 
  42  |     // Wait for modal to close
  43  |     await expect(modal).toBeHidden();
  44  | 
  45  |     // Check notification
  46  |     const notification = page.locator('.alert-success');
  47  |     await expect(notification).toBeVisible();
  48  |   });
  49  | 
  50  |   test('should show work item in list after creation', async ({ page }) => {
  51  |     // Add a work item
  52  |     const addButton = page.locator('button:has-text("+ Add")').first();
  53  |     await addButton.click();
  54  | 
  55  |     const titleInput = page.locator('#workTitle');
  56  |     await titleInput.fill('My Test Task');
  57  | 
  58  |     const saveButton = page.locator('#workModal button:has-text("Save Work")');
  59  |     await saveButton.click();
  60  | 
  61  |     // Wait and check list
  62  |     await page.waitForTimeout(1000);
  63  |     const listContent = await page.locator('#workItemsList').textContent();
  64  |     expect(listContent).toContain('My Test Task');
  65  |   });
  66  | });
  67  | 
  68  | test.describe('Priorities Tab', () => {
  69  |   test.beforeEach(async ({ page }) => {
  70  |     await page.goto('http://localhost:3000/?tab=my-priorities');
  71  |     await page.waitForLoadState('networkidle');
  72  |   });
  73  | 
  74  |   test('should not show loading message when no data', async ({ page }) => {
  75  |     await page.waitForTimeout(2000);
  76  |     const loadingText = await page.locator('#prioritiesList').textContent();
  77  |     expect(loadingText).not.toContain('Loading');
  78  |   });
  79  | 
  80  |   test('Add Priority button should open modal', async ({ page }) => {
  81  |     const addButton = page.locator('button:has-text("+ Add Priority")');
  82  |     await addButton.click();
  83  | 
  84  |     const modal = page.locator('#priorityModal');
  85  |     await expect(modal).toBeVisible();
  86  |   });
  87  | 
  88  |   test('should fill and submit priority form', async ({ page }) => {
  89  |     const addButton = page.locator('button:has-text("+ Add Priority")');
  90  |     await addButton.click();
  91  | 
  92  |     const modal = page.locator('#priorityModal');
  93  |     await expect(modal).toBeVisible();
  94  | 
  95  |     const titleInput = page.locator('#priorityTitle');
  96  |     await titleInput.fill('High Priority Task');
  97  | 
  98  |     const saveButton = page.locator('#priorityModal button:has-text("Save Priority")');
  99  |     await saveButton.click();
  100 | 
  101 |     await expect(modal).toBeHidden();
  102 | 
  103 |     const notification = page.locator('.alert-success');
  104 |     await expect(notification).toBeVisible();
  105 |   });
  106 | });
  107 | 
  108 | test.describe('Yearly Goals Tab', () => {
  109 |   test.beforeEach(async ({ page }) => {
  110 |     await page.goto('http://localhost:3000/?tab=yearly-goals');
  111 |     await page.waitForLoadState('networkidle');
  112 |   });
  113 | 
  114 |   test('should not show loading message when no data', async ({ page }) => {
  115 |     await page.waitForTimeout(2000);
> 116 |     const loadingText = await page.locator('#goalsList').textContent();
      |                                                          ^ Error: locator.textContent: Test timeout of 30000ms exceeded.
  117 |     expect(loadingText).not.toContain('Loading');
  118 |   });
  119 | 
  120 |   test('Add Goal button should open modal', async ({ page }) => {
  121 |     const addButton = page.locator('button:has-text("+ Add Goal")');
  122 |     await addButton.click();
  123 | 
  124 |     const modal = page.locator('#goalModal');
  125 |     await expect(modal).toBeVisible();
  126 |   });
  127 | 
  128 |   test('should fill and submit goal form', async ({ page }) => {
  129 |     const addButton = page.locator('button:has-text("+ Add Goal")');
  130 |     await addButton.click();
  131 | 
  132 |     const modal = page.locator('#goalModal');
  133 |     await expect(modal).toBeVisible();
  134 | 
  135 |     const nameInput = page.locator('#goalName');
  136 |     await nameInput.fill('2026 Goal');
  137 | 
  138 |     const saveButton = page.locator('#goalModal button:has-text("Save Goal")');
  139 |     await saveButton.click();
  140 | 
  141 |     await expect(modal).toBeHidden();
  142 | 
  143 |     const notification = page.locator('.alert-success');
  144 |     await expect(notification).toBeVisible();
  145 |   });
  146 | });
  147 | 
  148 | test.describe('Settings Tab', () => {
  149 |   test.beforeEach(async ({ page }) => {
  150 |     await page.goto('http://localhost:3000/?tab=settings');
  151 |     await page.waitForLoadState('networkidle');
  152 |   });
  153 | 
  154 |   test('should not show loading message when no data', async ({ page }) => {
  155 |     await page.waitForTimeout(2000);
  156 |     const loadingText = await page.locator('#sourcesTableBody').textContent();
  157 |     expect(loadingText).not.toContain('Loading');
  158 |   });
  159 | 
  160 |   test('Add Data Source button should open modal', async ({ page }) => {
  161 |     const addButton = page.locator('button:has-text("+ Add Data Source")');
  162 |     await addButton.click();
  163 | 
  164 |     const modal = page.locator('#sourceModal');
  165 |     await expect(modal).toBeVisible();
  166 |   });
  167 | 
  168 |   test('should fill and submit source form', async ({ page }) => {
  169 |     const addButton = page.locator('button:has-text("+ Add Data Source")');
  170 |     await addButton.click();
  171 | 
  172 |     const modal = page.locator('#sourceModal');
  173 |     await expect(modal).toBeVisible();
  174 | 
  175 |     const nameInput = page.locator('#sourceName');
  176 |     await nameInput.fill('Test Source');
  177 | 
  178 |     const typeSelect = page.locator('#sourceType');
  179 |     await typeSelect.selectOption('github');
  180 | 
  181 |     const saveButton = page.locator('#sourceModal button:has-text("Save Source")');
  182 |     await saveButton.click();
  183 | 
  184 |     await expect(modal).toBeHidden();
  185 | 
  186 |     const notification = page.locator('.alert-success');
  187 |     await expect(notification).toBeVisible();
  188 |   });
  189 | });
  190 | 
```