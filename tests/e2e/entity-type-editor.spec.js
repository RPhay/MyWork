import { test, expect } from '@playwright/test';

/**
 * The type editor silently corrupted types: its field-type <select> had no
 * option for `status` or `recurrence`, and a <select> falls back to its first
 * option, so opening a type and pressing Save rewrote those fields to `text` -
 * and updateEntityType then dropped every field the form could not represent.
 * A type opened once could come back with one field where it had four.
 */
test('type editor opens and shows all fields with correct types', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('/settings?tab=entity-types');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1800);

  await page.locator('text=Projects').first().click();
  await page.waitForTimeout(1200);

  const rows = await page.locator('.field-row').count();
  const types = await page.locator('.field-type').evaluateAll(els => els.map(e => e.value));
  const keys  = await page.locator('.field-key').evaluateAll(els => els.map(e => e.value));
  const alerts=(await page.locator('.alert-danger').allTextContents()).map(s=>s.trim()).filter(Boolean);
  console.log(JSON.stringify({fieldRows:rows, keys, types, alerts, pageErrors:errs}));

  expect(errs).toEqual([]);

  // Engine-written fields are not part of what a person defines on a type: the
  // board and focus bar add their own, and asserting a total count made this
  // fail every time a feature added one. `is_weekly` used to be in this list
  // and is gone with Weekly Priorities. Only the user-facing fields are checked.
  const INTERNAL = new Set(['board_bay', 'board_order', 'focus_slot', 'focus_seconds', 'focus_started_at']);
  const userKeys = keys.filter(k => !INTERNAL.has(k));
  // Compared as a set: field order is user-editable (fields are drag-sortable
  // in this very editor), so asserting a sequence makes the test fail on a
  // legitimate reorder rather than on a real problem.
  expect(new Set(userKeys)).toEqual(new Set(['priority', 'status', 'notes', 'links']));
  expect(userKeys.length, 'no field should appear twice').toBe(new Set(userKeys).size);
});

// A daily is never a child of anything and is implicitly a parent of
// everything, so offering it in either list is wrong or a no-op. Outlook
// Calendar is an import source, not a type you author rules against.
test('relationship lists exclude dailies and import types', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1800);
  await page.locator('text=Projects').first().click();
  await page.waitForTimeout(1200);

  const parents  = await page.locator('#parentTypesList .form-check-label').allTextContents();
  const children = await page.locator('#childTypesList .form-check-label').allTextContents();

  for (const list of [parents, children]) {
    expect(list).not.toContain('Work Items');
    expect(list).not.toContain('Daily');
    expect(list).not.toContain('Outlook Calendar');
  }
  expect(parents).toContain('Categories');
});

test('the type editor offers every field type the renderer supports', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  const js = await page.evaluate(async () => (await (await fetch('/js/entity-type-editor.js')).text()));
  // `recurrence` is deliberately absent: it was withdrawn as a field type
  // pending a better implementation, so there is no longer an option for it.
  for (const t of ['text','textarea','number','date','url','links','select','radio','checkbox','status','priority']) {
    expect(js, `missing <option> for ${t}`).toContain(`value="${t}"`);
  }
});
