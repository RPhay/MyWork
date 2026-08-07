import { test } from '@playwright/test';

test('check parent structure', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(2000);
  
  const parentInfo = await page.locator('.todo-row').first().evaluate(el => {
    const parent = el.parentElement;
    return {
      parentTag: parent.tagName,
      parentClass: parent.className,
      parentDisplay: window.getComputedStyle(parent).display,
      hasExpandedClass: parent.classList.contains('expanded'),
      allClasses: Array.from(parent.classList)
    };
  });
  
  console.log(JSON.stringify(parentInfo, null, 2));
});
