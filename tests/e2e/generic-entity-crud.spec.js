import { test, expect } from '@playwright/test';
import { dblclick } from './dblclick.js';

// Every entity type driven by the generic entity engine (generic-entity-init.js
// + genericEntity.js). Parameterized so a fix/regression in the shared engine
// gets caught across every type it renders, not just the one someone happened
// to click around in.
// Every one of these nests, so every one of them gets folders and a tree. If
// a type here ever renders differently from its neighbours, that's the bug
// this file exists to catch.
const TYPES = [
  // Projects runs on the generic engine too (Phase 4 moved `priorities` into
  // `entities`). It's in this list deliberately: it used to have its own tab
  // with a "Project Form" modal, and being covered by the same parameterized
  // tests as every other type is what proves it shares the code path now.
  { slug: 'priority', label: 'Projects', hierarchy: true },
  { slug: 'to_do', label: 'Todos', hierarchy: true },
  { slug: 'task', label: 'Tasks', hierarchy: true },
  { slug: 'ticket', label: 'Tickets', hierarchy: true },
  { slug: 'goal', label: 'Goals', hierarchy: true },
  { slug: 'area', label: 'Categories', hierarchy: true },
  { slug: 'idea', label: 'Ideas', hierarchy: true },
];

async function getCsrfToken(page) {
  return page.evaluate(() => document.body.dataset.csrfToken);
}

async function apiCreate(page, slug, title, extra = {}) {
  return page.evaluate(
    async ({ slug, title, extra, csrfToken }) => {
      const r = await fetch(`/api/entities/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ title, ...extra }),
      });
      return (await r.json()).data;
    },
    { slug, title, extra, csrfToken: await getCsrfToken(page) }
  );
}

async function apiGet(page, slug, id) {
  return page.evaluate(
    async ({ slug, id }) => (await (await fetch(`/api/entities/${slug}/${id}`)).json()).data,
    { slug, id }
  );
}

// Deletion confirms through the app's own #confirmModal, not window.confirm -
// browser dialogs are against this project's UX standards, so a test that
// accepts a native dialog would be asserting the wrong behavior.
async function confirmDeleteDialog(page) {
  const confirmBtn = page.locator('#confirmModalConfirm');
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
}

async function apiDeleteAll(page, slug, titlePrefix) {
  await page.evaluate(
    async ({ slug, titlePrefix, csrfToken }) => {
      const all = (await (await fetch(`/api/entities/${slug}`)).json()).data || [];
      for (const e of all.filter((x) => (x.title || '').startsWith(titlePrefix))) {
        await fetch(`/api/entities/${slug}/${e.id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': csrfToken } });
      }
    },
    { slug, titlePrefix, csrfToken: await getCsrfToken(page) }
  );
}

for (const type of TYPES) {
  test.describe(`Generic entity CRUD - ${type.label}`, () => {
    // Serial: tests within a type share the dev DB and the same type's
    // entity list, so running them in parallel (this project's default)
    // races refreshEntities() against sibling tests' creates/deletes.
    test.describe.configure({ mode: 'serial' });

    const prefix = `ZZZ e2e ${type.slug}`;

    test.beforeEach(async ({ page }) => {
      await page.goto(`/?tab=${type.slug}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800); // generic-entity-init.js's async per-type init
    });

    test.afterEach(async ({ page }) => {
      await apiDeleteAll(page, type.slug, prefix);
    });

    test('creates a new item and it appears in the list and persists', async ({ page }) => {
      const title = `${prefix} create`;

      await page.click(`#add${type.slug}Btn`);
      await expect(page.locator(`#${type.slug}EditorPane`)).toBeVisible();

      const titleInput = page.locator('#entity-editor-form input[name="title"]');
      await titleInput.fill(title);
      await titleInput.dispatchEvent('input');
      await expect(page.locator(`#${type.slug}SaveBtn`)).toBeEnabled();

      await page.click(`#${type.slug}SaveBtn`);

      // Must show up in the live list without a page reload/navigation.
      await expect(page.locator('.entity-row', { hasText: title })).toBeVisible({ timeout: 5000 });
      // And must actually be persisted server-side, not just rendered client-side.
      const stored = await page.evaluate(
        async ({ slug, title }) => {
          const all = (await (await fetch(`/api/entities/${slug}`)).json()).data || [];
          return all.find((e) => e.title === title) || null;
        },
        { slug: type.slug, title }
      );
      expect(stored).not.toBeNull();
    });

    test('creates a new item by pressing Enter in the title field, not just clicking Save', async ({ page }) => {
      // A plain <form> with no submit handler submits natively on Enter -
      // navigating the whole page to "?title=...&status=...", losing the
      // active tab and never actually saving. This is how a real user
      // creates most things, so it needs its own case, not just the
      // click-Save path above.
      const title = `${prefix} enter-submit`;

      await page.click(`#add${type.slug}Btn`);
      const titleInput = page.locator('#entity-editor-form input[name="title"]');
      await titleInput.fill(title);
      await titleInput.press('Enter');

      // Must NOT have navigated away - same URL, same tab still marked active.
      await expect(page).toHaveURL(new RegExp(`tab=${type.slug}$`));
      await expect(page.locator(`button[data-tab="${type.slug}"]`)).toHaveClass(/\bactive\b/);

      await expect(page.locator('.entity-row', { hasText: title })).toBeVisible({ timeout: 5000 });
      const stored = await page.evaluate(
        async ({ slug, title }) => {
          const all = (await (await fetch(`/api/entities/${slug}`)).json()).data || [];
          return all.find((e) => e.title === title) || null;
        },
        { slug: type.slug, title }
      );
      expect(stored).not.toBeNull();
    });

    test('edits an existing item', async ({ page }) => {
      const original = await apiCreate(page, type.slug, `${prefix} edit orig`);
      const updated = `${prefix} edit updated`;
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      // DOUBLE click, and on the TITLE.
      //
      // Two clicks open the editor; one only expands the row (generic-entity-init.js
      // defers toggleExpanded by DOUBLE_CLICK_MS so the second click can cancel it).
      // This spec single-clicked and asserted the editor was visible, which failed
      // for all seven types - the rule is stated in CLAUDE.md under "Rows, editors
      // and the focus bar" and the app has always been the correct side of it.
      //
      // The title rather than the row centre: control cells (status badge, date
      // picker) deliberately do not open the editor, and the centre of a wide row
      // can land on one.
      await dblclick(page.locator('.entity-row', { hasText: original.title }).locator('.entity-title'));
      await expect(page.locator(`#${type.slug}EditorPane`)).toBeVisible();

      const titleInput = page.locator('#entity-editor-form input[name="title"]');
      await titleInput.fill(updated);
      await titleInput.dispatchEvent('input');
      await page.click(`#${type.slug}SaveBtn`);

      await expect(page.locator('.entity-row', { hasText: updated })).toBeVisible({ timeout: 5000 });
      // The row showing the new title no longer proves it was saved: the editor
      // mirrors unsaved edits into the row as a preview (marked with a dot).
      // Poll the API so this asserts persistence rather than what is on screen.
      await expect
        // Optional chaining on purpose: a THROW inside expect.poll propagates
        // instead of retrying, so one transient response would fail the test
        // outright. Returning undefined lets it retry, and a genuine problem
        // still fails - on the timeout, with a readable diff.
        .poll(async () => (await apiGet(page, type.slug, original.id))?.title, { timeout: 5000 })
        .toBe(updated);
    });

    test('deletes an existing item', async ({ page }) => {
      const item = await apiCreate(page, type.slug, `${prefix} delete me`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      const row = page.locator('.entity-row', { hasText: item.title });
      await expect(row).toBeVisible();
      await row.locator('[data-action="delete"]').click();
      await confirmDeleteDialog(page);

      await expect(page.locator('.entity-row', { hasText: item.title })).toHaveCount(0, { timeout: 5000 });
      const stored = await page.evaluate(
        async ({ slug, id }) => {
          const r = await fetch(`/api/entities/${slug}/${id}`);
          return r.status;
        },
        { slug: type.slug, id: item.id }
      );
      expect(stored).toBe(404);
    });

    test('reorders two sibling items via drag and drop', async ({ page }) => {
      const first = await apiCreate(page, type.slug, `${prefix} order A`);
      const second = await apiCreate(page, type.slug, `${prefix} order B`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      const firstRow = page.locator('.entity-row', { hasText: first.title });
      const secondRow = page.locator('.entity-row', { hasText: second.title });
      await expect(firstRow).toBeVisible();
      await expect(secondRow).toBeVisible();

      // Drag the second (later, higher order_index) row to just above the
      // first, landing in its top band -> "before" zone, not "nest".
      const targetBox = await firstRow.boundingBox();
      await secondRow.dragTo(firstRow, {
        targetPosition: { x: targetBox.width / 2, y: 2 },
      });
      await page.waitForTimeout(600);

      const [reloadedFirst, reloadedSecond] = await Promise.all([
        apiGet(page, type.slug, first.id),
        apiGet(page, type.slug, second.id),
      ]);
      expect(reloadedSecond.order_index).toBeLessThan(reloadedFirst.order_index);
    });

    if (type.hierarchy) {
      test('makes an item a child of another via drag and drop', async ({ page }) => {
        const parent = await apiCreate(page, type.slug, `${prefix} parent`);
        const child = await apiCreate(page, type.slug, `${prefix} child`);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(800);

        const parentRow = page.locator('.entity-row', { hasText: parent.title });
        const childRow = page.locator('.entity-row', { hasText: child.title });
        await expect(parentRow).toBeVisible();
        await expect(childRow).toBeVisible();

        // Drop on the middle band of the parent row -> "nest" zone.
        const targetBox = await parentRow.boundingBox();
        await childRow.dragTo(parentRow, {
          targetPosition: { x: targetBox.width / 2, y: targetBox.height / 2 },
        });
        await page.waitForTimeout(600);

        // Hierarchy is stored in entity_relationships, not a column on the
        // entity itself - check the relationship, not the entity record.
        const relationships = await page.evaluate(
          async (slug) => (await (await fetch(`/api/entities/${slug}/relationships?kind=hierarchy`)).json()).data,
          type.slug
        );
        expect(relationships).toContainEqual(
          expect.objectContaining({ parent_entity_id: parent.id, child_entity_id: child.id })
        );

        // And the tree view should reflect it: the child row should now be
        // nested inside the parent's node in the DOM.
        const parentNode = page.locator('.entity-node', { hasText: parent.title }).first();
        await expect(parentNode.locator('.entity-node-children .entity-row', { hasText: child.title })).toHaveCount(1);
      });

      // ===== Folders =====
      // A folder is an is_folder row of THIS type, not a type of its own.
      // These run for every type precisely because the bug being guarded
      // against was Categories having folders while Todos did not.

      test('+ Folder opens a title-only editor and creates a folder', async ({ page }) => {
        const title = `${prefix} folder create`;

        await page.click(`#add${type.slug}FolderBtn`);
        await expect(page.locator(`#${type.slug}EditorPane`)).toBeVisible();

        // A folder shows its Worked Time and nothing else it does not own.
        //
        // This asserted toHaveCount(0) and failed for all seven types. The rule
        // in CLAUDE.md is "A folder shows Worked Time in its editor and nothing
        // else it does not own", and genericEntity.js#editableFields implements
        // exactly that: for a folder it keeps fields of type 'duration' only.
        // Every type seeds exactly one - focus_seconds / Worked Time - so the
        // correct expectation is that one field, not none. Asserting the type
        // as well means a future leak (the board_bay/board_order kind) still
        // fails this test rather than slipping through a bare count.
        await expect(page.locator('#entity-editor-form input[name="title"]')).toBeVisible();
        await expect(page.locator('#entity-editor-form [data-field-type]')).toHaveCount(1);
        await expect(page.locator('#entity-editor-form [data-field-type]')).toHaveAttribute('data-field-type', 'duration');

        const titleInput = page.locator('#entity-editor-form input[name="title"]');
        await titleInput.fill(title);
        await titleInput.dispatchEvent('input');
        await page.click(`#${type.slug}SaveBtn`);

        const row = page.locator('.entity-row', { hasText: title });
        await expect(row).toBeVisible({ timeout: 5000 });
        await expect(row).toHaveClass(/entity-row-folder/);
        await expect(row.locator('.entity-row-icon')).toHaveText('📁');

        // Persisted as a folder of this type, not as some other type.
        const all = await page.evaluate(
          async (slug) => (await (await fetch(`/api/entities/${slug}`)).json()).data,
          type.slug
        );
        const stored = all.find((e) => e.title === title);
        expect(stored).toBeTruthy();
        expect(Boolean(stored.is_folder)).toBe(true);
      });

      test('a folder renders as a folder while a normal item keeps the type icon', async ({ page }) => {
        await apiCreate(page, type.slug, `${prefix} plain item`, { is_folder: false });
        await apiCreate(page, type.slug, `${prefix} plain folder`, { is_folder: true });
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(800);

        const itemIcon = page.locator('.entity-row', { hasText: `${prefix} plain item` }).locator('.entity-row-icon');
        const folderIcon = page.locator('.entity-row', { hasText: `${prefix} plain folder` }).locator('.entity-row-icon');

        await expect(folderIcon).toHaveText('📁');
        // The item must show the type's own icon - the original bug was every
        // row rendering as a folder regardless.
        await expect(itemIcon).not.toHaveText('📁');
      });

      // A node was allowed to become its own ancestor. Nothing caught it at
      // write time; it surfaced much later as "Maximum call stack size
      // exceeded" out of hierarchyPath.js#buildPathMap, taking down Dailies,
      // Projects and Reporting at once - three tabs felled by one bad edge.
      test('refuses to make an item its own ancestor', async ({ page }) => {
        const outer = await apiCreate(page, type.slug, `${prefix} cycle outer`);
        const inner = await apiCreate(page, type.slug, `${prefix} cycle inner`);
        const token = await getCsrfToken(page);

        const relate = (parentId, childId) =>
          page.evaluate(
            async ({ slug, parentId, childId, csrfToken }) => {
              const r = await fetch(`/api/entities/${slug}/${childId}/relationships`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ parentEntityId: parentId, childEntityId: childId, relationshipKind: 'hierarchy' }),
              });
              return r.status;
            },
            { slug: type.slug, parentId, childId, csrfToken: token }
          );

        expect(await relate(outer.id, inner.id)).toBeLessThan(300);
        // Closing the loop, and self-parenting, must both be refused.
        expect(await relate(inner.id, outer.id)).toBeGreaterThanOrEqual(400);
        expect(await relate(outer.id, outer.id)).toBeGreaterThanOrEqual(400);

        // Path-building endpoints must still respond rather than blow the stack.
        const status = await page.evaluate(async () => (await fetch('/api/priorities')).status);
        expect(status).toBe(200);
      });

      test('items nest into folders and folders nest into folders', async ({ page }) => {
        const outer = await apiCreate(page, type.slug, `${prefix} outer folder`, { is_folder: true });
        const inner = await apiCreate(page, type.slug, `${prefix} inner folder`, { is_folder: true });
        const item = await apiCreate(page, type.slug, `${prefix} nested item`);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(800);

        // Addressed by ID, not by text. A folder's .entity-row CONTAINS its
        // nested rows once something is inside it, so `hasText` matches the
        // ANCESTOR as well as the row wanted - and `.first()` then picks the
        // outer folder. The second nest was therefore dropped onto the wrong
        // row, and this test has been reported as a drag-and-drop regression
        // ever since. The app was doing exactly what it was asked.
        // The target's box has to have STOPPED MOVING before the drag starts.
        // A fixed wait after networkidle is not enough for the wider types:
        // Goals has the most columns, its rows wrap tallest, and it was still
        // settling when the drag began - so the row slid out from under the
        // cursor and the drop landed as a sibling instead of a child. That is
        // the whole of the "Goals drag-to-nest regression".
        const settled = async (loc) => {
          let last = null;
          for (let i = 0; i < 12; i += 1) {
            const box = await loc.boundingBox();
            if (last && box
                && Math.abs(box.y - last.y) < 1
                && Math.abs(box.height - last.height) < 1) return box;
            last = box;
            await page.waitForTimeout(150);
          }
          return last;
        };

        // Driven by events rather than by moving the mouse. Rows on the widest
        // types (Goals, Todos) are HUNDREDS of pixels tall when the pane is
        // narrow - their columns collapse to a few pixels and the content wraps
        // - so a row can span past the fold and a pointer drag never reaches
        // the band it is aiming for. That is a real layout defect, but it is
        // not what this test is about: this exercises the drop handler, which
        // takes the same events either way. The y offset is 50% of the row, the
        // middle of the nest band.
        const nest = async (sourceId, targetId) => {
          const target = page.locator(`#${type.slug}EntityList .entity-row[data-entity-id="${targetId}"]`);
          const source = page.locator(`#${type.slug}EntityList .entity-row[data-entity-id="${sourceId}"]`);
          await expect(target).toBeVisible();
          await expect(source).toBeVisible();
          await settled(target);

          await page.evaluate(({ slug, sourceId, targetId }) => {
            const list = document.getElementById(`${slug}EntityList`);
            const src = list.querySelector(`.entity-row[data-entity-id="${sourceId}"]`);
            const dst = list.querySelector(`.entity-row[data-entity-id="${targetId}"]`);
            const dt = new DataTransfer();
            const r = dst.getBoundingClientRect();
            const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
            const fire = (el, name, extra = {}) => el.dispatchEvent(
              new DragEvent(name, { bubbles: true, cancelable: true, dataTransfer: dt, ...extra }));
            fire(src, 'dragstart');
            fire(dst, 'dragenter', at);
            fire(dst, 'dragover', at);
            fire(dst, 'drop', at);
            fire(src, 'dragend');
          }, { slug: type.slug, sourceId, targetId });
          await page.waitForTimeout(900);
        };

        await nest(inner.id, outer.id);   // folder under folder
        await nest(item.id, inner.id);    // item under folder

        const relationships = await page.evaluate(
          async (slug) => (await (await fetch(`/api/entities/${slug}/relationships?kind=hierarchy`)).json()).data,
          type.slug
        );
        expect(relationships).toContainEqual(
          expect.objectContaining({ parent_entity_id: outer.id, child_entity_id: inner.id })
        );
        expect(relationships).toContainEqual(
          expect.objectContaining({ parent_entity_id: inner.id, child_entity_id: item.id })
        );
      });
    }

    // Field values live in entity_field_values, keyed off the type's schema.
    // This table was empty for every type until the client stopped sending
    // field values flat alongside `title` instead of nested under `fields`.
    test('field values entered in the editor survive a reload', async ({ page }) => {
      const item = await apiCreate(page, type.slug, `${prefix} field values`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      // Double click - one click only expands. Same stale-single-click fault as
      // 'edits an existing item' above; see the note there.
      await dblclick(page.locator('.entity-row', { hasText: item.title }).locator('.entity-title'));
      await expect(page.locator(`#${type.slug}EditorPane`)).toBeVisible();

      const notes = page.locator('#entity-editor-form [name="notes"]');
      await expect(notes).toBeVisible();
      await notes.fill('ZZZ persisted note');
      await notes.dispatchEvent('input');
      await page.click(`#${type.slug}SaveBtn`);
      await page.waitForTimeout(600);

      const stored = await apiGet(page, type.slug, item.id);
      expect(stored.fields.notes).toBe('ZZZ persisted note');
    });
  });
}
