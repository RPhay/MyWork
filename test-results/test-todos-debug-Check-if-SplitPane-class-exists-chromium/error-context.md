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
  4   |   await page.goto('http://localhost:3000/?tab=todos');
  5   |   await page.waitForLoadState('networkidle');
  6   | 
  7   |   const splitpaneInfo = await page.evaluate(() => {
  8   |     return {
  9   |       classExists: typeof SplitPane !== 'undefined',
  10  |       instanceExists: typeof window.todoSplitPane !== 'undefined',
  11  |       hasShowRightPane: window.todoSplitPane && typeof window.todoSplitPane.showRightPane === 'function',
  12  |       instanceKeys: window.todoSplitPane ? Object.getOwnPropertyNames(window.todoSplitPane) : [],
  13  |       instanceMethods: window.todoSplitPane ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.todoSplitPane)) : [],
  14  |     };
  15  |   });
  16  | 
  17  |   console.log('SplitPane info:', JSON.stringify(splitpaneInfo, null, 2));
  18  |   expect(splitpaneInfo.classExists).toBe(true);
  19  |   expect(splitpaneInfo.instanceExists).toBe(true);
> 20  |   expect(splitpaneInfo.hasShowRightPane).toBe(true);
      |                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  21  | });
  22  | 
  23  | test('Todos page - editor should start hidden', async ({ page }) => {
  24  |   await page.goto('http://localhost:3000/?tab=todos');
  25  | 
  26  |   // Wait for page to load
  27  |   await page.waitForLoadState('networkidle');
  28  | 
  29  |   // Check if editor pane is hidden
  30  |   const editorPane = await page.locator('#todoEditorPane');
  31  |   const isHidden = await editorPane.evaluate(el => {
  32  |     const classes = el.className;
  33  |     const computedStyle = window.getComputedStyle(el);
  34  |     return classes.includes('hidden') && computedStyle.display === 'none';
  35  |   });
  36  | 
  37  |   console.log('Editor pane is hidden:', isHidden);
  38  |   expect(isHidden).toBe(true);
  39  | });
  40  | 
  41  | test('Todos page - clicking on todo should load it', async ({ page }) => {
  42  |   const consoleLogs = [];
  43  |   page.on('console', msg => {
  44  |     if (msg.type() === 'error') {
  45  |       consoleLogs.push(`CONSOLE ERROR: ${msg.text()}`);
  46  |     }
  47  |   });
  48  | 
  49  |   await page.goto('http://localhost:3000/?tab=todos');
  50  | 
  51  |   // Wait for page to load
  52  |   await page.waitForLoadState('networkidle');
  53  | 
  54  |   // Expand first folder if collapsed
  55  |   const firstFolder = await page.locator('.todo-folder-node').first();
  56  |   const isCollapsed = await firstFolder.evaluate(el => !el.classList.contains('expanded'));
  57  |   if (isCollapsed) {
  58  |     const toggle = firstFolder.locator('.todo-folder-toggle').first();
  59  |     await toggle.click({ force: true });
  60  |     await page.waitForTimeout(300);
  61  |   }
  62  | 
  63  |   // Get first todo item
  64  |   const firstTodo = await page.locator('.todo-row').first();
  65  | 
  66  |   // Click on it
  67  |   await firstTodo.click({ force: true });
  68  | 
  69  |   // Wait for any errors to appear
  70  |   await page.waitForTimeout(1000);
  71  | 
  72  |   // Check for error notifications
  73  |   const errorElements = await page.locator('.alert-danger');
  74  |   const errorCount = await errorElements.count();
  75  |   console.log('Number of error alerts:', errorCount);
  76  | 
  77  |   if (errorCount > 0) {
  78  |     const errorText = await errorElements.first().textContent();
  79  |     console.log('Error message:', errorText);
  80  |   }
  81  | 
  82  |   // Check if editor pane is now visible
  83  |   const editorPane = await page.locator('#todoEditorPane');
  84  |   const isVisible = await editorPane.evaluate(el => {
  85  |     const classes = el.className;
  86  |     const computedStyle = window.getComputedStyle(el);
  87  |     return !classes.includes('hidden') && computedStyle.display !== 'none';
  88  |   });
  89  | 
  90  |   console.log('Editor pane is visible after click:', isVisible);
  91  | 
  92  |   // Check if title is populated
  93  |   const titleInput = await page.locator('#toDoEditorFormTitle');
  94  |   const titleValue = await titleInput.inputValue();
  95  |   console.log('Title value:', titleValue);
  96  | 
  97  |   if (consoleLogs.length > 0) {
  98  |     console.log('Console errors:', consoleLogs);
  99  |   }
  100 | 
  101 |   expect(errors).toBe(0);
  102 |   expect(isVisible).toBe(true);
  103 |   expect(titleValue.length).toBeGreaterThan(0);
  104 | });
  105 | 
  106 | test('Templates page - for comparison', async ({ page }) => {
  107 |   await page.goto('http://localhost:3000/?tab=templates');
  108 | 
  109 |   // Wait for page to load
  110 |   await page.waitForLoadState('networkidle');
  111 | 
  112 |   // Check if editor pane is hidden
  113 |   const editorPane = await page.locator('#templateEditorPane');
  114 |   const isHidden = await editorPane.evaluate(el => {
  115 |     const classes = el.className;
  116 |     const computedStyle = window.getComputedStyle(el);
  117 |     return classes.includes('hidden') && computedStyle.display === 'none';
  118 |   });
  119 | 
  120 |   console.log('Templates editor pane is hidden:', isHidden);
```