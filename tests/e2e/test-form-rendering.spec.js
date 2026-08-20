import { test, expect } from '@playwright/test';

test('Check form field rendering for Goals', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Go to Goals
  await page.locator('.type-goal').click();
  await page.waitForTimeout(500);
  
  // Click add
  await page.locator('button#addgoalBtn').click();
  await page.waitForTimeout(500);
  
  // Get all form fields with labels
  const fields = await page.locator('label').allTextContents();
  console.log('=== Goals Form Fields ===');
  fields.forEach((label, i) => {
    console.log(`${i + 1}. ${label}`);
  });
  
  console.log(`\nTotal labels: ${fields.length}`);
});

test('Check form field rendering for Categories', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Go to Categories
  await page.locator('.type-area').click();
  await page.waitForTimeout(500);
  
  // Click add
  await page.locator('button#addareaBtn').click();
  await page.waitForTimeout(500);
  
  // Get all form fields with labels
  const fields = await page.locator('label').allTextContents();
  console.log('=== Categories Form Fields ===');
  fields.forEach((label, i) => {
    console.log(`${i + 1}. ${label}`);
  });
  
  console.log(`\nTotal labels: ${fields.length}`);
});
