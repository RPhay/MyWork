import { test } from '@playwright/test';

test('actual CSS inspection', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(2000);
  
  // Get actual CSS being applied
  const cssInfo = await page.locator('.todo-row').first().evaluate(el => {
    const parent = el.parentElement;
    const grandparent = parent?.parentElement;
    
    return {
      rowDisplay: window.getComputedStyle(el).display,
      rowWidth: window.getComputedStyle(el).width,
      rowHeight: window.getComputedStyle(el).height,
      parentDisplay: window.getComputedStyle(parent).display,
      parentWidth: window.getComputedStyle(parent).width,
      grandparentDisplay: window.getComputedStyle(grandparent).display,
      grandparentWidth: window.getComputedStyle(grandparent).width,
      containerDisplay: window.getComputedStyle(document.getElementById('toDosList')).display,
      containerWidth: window.getComputedStyle(document.getElementById('toDosList')).width,
      tabPaneDisplay: window.getComputedStyle(document.getElementById('tab-todos')).display,
      tabPaneWidth: window.getComputedStyle(document.getElementById('tab-todos')).width
    };
  });
  
  console.log(JSON.stringify(cssInfo, null, 2));
});
