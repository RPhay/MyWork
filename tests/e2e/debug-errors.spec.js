import { test, expect } from '@playwright/test';

test('Debug: Capture all console output', async ({ page }) => {
  const logs = [];
  const errors = [];
  
  page.on('console', msg => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    if (msg.type() === 'error') errors.push(text);
    logs.push(text);
  });

  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.message}`);
  });

  await page.goto('http://localhost:3000');
  
  // Go to Goals tab
  await page.locator('.type-goal').click();
  await page.waitForTimeout(1000);
  
  console.log('\n=== All Logs ===');
  logs.forEach(log => console.log(log));
  
  console.log('\n=== ERRORS ONLY ===');
  if (errors.length === 0) {
    console.log('(No errors)');
  } else {
    errors.forEach(err => console.log(err));
  }
});
