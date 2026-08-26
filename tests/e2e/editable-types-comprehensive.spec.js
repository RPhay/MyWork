import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// dashboard.ejs renders EVERY tab's rows into the DOM at once, so a bare
// .entity-row matches rows in hidden panes - 342 of them against 36 on
// screen in one measured case. Scope to the active tab, or the test
// clicks something the user cannot see.
test.describe('Editable Types - Comprehensive Functionality', () => {
  // Test all editable types: areas, goals, todos, tasks, tickets, ideas
  // Slugs, exactly as the database spells them. `todo` was wrong - the type is
  // `to_do`, so [data-tab="todo"] matched nothing and every Todo case here
  // failed before it began. The `buttonId` column was dropped: it held
  // 'addareaBtnote' and friends, which is a find/replace accident on ids that
  // nothing read anyway - the tests build the id themselves below.
  const editableTypes = [
    { slug: 'category', label: 'Category' },
    { slug: 'goal', label: 'Goal' },
    { slug: 'to_do', label: 'Todo' },
    { slug: 'task', label: 'Task' },
    { slug: 'ticket', label: 'Ticket' },
    { slug: 'idea', label: 'Idea' }
  ];

  // The template renders `add<%= typeSlug %>Btn` - the slug verbatim, NOT
  // capitalised. Every test below built `#addCategoryBtn` and waited 30
  // seconds for a button the app has never produced, which is where 48 of the
  // baseline's 168 failures came from. ui-check.spec.js carries a note about
  // making this same mistake.
  const addBtnFor = (slug) => `#add${slug}Btn`;

  editableTypes.forEach(type => {
    test.describe(`${type.label} Type`, () => {
      let page;

      // Its fixtures are ZZZ-prefixed, so the global sweep CAN see them - but
      // relying on that is relying on a backstop. 18 rows a run were reaching
      // it before this hook existed.
      test.afterEach(async ({ page: p }) => {
        await purgeByTitlePrefix(p, type.slug, 'ZZZ');
      });

      test.beforeEach(async ({ page: p }) => {
        page = p;
        await page.goto('http://localhost:3000/');
        // Click the type tab
        await page.click(`[data-tab="${type.slug}"]`);
        await page.waitForLoadState('networkidle');
      });

      test(`[${type.label}] Can create a new item`, async () => {
        // Click add button
        const addBtn = page.locator(addBtnFor(type.slug));
        await addBtn.click();

        // Wait for editor form
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible({ timeout: 5000 });

        // Fill title
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill(`ZZZ New ${type.label}`);

        // Save
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await saveBtn.click();

        // Wait for page reload and verify item appears
        await page.waitForLoadState('networkidle');
        // `expect(locator).toBeDefined()` is true of every locator ever built,
        // so this asserted nothing. Look for the row actually created, and do
        // it by title - a hardcoded data-entity-id="1" belongs to whatever row
        // happens to hold that id.
        const itemRow = page.locator(`#tab-${type.slug} .entity-row`, { hasText: `ZZZ New ${type.label}` });
        await expect(itemRow.first()).toBeVisible();
      });

      test(`[${type.label}] Can edit an existing item`, async () => {
        // Create an item first
        const addBtn = page.locator(addBtnFor(type.slug));
        await addBtn.click();
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill(`ZZZ Edit ${type.label}`);
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // The editor is ALREADY open on what was just saved - "the editor stays
        // open on it so you can keep filling it in" (the add button's own
        // tooltip). So edit in place.
        //
        // This used to click the row to "open" the editor, which is wrong twice
        // over: one click expands a row and TWO open the editor (CLAUDE.md), and
        // double-clicking the row the editor is already on closes it - which is
        // why #entity-editor-form came back "not found" straight after a save.
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

        // ...and check the row we edited, not whichever one sorts first.
        const updatedItemRow = page.locator(`#tab-${type.slug} .entity-row`, { hasText: '(edited)' }).first();
        await expect(updatedItemRow).toBeVisible();
      });

      // REMOVED: "Toggle close works - click same row again closes editor".
      //
      // It asserted that ONE click opens the editor and a second closes it.
      // The rule is the opposite and deliberate - one click expands a row, TWO
      // open the editor (CLAUDE.md; the handler is bound to dblclick). The test
      // encoded behaviour that was taken out on purpose, so it could not pass
      // and should not.

      // REMOVED: "Can delete an item", and below it "Can create a folder".
      //
      // Both drive `page.once('dialog', ...)` - a native confirm() for the
      // delete and a prompt() for the folder name. This app uses custom modals
      // (see the UX standards), so no dialog event ever fires and both sat
      // waiting out the full timeout. Deletion is covered by
      // recently-deleted.spec.js and folders by generic-entity-crud.spec.js,
      // both against the modals that actually exist.

      test(`[${type.label}] Expand/Collapse buttons work`, async () => {
        // Create a parent item first
        const addBtn = page.locator(addBtnFor(type.slug));
        await addBtn.click();
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill('ZZZ Parent Item');
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // Check that expand/collapse buttons exist
        const expandBtn = page.locator(`#expandAll${type.slug}Btn`);
        const collapseBtn = page.locator(`#collapseAll${type.slug}Btn`);
        await expect(expandBtn).toBeVisible();
        await expect(collapseBtn).toBeVisible();
      });

      test(`[${type.label}] Form has title field`, async () => {
        // Click add button
        const addBtn = page.locator(addBtnFor(type.slug));
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
        const addBtn = page.locator(addBtnFor(type.slug));
        await addBtn.click();

        // Wait for form
        const form = page.locator('#entity-editor-form');
        await expect(form).toBeVisible();

        // Check save button is disabled initially
        const saveBtn = page.locator(`#${type.slug}SaveBtn`);
        await expect(saveBtn).toBeDisabled();

        // Make a change
        const titleInput = form.locator('input[name="title"]');
        await titleInput.fill('ZZZ New Item');

        // Check save button is now enabled
        await expect(saveBtn).toBeEnabled();
      });
    });
  });
});
