import { test, expect } from '@playwright/test';

test('Verify schema fetching in browser', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Intercept API calls
  let schemas = {};
  page.on('response', async response => {
    if (response.url().includes('/api/entity-types/')) {
      const slug = response.url().split('/').pop();
      const data = await response.json();
      if (data.success && data.data) {
        schemas[slug] = {
          label: data.data.label,
          fieldCount: data.data.fields?.length || 0,
          fieldTypes: data.data.fields?.map(f => f.field_type) || []
        };
      }
    }
  });

  // Click Categories tab to trigger schema fetch
  await page.locator('.type-area').click();
  await page.waitForTimeout(500);
  
  // Click Goals tab
  await page.locator('.type-goal').click();
  await page.waitForTimeout(500);
  
  // Report what was fetched
  console.log('=== Schemas fetched ===');
  Object.entries(schemas).forEach(([slug, schema]) => {
    console.log(`${slug}: ${schema.label} (${schema.fieldCount} fields)`);
    console.log(`  Types: ${schema.fieldTypes.join(', ')}`);
  });
});
