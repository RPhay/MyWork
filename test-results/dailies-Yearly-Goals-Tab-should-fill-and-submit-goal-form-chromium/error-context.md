# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dailies.spec.js >> Yearly Goals Tab >> should fill and submit goal form
- Location: tests/e2e/dailies.spec.js:127:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("+ Add Goal")')
    - locator resolved to <button data-bs-toggle="modal" class="btn btn-primary" data-bs-target="#goalModal" onclick="openNewGoalForm()">↵      + Add Goal↵    </button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    56 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork" [ref=e4] [cursor=pointer]:
        - /url: /
      - list [ref=e6]:
        - listitem [ref=e7]:
          - link "Dailies" [ref=e8] [cursor=pointer]:
            - /url: /?tab=dailies
        - listitem [ref=e9]:
          - link "My Priorities" [ref=e10] [cursor=pointer]:
            - /url: /?tab=my-priorities
        - listitem [ref=e11]:
          - link "Yearly Goals" [ref=e12] [cursor=pointer]:
            - /url: /?tab=yearly-goals
        - listitem [ref=e13]:
          - link "Settings" [ref=e14] [cursor=pointer]:
            - /url: /?tab=settings
  - generic [ref=e15]:
    - tablist [ref=e16]:
      - tab "Dailies" [ref=e17] [cursor=pointer]
      - tab "My Priorities" [ref=e18] [cursor=pointer]
      - tab "Yearly Goals" [ref=e19] [cursor=pointer]
      - tab "Settings" [ref=e20] [cursor=pointer]
    - generic [ref=e22]:
      - group [ref=e25]:
        - radio "Day View" [checked]
        - generic [ref=e26] [cursor=pointer]: Day View
        - radio "Week View"
        - generic [ref=e27] [cursor=pointer]: Week View
      - generic [ref=e28]:
        - generic [ref=e29]:
          - heading "Select Date" [level=6] [ref=e30]
          - generic [ref=e31]:
            - button "← Previous Day" [ref=e32] [cursor=pointer]
            - button "Today" [ref=e33] [cursor=pointer]
            - button "Next Day →" [ref=e34] [cursor=pointer]
        - generic [ref=e35]:
          - generic [ref=e36]:
            - heading "Work Items for" [level=6] [ref=e37]
            - button "+ Add" [ref=e38] [cursor=pointer]
          - table [ref=e40]:
            - rowgroup [ref=e41]:
              - row [ref=e42]:
                - columnheader "Title" [ref=e43]
                - columnheader "Status" [ref=e44]
                - columnheader "Actions" [ref=e45]
            - rowgroup [ref=e46]:
              - row [ref=e47]:
                - cell "Loading..." [ref=e48]
        - generic [ref=e49]:
          - heading "My Priorities" [level=6] [ref=e50]
          - generic [ref=e51]: Loading...
          - heading "My Goals" [level=6] [ref=e52]
          - generic [ref=e53]: Loading...
  - contentinfo [ref=e54]:
    - paragraph [ref=e56]: © 2026 MyWork. All rights reserved.
```

# Test source

```ts
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
> 129 |     await addButton.click();
      |                     ^ Error: locator.click: Test timeout of 30000ms exceeded.
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