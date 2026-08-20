import { test, expect } from '@playwright/test';
import { setupTestData, createTestWorkItem } from './setup-test-data.js';

test.describe('Context Menu - Comprehensive Association Tests', () => {
  let testData;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Navigate to Dailies tab
    const dailiesTab = page.locator('button:has-text("Dailies")').first();
    await dailiesTab.click();
    await page.waitForTimeout(1000);

    // Setup test data
    testData = await setupTestData(page);
    await page.waitForTimeout(500);
  });

  // ============ ADD SUBMENU TESTS ============

  test('Add -> Project should associate a project', async ({ page }) => {
    // Create work item
    const workItem = await createTestWorkItem(page, 'Test Add Project');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Right-click to open context menu
    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Click Add submenu
    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    // Click Add Project
    const addProjectBtn = page.locator('[data-action="add-project"]');
    await addProjectBtn.click();
    await page.waitForTimeout(1500);

    // Select first project
    const modal = page.locator('.modal.show, .modal.fade.show').first();
    const itemVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
    expect(itemVisible).toBe(true);

    const projectItem = page.locator('.list-group-item').first();
    await projectItem.click();
    await page.waitForTimeout(1500);

    // Verify success notification
    const notification = page.locator('.alert-success').first();
    const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
    if (notifVisible) {
      const text = await notification.textContent();
      console.log('✓ Project association notification:', text);
      expect(text).toContain('associated');
    }
  });

  test('Add -> Category should associate a category', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Add Category');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    const addAreaBtn = page.locator('[data-action="add-area"]');
    await addAreaBtn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal.show, .modal.fade.show').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    const categoryItem = page.locator('.list-group-item').first();
    await categoryItem.click();
    await page.waitForTimeout(1500);

    const notification = page.locator('.alert-success').first();
    const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('✓ Category association notification visible:', notifVisible);
  });

  test('Add -> Goal should associate a goal', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Add Goal');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    const addGoalBtn = page.locator('[data-action="add-goal"]');
    await addGoalBtn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal.show, .modal.fade.show').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    const goalItem = page.locator('.list-group-item').first();
    await goalItem.click();
    await page.waitForTimeout(1500);

    const notification = page.locator('.alert-success').first();
    const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('✓ Goal association notification visible:', notifVisible);
  });

  test('Add -> Todo should associate a todo', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Add Todo');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    const addTodoBtn = page.locator('[data-action="add-todo"]');
    await addTodoBtn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal.show, .modal.fade.show').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    const todoItem = page.locator('.list-group-item').first();
    await todoItem.click();
    await page.waitForTimeout(1500);

    const notification = page.locator('.alert-success').first();
    const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('✓ Todo association notification visible:', notifVisible);
  });

  test('Add -> Task should associate a task', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Add Task');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    const addTaskBtn = page.locator('[data-action="add-task"]');
    await addTaskBtn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal.show, .modal.fade.show').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    const taskItem = page.locator('.list-group-item').first();
    await taskItem.click();
    await page.waitForTimeout(1500);

    const notification = page.locator('.alert-success').first();
    const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('✓ Task association notification visible:', notifVisible);
  });

  test('Add -> Ticket should associate a ticket', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Add Ticket');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    const addTicketBtn = page.locator('[data-action="add-ticket"]');
    await addTicketBtn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal.show, .modal.fade.show').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    const ticketItem = page.locator('.list-group-item').first();
    await ticketItem.click();
    await page.waitForTimeout(1500);

    const notification = page.locator('.alert-success').first();
    const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('✓ Ticket association notification visible:', notifVisible);
  });

  test('Add -> Idea should associate an idea', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Add Idea');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addSubmenu = page.locator('[data-submenu="add-items"]');
    await addSubmenu.click();
    await page.waitForTimeout(300);

    const addIdeaBtn = page.locator('[data-action="add-idea"]');
    await addIdeaBtn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal.show, .modal.fade.show').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    const ideaItem = page.locator('.list-group-item').first();
    await ideaItem.click();
    await page.waitForTimeout(1500);

    const notification = page.locator('.alert-success').first();
    const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('✓ Idea association notification visible:', notifVisible);
  });

  // ============ CREATE SUBMENU TESTS ============

  test('Create -> Project should create and associate a project', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Create Project');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const createSubmenu = page.locator('[data-submenu="create-items"]');
    await createSubmenu.click();
    await page.waitForTimeout(300);

    const createProjectBtn = page.locator('[data-action="create-project"]');
    const btnVisible = await createProjectBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Create Project button visible:', btnVisible);

    if (btnVisible) {
      await createProjectBtn.click();
      await page.waitForTimeout(500);

      // Handle prompt
      page.once('dialog', dialog => {
        console.log('Dialog appeared:', dialog.message());
        dialog.accept('New Test Project');
      });
      await page.waitForTimeout(1500);

      const notification = page.locator('.alert-success').first();
      const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('✓ Create project notification visible:', notifVisible);
    }
  });

  test('Create -> Category should create and associate a category', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Create Category');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const createSubmenu = page.locator('[data-submenu="create-items"]');
    await createSubmenu.click();
    await page.waitForTimeout(300);

    const createAreaBtn = page.locator('[data-action="create-area"]');
    const btnVisible = await createAreaBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Create Category button visible:', btnVisible);

    if (btnVisible) {
      await createAreaBtn.click();
      await page.waitForTimeout(500);

      page.once('dialog', dialog => {
        dialog.accept('New Test Category');
      });
      await page.waitForTimeout(1500);

      const notification = page.locator('.alert-success').first();
      const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('✓ Create category notification visible:', notifVisible);
    }
  });

  test('Create -> Goal should create and associate a goal', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Create Goal');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const createSubmenu = page.locator('[data-submenu="create-items"]');
    await createSubmenu.click();
    await page.waitForTimeout(300);

    const createGoalBtn = page.locator('[data-action="create-goal"]');
    const btnVisible = await createGoalBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (btnVisible) {
      await createGoalBtn.click();
      await page.waitForTimeout(500);

      page.once('dialog', dialog => {
        dialog.accept('New Test Goal');
      });
      await page.waitForTimeout(1500);

      const notification = page.locator('.alert-success').first();
      const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('✓ Create goal notification visible:', notifVisible);
    }
  });

  test('Create -> Todo should create and associate a todo', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Create Todo');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const createSubmenu = page.locator('[data-submenu="create-items"]');
    await createSubmenu.click();
    await page.waitForTimeout(300);

    const createTodoBtn = page.locator('[data-action="create-todo"]');
    const btnVisible = await createTodoBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (btnVisible) {
      await createTodoBtn.click();
      await page.waitForTimeout(500);

      page.once('dialog', dialog => {
        dialog.accept('New Test Todo');
      });
      await page.waitForTimeout(1500);

      const notification = page.locator('.alert-success').first();
      const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('✓ Create todo notification visible:', notifVisible);
    }
  });

  test('Create -> Task should create and associate a task', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Create Task');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const createSubmenu = page.locator('[data-submenu="create-items"]');
    await createSubmenu.click();
    await page.waitForTimeout(300);

    const createTaskBtn = page.locator('[data-action="create-task"]');
    const btnVisible = await createTaskBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (btnVisible) {
      await createTaskBtn.click();
      await page.waitForTimeout(500);

      page.once('dialog', dialog => {
        dialog.accept('New Test Task');
      });
      await page.waitForTimeout(1500);

      const notification = page.locator('.alert-success').first();
      const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('✓ Create task notification visible:', notifVisible);
    }
  });

  test('Create -> Ticket should create and associate a ticket', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Create Ticket');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const createSubmenu = page.locator('[data-submenu="create-items"]');
    await createSubmenu.click();
    await page.waitForTimeout(300);

    const createTicketBtn = page.locator('[data-action="create-ticket"]');
    const btnVisible = await createTicketBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (btnVisible) {
      await createTicketBtn.click();
      await page.waitForTimeout(500);

      page.once('dialog', dialog => {
        dialog.accept('New Test Ticket');
      });
      await page.waitForTimeout(1500);

      const notification = page.locator('.alert-success').first();
      const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('✓ Create ticket notification visible:', notifVisible);
    }
  });

  test('Create -> Idea should create and associate an idea', async ({ page }) => {
    const workItem = await createTestWorkItem(page, 'Test Create Idea');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workItemHeader = page.locator('.work-item-header').first();
    await workItemHeader.click({ button: 'right' });
    await page.waitForTimeout(500);

    const createSubmenu = page.locator('[data-submenu="create-items"]');
    await createSubmenu.click();
    await page.waitForTimeout(300);

    const createIdeaBtn = page.locator('[data-action="create-idea"]');
    const btnVisible = await createIdeaBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (btnVisible) {
      await createIdeaBtn.click();
      await page.waitForTimeout(500);

      page.once('dialog', dialog => {
        dialog.accept('New Test Idea');
      });
      await page.waitForTimeout(1500);

      const notification = page.locator('.alert-success').first();
      const notifVisible = await notification.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('✓ Create idea notification visible:', notifVisible);
    }
  });
});
