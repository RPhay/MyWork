import { test, expect } from '@playwright/test';

test('Debug Goals form rendering', async ({ page }) => {
  // Enable all console messages
  page.on('console', msg => {
    console.log(`[Browser] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', error => {
    console.log(`[Error] ${error.message}`);
  });

  await page.goto('http://localhost:3000');
  
  // Go to Goals tab
  await page.locator('.type-goal').click();
  await page.waitForTimeout(500);
  
  // Click add button
  await page.locator('button#addgoalBtn').click();
  await page.waitForTimeout(500);
  
  // Check the form  
  const formElement = page.locator('#goal-editor-pane form');
  const formCount = await formElement.count();
  console.log(`\nForm elements found in #goal-editor-pane: ${formCount}`);
  
  // Get all inputs
  const inputs = await page.locator('#goal-editor-pane input, #goal-editor-pane select, #goal-editor-pane textarea').count();
  console.log(`Total form fields: ${inputs}`);
  
  // Check if it's a form-group
  const formGroups = await page.locator('#goal-editor-pane .form-group').count();
  console.log(`Form groups: ${formGroups}`);
});
