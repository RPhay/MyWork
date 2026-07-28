import { test, expect } from '@playwright/test';

test.describe('Dailies Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?tab=dailies');
    await page.waitForLoadState('networkidle');
  });

  test('should display calendar on load', async ({ page }) => {
    const calendar = await page.locator('#calendar').textContent();
    expect(calendar).toContain('Jan') || expect(calendar).toContain('Feb') || expect(calendar).toContain('Mar');
  });

  test('should not show loading message when no data', async ({ page }) => {
    await page.waitForTimeout(2000); // Wait for load
    const loadingText = await page.locator('#workItemsTableBody').textContent();
    expect(loadingText).not.toContain('Loading');
  });

  test('Add Work button should open modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("+ Add")').first();
    await addButton.click();

    const modal = page.locator('#workModal');
    await expect(modal).toBeVisible();
  });

  test('should fill and submit work form', async ({ page }) => {
    const addButton = page.locator('button:has-text("+ Add")').first();
    await addButton.click();

    const modal = page.locator('#workModal');
    await expect(modal).toBeVisible();

    const titleInput = page.locator('#workTitle');
    await titleInput.fill('Test Work Item');

    const saveButton = page.locator('#workModal button:has-text("Save Work")');
    await saveButton.click();

    // Wait for modal to close
    await expect(modal).toBeHidden();

    // Check notification
    const notification = page.locator('.alert-success');
    await expect(notification).toBeVisible();
  });

  test('should show work item in table after creation', async ({ page }) => {
    // Add a work item
    const addButton = page.locator('button:has-text("+ Add")').first();
    await addButton.click();

    const titleInput = page.locator('#workTitle');
    await titleInput.fill('My Test Task');

    const saveButton = page.locator('#workModal button:has-text("Save Work")');
    await saveButton.click();

    // Wait and check table
    await page.waitForTimeout(1000);
    const tableContent = await page.locator('#workItemsTableBody').textContent();
    expect(tableContent).toContain('My Test Task');
  });
});

test.describe('Priorities Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?tab=my-priorities');
    await page.waitForLoadState('networkidle');
  });

  test('should not show loading message when no data', async ({ page }) => {
    await page.waitForTimeout(2000);
    const loadingText = await page.locator('#prioritiesTableBody').textContent();
    expect(loadingText).not.toContain('Loading');
  });

  test('Add Priority button should open modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("+ Add Priority")');
    await addButton.click();

    const modal = page.locator('#priorityModal');
    await expect(modal).toBeVisible();
  });

  test('should fill and submit priority form', async ({ page }) => {
    const addButton = page.locator('button:has-text("+ Add Priority")');
    await addButton.click();

    const modal = page.locator('#priorityModal');
    await expect(modal).toBeVisible();

    const titleInput = page.locator('#priorityTitle');
    await titleInput.fill('High Priority Task');

    const saveButton = page.locator('#priorityModal button:has-text("Save Priority")');
    await saveButton.click();

    await expect(modal).toBeHidden();

    const notification = page.locator('.alert-success');
    await expect(notification).toBeVisible();
  });
});

test.describe('Yearly Goals Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?tab=yearly-goals');
    await page.waitForLoadState('networkidle');
  });

  test('should not show loading message when no data', async ({ page }) => {
    await page.waitForTimeout(2000);
    const loadingText = await page.locator('#goalsTableBody').textContent();
    expect(loadingText).not.toContain('Loading');
  });

  test('Add Goal button should open modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("+ Add Goal")');
    await addButton.click();

    const modal = page.locator('#goalModal');
    await expect(modal).toBeVisible();
  });

  test('should fill and submit goal form', async ({ page }) => {
    const addButton = page.locator('button:has-text("+ Add Goal")');
    await addButton.click();

    const modal = page.locator('#goalModal');
    await expect(modal).toBeVisible();

    const nameInput = page.locator('#goalName');
    await nameInput.fill('2026 Goal');

    const saveButton = page.locator('#goalModal button:has-text("Save Goal")');
    await saveButton.click();

    await expect(modal).toBeHidden();

    const notification = page.locator('.alert-success');
    await expect(notification).toBeVisible();
  });
});

test.describe('Settings Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?tab=settings');
    await page.waitForLoadState('networkidle');
  });

  test('should not show loading message when no data', async ({ page }) => {
    await page.waitForTimeout(2000);
    const loadingText = await page.locator('#sourcesTableBody').textContent();
    expect(loadingText).not.toContain('Loading');
  });

  test('Add Data Source button should open modal', async ({ page }) => {
    const addButton = page.locator('button:has-text("+ Add Data Source")');
    await addButton.click();

    const modal = page.locator('#sourceModal');
    await expect(modal).toBeVisible();
  });

  test('should fill and submit source form', async ({ page }) => {
    const addButton = page.locator('button:has-text("+ Add Data Source")');
    await addButton.click();

    const modal = page.locator('#sourceModal');
    await expect(modal).toBeVisible();

    const nameInput = page.locator('#sourceName');
    await nameInput.fill('Test Source');

    const typeSelect = page.locator('#sourceType');
    await typeSelect.selectOption('github');

    const saveButton = page.locator('#sourceModal button:has-text("Save Source")');
    await saveButton.click();

    await expect(modal).toBeHidden();

    const notification = page.locator('.alert-success');
    await expect(notification).toBeVisible();
  });
});
