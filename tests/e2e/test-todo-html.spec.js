import { test } from '@playwright/test';

test('check rendered todo html', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(2000);
  
  // Get the first todo-row HTML
  const todoHtml = await page.locator('.todo-row').first().innerHTML();
  console.log('First todo HTML:');
  console.log(todoHtml.substring(0, 500));
  
  // Get its computed styles
  const styles = await page.locator('.todo-row').first().evaluate(el => {
    const computed = window.getComputedStyle(el);
    return {
      display: computed.display,
      gridTemplateColumns: computed.gridTemplateColumns,
      gap: computed.gap,
      minHeight: computed.minHeight,
      height: computed.height,
      width: computed.width
    };
  });
  
  console.log('\nComputed styles:', styles);
  
  // Check children
  const childrenInfo = await page.locator('.todo-row').first().evaluate(el => {
    return Array.from(el.children).map((child, i) => ({
      tag: child.tagName,
      class: child.className,
      width: child.offsetWidth,
      height: child.offsetHeight,
      display: window.getComputedStyle(child).display
    }));
  });
  
  console.log('\nChildren info:', childrenInfo);
});
