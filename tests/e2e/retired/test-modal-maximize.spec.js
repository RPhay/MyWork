import { test, expect } from '@playwright/test';

test.describe('Modal Maximize Functionality', () => {
  test('should maximize modal to fill viewport on double-click', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Open modal
    await page.locator('#createNewTypeBtn').click();
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Get initial size (should be smaller)
    const initialBox = await modal.boundingBox();
    const initialWidth = initialBox.width;
    const initialHeight = initialBox.height;

    // Double-click header to maximize
    const header = page.locator('.modal-header-bar');
    await header.dblclick();

    // Wait for animation
    await page.waitForTimeout(300);

    // Get maximized size
    const maximizedBox = await modal.boundingBox();
    const maximizedWidth = maximizedBox.width;
    const maximizedHeight = maximizedBox.height;

    // Should now be much larger (at least 90% of viewport)
    const viewportSize = page.viewportSize();
    expect(maximizedWidth).toBeGreaterThan(viewportSize.width * 0.9);
    expect(maximizedHeight).toBeGreaterThan(viewportSize.height * 0.9);

    // Should be at top-left corner (or very close)
    expect(maximizedBox.x).toBeLessThan(5);
    expect(maximizedBox.y).toBeLessThan(5);
  });

  test('should restore modal from maximized state', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Open modal
    await page.locator('#createNewTypeBtn').click();
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Get initial size
    const initialBox = await modal.boundingBox();

    // Double-click header to maximize
    const header = page.locator('.modal-header-bar');
    await header.dblclick();
    await page.waitForTimeout(300);

    // Double-click again to restore
    await header.dblclick();
    await page.waitForTimeout(300);

    // Get restored size
    const restoredBox = await modal.boundingBox();

    // Should be close to original size
    expect(Math.abs(restoredBox.width - initialBox.width)).toBeLessThan(50);
    expect(Math.abs(restoredBox.height - initialBox.height)).toBeLessThan(50);
  });

  test('maximize button should toggle maximize state', async ({ page }) => {
    await page.goto('http://localhost:3000/settings?tab=entity-types', {
      waitUntil: 'networkidle'
    });

    // Open modal
    await page.locator('#createNewTypeBtn').click();
    const modal = page.locator('.draggable-modal');
    await expect(modal).toBeVisible();

    // Get initial size
    const initialBox = await modal.boundingBox();

    // Click maximize button
    const maximizeBtn = page.locator('.modal-maximize-btn');
    await maximizeBtn.click();
    await page.waitForTimeout(300);

    // Should be maximized
    const maximizedBox = await modal.boundingBox();
    expect(maximizedBox.width).toBeGreaterThan(initialBox.width * 1.5);

    // Click again to restore
    await maximizeBtn.click();
    await page.waitForTimeout(300);

    // Should be restored
    const restoredBox = await modal.boundingBox();
    expect(Math.abs(restoredBox.width - initialBox.width)).toBeLessThan(50);
  });
});
