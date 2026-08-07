import { test, expect } from '@playwright/test';

test('test link adding error', async ({ page }) => {
  const responses = [];
  
  page.on('response', response => {
    if (response.url().includes('/api/links')) {
      responses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Go to To Dos tab
  await page.click('[data-tab="todos"]');
  await page.waitForTimeout(1000);
  
  // Create a to-do first
  await page.click('#addToDoBtn');
  await page.fill('#toDoTitle', 'Test Item');
  await page.click('#saveToDoBtn');
  await page.waitForTimeout(1000);
  
  // Open edit for the to-do
  const editBtn = await page.locator('.todo-row [data-action="edit"]').first();
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await page.waitForSelector('#toDoModal');
    
    // Try adding a link via API
    console.log('Attempting to add link...');
    const response = await page.evaluate(async () => {
      const result = await fetch('/api/links/to-do/1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify({
          url: 'https://example.com',
          title: 'Example'
        })
      });
      return {
        status: result.status,
        text: await result.text()
      };
    });
    
    console.log('API Response:', response);
  }
  
  console.log('Link API responses:', responses);
});
