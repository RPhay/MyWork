import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';
import { dblclick } from './dblclick.js';

const TYPE = 'to_do';

async function api(page, url, opts = {}) {
  return page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': window.APP_CONFIG?.csrfToken },
    });
    return res.json();
  }, { url, opts });
}

test.afterEach(async ({ page }) => { await purgeByTitlePrefix(page, TYPE, 'ZZZ'); });

test('right-clicking a row makes it the selected row', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const a = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ sel A' }) })).data;
  const b = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ sel B' }) })).data;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const rowA = page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${a.id}"]`);
  const rowB = page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${b.id}"]`);

  // Select A the usual way. The click is what applies selection - dblclick()
  // is dispatched (see dblclick.js) and deliberately does not fire the clicks,
  // so this test states the one it depends on instead of relying on it.
  await rowA.locator('.entity-cell-title').click();
  await dblclick(rowA.locator('.entity-cell-title'));
  await page.waitForTimeout(700);
  // classList.contains, not toHaveClass(/selected/): that regex also matches
  // `multi-selected`, which is a different signal entirely - one row can carry
  // both, so a loose match here says nothing.
  const isSelected = (id) => page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${id}"]`)
    .evaluate(el => el.classList.contains('selected'));
  expect(await isSelected(a.id), 'A is selected').toBe(true);

  // Right-clicking B must move the selection to B, not act on A while A stays lit.
  await rowB.locator('.entity-cell-title').click({ button: 'right' });
  await page.waitForTimeout(800);
  expect(await isSelected(b.id), 'right-click moves the selection to B').toBe(true);
  expect(await isSelected(a.id), 'and takes it off A').toBe(false);
});

test('a folder can be pinned to the focus bar', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const folder = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ pin folder', is_folder: true }) })).data;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${folder.id}"] .entity-cell-title`)
    .click({ button: 'right' });
  await page.waitForTimeout(500);

  console.log('menu items ->', JSON.stringify(await page.locator('.entity-context-menu .context-menu-item').allTextContents()));
  const pin = page.locator('.entity-context-menu .context-menu-item', { hasText: 'Pin to focus bar' });
  await expect(pin, 'folders offer the pin too').toHaveCount(1);
  await pin.click();
  await page.waitForTimeout(1200);
  await expect(page.locator('#focusBar .focus-chip').filter({ hasText: 'ZZZ pin folder' })).toHaveCount(1);

  await page.evaluate(async (id) => {
    await fetch(`/api/focus/${id}`, { method: 'DELETE', headers: { 'CSRF-Token': window.APP_CONFIG?.csrfToken } });
  }, folder.id);
});

test("clicking a folder's rolled-up status leaves the editor alone", async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const folder = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ roll folder', is_folder: true }) })).data;
  const kid = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ roll kid', fields: { status: 'Complete' } }) })).data;
  await api(page, `/api/entities/${TYPE}/${kid.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: folder.id, childEntityId: kid.id, relationshipKind: 'hierarchy' }),
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1900);

  const cell = page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${folder.id}"] .entity-cell[data-col="status"] .is-rollup`);
  test.skip(await cell.count() === 0, 'no rolled-up status rendered');

  // Editor closed: clicking the roll-up must not open it.
  expect(await page.locator('#entity-editor-form').count()).toBe(0);
  await cell.click();
  await page.waitForTimeout(700);
  expect(await page.locator('#entity-editor-form').count(),
    'a rolled-up status is not a control - it must not open the editor').toBe(0);

  // Editor open on something else: clicking the roll-up must not switch it.
  await dblclick(page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${kid.id}"] .entity-cell-title`));
  await page.waitForTimeout(800);
  const before = await page.locator('#entity-editor-form input[name="title"]').inputValue();
  await cell.click();
  await page.waitForTimeout(700);
  const after = await page.locator('#entity-editor-form input[name="title"]').inputValue();
  expect(after, 'the editor stays on what it was showing').toBe(before);
});

// One click opens and closes a row; TWO open and close the editor. The editor
// used to be one click away, so you could not look inside a folder without
// loading its editor, and a stray click on a list was a state change.
test('one click expands a row, two open the editor', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const folder = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ click folder', is_folder: true }) })).data;
  const kid = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ click kid' }) })).data;
  await api(page, `/api/entities/${TYPE}/${kid.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: folder.id, childEntityId: kid.id, relationshipKind: 'hierarchy' }),
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1900);

  const node = page.locator(`#${TYPE}EntityList .entity-node[data-entity-id="${folder.id}"]`);
  const title = page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${folder.id}"] .entity-cell-title`);
  const wasExpanded = await node.evaluate(el => el.classList.contains('expanded'));

  // One click: the row opens or closes, and the editor stays as it was.
  await title.click();
  await page.waitForTimeout(600);
  expect(await node.evaluate(el => el.classList.contains('expanded')),
    'a single click toggles the row').toBe(!wasExpanded);
  expect(await page.locator('#entity-editor-form').count(),
    'a single click must not open the editor').toBe(0);

  // Two clicks: the editor, and the row is not left flapping.
  const beforeDouble = await node.evaluate(el => el.classList.contains('expanded'));
  // The click is what SCHEDULES the deferred expand; without it there is
  // nothing for the double-click to cancel and the assertion below would pass
  // vacuously. dblclick() is dispatched and fires no clicks of its own.
  await title.click();
  await dblclick(title);
  await page.waitForTimeout(900);
  await expect(page.locator('#entity-editor-form input[name="title"]')).toHaveValue('ZZZ click folder');
  expect(await node.evaluate(el => el.classList.contains('expanded')),
    'the pending expand is cancelled by the second click').toBe(beforeDouble);
});
