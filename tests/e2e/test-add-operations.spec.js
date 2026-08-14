import { test, expect } from '@playwright/test';
import { setupTestData, createTestWorkItem } from './setup-test-data.js';

test.describe('Add Submenu Operations (Association)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    const dailiesTab = page.locator('button:has-text("Dailies")').first();
    await dailiesTab.click();
    await page.waitForTimeout(1000);

    await setupTestData(page);
    await page.waitForTimeout(500);
  });

  // Helper to perform Add operation
  async function testAddAssociation(page, actionType, buttonSelector) {
    const workItem = await createTestWorkItem(page, `Test Add ${actionType}`);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    const btn = page.locator(buttonSelector);
    await btn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal.show, .modal.fade.show').first();
    const isVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isVisible) {
      console.warn(`⚠️ ${actionType}: Modal did not appear`);
      return false;
    }

    const item = page.locator('.list-group-item').first();
    const itemVisible = await item.isVisible({ timeout: 1000 }).catch(() => false);

    if (!itemVisible) {
      console.warn(`⚠️ ${actionType}: No items in modal`);
      return false;
    }

    await item.click();
    await page.waitForTimeout(1500);

    const notification = page.locator('.alert-success').first();
    const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);

    if (notifVisible) {
      const text = await notification.textContent();
      console.log(`✅ ${actionType}: ${text}`);
      return true;
    } else {
      console.warn(`⚠️ ${actionType}: No success notification`);
      return false;
    }
  }

  test('Add -> Project', async ({ page }) => {
    const result = await testAddAssociation(page, 'Project', '[data-action="add-project"]');
    expect(result).toBe(true);
  });

  test('Add -> Category', async ({ page }) => {
    const result = await testAddAssociation(page, 'Category', '[data-action="add-area"]');
    expect(result).toBe(true);
  });

  test('Add -> Goal', async ({ page }) => {
    const result = await testAddAssociation(page, 'Goal', '[data-action="add-goal"]');
    expect(result).toBe(true);
  });

  test('Add -> Todo', async ({ page }) => {
    const result = await testAddAssociation(page, 'Todo', '[data-action="add-todo"]');
    expect(result).toBe(true);
  });

  test('Add -> Task', async ({ page }) => {
    const result = await testAddAssociation(page, 'Task', '[data-action="add-task"]');
    expect(result).toBe(true);
  });

  test('Add -> Ticket', async ({ page }) => {
    const result = await testAddAssociation(page, 'Ticket', '[data-action="add-ticket"]');
    expect(result).toBe(true);
  });

  test('Add -> Idea', async ({ page }) => {
    const result = await testAddAssociation(page, 'Idea', '[data-action="add-idea"]');
    expect(result).toBe(true);
  });
});
