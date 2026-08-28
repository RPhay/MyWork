import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix } from './helpers/cleanup.js';
import { flushAutosave, openEditor } from './editor-gestures.js';

// A refresh is usually incidental to what you were doing, so it should not
// throw away the editor you had open. Only the record's IDENTITY is kept - the
// values that come back are the saved ones, since anything unsaved went with
// the page.

const TYPE = 'to_do';

test.afterEach(async ({ page }) => { await purgeByTitlePrefix(page, TYPE, 'ZZZ'); });

test('a hard refresh leaves the open editor open, on the same record', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  await page.click(`#add${TYPE}Btn`);
  const t = page.locator('#entity-editor-form input[name="title"]');
  await t.fill('ZZZ refresh keeper');
  await t.dispatchEvent('input');
  await flushAutosave(page);
  await page.waitForTimeout(1300);
  await expect(page.locator('#entity-editor-form input[name="title"]')).toHaveValue('ZZZ refresh keeper');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);

  await expect(
    page.locator('#entity-editor-form input[name="title"]'),
    'the editor should still be open on the same record'
  ).toHaveValue('ZZZ refresh keeper');
});

// There is ONE editor. An earlier version of the reopen feature remembered a
// record per TYPE, so every tab restored its own on load - several visible
// editor panes, several elements sharing id="entity-editor-form", and the
// singleton pointing at whichever tab initialised last. Clicking a row then
// could not resolve a form, which made the editor unusable.
test('never more than one editor, whatever is remembered', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // This test needs a row on each of those three tabs, and it used to assume
  // the user had some. Projects emptied on 2026-08-27 - every row it held was
  // test residue - and the assertion below then timed out waiting for a pencil
  // on a row that does not exist, which reads like a broken editor rather than
  // an empty tab. Make the row rather than hoping for it.
  const madeHere = await page.evaluate(async () => {
    const t = document.body.dataset.csrfToken || '';
    const made = [];
    for (const slug of ['priority', 'idea', 'to_do']) {
      const b = await (await fetch(`/api/entities/${slug}`)).json().catch(() => ({}));
      if ((b.data || []).some(x => !x.is_folder && !x.deleted_at)) continue;
      const r = await (await fetch(`/api/entities/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t },
        body: JSON.stringify({ title: `ZZZ editor-open ${slug}` }),
      })).json().catch(() => ({}));
      if (r?.data?.id) made.push({ slug, id: r.data.id });
    }
    return made;
  });

  await page.evaluate(async () => {
    // The pre-fix per-type shape, as a browser may still hold it.
    const out = {};
    for (const slug of ['priority', 'idea', 'to_do']) {
      const b = await (await fetch(`/api/entities/${slug}`)).json().catch(() => ({}));
      const first = (b.data || []).find(x => !x.is_folder);
      if (first) out[slug] = String(first.id);
    }
    localStorage.setItem('entityOpenEditor', JSON.stringify(out));
  });

  await page.goto('/?tab=priority', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2400);
  expect(await page.locator('#entity-editor-form').count(),
    'more than one editor form in the DOM').toBeLessThanOrEqual(1);

  // ...and the editor still works.
  const row = page.locator('#priorityEntityList .entity-row:not([data-is-folder="1"])').first();
  await openEditor(row);
  await page.waitForTimeout(1000);
  expect((await page.locator('#entity-editor-form input[name="title"]').inputValue()).length,
    'clicking a row must open its editor').toBeGreaterThan(0);

  // By id, and both calls - /api/entities/:type/:id only soft-deletes.
  await page.evaluate(async (made) => {
    const t = document.body.dataset.csrfToken || '';
    const h = { 'Content-Type': 'application/json', 'X-CSRF-Token': t };
    for (const { slug, id } of made) {
      await fetch(`/api/entities/${slug}/${id}`, { method: 'DELETE', headers: h });
      await fetch(`/api/trash/${id}`, { method: 'DELETE', headers: h });
    }
  }, madeHere);
});

test('an editor closed on purpose stays closed across a refresh', async ({ page }) => {
  await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  await page.click(`#add${TYPE}Btn`);
  const t = page.locator('#entity-editor-form input[name="title"]');
  await t.fill('ZZZ refresh closer');
  await t.dispatchEvent('input');
  await flushAutosave(page);
  await page.waitForTimeout(1300);

  // Clicking the open row's pencil again is how an editor is closed.
  await openEditor(page.locator(`#${TYPE}EntityList .entity-row`)
    .filter({ hasText: 'ZZZ refresh closer' }).first());
  await page.waitForTimeout(600);
  await expect(page.locator('#entity-editor-form')).toHaveCount(0);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await expect(page.locator('#entity-editor-form'), 'should not reopen itself').toHaveCount(0);
});
