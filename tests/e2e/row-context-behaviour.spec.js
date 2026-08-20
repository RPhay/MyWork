import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

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

  await rowA.locator('.entity-cell-title').click();          // select A the usual way
  await page.waitForTimeout(700);
  await expect(rowA).toHaveClass(/selected/);

  // Right-clicking B must move the selection to B, not act on A while A stays lit.
  await rowB.locator('.entity-cell-title').click({ button: 'right' });
  await page.waitForTimeout(800);
  await expect(page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${b.id}"]`)).toHaveClass(/selected/);
  await expect(page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${a.id}"]`)).not.toHaveClass(/selected/);
});

test('a folder can be pinned to the focus bar', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const folder = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ pin folder', is_folder: true }) })).data;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${folder.id}"] .entity-cell-title`)
    .click({ button: 'right' });
  await page.waitForTimeout(500);

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
  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${kid.id}"] .entity-cell-title`).click();
  await page.waitForTimeout(800);
  const before = await page.locator('#entity-editor-form input[name="title"]').inputValue();
  await cell.click();
  await page.waitForTimeout(700);
  const after = await page.locator('#entity-editor-form input[name="title"]').inputValue();
  expect(after, 'the editor stays on what it was showing').toBe(before);
});
