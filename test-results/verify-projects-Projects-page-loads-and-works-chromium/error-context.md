# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify-projects.spec.js >> Projects page loads and works
- Location: tests/e2e/verify-projects.spec.js:3:1

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
    - generic:                        
    - generic [ref=e37]:
      - button "Associate Items" [ref=e39] [cursor=pointer]
      - generic [ref=e41]:
        - generic:
          - heading "Associate Items" [level=6]
          - generic:
            - generic [ref=e42] [cursor=pointer]:
              - generic [ref=e43]: 
              - generic [ref=e44]: 
              - generic [ref=e45]: Categories
            - text:       
          - generic [ref=e46] [cursor=pointer]:
            - generic [ref=e47]: 
            - generic [ref=e48]: 
            - generic [ref=e49]: Goals
          - generic:
            - generic [ref=e50] [cursor=pointer]:
              - generic [ref=e51]: 
              - generic [ref=e52]: 
              - generic [ref=e53]: To Dos
            - text:      
      - generic [ref=e54]:
        - generic [ref=e55]:
          - generic [ref=e56]:
            - heading "Projects" [level=6] [ref=e57]
            - button "+ Add Project" [ref=e58] [cursor=pointer]
          - paragraph [ref=e59]: Drop a project on another to make it a sub-project, between two projects to reorder it there, or onto empty space to make it top-level. Drag a category, goal, or to do from the associate panel onto a project to associate it.
          - generic [ref=e60]:
            - generic [ref=e61]: Title
            - generic [ref=e62]: Categories
            - generic [ref=e63]: Goals
            - generic [ref=e64]: Actions
          - generic [ref=e66]:
            - generic [ref=e67]:
              - generic [ref=e68]:
                - generic [ref=e69] [cursor=pointer]: 
                - generic [ref=e70]: 
                - generic [ref=e71]: Tets
              - generic [ref=e72]: "-"
              - generic [ref=e74]: "-"
              - button "Delete" [ref=e77] [cursor=pointer]:
                - generic [ref=e78]: 
            - text:        
        - text: 
  - text:                                                                                                          
  - contentinfo [ref=e79]:
    - paragraph [ref=e81]: © 2026 MyWork. Licensed under the MIT License.
  - text:     
  - alert [ref=e83]:
    - text: Error loading project
    - button "Close" [ref=e84] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Projects page loads and works', async ({ page }) => {
  4  |   await page.goto('http://localhost:3000', { waitUntil: 'load' });
  5  | 
  6  |   // Click Projects tab
  7  |   const projectsButton = page.locator('button[data-tab="my-priorities"]');
  8  |   await projectsButton.click();
  9  |   await page.waitForTimeout(1000);
  10 | 
  11 |   // Check for project nodes
  12 |   const projectNodes = page.locator('.priority-node');
  13 |   const count = await projectNodes.count();
  14 |   console.log('Project nodes found:', count);
  15 |   expect(count).toBeGreaterThan(0);
  16 | 
  17 |   // Try clicking on first project
  18 |   const firstProject = projectNodes.first();
  19 |   await firstProject.click();
  20 |   await page.waitForTimeout(500);
  21 | 
  22 |   // Check that editor pane is now visible
  23 |   const editorPane = page.locator('#priorityEditorPane');
  24 |   const isVisible = await editorPane.isVisible();
  25 |   console.log('Editor pane visible after click:', isVisible);
> 26 |   expect(isVisible).toBe(true);
     |                     ^ Error: expect(received).toBe(expected) // Object.is equality
  27 | 
  28 |   // Check that editor has content
  29 |   const editorTitle = editorPane.locator('.split-pane-editor-title');
  30 |   const title = await editorTitle.textContent();
  31 |   console.log('Editor title:', title);
  32 |   expect(title).not.toBe('Select a project to edit');
  33 | });
  34 | 
```