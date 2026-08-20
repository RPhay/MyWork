import { test, expect } from '@playwright/test';

test.describe('Entity Type Editor - Full Workflow', () => {
  test('should allow creating a new entity type with fields', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Click "New Type" button
    await page.locator('#createNewTypeBtn').click();

    // Wait for modal
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Fill in type details
    await page.locator('#typeName').fill('Book');
    await page.locator('#typeSingular').fill('Book');
    await page.locator('#typeIcon').fill('📚');

    // Add a field
    const addFieldBtn = page.locator('#addFieldBtn');
    await addFieldBtn.click();

    // Fill in field details
    const fieldRows = page.locator('.field-row');
    const firstFieldRow = fieldRows.first();

    await firstFieldRow.locator('.field-key').fill('title');
    await firstFieldRow.locator('.field-label').fill('Title');
    await firstFieldRow.locator('.field-type').selectOption('text');

    // Check form is valid (no validation errors)
    const form = page.locator('#entityTypeForm');
    const isValid = await form.evaluate((el) => el.checkValidity());
    expect(isValid).toBe(true);
  });

  test('should allow dragging the modal', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    await page.locator('#createNewTypeBtn').click();

    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Get initial position
    const initialBox = await modal.boundingBox();

    // Drag the modal header
    const header = page.locator('.modal-header-bar');
    await header.dragTo(page.locator('body'), {
      sourcePosition: { x: 100, y: 20 },
      targetPosition: { x: 200, y: 100 }
    });

    // Position should have changed (approximately, accounting for centering)
    const finalBox = await modal.boundingBox();
    expect(finalBox.x).not.toBe(initialBox.x);
  });

  test('should allow editing an existing type', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Click first type in list
    const firstType = page.locator('.type-list-item').first();
    await firstType.click();

    // Wait for modal
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Check modal has title indicating edit mode
    const title = page.locator('.modal-header-bar h3');
    const titleText = await title.textContent();
    expect(titleText).toContain('Edit:');

    // Check form has data loaded
    const nameInput = page.locator('#typeName');
    const value = await nameInput.inputValue();
    expect(value).toBeTruthy();
  });

  test('should show field relationships section', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    await page.locator('#createNewTypeBtn').click();

    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Check relationships section exists
    const parentTypesList = page.locator('#parentTypesList');
    const childTypesList = page.locator('#childTypesList');

    await expect(parentTypesList).toBeVisible();
    await expect(childTypesList).toBeVisible();
  });

  test('should have hierarchy checkbox', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    await page.locator('#createNewTypeBtn').click();

    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    const hierarchyCheckbox = page.locator('#typeHierarchy');
    await expect(hierarchyCheckbox).toBeVisible();

    // Toggle it
    await hierarchyCheckbox.click();
    const isChecked = await hierarchyCheckbox.isChecked();
    expect(isChecked).toBe(true);
  });
});
