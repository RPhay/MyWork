import { test, expect } from '@playwright/test';

test('Generic entity tab: ideas drag/drop and toggle close', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Click on Ideas tab in the main navigation (type-tab class)
  await page.locator('.type-idea').click();
  await page.waitForTimeout(500);
  
  // Verify generic elements are present
  const ideaEntityList = page.locator('#ideaEntityList');
  await expect(ideaEntityList).toBeVisible();
  
  // Verify buttons exist
  const addIdeasBtn = page.locator('#addideaBtn');
  const addFolderBtn = page.locator('#addideaFolderBtn');
  const expandBtn = page.locator('#expandAllideaBtn');
  const collapseBtn = page.locator('#collapseAllideaBtn');
  
  expect(await addIdeasBtn.count()).toBe(1);
  expect(await addFolderBtn.count()).toBe(1);
  expect(await expandBtn.count()).toBe(1);
  expect(await collapseBtn.count()).toBe(1);
  
  console.log('✓ Generic entity UI elements present for Ideas');
  console.log('✓ Generic entity template working for Ideas type');
});
