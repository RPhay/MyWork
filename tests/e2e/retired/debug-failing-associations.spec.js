import { test, expect } from '@playwright/test';
import { setupTestData, createTestWorkItem } from './setup-test-data.js';

test.describe('Debug Failing Associations', () => {
  let testData;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    const dailiesTab = page.locator('button:has-text("Dailies")').first();
    await dailiesTab.click();
    await page.waitForTimeout(1000);

    testData = await setupTestData(page);
    await page.waitForTimeout(500);
  });

  test('Debug: Add -> Category', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Debug Add Category');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Check context menu visibility
    const contextMenu = page.locator('#workItemContextMenu');
    const menuVisible = await contextMenu.evaluate(el => !el.classList.contains('d-none'));
    console.log('✓ Context menu visible:', menuVisible);

    // Click Add submenu
    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(500);

    // Check if buttons are visible
    const areaBtn = page.locator('[data-action="add-area"]');
    const btnVisible = await areaBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('✓ Add->Category button visible:', btnVisible);

    if (btnVisible) {
      await areaBtn.click();
      await page.waitForTimeout(1500);

      // Look for modal
      const allModals = page.locator('.modal');
      const count = await allModals.count();
      console.log('✓ Total modals on page:', count);

      const visibleModals = page.locator('.modal.show, .modal.fade.show');
      const visibleCount = await visibleModals.count();
      console.log('✓ Visible modals:', visibleCount);

      if (visibleCount > 0) {
        const modal = visibleModals.first();
        const text = await modal.textContent();
        console.log('✓ Modal content preview:', text?.substring(0, 100));
      }

      // Try to find list items
      const listItems = page.locator('.list-group-item');
      const itemCount = await listItems.count();
      console.log('✓ List items found:', itemCount);
    }
  });

  test('Debug: Add -> Goal', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Debug Add Goal');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(500);

    const goalBtn = page.locator('[data-action="add-goal"]');
    const btnVisible = await goalBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('✓ Add->Goal button visible:', btnVisible);

    if (btnVisible) {
      await goalBtn.click();
      await page.waitForTimeout(1500);

      const visibleModals = page.locator('.modal.show, .modal.fade.show');
      const visibleCount = await visibleModals.count();
      console.log('✓ Visible modals:', visibleCount);

      const listItems = page.locator('.list-group-item');
      const itemCount = await listItems.count();
      console.log('✓ List items found:', itemCount);
    }
  });

  test('Debug: Create Submenu Access', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Debug Create');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Check all data-submenu elements
    const allSubmenus = page.locator('[data-submenu]');
    const submenuCount = await allSubmenus.count();
    console.log('✓ Total submenu buttons:', submenuCount);

    // Get text of each
    for (let i = 0; i < submenuCount; i++) {
      const btn = allSubmenus.nth(i);
      const text = await btn.textContent();
      const submenu = await btn.getAttribute('data-submenu');
      console.log(`  [${i}] ${submenu}: ${text?.trim()}`);
    }

    // Try to access create-items more specifically
    const contextMenu = page.locator('#workItemContextMenu');
    const createBtn = contextMenu.locator('[data-submenu="create-items"]');
    const btnExists = await createBtn.count();
    console.log('✓ Create button in context menu:', btnExists);

    if (btnExists > 0) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Check if create submenu items are visible
      const createSubmenu = page.locator('#create-items-submenu');
      const submenuVisible = await createSubmenu.evaluate(el => !el.classList.contains('d-none')).catch(() => false);
      console.log('✓ Create submenu visible:', submenuVisible);
    }
  });
});
