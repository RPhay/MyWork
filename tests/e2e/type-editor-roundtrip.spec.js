import { test, expect } from '@playwright/test';

/**
 * Opening a type and pressing Save must change NOTHING.
 *
 * The save path rebuilds a whole type from the inputs on screen, and it has
 * corrupted data twice doing it: it destroyed the status roles (`doneValues`
 * became `['Ignored']`, so every folder roll-up was wrong), and it left
 * `supports_hierarchy = 0` on the template type while the seed said true, so
 * templates silently never nested. Both were found from the damage, after the
 * fact.
 *
 * Anything the form cannot render is at risk the same way - a field type with
 * no <option>, a flag with no checkbox, a property the form never reads. The
 * check that catches ALL of those at once, including the ones nobody has
 * thought of, is a round trip: snapshot the type, save it untouched, snapshot
 * again, and require the two to be identical.
 *
 * This is deliberately run against every seeded type rather than a fixture,
 * because the corruptions that happened were on real types with real
 * configuration - Ideas has its own status vocabulary, Templates has no focus
 * block, Dailies is not editable in the same way.
 */

async function api(page, url, opts = {}) {
  return page.evaluate(async ([u, o]) => {
    const r = await fetch(u, {
      ...o,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.body.dataset.csrfToken || '' },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [url, opts]);
}

/** Everything about a type that a save could plausibly damage. */
function snapshot(type) {
  const parse = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
    return v;
  };
  return {
    slug: type.slug,
    label: type.label,
    label_singular: type.label_singular,
    icon: type.icon,
    supports_hierarchy: Number(type.supports_hierarchy ?? 0),
    supports_folders: Number(type.supports_folders ?? 0),
    type_category: type.type_category,
    primary_date_field: type.primary_date_field ?? null,
    title_order: type.title_order ?? null,
    fields: (type.fields || [])
      .slice()
      .sort((a, b) => a.field_key.localeCompare(b.field_key))
      .map((f) => ({
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        required: Number(f.required ?? 0),
        show_in_row: Number(f.show_in_row ?? 0),
        show_column_label: Number(f.show_column_label ?? 0),
        is_completion_signal: Number(f.is_completion_signal ?? 0),
        rollup: f.rollup ?? null,
        field_options: parse(f.field_options),
      })),
  };
}

const TYPES = ['category', 'goal', 'to_do', 'task', 'ticket', 'idea', 'priority', 'template'];

for (const slug of TYPES) {
  test(`saving ${slug} untouched changes nothing`, async ({ page }) => {
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto('/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);

    const before = snapshot((await api(page, `/api/entity-types/${slug}`)).body.data);

    // Open it in the editor by clicking its row, exactly as a person would.
    // Every slug in TYPES is a built-in (system) type except 'template',
    // which is read-only and lives in a different list - the row lookup
    // finding nothing there is what makes this test.skip fire for it, same
    // as before Built-in/Custom were split out of one "Editable Types" list.
    const row = page.locator('#builtInTypesList .type-list-item')
      .filter({ hasText: before.label }).first();
    if (await row.count() === 0) test.skip(true, `${slug} is not listed as editable`);
    await row.click();
    await page.waitForTimeout(1200);
    await expect(page.locator('#entityTypeForm')).toBeVisible();

    // Save without touching anything.
    await page.locator('#entityTypeSaveBtn').click();
    await page.waitForTimeout(1800);

    const after = snapshot((await api(page, `/api/entity-types/${slug}`)).body.data);

    // Report the whole difference at once - a save that damages a type usually
    // damages several things, and one assertion per property hides the rest.
    const diffs = [];
    for (const k of Object.keys(before)) {
      if (k === 'fields') continue;
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        diffs.push(`${k}: ${JSON.stringify(before[k])} -> ${JSON.stringify(after[k])}`);
      }
    }
    const keysBefore = before.fields.map((f) => f.field_key);
    const keysAfter = after.fields.map((f) => f.field_key);
    for (const k of keysBefore) if (!keysAfter.includes(k)) diffs.push(`field LOST: ${k}`);
    for (const k of keysAfter) if (!keysBefore.includes(k)) diffs.push(`field ADDED: ${k}`);
    for (const f of before.fields) {
      const g = after.fields.find((x) => x.field_key === f.field_key);
      if (!g) continue;
      for (const k of Object.keys(f)) {
        if (JSON.stringify(f[k]) !== JSON.stringify(g[k])) {
          diffs.push(`${f.field_key}.${k}: ${JSON.stringify(f[k])} -> ${JSON.stringify(g[k])}`);
        }
      }
    }

    if (diffs.length) console.log(`DIFFS ${slug}\n  ` + diffs.join('\n  '));
    expect(diffs, `saving ${slug} untouched must change nothing`).toEqual([]);
    expect(errs, 'no page errors while saving').toEqual([]);
  });
}

// The round trips above only exercise the field types those eight happen to
// use. The corruption that actually happened was a field type the form could
// not render - `status` and `recurrence` had no <option>, so saving rewrote
// them to `text` and dropped what it could not draw.
//
// So: put ONE field of every type the editor offers on a single type, save it
// untouched, and require all of them back unchanged. `recurrence` is left out
// on purpose - it is a permitted ENUM value with no <option> because the
// feature was withdrawn (CLAUDE.md), and nothing uses it.
const EVERY_FIELD_TYPE = [
  'text', 'textarea', 'number', 'date', 'url', 'links', 'select', 'radio',
  'status', 'priority', 'checkbox', 'emoji', 'emojis', 'duration', 'timebox',
  'notes', 'worked_with_claude',
];

test('a type carrying every renderable field type survives a save', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const type = (await api(page, '/api/entity-types/tests')).body?.data;
  test.skip(!type, 'the `tests` fixture type is not present');

  const made = [];
  try {
    for (const ft of EVERY_FIELD_TYPE) {
      const body = { field_key: `zzz_rt_${ft}`, label: `ZZZ rt ${ft}`, field_type: ft, show_in_row: 1 };
      if (['select', 'radio', 'status'].includes(ft)) body.field_options = { values: ['One', 'Two', 'Complete'] };
      if (ft === 'emoji' || ft === 'emojis') body.field_options = { values: ['🔴', '🟡', '🟢'] };
      const res = await api(page, `/api/entity-types/${type.id}/fields`, {
        method: 'POST', body: JSON.stringify(body),
      });
      expect(res.status, `${ft} must be an accepted field type`).toBeLessThan(400);
      made.push(res.body.data.id);
    }

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);

    const before = snapshot((await api(page, '/api/entity-types/tests')).body.data);

    // The 'tests' fixture is user-created (ensureEntityType posts to
    // /api/entity-types with no is_system flag), so it lives in Custom Types.
    const row = page.locator('#customTypesList .type-list-item').filter({ hasText: before.label }).first();
    await row.click();
    await page.waitForTimeout(1400);
    await expect(page.locator('#entityTypeForm')).toBeVisible();
    await page.locator('#entityTypeSaveBtn').click();
    await page.waitForTimeout(2200);

    const after = snapshot((await api(page, '/api/entity-types/tests')).body.data);

    // A save is allowed to FILL IN what a status field is missing, and only
    // that. A status with no roll-up mode leaves every folder of its type
    // blank, and one with no doneValues cannot say what "finished" means, so
    // the save path defaults both - preferring any existing roles, never
    // replacing them (entity-type-editor.js, the `keep(prev...)` branches).
    //
    // Filling an absent value is repair. Changing one that was already set is
    // the corruption this file exists to catch, so that still fails.
    const filledFromNothing = (fkey, key, was, now) => {
      const f = before.fields.find((x) => x.field_key === fkey);
      if (!f || f.field_type !== 'status') return false;
      if (key === 'rollup') return was === null && now === 'status';
      if (key === 'field_options') {
        const a = was || {}; const b = now || {};
        const sameValues = JSON.stringify(a.values) === JSON.stringify(b.values);
        const onlyGained = !a.doneValues && Array.isArray(b.doneValues);
        return sameValues && onlyGained;
      }
      return false;
    };

    const diffs = [];
    for (const f of before.fields) {
      const g = after.fields.find((x) => x.field_key === f.field_key);
      if (!g) { diffs.push(`field LOST: ${f.field_key} (${f.field_type})`); continue; }
      for (const k of Object.keys(f)) {
        if (JSON.stringify(f[k]) === JSON.stringify(g[k])) continue;
        if (filledFromNothing(f.field_key, k, f[k], g[k])) continue;
        diffs.push(`${f.field_key}.${k}: ${JSON.stringify(f[k])} -> ${JSON.stringify(g[k])}`);
      }
    }
    if (diffs.length) console.log('DIFFS every-field-type\n  ' + diffs.join('\n  '));
    expect(diffs, 'every field type must survive a save untouched').toEqual([]);
    expect(errs, 'no page errors while saving').toEqual([]);
  } finally {
    for (const id of made) {
      await api(page, `/api/entity-types/fields/${id}`, { method: 'DELETE' });
    }
  }
});
