import { test, expect } from '@playwright/test';
import { setupTestData, createTestWorkItem } from './setup-test-data.js';

test.describe('Verify Associations Persist and Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    const dailiesTab = page.locator('button:has-text("Dailies")').first();
    await dailiesTab.click();
    await page.waitForTimeout(1000);

    await setupTestData(page);
    await page.waitForTimeout(500);
  });

  async function testAssociation(page, type, actionSelector, expectedDisplayType) {
    // Create work item
    const workItem = await createTestWorkItem(page, `Test ${type} Association`);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open context menu
    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Click Add submenu
    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    // Click the specific action
    const btn = page.locator(actionSelector);
    await btn.click();
    await page.waitForTimeout(1500);

    // Select first item from modal
    const modal = page.locator('.modal.show, .modal.fade.show').first();
    const itemExists = await modal.isVisible({ timeout: 3000 }).catch(() => false);

    if (!itemExists) {
      console.log(`❌ ${type}: Modal did not appear`);
      return false;
    }

    const item = page.locator('.list-group-item').first();
    await item.click();
    await page.waitForTimeout(1500);

    // Close any notification
    await page.waitForTimeout(500);

    // Now expand the work item to see if association appears
    const expandToggle = page.locator('.work-item-toggle').first();
    await expandToggle.click();
    await page.waitForTimeout(500);

    // Look for the associated child item
    const childItem = page.locator(`.child-item-row[data-item-type="${expectedDisplayType}"]`);
    const childExists = await childItem.isVisible({ timeout: 2000 }).catch(() => false);

    if (childExists) {
      const text = await childItem.textContent();
      console.log(`✅ ${type}: Association displayed - ${text?.trim().substring(0, 50)}`);
      return true;
    } else {
      console.log(`❌ ${type}: Association not displayed after expansion`);
      return false;
    }
  }

  test('Add -> Project and verify display', async ({ page }) => {
    const result = await testAssociation(page, 'Project', '[data-action="add-project"]', 'priority');
    expect(result).toBe(true);
  });

  test('Add -> Category and verify display', async ({ page }) => {
    const result = await testAssociation(page, 'Category', '[data-action="add-area"]', 'area');
    expect(result).toBe(true);
  });

  test('Add -> Goal and verify display', async ({ page }) => {
    const result = await testAssociation(page, 'Goal', '[data-action="add-goal"]', 'goal');
    expect(result).toBe(true);
  });

  test('Add -> Todo and verify display', async ({ page }) => {
    const result = await testAssociation(page, 'Todo', '[data-action="add-todo"]', 'todo');
    expect(result).toBe(true);
  });

  test('Add -> Task and verify display', async ({ page }) => {
    const result = await testAssociation(page, 'Task', '[data-action="add-task"]', 'task');
    expect(result).toBe(true);
  });

  test('Add -> Ticket and verify display', async ({ page }) => {
    const result = await testAssociation(page, 'Ticket', '[data-action="add-ticket"]', 'ticket');
    expect(result).toBe(true);
  });

  test('Add -> Idea and verify display', async ({ page }) => {
    const result = await testAssociation(page, 'Idea', '[data-action="add-idea"]', 'idea');
    expect(result).toBe(true);
  });
});
