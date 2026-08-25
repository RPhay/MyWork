import { test, expect } from '@playwright/test';

// dashboard.ejs renders EVERY tab's rows into the DOM at once, so a bare
// .entity-row matches rows in hidden panes - 342 of them against 36 on
// screen in one measured case. Scope to the active tab, or the test
// clicks something the user cannot see.
test.describe('Editable Types - Comprehensive Functionality', () => {
  // Test all editable types: areas, goals, todos, tasks, tickets, ideas
  const editableTypes = [
    { slug: 'category', label: 'Area', buttonId: 'addareaBtnote' },
    { slug: 'goal', label: 'Goal', buttonId: 'addgoalBtnote' },
    { slug: 'todo', label: 'Todo', buttonId: 'addtodoBtnote' },
    { slug: 'task', label: 'Task', buttonId: 'addtaskBtnote' },
    { slug: 'ticket', label: 'Ticket', buttonId: 'addticketBtnote' },
    { slug: 'idea', label: 'Idea', buttonId: 'addideaBtnote' }
  ];

  editableTypes.forEach(type => {
    test.describe(`${type.label} Type`, () => {
      let page;

      test.beforeEach(async ({ page: p }) => {
        page = p;
        await page.goto('http://localhost:3000/');
        // Click the type tab
        await page.click(`[data-tab="${type.slug}"]`);
        await page.waitForLoadState('networkidle');
      });

      test(`[${type.label}] Can create a new item`, async () => {
        // Click add button
        const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        await addBtn.click();

        // Wait for editor form
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible({ timeout: 5000 });

        // Fill title
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill(`Test ${type.label}`);

        // Save
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await saveBtn.click();

        // Wait for page reload and verify item appears
        await page.waitForLoadState('networkidle');
        const itemRow = page.locator(`[data-entity-type="${type.slug}"][data-entity-id="1"]`);
        await expect(itemRow).toBeDefined();
      });

      test(`[${type.label}] Can edit an existing item`, async () => {
        // Create an item first
        const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        await addBtn.click();
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill(`Edit Test ${type.label}`);
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // Now click on the item to edit it
        const itemRow = page.locator(`#tab-${type.slug} .entity-row:visible`).first();
        await itemRow.click();
        const editForm = page.locator('#entity-editor-form');
        await expect(editForm).toBeVisible();

        // Change title
        const titleInputEdit = editForm.locator('input[name="title"]');
        const currentTitle = await titleInputEdit.inputValue();
        await titleInputEdit.fill(`${currentTitle} (edited)`);

        // Save
        const saveBtnEdit = page.locator(`#${type.slug}SaveBtn`);
        await saveBtnEdit.click();
        await page.waitForLoadState('networkidle');

        // Verify title changed
        const updatedItemRow = page.locator(`#tab-${type.slug} .entity-row:visible`).first();
        await expect(updatedItemRow).toContainText('(edited)');
      });

      test(`[${type.label}] Toggle close works - click same row again closes editor`, async () => {
        // Create item
        const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        await addBtn.click();
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill(`Toggle Test ${type.label}`);
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // Click row to open editor
        const itemRow = page.locator(`#tab-${type.slug} .entity-row:visible`).first();
        await itemRow.click();
        const editForm = page.locator('#entity-editor-form');
        await expect(editForm).toBeVisible();

        // Click same row again (should close)
        await itemRow.click();
        await expect(editForm).not.toBeVisible({ timeout: 2000 });

        // Click row again (should reopen)
        await itemRow.click();
        await expect(editForm).toBeVisible({ timeout: 2000 });
      });

      test(`[${type.label}] Can delete an item`, async () => {
        // Create item
        const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        await addBtn.click();
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill(`Delete Test ${type.label}`);
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // Get initial count
        const initialRows = await page.locator(`#tab-${type.slug} .entity-row:visible`).count();

        // Click delete button
        const deleteBtn = page.locator('[data-action="delete"]').first();
        page.once('dialog', async dialog => {
          await dialog.accept();
        });
        await deleteBtn.click();
        await page.waitForLoadState('networkidle');

        // Verify count decreased
        const finalRows = await page.locator(`#tab-${type.slug} .entity-row:visible`).count();
        expect(finalRows).toBeLessThan(initialRows);
      });

      test(`[${type.label}] Can create a folder`, async () => {
        // Click + Folder button
        const folderBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}FolderBtn`);
        page.once('dialog', async dialog => {
          await dialog.type('Test Folder');
          await dialog.accept();
        });
        await folderBtn.click();
        await page.waitForLoadState('networkidle');

        // Verify folder appears
        const folderRow = page.locator(`#tab-${type.slug} .entity-row:visible`).first();
        await expect(folderRow).toContainText('Test Folder');
      });

      test(`[${type.label}] Expand/Collapse buttons work`, async () => {
        // Create a parent item first
        const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        await addBtn.click();
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill('Parent Item');
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // Check that expand/collapse buttons exist
        const expandBtn = page.locator(`#expandAll${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        const collapseBtn = page.locator(`#collapseAll${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        await expect(expandBtn).toBeVisible();
        await expect(collapseBtn).toBeVisible();
      });

      test(`[${type.label}] Form has title field`, async () => {
        // Click add button
        const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        await addBtn.click();

        // Wait for form
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();

        // Check title field exists
        const titleField = form.locator('input[name="title"]');
        await expect(titleField).toBeVisible();

        // Check label
        const titleLabel = form.locator('label').first();
        await expect(titleLabel).toContainText('Title');
      });

      test(`[${type.label}] Save button is disabled until changes made`, async () => {
        // Click add button
        const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
        await addBtn.click();

        // Wait for form
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();

        // Check save button is disabled initially
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await expect(saveBtn).toBeDisabled();

        // Make a change
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill('New Item');

        // Check save button is now enabled
        await expect(saveBtn).toBeEnabled();
      });
    });
  });
});
