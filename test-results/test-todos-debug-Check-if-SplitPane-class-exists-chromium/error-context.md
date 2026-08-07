# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-todos-debug.spec.js >> Check if SplitPane class exists
- Location: tests/e2e/test-todos-debug.spec.js:3:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
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
    - generic [ref=e36]:
      - text:                                                                                                              
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e40]:
            - generic [ref=e42]:
              - button "+ Add Folder" [ref=e43] [cursor=pointer]
              - button "+ Add To Do" [ref=e44] [cursor=pointer]
            - paragraph [ref=e45]: Drag a to do onto a folder to file it there, or onto empty space to unfile it. Drag a folder onto another to nest it.
            - generic [ref=e46]:
              - generic [ref=e47]: Title
              - generic [ref=e48]: Notes
              - generic [ref=e49]: Actions
            - generic [ref=e50]:
              - generic [ref=e51]:
                - generic [ref=e52]:
                  - generic [ref=e53]:
                    - generic [ref=e54] [cursor=pointer]: 
                    - generic [ref=e55]: 
                    - generic [ref=e56]: Claude
                  - generic [ref=e57]:
                    - button "Edit" [ref=e58] [cursor=pointer]:
                      - generic [ref=e59]: 
                    - button "Delete" [ref=e60] [cursor=pointer]:
                      - generic [ref=e61]: 
                - text:        
              - generic [ref=e62]:
                - generic [ref=e63]:
                  - generic "To Do" [ref=e64]: 
                  - generic [ref=e65]: Add SSO toggle for contexts
                - generic [ref=e66]: "Add ability to enable/configure SSO for a context so if SSO is enabled, users must log in via SSO with a given user. Requirements: Support OAuth2 initially, context-level enforcement, auto user mapping, redirect to SSO login if not authenticated."
                - button "Delete" [ref=e68] [cursor=pointer]:
                  - generic [ref=e69]: 
          - text:  
        - text:      
      - text:                                     
  - contentinfo [ref=e71]:
    - paragraph [ref=e73]: © 2026 MyWork. Licensed under the MIT License.
  - text:     
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test('Check if SplitPane class exists', async ({ page }) => {
  4   |   const consoleLogs = [];
  5   |   page.on('console', msg => {
  6   |     if (msg.type() === 'error') {
  7   |       consoleLogs.push(`ERROR: ${msg.text()}`);
  8   |     }
  9   |   });
  10  | 
  11  |   await page.goto('http://localhost:3000/?tab=todos');
  12  |   await page.waitForLoadState('networkidle');
  13  | 
  14  |   if (consoleLogs.length > 0) {
  15  |     console.log('Console errors during load:', consoleLogs);
  16  |   }
  17  | 
  18  |   const splitpaneInfo = await page.evaluate(() => {
  19  |     const info = {
  20  |       classExists: typeof SplitPane !== 'undefined',
  21  |       instanceExists: typeof window.todoSplitPane !== 'undefined',
  22  |       instanceValue: String(window.todoSplitPane),
  23  |       hasShowRightPane: window.todoSplitPane && typeof window.todoSplitPane.showRightPane === 'function',
  24  |       instanceKeys: window.todoSplitPane ? Object.getOwnPropertyNames(window.todoSplitPane) : [],
  25  |       instanceMethods: window.todoSplitPane ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.todoSplitPane)) : [],
  26  |       instanceType: window.todoSplitPane ? window.todoSplitPane.constructor.name : 'unknown',
  27  |     };
  28  | 
  29  |     // Check if it's actually a SplitPane instance
  30  |     if (window.todoSplitPane) {
  31  |       info.isSplitPane = window.todoSplitPane instanceof SplitPane;
  32  |     }
  33  | 
  34  |     return info;
  35  |   });
  36  | 
  37  |   console.log('SplitPane info:', JSON.stringify(splitpaneInfo, null, 2));
  38  |   expect(splitpaneInfo.classExists).toBe(true);
  39  |   expect(splitpaneInfo.instanceExists).toBe(true);
> 40  |   expect(splitpaneInfo.hasShowRightPane).toBe(true);
      |                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  41  | });
  42  | 
  43  | test('Todos page - editor should start hidden', async ({ page }) => {
  44  |   await page.goto('http://localhost:3000/?tab=todos');
  45  | 
  46  |   // Wait for page to load
  47  |   await page.waitForLoadState('networkidle');
  48  | 
  49  |   // Check if editor pane is hidden
  50  |   const editorPane = await page.locator('#todoEditorPane');
  51  |   const isHidden = await editorPane.evaluate(el => {
  52  |     const classes = el.className;
  53  |     const computedStyle = window.getComputedStyle(el);
  54  |     return classes.includes('hidden') && computedStyle.display === 'none';
  55  |   });
  56  | 
  57  |   console.log('Editor pane is hidden:', isHidden);
  58  |   expect(isHidden).toBe(true);
  59  | });
  60  | 
  61  | test('Todos page - clicking on todo should load it', async ({ page }) => {
  62  |   const consoleLogs = [];
  63  |   page.on('console', msg => {
  64  |     if (msg.type() === 'error') {
  65  |       consoleLogs.push(`CONSOLE ERROR: ${msg.text()}`);
  66  |     }
  67  |   });
  68  | 
  69  |   await page.goto('http://localhost:3000/?tab=todos');
  70  | 
  71  |   // Wait for page to load
  72  |   await page.waitForLoadState('networkidle');
  73  | 
  74  |   // Expand first folder if collapsed
  75  |   const firstFolder = await page.locator('.todo-folder-node').first();
  76  |   const isCollapsed = await firstFolder.evaluate(el => !el.classList.contains('expanded'));
  77  |   if (isCollapsed) {
  78  |     const toggle = firstFolder.locator('.todo-folder-toggle').first();
  79  |     await toggle.click({ force: true });
  80  |     await page.waitForTimeout(300);
  81  |   }
  82  | 
  83  |   // Get first todo item
  84  |   const firstTodo = await page.locator('.todo-row').first();
  85  | 
  86  |   // Click on it
  87  |   await firstTodo.click({ force: true });
  88  | 
  89  |   // Wait for any errors to appear
  90  |   await page.waitForTimeout(1000);
  91  | 
  92  |   // Check for error notifications
  93  |   const errorElements = await page.locator('.alert-danger');
  94  |   const errorCount = await errorElements.count();
  95  |   console.log('Number of error alerts:', errorCount);
  96  | 
  97  |   if (errorCount > 0) {
  98  |     const errorText = await errorElements.first().textContent();
  99  |     console.log('Error message:', errorText);
  100 |   }
  101 | 
  102 |   // Check if editor pane is now visible
  103 |   const editorPane = await page.locator('#todoEditorPane');
  104 |   const isVisible = await editorPane.evaluate(el => {
  105 |     const classes = el.className;
  106 |     const computedStyle = window.getComputedStyle(el);
  107 |     return !classes.includes('hidden') && computedStyle.display !== 'none';
  108 |   });
  109 | 
  110 |   console.log('Editor pane is visible after click:', isVisible);
  111 | 
  112 |   // Check if title is populated
  113 |   const titleInput = await page.locator('#toDoEditorFormTitle');
  114 |   const titleValue = await titleInput.inputValue();
  115 |   console.log('Title value:', titleValue);
  116 | 
  117 |   if (consoleLogs.length > 0) {
  118 |     console.log('Console errors:', consoleLogs);
  119 |   }
  120 | 
  121 |   expect(errors).toBe(0);
  122 |   expect(isVisible).toBe(true);
  123 |   expect(titleValue.length).toBeGreaterThan(0);
  124 | });
  125 | 
  126 | test('Templates page - for comparison', async ({ page }) => {
  127 |   await page.goto('http://localhost:3000/?tab=templates');
  128 | 
  129 |   // Wait for page to load
  130 |   await page.waitForLoadState('networkidle');
  131 | 
  132 |   // Check if editor pane is hidden
  133 |   const editorPane = await page.locator('#templateEditorPane');
  134 |   const isHidden = await editorPane.evaluate(el => {
  135 |     const classes = el.className;
  136 |     const computedStyle = window.getComputedStyle(el);
  137 |     return classes.includes('hidden') && computedStyle.display === 'none';
  138 |   });
  139 | 
  140 |   console.log('Templates editor pane is hidden:', isHidden);
```