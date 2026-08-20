import { test, expect } from '@playwright/test';

test.describe('Entity Type Editor Modal', () => {
  test('should open entity type editor when clicking new type button', async ({ page }) => {
    // Wait for server to be ready
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Click "New Type" button
    const newTypeBtn = page.locator('#createNewTypeBtn');
    await expect(newTypeBtn).toBeVisible();
    await newTypeBtn.click();

    // Check if modal opens
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Check modal title
    const title = page.locator('.modal-header-bar h3');
    await expect(title).toContainText('Create New Entity Type');

    // Check form fields exist
    await expect(page.locator('#typeName')).toBeVisible();
    await expect(page.locator('#typeSingular')).toBeVisible();
    await expect(page.locator('#typeIcon')).toBeVisible();
    await expect(page.locator('#typeHierarchy')).toBeVisible();
  });

  test('should close modal with escape key', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Click "New Type" button
    await page.locator('#createNewTypeBtn').click();

    // Check modal is visible
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should be gone
    await expect(modal).not.toBeVisible();
  });

  test('should close modal with close button', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Click "New Type" button
    await page.locator('#createNewTypeBtn').click();

    // Check modal is visible
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Click close button
    await page.locator('.modal-close-btn').click();

    // Modal should be gone
    await expect(modal).not.toBeVisible();
  });

  test('should maximize modal on double-click title', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Click "New Type" button
    await page.locator('#createNewTypeBtn').click();

    // Check modal is visible
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Double-click title bar
    const header = page.locator('.modal-header-bar');
    await header.dblclick();

    // Modal should have maximized class
    await expect(modal).toHaveClass(/maximized/);

    // Double-click again to restore
    await header.dblclick();

    // Modal should not have maximized class
    const classes = await modal.getAttribute('class');
    expect(classes).not.toContain('maximized');
  });

  test('should display existing entity types in list', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Check if types list exists
    const typesList = page.locator('#typesList');
    await expect(typesList).toBeVisible();

    // Should have type items
    const typeItems = page.locator('.type-list-item');
    const count = await typeItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should open editor when clicking type in list', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Click first type in list
    const firstType = page.locator('.type-list-item').first();
    await firstType.click();

    // Check if modal opens
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Modal should be for editing (not creating)
    const title = page.locator('.modal-header-bar h3');
    const titleText = await title.textContent();
    expect(titleText).toContain('Edit:');
  });

  test('should allow adding fields', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Click "New Type" button
    await page.locator('#createNewTypeBtn').click();

    // Check modal is visible
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Click "Add Field" button
    const addFieldBtn = page.locator('#addFieldBtn');
    await expect(addFieldBtn).toBeVisible();
    await addFieldBtn.click();

    // Check if field row appears
    const fieldRow = page.locator('.field-row').first();
    await expect(fieldRow).toBeVisible();
  });
});
