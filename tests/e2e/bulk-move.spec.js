import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// Bulk MOVE. A drag carries one row, so re-filing a batch had no gesture at
// all - which is what finding 13 asks for alongside bulk delete and setting a
// field across a selection.

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

test('several rows move into a folder at once', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const folder = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ move target', is_folder: true }) })).data;
  const rows = [];
  for (const t of ['ZZZ move a', 'ZZZ move b', 'ZZZ move c']) {
    rows.push((await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: t }) })).data);
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1900);

  const rowOf = (id) => page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${id}"]`);
  await rowOf(rows[0].id).locator('.entity-cell-title').click();
  await rowOf(rows[2].id).locator('.entity-cell-title').click({ modifiers: ['Shift'] });
  await page.waitForTimeout(500);

  const bar = page.locator(`#${TYPE}SelectionBar`);
  await expect(bar, 'the selection bar shows').toBeVisible();
  await bar.locator('[data-action="move-selected"]').click();
  await page.waitForTimeout(600);

  // The picker offers the folder, and must NOT offer the rows being moved.
  const offered = await page.locator('#confirmModalSelect option').evaluateAll(os => os.map(o => o.textContent.trim()));
  console.log('move targets ->', JSON.stringify(offered));
  expect(offered[0], 'top level first').toContain('Top level');
  expect(offered).toContain('ZZZ move target');

  await page.selectOption('#confirmModalSelect', String(folder.id));
  await page.click('#confirmModalConfirm');
  await page.waitForTimeout(1800);

  const edges = (await api(page, `/api/entities/${TYPE}/relationships?kind=hierarchy`)).data || [];
  const inside = rows.filter(r => edges.some(e =>
    String(e.parent_entity_id) === String(folder.id) && String(e.child_entity_id) === String(r.id)));
  console.log('moved inside ->', inside.length);
  expect(inside.length, 'all three landed in the folder').toBe(3);
});

test('a row cannot be moved into itself or its own subtree', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  const outer = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ self outer', is_folder: true }) })).data;
  const inner = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ self inner', is_folder: true }) })).data;
  await api(page, `/api/entities/${TYPE}/${inner.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: outer.id, childEntityId: inner.id, relationshipKind: 'hierarchy' }),
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1900);

  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${outer.id}"] .entity-cell-title`).click();
  // A second row so the bar appears - selection needs two.
  const other = (await api(page, `/api/entities/${TYPE}`, { method: 'POST', body: JSON.stringify({ title: 'ZZZ self other' }) })).data;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1900);
  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${outer.id}"] .entity-cell-title`).click();
  await page.locator(`#${TYPE}EntityList .entity-row[data-entity-id="${other.id}"] .entity-cell-title`).click({ modifiers: ['Meta'] });
  await page.waitForTimeout(500);

  await page.locator(`#${TYPE}SelectionBar [data-action="move-selected"]`).click();
  await page.waitForTimeout(600);
  const offered = await page.locator('#confirmModalSelect option').evaluateAll(os => os.map(o => o.textContent.trim()));
  console.log('offered with outer selected ->', JSON.stringify(offered));

  expect(offered, 'a row cannot be moved into itself').not.toContain('ZZZ self outer');
  expect(offered, 'nor into something inside it').not.toContain('ZZZ self inner');
  await page.click('#confirmModalCancel');
});
