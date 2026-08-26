import { test, expect } from '@playwright/test';
import { purgeByTitlePrefix, deleteFields } from './helpers/cleanup.js';

// This spec declares SIX extra columns on the type, and columns drop rather
// than collapse when the pane cannot fit them (genericEntity.fitColumns), with
// the editor taking half of it. At the default 1280 the cells it clicks were
// present and not visible, so it waited out its 180s timeout - and the page
// was torn down before its `finally` could delete the fields it had added,
// which is how six zzz_ field definitions came to be left on the Ideas type.
test.use({ viewport: { width: 3000, height: 1100 } });

// Every field type with an interactive CELL must stay in step with its EDITOR
// control, both ways. The two sides render differently per type - a hidden
// input plus a badge, a group of radios, a button showing a glyph - and the
// row->editor path assumed a single named input, so any shape that did not
// match fell silently out of sync.
//
// The fields are added to an EXISTING type and hard-deleted afterwards. A
// purpose-built type was tried first and rejected: deleting a type is a SOFT
// delete that permanently reserves its slug, so each run would leave residue
// that can never be cleaned up.

test.describe.configure({ timeout: 180_000 });

const PREFIX = 'zzz_';
const NEW_FIELDS = [
  { field_key: 'zzz_status',   label: 'ZZZ Status',   field_type: 'status',   show_in_row: 1, field_options: { values: ['Not Started', 'In Progress', 'Complete'] } },
  { field_key: 'zzz_priority', label: 'ZZZ Priority', field_type: 'priority', show_in_row: 1 },
  { field_key: 'zzz_check',    label: 'ZZZ Check',    field_type: 'checkbox', show_in_row: 1 },
  { field_key: 'zzz_select',   label: 'ZZZ Select',   field_type: 'select',   show_in_row: 1, field_options: { choices: ['Alpha', 'Beta', 'Gamma'] } },
  { field_key: 'zzz_radio',    label: 'ZZZ Radio',    field_type: 'radio',    show_in_row: 1, field_options: { choices: ['One', 'Two', 'Three'] } },
  { field_key: 'zzz_emojis',   label: 'ZZZ Emojis',   field_type: 'emojis',   show_in_row: 1, field_options: { values: ['\u{1F534}', '\u{1F7E1}', '\u{1F7E2}'] } },
];

const TYPE = 'idea';
const ROW = 'ZZZsync row';

async function addFields(page, typeSlug, fields) {
  return page.evaluate(async ({ typeSlug, fields }) => {
    const csrf = window.APP_CONFIG?.csrfToken;
    const types = (await (await fetch('/api/entity-types')).json()).data || [];
    const t = types.find(x => x.slug === typeSlug);
    if (!t) return { ok: false, message: `no type ${typeSlug}` };
    const ids = [];
    for (const f of fields) {
      const res = await fetch(`/api/entity-types/${t.id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf },
        body: JSON.stringify(f),
      });
      const body = await res.json().catch(() => ({}));
      if (!body.success) return { ok: false, message: `${f.field_key}: ${body.message}` };
      ids.push(body.data.id);
    }
    return { ok: true, ids };
  }, { typeSlug, fields });
}

async function editorShows(page, key, type) {
  const form = page.locator('#entity-editor-form');
  if (type === 'status')   return (await form.locator(`[data-field-type="status"]:has(input[name="${key}"]) .option-choice.selected`).textContent() || '').trim();
  if (type === 'priority') return (await form.locator(`[data-field-type="priority"]:has(input[name="${key}"]) .editor-cycle-label`).textContent() || '').trim();
  if (type === 'checkbox') return (await form.locator(`input[name="${key}"]`).isChecked()) ? 'on' : 'off';
  if (type === 'radio')    return (await form.locator(`input[type="radio"][name="${key}"]:checked`).inputValue().catch(() => '')) || '';
  return await form.locator(`[name="${key}"]`).inputValue().catch(() => '');
}

async function cellShows(page, row, key, type) {
  const cell = row.locator(`.entity-cell[data-col="${key}"]`);
  if (type === 'status')   return (await cell.locator('[data-action="cycle-status"]').textContent() || '').trim();
  if (type === 'priority') return (await cell.locator('[data-action="cycle-priority"]').getAttribute('data-priority')) || '';
  // The cell carries `data-value`, not `data-checked` (genericEntity.js#1168),
  // and the toggle handler reads dataset.value too. Reading data-checked got
  // null every time, so the cell always looked "off" and the mismatch was
  // reported as a cell<->editor sync bug that was not there.
  if (type === 'checkbox') return (await cell.locator('[data-action="toggle-checkbox"]').getAttribute('data-value')) === '1' ? 'on' : 'off';
  if (type === 'select' || type === 'radio') return await cell.locator('select[data-action="set-choice"]').inputValue();
  if (type === 'emojis')   return (await cell.locator('[data-action="cycle-emoji"]').textContent() || '').trim();
  return (await cell.textContent() || '').trim();
}

const norm = (v) => String(v ?? '').trim().toLowerCase();
const same = (a, b, type) =>
  norm(a) === norm(b) || (type === 'priority' && norm(b) === 'none' && norm(a) === '');

test('every interactive field syncs cell <-> editor', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const added = await addFields(page, TYPE, NEW_FIELDS);
  expect(added.ok, `could not add test fields: ${added.message}`).toBe(true);

  try {
    await page.goto(`/?tab=${TYPE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.click(`#add${TYPE}Btn`);
    const t = page.locator('#entity-editor-form input[name="title"]');
    await t.fill(ROW);
    await t.dispatchEvent('input');
    await page.click(`#${TYPE}SaveBtn`);
    await page.waitForTimeout(1400);

    const row = page.locator(`#${TYPE}EntityList .entity-row`).filter({ hasText: ROW }).first();
    await expect(row).toHaveCount(1);

    const failures = [];

    for (const f of NEW_FIELDS) {
      const cell = row.locator(`.entity-cell[data-col="${f.field_key}"]`);
      if (await cell.count() === 0) { failures.push(`${f.field_type}: no cell rendered`); continue; }

      // ---- cell -> editor ----
      if (['status', 'priority', 'checkbox', 'emojis'].includes(f.field_type)) {
        await cell.locator('[data-action]').first().click();
      } else {
        const sel = cell.locator('select[data-action="set-choice"]');
        const opts = await sel.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
        await sel.selectOption(opts[opts.length - 1]);
      }
      await page.waitForTimeout(900);

      const c1 = await cellShows(page, row, f.field_key, f.field_type);
      const e1 = await editorShows(page, f.field_key, f.field_type);
      if (!same(c1, e1, f.field_type)) {
        failures.push(`${f.field_type} CELL->EDITOR: cell="${c1}" editor="${e1}"`);
      }

      // ---- editor -> cell ----
      if (f.field_type === 'priority') {
        await page.locator(`#entity-editor-form [data-field-type="priority"]:has(input[name="${f.field_key}"]) .editor-cycle`).click();
      } else if (f.field_type === 'status' || f.field_type === 'emojis') {
        // Whole set on screen: pick one that is not already current.
        const group = page.locator(`#entity-editor-form [data-field-type="${f.field_type}"]:has(input[name="${f.field_key}"])`);
        await group.locator('.option-choice:not(.selected)').first().click();
      } else if (f.field_type === 'checkbox') {
        await page.locator(`#entity-editor-form input[name="${f.field_key}"]`).click();
      } else if (f.field_type === 'radio') {
        const radios = page.locator(`#entity-editor-form input[type="radio"][name="${f.field_key}"]`);
        await radios.first().check();
      } else {
        const sel = page.locator(`#entity-editor-form select[name="${f.field_key}"]`);
        const opts = await sel.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
        await sel.selectOption(opts[0]);
      }
      await page.waitForTimeout(700);

      const e2 = await editorShows(page, f.field_key, f.field_type);
      const c2 = await cellShows(page, row, f.field_key, f.field_type);
      if (!same(c2, e2, f.field_type)) {
        failures.push(`${f.field_type} EDITOR->CELL: editor="${e2}" cell="${c2}"`);
      }
    }

    expect(failures, `out of sync:\n  ${failures.join('\n  ')}`).toEqual([]);
  } finally {
    await purgeByTitlePrefix(page, TYPE, 'ZZZ');
    if (added.ids) await deleteFields(page, added.ids);
  }
});
