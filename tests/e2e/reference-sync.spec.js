import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';

// A reference IS the record. Editing it anywhere edits it everywhere, and every
// view showing it has to say so without a reload - including when the change is
// STRUCTURAL rather than a value.

async function api(page, url, opts = {}) {
  return page.evaluate(async ({ url, opts }) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': window.APP_CONFIG?.csrfToken },
    });
    return res.json();
  }, { url, opts });
}

test.afterEach(async ({ page }) => {
  await purgeByTitlePrefix(page, 'tests', 'ZZZ');
  await purgeByTitlePrefix(page, 'template', 'ZZZ');
});

test('renaming a record updates the template referencing it, live', async ({ page }) => {
  await page.goto('/?tab=tests', { waitUntil: 'networkidle' });
  const row = (await api(page, '/api/entities/tests', { method: 'POST', body: JSON.stringify({ title: 'ZZZ before rename' }) })).data;
  const tpl = (await api(page, '/api/entities/template', { method: 'POST', body: JSON.stringify({ title: 'ZZZ sync holder' }) })).data;
  await api(page, `/api/entities/template/${row.id}/relationships`, {
    method: 'POST',
    body: JSON.stringify({ parentEntityId: tpl.id, childEntityId: row.id, relationshipKind: 'hierarchy' }),
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await page.locator('button[data-rail-toggle="template"]').click();
  await page.waitForTimeout(800);
  // A plain click on a rail deselects everything else, so ask for the type back
  // - Templates + a type is an allowed pair, which is what this test needs.
  await page.locator('button[data-tab="tests"]').click();
  await page.waitForTimeout(1000);
  await page.locator('#expandAlltemplateBtn').click().catch(() => {});
  await page.waitForTimeout(700);

  const inTemplate = page.locator(`#templateEntityList .entity-row[data-entity-id="${row.id}"] .entity-title`);
  await expect(inTemplate).toHaveText('ZZZ before rename');

  // Rename it on its OWN page - the template must follow without a reload.
  await page.locator(`#testsEntityList .entity-row[data-entity-id="${row.id}"] .entity-cell-title`).dblclick();
  await page.waitForTimeout(800);
  const title = page.locator('#entity-editor-form input[name="title"]');
  await title.fill('ZZZ after rename');
  await title.dispatchEvent('input');
  await page.click('#testsSaveBtn');
  await page.waitForTimeout(1600);

  await expect(inTemplate, 'the reference shows the new name without a reload')
    .toHaveText('ZZZ after rename');
});
