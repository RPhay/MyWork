import { test, expect } from '@playwright/test';

test('Check if GenericEntity gets defined', async ({ page }) => {
  const logs = [];
  const errors = [];

  page.on('console', msg => {
    logs.push(msg.text());
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('http://localhost:3000/');

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Check if GenericEntity is defined
  const genericEntityDefined = await page.evaluate(() => typeof GenericEntity !== 'undefined');
  console.log('GenericEntity defined:', genericEntityDefined);

  // Check window object for any entity-related keys
  const windowKeys = await page.evaluate(() => Object.keys(window).filter(k => k.includes('Generic') || k.includes('Entity')));
  console.log('Window keys with Generic/Entity:', windowKeys);

  // Print all logs
  console.log('Total logs:', logs.length);
  console.log('Logs with init:', logs.filter(l => l.includes('Init')).slice(0, 10));
  console.log('Errors:', errors.slice(0, 5));
});
