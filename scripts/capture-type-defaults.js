#!/usr/bin/env node

/**
 * Snapshot every entity type's current configuration as the defaults that
 * "Revert to defaults" restores.
 *
 *   node scripts/capture-type-defaults.js            # show what would change
 *   node scripts/capture-type-defaults.js --write    # write the snapshot
 *
 * Writes src/database/typeDefaults.json.
 *
 * Why a captured snapshot rather than the hand-written definitions in
 * systemEntityTypes.js: that file is the SEED, used when creating a type that
 * does not exist yet. It has drifted from what the app is actually configured
 * with - different labels, different field types - and it cannot describe types
 * the user created afterwards at all, because it only knows the system ones.
 * Defaults have to mean "the configuration I want back", which is a property of
 * this installation, not of the repo.
 *
 * The snapshot is committed, so it travels between machines. That is the point:
 * a database rebuilt elsewhere can be brought back to this configuration
 * instead of to whatever the seeder happened to produce.
 *
 * Re-run this whenever the current configuration IS the one worth keeping.
 * It overwrites the previous snapshot, so review the diff before committing.
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { query } from '../src/database/connectionPool.js';

const OUT = 'src/database/typeDefaults.json';

// Columns that describe configuration. Deliberately excludes id, timestamps and
// deleted_at - those are per-database facts, not settings, and restoring an id
// from another machine would be meaningless or actively wrong.
const TYPE_KEYS = [
  'slug', 'label', 'label_singular', 'icon', 'type_category', 'external_source',
  'template_structure', 'supports_hierarchy', 'is_system', 'primary_date_field',
  'order_index', 'is_visible', 'title_order', 'supports_folders',
];

const FIELD_KEYS = [
  'field_key', 'label', 'field_type', 'field_options', 'required',
  'display_order', 'show_in_row', 'is_completion_signal', 'rollup',
  'show_column_label',
];

const pick = (row, keys) => Object.fromEntries(keys.map(k => [k, row[k] ?? null]));

async function main() {
  const write = process.argv.includes('--write');

  const types = await query(
    'SELECT * FROM entity_types WHERE deleted_at IS NULL ORDER BY order_index, id'
  );

  const snapshot = { capturedAt: new Date().toISOString(), types: [] };

  for (const t of types) {
    const fields = await query(
      'SELECT * FROM entity_type_fields WHERE entity_type_id = ? ORDER BY display_order, id',
      [t.id]
    );
    snapshot.types.push({
      ...pick(t, TYPE_KEYS),
      fields: fields.map(f => pick(f, FIELD_KEYS)),
    });
  }

  const json = JSON.stringify(snapshot, null, 2) + '\n';

  console.log(`\nCaptured ${snapshot.types.length} type(s):\n`);
  for (const t of snapshot.types) {
    console.log(`  ${(t.icon || ' ')} ${t.slug.padEnd(18)} ${String(t.fields.length).padStart(2)} field(s)  "${t.label}"`);
  }

  if (existsSync(OUT)) {
    try {
      const prev = JSON.parse(readFileSync(OUT, 'utf8'));
      const before = new Map(prev.types.map(t => [t.slug, t]));
      const changed = snapshot.types.filter(t => {
        const p = before.get(t.slug);
        if (!p) return true;
        return JSON.stringify({ ...p, fields: p.fields }) !== JSON.stringify({ ...t, fields: t.fields });
      });
      const removed = prev.types.filter(p => !snapshot.types.some(t => t.slug === p.slug));
      console.log(`\nAgainst the existing snapshot: ${changed.length} changed/new, ${removed.length} no longer present.`);
      for (const c of changed) console.log(`  changed: ${c.slug}`);
      for (const r of removed) console.log(`  gone:    ${r.slug}`);
    } catch {
      console.log('\nExisting snapshot could not be parsed; it will be replaced.');
    }
  } else {
    console.log('\nNo existing snapshot - this creates one.');
  }

  if (!write) {
    console.log('\nNothing written. Re-run with --write to save the snapshot.');
    process.exit(0);
  }

  writeFileSync(OUT, json);
  console.log(`\nWrote ${OUT}`);
  console.log('Review the diff before committing - this is what Revert restores.');
  process.exit(0);
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
