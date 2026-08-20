import { test } from '@playwright/test';

test('Debug save operation', async ({ page }) => {
  // Capture network requests
  const requests = [];
  page.on('request', req => {
    if (req.method() !== 'OPTIONS') {
      console.log(`[API] ${req.method()} ${req.url()}`);
      requests.push({ method: req.method(), url: req.url() });
    }
  });

  await page.goto('http://localhost:3000/');
  
  // Click Areas tab
  await page.click('[data-tab="area"]');
  await page.waitForLoadState('networkidle');

  // Click add button
  await page.click('#addareaBtn');
  await page.waitForTimeout(1000);

  // Fill and save
  const form = page.locator('#entity-editor-form');
  await form.locator('input[name="title"]').fill('Test Area');
  await page.waitForTimeout(500);

  // Click save
  console.log('Clicking save button...');
  await page.click('#areaSaveBtn');
  
  // Wait for requests
  await page.waitForLoadState('networkidle');

  console.log('All requests:', requests.filter(r => r.url.includes('/api')));
});
