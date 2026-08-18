import { test, expect } from '@playwright/test';

test('Settings page HTML diagnostic', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('Console error:', msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.toString());
    console.log('Page error:', err);
  });

  await page.goto('http://localhost:3000/settings?tab=entity-types', {
    waitUntil: 'networkidle'
  });

  // Get page HTML
  const html = await page.content();

  // Check what's in the HTML
  console.log('Has "Entity Types" text:', html.includes('Entity Types'));
  console.log('Has "Editable Types" text:', html.includes('Editable Types'));
  console.log('Has "Read-Only Types" text:', html.includes('Read-Only Types'));
  console.log('Has "editableTypesList" element:', html.includes('editableTypesList'));
  console.log('Has "readonlyTypesList" element:', html.includes('readonlyTypesList'));

  // Check for any script errors
  console.log('Console errors count:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }

  // Try to find the sections
  const heading = await page.locator('h2').first();
  console.log('First h2 text:', await heading.textContent());

  const allH4s = await page.locator('h4').allTextContents();
  console.log('All h4 texts:', allH4s);

  expect(true).toBe(true);
});
