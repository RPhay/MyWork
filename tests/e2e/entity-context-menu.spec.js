import { test, expect } from '@playwright/test';

/**
 * The context menu is built from the type's own definition - never from its
 * slug. `supports_hierarchy` gates every "inside" entry and folders; the type's
 * `hierarchy` relationship rules decide which types may be children. Editing a
 * type in Settings changes its menu with no code change, which is the whole
 * point of the generic engine.
 */

const PREFIX = 'ZZZ ctx';

async function rightClick(page, locator) {
  // page.mouse rather than locator.click({button:'right'}): the latter scrolls
  // as part of the click, and that scroll dismisses the menu it just opened.
  // Scroll first, settle, and only then send the gesture - a row below the
  // fold otherwise yields coordinates outside the viewport.
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(250);
}

async function menuItems(page) {
  return (await page.locator('.entity-context-menu .context-menu-item').allTextContents())
    .map(s => s.replace(/[^\x20-\x7E]/g, '').trim());
}

async function api(page, path, options = {}) {
  return page.evaluate(async ({ path, options, t }) => {
    const r = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t, ...(options.headers || {}) } });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, options, t: await page.evaluate(() => document.body.dataset.csrfToken) });
}

test.describe('Generic entity context menu', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page }) => {
    await page.goto('/');
    const { body } = await api(page, '/api/entities/category');
    for (const e of (body?.data || []).filter(x => (x.title || '').startsWith(PREFIX))) {
      await api(page, `/api/entities/category/${e.id}`, { method: 'DELETE' });
    }
  });

  test('a hierarchical type offers nesting, folders, edit and delete', async ({ page }) => {
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('/?tab=category');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await api(page, '/api/entities/category', { method: 'POST', body: JSON.stringify({ title: `${PREFIX} parent` }) });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);

    await rightClick(page, page.locator('.entity-row', { hasText: `${PREFIX} parent` }).first());
    await expect(page.locator('.entity-context-menu')).toBeVisible();
    const items = await menuItems(page);
    expect(items.join('|')).toContain('New Category inside');
    expect(items.join('|')).toContain('New Folder inside');
    expect(items.join('|')).toContain('Edit Category');
    expect(items.join('|')).toContain('Delete Category');
    expect(errs).toEqual([]);
  });

  test('"New Folder inside" nests the folder under the row it was opened on', async ({ page }) => {
    await page.goto('/?tab=category');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const parent = (await api(page, '/api/entities/category', { method: 'POST', body: JSON.stringify({ title: `${PREFIX} host` }) })).body.data;
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);

    await rightClick(page, page.locator('.entity-row', { hasText: `${PREFIX} host` }).first());
    await page.locator('.entity-context-menu .context-menu-item', { hasText: 'New Folder inside' }).click();

    const title = page.locator('#entity-editor-form input[name="title"]');
    await expect(title).toBeVisible();
    await title.fill(`${PREFIX} nested folder`);
    await title.dispatchEvent('input');
    await page.click('#categorySaveBtn');
    await page.waitForTimeout(1200);

    const rels = (await api(page, '/api/entities/category/relationships?kind=hierarchy')).body.data;
    const all = (await api(page, '/api/entities/category')).body.data;
    const folder = all.find(e => e.title === `${PREFIX} nested folder`);
    expect(folder).toBeTruthy();
    expect(Boolean(folder.is_folder)).toBe(true);
    expect(rels).toContainEqual(expect.objectContaining({ parent_entity_id: parent.id, child_entity_id: folder.id }));
  });

  test('right-clicking empty space offers top-level creation only', async ({ page }) => {
    await page.goto('/?tab=category');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Dispatched on the container rather than via page.mouse: with a full list
    // there is no pixel inside the pane that isn't covered by a row, and the
    // branch under test is precisely "the target was not a row". The row path
    // is covered with real mouse input in the tests above.
    await page.evaluate(() => {
      document.getElementById('areaEntityList')
        .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 300 }));
    });
    await page.waitForTimeout(250);

    const items = (await menuItems(page)).join('|');
    expect(items).toContain('New Category');
    expect(items).toContain('New Folder');
    expect(items).not.toContain('inside');
    expect(items).not.toContain('Delete');
  });
});
