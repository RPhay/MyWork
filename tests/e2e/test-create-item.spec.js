import { test, expect } from '@playwright/test';

// dashboard.ejs renders EVERY tab's rows into the DOM at once, so a bare
// .entity-row matches rows in hidden panes - 342 of them against 36 on
// screen in one measured case. Scope to the active tab, or the test
// clicks something the user cannot see.
test('Areas - Create and Edit Item', async ({ page }) => {
  await page.goto('http://localhost:3000/');

  // Click Areas tab
  await page.click('[data-tab="area"]');
  await page.waitForLoadState('networkidle');

  // Get initial item count
  const initialCount = await page.locator('#tab-area .entity-row:visible').count();

  // Click add button
  const addBtn = page.locator('#addareaBtn');
  await addBtn.click();

  // Wait for form to appear
  const form = page.locator('#entity-editor-form');
  await expect(form).toBeVisible({ timeout: 5000 });

  // Fill title
  const titleInput = form.locator('input[name="title"]');
  await expect(titleInput).toBeVisible();
  await titleInput.fill('New Area Test');

  // The save button should enable once input changes
  const saveBtn = page.locator('#areaSaveBtn');
  // Wait for button to be enabled (may take a moment for change tracking)
  await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  await saveBtn.click();

  // Wait for reload and new item to appear
  await page.waitForLoadState('networkidle');

  // Verify new item was created
  const finalCount = await page.locator('#tab-area .entity-row:visible').count();
  expect(finalCount).toBeGreaterThan(initialCount);

  // Verify item title appears
  const newItem = page.locator('#tab-area .entity-row:visible').first();
  await expect(newItem).toContainText('New Area Test');
});

test('Goals - Create Item', async ({ page }) => {
  await page.goto('http://localhost:3000/');

  // Click Goals tab
  await page.click('[data-tab="goal"]');
  await page.waitForLoadState('networkidle');

  // Click add button
  const addBtn = page.locator('#addgoalBtn');
  await addBtn.click();

  // Wait for form
  const form = page.locator('#entity-editor-form');
  await expect(form).toBeVisible({ timeout: 5000 });

  // Fill title
  const titleInput = form.locator('input[name="title"]');
  await titleInput.fill('New Goal Test');

  // Save - wait for button to be enabled
  const saveBtn = page.locator('#goalSaveBtn');
  await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  await saveBtn.click();

  // Verify
  await page.waitForLoadState('networkidle');
  const newItem = page.locator('#tab-area .entity-row:visible').first();
  await expect(newItem).toContainText('New Goal Test');
});
