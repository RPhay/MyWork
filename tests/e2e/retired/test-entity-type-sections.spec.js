import { test, expect } from '@playwright/test';

test.describe('Entity Types - Section Display', () => {
  test('should display editable and read-only sections', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Check for Editable Types section
    const editableHeading = page.locator('h4', { hasText: /Editable Types/ });
    await expect(editableHeading).toBeVisible();

    // Check for Read-Only Types section
    const readonlyHeading = page.locator('h4', { hasText: /Read-Only Types/ });
    await expect(readonlyHeading).toBeVisible();

    // Check for New Type button
    const createBtn = page.locator('#createNewTypeBtn');
    await expect(createBtn).toBeVisible();

    // Check for type lists
    const editableList = page.locator('#editableTypesList');
    const readonlyList = page.locator('#readonlyTypesList');

    await expect(editableList).toBeVisible();
    await expect(readonlyList).toBeVisible();
  });

  test('should show type items in editable section', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Wait for types to load
    await page.waitForTimeout(500);

    // Check if editable types are displayed
    const editableList = page.locator('#editableTypesList');
    const typeItems = editableList.locator('.type-list-item');

    const count = await typeItems.count();
    expect(count).toBeGreaterThan(0);

    // Each item should have icon and label
    for (let i = 0; i < Math.min(count, 3); i++) {
      const item = typeItems.nth(i);
      const icon = item.locator('.type-icon');
      const info = item.locator('.type-info');

      await expect(icon).toBeVisible();
      await expect(info).toBeVisible();
    }
  });

  test('should show category badges for non-editable types', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Wait for types to load
    await page.waitForTimeout(500);

    // Check read-only list for category badges
    const readonlyList = page.locator('#readonlyTypesList');
    const badges = readonlyList.locator('.type-badge');

    if (await badges.count() > 0) {
      // If there are any readonly types, they should have badges
      const firstBadge = badges.first();
      const badgeText = await firstBadge.textContent();
      expect(['template', 'daily', 'external']).toContain(badgeText);
    }
  });

  test('editable types should be clickable to edit', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Wait for types to load
    await page.waitForTimeout(500);

    // Click first editable type
    const editableList = page.locator('#editableTypesList');
    const firstType = editableList.locator('.type-list-item').first();

    if (await firstType.isVisible()) {
      await firstType.click();

      // Modal should open
      const modal = page.locator('.draggable-modal');
      await expect(modal).toBeVisible();
    }
  });

  test('should have separate lists for editable and readonly types', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Verify the two sections exist and are distinct
    const editableSection = page.locator('text=Editable Types');
    const readonlySection = page.locator('text=Read-Only Types');

    await expect(editableSection).toBeVisible();
    await expect(readonlySection).toBeVisible();

    // They should be in different containers
    const editableContainer = editableSection.locator('xpath=//..//..').locator('id=editableTypesList').first();
    const readonlyContainer = readonlySection.locator('xpath=//..//..').locator('id=readonlyTypesList').first();

    await expect(editableContainer).toBeVisible();
    await expect(readonlyContainer).toBeVisible();
  });
});
