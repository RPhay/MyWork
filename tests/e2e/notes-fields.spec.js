import { test, expect } from '@playwright/test';

/**
 * Notes, Claude Notes and the worked-with-Claude toggle - the three properties
 * Dailies has always carried on a work item, made available to any editable
 * type as field types.
 *
 * What makes them the Dailies pattern is the ROW, not the editor. A note can be
 * a paragraph; fifty rows each showing a paragraph is not a list any more. So
 * the row shows one glyph that is LIT when there is something there and muted
 * when there is not, and the text itself opens in a box. These tests are mostly
 * about that distinction, because it is the part that would be quietly lost by
 * anyone "simplifying" the cell renderer into showing the value.
 *
 * Notes and Claude Notes are deliberately two fields, not one: notes you wrote
 * and notes Claude wrote must not overwrite each other.
 */

const TITLE = 'ZZZ notes subject';
const TYPE = 'idea';

async function api(page, url, opts = {}) {
  return page.evaluate(async ([u, o]) => {
    const r = await fetch(u, {
      ...o,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.body.dataset.csrfToken || '' },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [url, opts]);
}

let fieldIds = [];
let entityId = null;

test.afterAll(async ({ browser }) => {
  // Teardown in afterAll, not at the end of a test body: a spec that tidies up
  // on its last line leaks every time an assertion fails earlier, which is how
  // this database reached 229 stray rows once already.
  const page = await browser.newPage();
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  const list = (await api(page, `/api/entities/${TYPE}`)).body?.data || [];
  for (const e of list.filter(x => (x.title || '').startsWith('ZZZ notes')))
    await api(page, `/api/entities/${TYPE}/${e.id}`, { method: 'DELETE' });
  for (const id of fieldIds)
    await api(page, `/api/entity-types/fields/${id}`, { method: 'DELETE' });
  await page.close();
});

test('the three fields can be declared, and round-trip their values', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const type = (await api(page, `/api/entity-types/${TYPE}`)).body.data;
  for (const [key, label, field_type] of [
    ['zzz_notes', 'ZZZ Notes', 'notes'],
    ['zzz_claude_notes', 'ZZZ Claude Notes', 'claude_notes'],
    ['zzz_with_claude', 'ZZZ With Claude', 'worked_with_claude'],
  ]) {
    const made = await api(page, `/api/entity-types/${type.id}/fields`, {
      method: 'POST',
      body: JSON.stringify({ field_key: key, label, field_type, show_in_row: 1 }),
    });
    expect(made.status, `${field_type} must be an accepted field type`).toBeLessThan(400);
    fieldIds.push(made.body.data.id);
  }

  // The service allow-list and the MySQL ENUM must BOTH have accepted it. A
  // type widened in only one place fails here rather than the first time
  // someone saves a value.
  const back = (await api(page, `/api/entity-types/${TYPE}`)).body.data;
  const declared = (back.fields || []).filter(f => f.field_key.startsWith('zzz_'));
  expect(declared.map(f => f.field_type).sort())
    .toEqual(['claude_notes', 'notes', 'worked_with_claude']);

  // Values round-trip, and the two notes fields do NOT overwrite each other.
  const made = await api(page, `/api/entities/${TYPE}`, {
    method: 'POST', body: JSON.stringify({ title: TITLE }),
  });
  entityId = made.body.data.id;
  await api(page, `/api/entities/${TYPE}/${entityId}`, {
    method: 'PUT',
    body: JSON.stringify({ fields: {
      zzz_notes: 'mine, not Claude\'s',
      zzz_claude_notes: 'Claude\'s, not mine',
      zzz_with_claude: true,
    } }),
  });

  const read = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === entityId);
  expect(read.fields.zzz_notes, 'my notes survive').toBe('mine, not Claude\'s');
  expect(read.fields.zzz_claude_notes, 'Claude\'s notes survive, separately').toBe('Claude\'s, not mine');
  expect(read.fields.zzz_with_claude, 'the toggle survives as a boolean').toBe(true);
  expect(errs).toEqual([]);
});

// The bug this guards is specific and was live until this feature was built:
// setEntityFieldValue routed ANY string merely BEGINNING with a date into
// value_date, where the column coerced it to the date and dropped the rest.
// Notes are exactly the field people start with a date.
test('a note that begins with a date keeps its text', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const made = await api(page, `/api/entities/${TYPE}`, {
    method: 'POST', body: JSON.stringify({ title: 'ZZZ notes dated' }),
  });
  const id = made.body.data.id;
  const text = '2026-08-22 spoke to Ryan about the schema';
  await api(page, `/api/entities/${TYPE}/${id}`, {
    method: 'PUT', body: JSON.stringify({ fields: { zzz_notes: text } }),
  });

  const read = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === id);
  expect(read.fields.zzz_notes, 'the whole note, not just the date').toBe(text);
});

test('a row shows a glyph that lights up, never the text itself', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const row = page.locator(`#ideaEntityList .entity-row[data-entity-id="${entityId}"]`);
  await expect(row).toBeVisible({ timeout: 8000 });

  // The note's text must not be in the row. This is the whole point of the
  // pattern - a list stays a list.
  await expect(row).not.toContainText('mine, not Claude');
  await expect(row).not.toContainText('Claude\'s, not mine');

  const notes = row.locator('[data-action="edit-notes-field"][data-field-type="notes"]');
  const claude = row.locator('[data-action="edit-notes-field"][data-field-type="claude_notes"]');
  const sun = row.locator('[data-action="toggle-claude-field"]');
  await expect(notes, 'a notes glyph').toHaveCount(1);
  await expect(claude, 'a separate Claude-notes glyph').toHaveCount(1);
  await expect(sun, 'the worked-with-Claude sun').toHaveCount(1);

  // Lit, because this row has notes and the toggle is on.
  const litColour = (loc) => loc.locator('i').evaluate(el => el.style.color);
  expect(await litColour(notes), 'notes glyph is lit').not.toBe('rgb(222, 226, 230)');
  expect(await litColour(claude), 'Claude notes glyph is lit').not.toBe('rgb(222, 226, 230)');
  expect(await sun.getAttribute('data-value'), 'the sun reads as on').toBe('1');
});

test('the glyph opens a box that writes the note back', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const row = page.locator(`#ideaEntityList .entity-row[data-entity-id="${entityId}"]`);
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.locator('[data-action="edit-notes-field"][data-field-type="notes"]').click();

  const box = page.locator('#entityNotesEditorText');
  await expect(box, 'the box opens on the existing note').toBeVisible({ timeout: 5000 });
  await expect(box).toHaveValue('mine, not Claude\'s');
  await expect(page.locator('#entityNotesEditorTitle')).toHaveText('Notes');

  await box.fill('rewritten by hand');
  await page.click('#entityNotesEditorSave');
  await page.waitForTimeout(1200);

  const read = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === entityId);
  expect(read.fields.zzz_notes, 'the box wrote it back').toBe('rewritten by hand');
  expect(read.fields.zzz_claude_notes, 'and left Claude\'s notes alone').toBe('Claude\'s, not mine');
});

test('the sun toggles from the row without opening the editor', async ({ page }) => {
  await page.goto('/?tab=idea', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const row = page.locator(`#ideaEntityList .entity-row[data-entity-id="${entityId}"]`);
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.locator('[data-action="toggle-claude-field"]').click();
  await page.waitForTimeout(1000);

  const read = (await api(page, `/api/entities/${TYPE}`)).body.data.find(e => e.id === entityId);
  expect(read.fields.zzz_with_claude, 'the sun flipped it off').toBe(false);
  // A cell control never opens the editor - that would move the cell being
  // clicked out from under the pointer.
  expect(await page.locator('#entity-editor-form').count(),
    'clicking a cell control must not open the editor').toBe(0);
});
