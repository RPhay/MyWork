import { test, expect } from '@playwright/test';

/**
 * Guards the type registry against the drift that silently broke it before:
 * a field type that exists in the database but has no renderer, no <option> in
 * the Settings editor, or no place in the MySQL ENUM. Any of those makes the
 * field half-exist - it saves but renders as a text box, or it corrupts on the
 * next save because the editor's <select> falls back to its first option.
 */

const RENDERED_TYPES = [
  'text', 'textarea', 'number', 'date', 'url', 'links',
  'select', 'radio', 'checkbox', 'status', 'recurrence',
  // `priority` renders the priority meter (genericEntity.js). It was missing
  // from this list while being seeded 8 times, so the test reported it as
  // "not a known renderer" when the renderer was there all along.
  'priority',
  // `timebox` is how long something is MEANT to take - an icon you click to
  // cycle, None included.
  'timebox',
  // `duration` is Worked Time: seconds stored, "1h 30m" shown.
  'duration',
  // `emoji` is a free pick; `emojis` cycles through a set declared on the field.
  'emoji', 'emojis',
];

test('every field type in use is renderable, editable and valid', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  await page.waitForLoadState('networkidle');

  const types = await page.evaluate(async () => (await (await fetch('/api/entity-types')).json()).data);
  const rendererJs = await page.evaluate(async () => (await (await fetch('/js/genericEntity.js')).text()));
  const editorJs = await page.evaluate(async () => (await (await fetch('/js/entity-type-editor.js')).text()));

  const inUse = new Set();
  for (const t of types) for (const f of t.fields || []) inUse.add(f.field_type);

  for (const fieldType of inUse) {
    expect(RENDERED_TYPES, `field type "${fieldType}" is used by a type but is not a known renderer`).toContain(fieldType);
    expect(rendererJs, `genericEntity.js has no renderer for "${fieldType}"`).toMatch(new RegExp(`\\n\\s*${fieldType}:`));
    expect(editorJs, `the type editor has no <option> for "${fieldType}"`).toContain(`value="${fieldType}"`);
  }

});

test('no type lost its status field to the editor bug', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  const types = await page.evaluate(async () => (await (await fetch('/api/entity-types')).json()).data);

  for (const t of types) {
    const status = (t.fields || []).find(f => f.field_key === 'status');
    if (!status) continue;
    // A field keyed `status` that is typed `text` is the signature of the
    // option-less <select> having rewritten it on save.
    expect(status.field_type, `${t.slug}.status was downgraded to ${status.field_type}`).toBe('status');
    expect(status.field_options, `${t.slug}.status lost its value list`).toBeTruthy();
  }
});

test('every hierarchical type can actually nest under itself', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  const types = await page.evaluate(async () => (await (await fetch('/api/entity-types')).json()).data);

  for (const t of types.filter(x => x.supports_hierarchy && x.type_category === 'editable')) {
    const schema = await page.evaluate(async (slug) =>
      (await (await fetch(`/api/entity-types/${slug}`)).json()).data, t.slug);
    const selfNest = (schema.relationships || []).some(r =>
      r.relationship_kind === 'hierarchy' && r.parent_type_id === schema.id && r.child_type_id === schema.id);
    // Without this rule the tree renders but every drag-to-nest is rejected,
    // and the context menu's "New ... inside" would create orphans.
    expect(selfNest, `${t.slug} claims supports_hierarchy but has no ${t.slug}->${t.slug} hierarchy rule`).toBe(true);
  }
});


// A type that declares children must be able to HOLD them. Templates shipped
// with eight allowed child types and `supports_hierarchy` false, and the
// contradiction was invisible: the renderer silently took its flat branch, the
// client never fetched the edges, and rows dropped into a template arrived with
// their trees stripped off.
test('a type that allows children supports hierarchy', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  await page.waitForLoadState('networkidle');
  const types = await page.evaluate(async () => (await (await fetch('/api/entity-types')).json()).data);
  const byId = new Map(types.map(t => [t.id, t]));

  const rels = await page.evaluate(async () => (await (await fetch('/api/entity-types/relationships')).json()).data)
    .catch(() => null);

  const broken = [];
  for (const t of types) {
    const kids = (t.relationships || rels || [])
      .filter(r => r.relationship_kind === 'hierarchy' && r.parent_type_id === t.id);
    if (kids.length > 0 && !t.supports_hierarchy) {
      broken.push(`${t.slug} allows ${kids.map(k => byId.get(k.child_type_id)?.slug || k.child_type_id).join(', ')} but does not support hierarchy`);
    }
  }
  expect(broken, broken.join(' | ')).toEqual([]);
});
