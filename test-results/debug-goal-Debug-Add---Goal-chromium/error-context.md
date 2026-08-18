# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-goal.spec.js >> Debug: Add -> Goal
- Location: tests/e2e/debug-goal.spec.js:4:1

# Error details

```
TypeError: Cannot read properties of undefined (reading 'json')
```

```
Error: page.waitForLoadState: Test ended.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.07.28.0" [ref=e4] [cursor=pointer]:
        - /url: /
      - button " Context" [ref=e6] [cursor=pointer]:
        - generic [ref=e7]: 
        - text: Context
      - link "Settings" [ref=e8] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e9]: 
  - generic [ref=e10]:
    - tablist [ref=e11]:
      - tab "⭐ Dailies" [ref=e12] [cursor=pointer]:
        - generic [ref=e13]: ⭐
        - text: Dailies
      - tab "📌 Projects" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: 📌
        - text: Projects
      - tab "📂 Categories" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 📂
        - text: Categories
      - tab "🎯 Goals" [ref=e18] [cursor=pointer]:
        - generic [ref=e19]: 🎯
        - text: Goals
      - tab "☑ Todos" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: ☑
        - text: Todos
      - tab "📋 Tasks" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: 📋
        - text: Tasks
      - tab "🎫 Tickets" [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: 🎫
        - text: Tickets
      - tab "💡 Brainstorming" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: 💡
        - text: Brainstorming
      - tab "📑 Templates" [ref=e28] [cursor=pointer]:
        - generic [ref=e29]: 📑
        - text: Templates
      - tab "📊 Priorities" [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: 📊
        - text: Priorities
      - tab "📈 Reporting" [ref=e32] [cursor=pointer]:
        - generic [ref=e33]: 📈
        - text: Reporting
    - generic: "                                                       Add notes here... Visit URL: EditRemove                                     "
  - contentinfo [ref=e34]:
    - paragraph [ref=e36]: © 2026 MyWork. Licensed under the MIT License.
  - text:     
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { createTestWorkItem } from './setup-test-data.js';
  3  | 
  4  | test('Debug: Add -> Goal', async ({ page }) => {
  5  |   const consoleLogs = [];
  6  |   page.on('console', msg => {
  7  |     if (msg.text().includes('goal') || msg.type() === 'error') {
  8  |       console.log(`[${msg.type()}] ${msg.text()}`);
  9  |       consoleLogs.push({ type: msg.type(), text: msg.text() });
  10 |     }
  11 |   });
  12 | 
  13 |   page.on('pageerror', error => {
  14 |     console.error('[PAGE_ERROR]', error.message);
  15 |   });
  16 | 
  17 |   // Intercept the goals API call
  18 |   await page.route('**/api/goals/**', async route => {
  19 |     console.log('[INTERCEPT]', route.request().url());
  20 |     const response = await route.continue();
  21 |     const body = await response.json();
  22 |     console.log('[GOALS_RESPONSE]', JSON.stringify(body, null, 2).substring(0, 200));
  23 |     return response;
  24 |   });
  25 | 
  26 |   await page.goto('http://localhost:3000');
> 27 |   await page.waitForLoadState('networkidle');
     |              ^ Error: page.waitForLoadState: Test ended.
  28 | 
  29 |   const dailiesTab = page.locator('button:has-text("Dailies")').first();
  30 |   await dailiesTab.click();
  31 |   await page.waitForTimeout(1000);
  32 | 
  33 |   // Create a test goal directly
  34 |   const csrfToken = await page.evaluate(() => window.APP_CONFIG?.csrfToken);
  35 |   const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
  36 |   const year = new Date().getFullYear();
  37 |   const goalResp = await page.request.post('/api/goals', {
  38 |     data: { name: 'Debug Test Goal', year },
  39 |     headers
  40 |   });
  41 |   console.log('[CREATE_GOAL] Status:', goalResp.status());
  42 |   if (goalResp.ok()) {
  43 |     const result = await goalResp.json();
  44 |     console.log('[CREATE_GOAL_SUCCESS]', result.data?.id);
  45 |   }
  46 | 
  47 |   // Create work item
  48 |   const workItem = await createTestWorkItem(page, 'Debug Goal Association');
  49 |   await page.reload();
  50 |   await page.waitForLoadState('networkidle');
  51 |   await page.waitForTimeout(1000);
  52 | 
  53 |   // Right-click
  54 |   const workItemHeader = page.locator('.work-item-header').first();
  55 |   await workItemHeader.click({ button: 'right' });
  56 |   await page.waitForTimeout(500);
  57 | 
  58 |   // Click Add > Goal
  59 |   const addSubmenu = page.locator('[data-submenu="add-items"]');
  60 |   await addSubmenu.click();
  61 |   await page.waitForTimeout(300);
  62 | 
  63 |   const goalBtn = page.locator('[data-action="add-goal"]');
  64 |   console.log('[CLICK_ADD_GOAL]');
  65 |   await goalBtn.click();
  66 |   await page.waitForTimeout(2000);
  67 | 
  68 |   // Check for modal
  69 |   const allModals = page.locator('.modal');
  70 |   const count = await allModals.count();
  71 |   console.log('[MODAL_COUNT]', count);
  72 | 
  73 |   const visibleModals = page.locator('.modal.show, .modal.fade.show');
  74 |   const visibleCount = await visibleModals.count();
  75 |   console.log('[VISIBLE_MODAL_COUNT]', visibleCount);
  76 | 
  77 |   // Check for error in page
  78 |   const errorElements = page.locator('.alert-danger, .alert-error');
  79 |   const errorCount = await errorElements.count();
  80 |   console.log('[ERROR_ELEMENTS]', errorCount);
  81 | 
  82 |   if (errorCount > 0) {
  83 |     const errorText = await errorElements.first().textContent();
  84 |     console.log('[ERROR_TEXT]', errorText);
  85 |   }
  86 | 
  87 |   console.log('[CONSOLE_LOGS]');
  88 |   consoleLogs.forEach(log => console.log(`  [${log.type}] ${log.text}`));
  89 | });
  90 | 
```