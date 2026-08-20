import { test, expect } from '@playwright/test';

test.describe('Entity Type Editor - Field Types', () => {
  test('should include URL field type', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    await page.locator('#createNewTypeBtn').click();
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Add a field
    await page.locator('#addFieldBtn').click();

    // Check URL option exists
    const fieldType = page.locator('.field-type').first();
    const options = await fieldType.locator('option').allTextContents();
    expect(options).toContain('URL');
  });

  test('should include radio buttons field type', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    await page.locator('#createNewTypeBtn').click();
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Add a field
    await page.locator('#addFieldBtn').click();

    // Check Radio Buttons option exists
    const fieldType = page.locator('.field-type').first();
    const options = await fieldType.locator('option').allTextContents();
    expect(options).toContain('Radio Buttons');
  });

  test('should allow dragging fields to reorder', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    await page.locator('#createNewTypeBtn').click();
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Add two fields
    const addFieldBtn = page.locator('#addFieldBtn');
    await addFieldBtn.click();
    await addFieldBtn.click();

    // Get initial order
    const fieldRows = page.locator('.field-row');
    const firstLabel = await fieldRows.nth(0).locator('.field-label').inputValue();
    const secondLabel = await fieldRows.nth(1).locator('.field-label').inputValue();

    // Fill in labels
    await fieldRows.nth(0).locator('.field-label').fill('First Field');
    await fieldRows.nth(1).locator('.field-label').fill('Second Field');

    // Drag second field to first position
    await fieldRows.nth(1).dragTo(fieldRows.nth(0));

    // Check order changed (second field should now be first)
    const newFirstLabel = await fieldRows.nth(0).locator('.field-label').inputValue();
    expect(newFirstLabel).toBe('Second Field');
  });

  test('should have drag handle visible on fields', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    await page.locator('#createNewTypeBtn').click();
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Add a field
    await page.locator('#addFieldBtn').click();

    // Check drag handle exists
    const dragHandle = page.locator('.field-drag-handle');
    await expect(dragHandle).toBeVisible();
    const text = await dragHandle.textContent();
    expect(text).toContain('⋮');
  });
});
