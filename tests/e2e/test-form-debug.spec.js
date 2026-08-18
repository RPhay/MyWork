import { test } from '@playwright/test';

test('Debug form and save button', async ({ page }) => {
  await page.goto('http://localhost:3000/');

  // Click Areas tab
  await page.click('[data-tab="area"]');
  await page.waitForLoadState('networkidle');

  // Click add button
  await page.click('#addareaBtn');
  await page.waitForTimeout(2000);

  // Check form exists
  const form = page.locator('#entity-editor-form');
  console.log('Form visible:', await form.isVisible());

  // Check save button
  const saveBtn = page.locator('#areaSaveBtn');
  console.log('Save button exists:', await saveBtn.count());
  const isDisabled = await saveBtn.evaluate((el) => el.disabled);
  console.log('Save button disabled:', isDisabled);

  // Try to fill title
  const titleInput = form.locator('input[name="title"]');
  console.log('Title input exists:', await titleInput.count());
  await titleInput.fill('Test Item');
  await page.waitForTimeout(500);

  // Check save button after filling
  const isDisabledAfter = await saveBtn.evaluate((el) => el.disabled);
  console.log('Save button disabled after fill:', isDisabledAfter);
});
