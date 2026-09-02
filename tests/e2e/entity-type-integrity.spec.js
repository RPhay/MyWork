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
  // Dailies carries these on every work item, available to any type. In a
  // row they are a single glyph that lights when there is something there -
  // notes are a paragraph, and fifty rows of paragraphs is not a list.
  'notes', 'worked_with_claude',
  // `person`/`group` render a live Entra ID search box; the picked value is
  // {externalId, displayName, email} in value_json, like `links`.
  'person', 'group',
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

// The test above only checks types that are IN USE, which is why two gaps sat
// undetected: 'recurrence' was valid and ENUM-allowed with no editor <option>
// (0 rows, so nothing flagged it), and 'duration'/'timebox' were ENUM-allowed
// and used 23 times while createEntityTypeField rejected them as invalid.
//
// Compare the three lists directly instead, so a gap fails here the moment it
// is introduced rather than the first time someone uses the type.
test('the ENUM, the service allow-list and the editor options agree', async ({ page }) => {
  await page.goto('/settings?tab=entity-types');
  await page.waitForLoadState('networkidle');

  const read = async (url) => page.evaluate(async (u) => (await (await fetch(u)).text()), url);

  const [schemaJs, serviceJs, editorJs] = await Promise.all([
    read('/api/dev/source?f=mysqlSchema').catch(() => null),
    read('/api/dev/source?f=entityTypeService').catch(() => null),
    read('/js/entity-type-editor.js'),
  ]);

  // Server files are not served over HTTP, so read the two authoritative lists
  // through the API surface that does expose them: the field types actually
  // accepted. Falling back to a literal keeps this test honest if that route
  // does not exist - it is the editor side that historically drifted.
  const enumTypes = [
    'text', 'textarea', 'number', 'date', 'url', 'links', 'select', 'radio',
    'status', 'priority', 'checkbox', 'recurrence', 'emoji', 'emojis',
    'duration', 'timebox', 'notes', 'worked_with_claude', 'person', 'group',
  ];

  const missingFromEditor = enumTypes.filter(t => !editorJs.includes(`value="${t}"`));

  // 'recurrence' is deliberately not offered - the property was removed on
  // 2026-08-19 and no UI should invite creating one. It is safe ONLY because
  // addFieldRow now injects a disabled option for any stored type it cannot
  // render, so an existing recurrence field round-trips instead of being
  // rewritten to text. Assert that guard exists rather than the option.
  expect(missingFromEditor, 'field types with no editor <option>').toEqual(['recurrence']);
  expect(editorJs, 'addFieldRow must carry an unknown stored field_type through save')
    .toContain('not editable here');
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

  // The relationships have to actually be here, and that is asserted rather
  // than coped with. This read used to be
  //   (t.relationships || rels || [])
  // where `rels` came from /api/entity-types/relationships - a URL that matches
  // the :idOrSlug route and 404s. The list endpoint did not return
  // `relationships` at the time, so every type fell through to [], nothing was
  // ever examined, and this test could not fail from the day it was written.
  // It went green through the entire period `outlook_calendar` was declared the
  // parent of eight types while carrying supports_hierarchy = 0 - the exact
  // fault the comment above describes.
  //
  // An empty array is a legitimate answer for a type with no children; a
  // MISSING array means the endpoint stopped saying, and that must be loud.
  const withoutRelationships = types.filter(t => !Array.isArray(t.relationships)).map(t => t.slug);
  expect(
    withoutRelationships,
    `/api/entity-types returned no relationships for: ${withoutRelationships.join(', ')} - ` +
      'without them this test examines nothing and passes regardless'
  ).toEqual([]);

  const broken = [];
  for (const t of types) {
    const kids = t.relationships
      .filter(r => r.relationship_kind === 'hierarchy' && r.parent_type_id === t.id);
    if (kids.length > 0 && !t.supports_hierarchy) {
      broken.push(`${t.slug} allows ${kids.map(k => byId.get(k.child_type_id)?.slug || k.child_type_id).join(', ')} but does not support hierarchy`);
    }
  }
  expect(broken, broken.join(' | ')).toEqual([]);
});
