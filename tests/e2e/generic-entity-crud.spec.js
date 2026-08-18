import { test, expect } from '@playwright/test';

// Every entity type driven by the generic entity engine (generic-entity-init.js
// + genericEntity.js). Parameterized so a fix/regression in the shared engine
// gets caught across every type it renders, not just the one someone happened
// to click around in.
const TYPES = [
  { slug: 'to_do', label: 'Todos', hierarchy: true },
  { slug: 'task', label: 'Tasks', hierarchy: false },
  { slug: 'ticket', label: 'Tickets', hierarchy: false },
  { slug: 'goal', label: 'Goals', hierarchy: false },
  { slug: 'area', label: 'Categories', hierarchy: true },
  { slug: 'idea', label: 'Ideas', hierarchy: true },
];

async function getCsrfToken(page) {
  return page.evaluate(() => document.body.dataset.csrfToken);
}

async function apiCreate(page, slug, title) {
  return page.evaluate(
    async ({ slug, title, csrfToken }) => {
      const r = await fetch(`/api/entities/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ title }),
      });
      return (await r.json()).data;
    },
    { slug, title, csrfToken: await getCsrfToken(page) }
  );
}

async function apiGet(page, slug, id) {
  return page.evaluate(
    async ({ slug, id }) => (await (await fetch(`/api/entities/${slug}/${id}`)).json()).data,
    { slug, id }
  );
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

      await page.locator('.entity-row', { hasText: original.title }).click();
      await expect(page.locator(`#${type.slug}EditorPane`)).toBeVisible();

      const titleInput = page.locator('#entity-editor-form input[name="title"]');
      await titleInput.fill(updated);
      await titleInput.dispatchEvent('input');
      await page.click(`#${type.slug}SaveBtn`);

      await expect(page.locator('.entity-row', { hasText: updated })).toBeVisible({ timeout: 5000 });
      const stored = await apiGet(page, type.slug, original.id);
      expect(stored.title).toBe(updated);
    });

    test('deletes an existing item', async ({ page }) => {
      const item = await apiCreate(page, type.slug, `${prefix} delete me`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      const row = page.locator('.entity-row', { hasText: item.title });
      await expect(row).toBeVisible();
      page.once('dialog', (d) => d.accept());
      await row.locator('[data-action="delete"]').click();

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
    }
  });
}
