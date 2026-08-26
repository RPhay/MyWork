/**
 * Move rows from the legacy tables into `entities`, on EITHER engine.
 *
 * Every scripts/phaseN-migrate-*.js is MySQL-only and says so - they use the
 * mysql2 pool's own transaction API, which the `mssql` package does not
 * mirror. An MSSQL install therefore never had its rows moved, and since every
 * service now reads `entities`, those records are in the database and invisible
 * in the app. That is not a stale copy to be dropped; it is data.
 *
 * "Drop Retired Tables" refuses such a table, which is how this came to light:
 *   MyWork.work_items - 29 row(s) have no matching entity
 *
 * This script exists to make that refusal go away honestly, by migrating the
 * rows rather than by destroying them.
 *
 * HOW IT DIFFERS from the phase scripts, deliberately:
 *
 *  - It goes through connectionPool's `query`, which both engines share, so it
 *    runs unchanged on MySQL and SQL Server.
 *  - It DISCOVERS each legacy table's columns from INFORMATION_SCHEMA instead
 *    of hardcoding them. A column list written here would be a guess about a
 *    database this machine cannot see.
 *  - It matches every column against the target type's FIELD KEYS, so it
 *    carries what the type can hold and reports what it cannot, rather than
 *    silently dropping it.
 *  - It skips a row that already has an entity of that type with the same
 *    title - the same test "Drop Retired Tables" applies - so running it twice
 *    does not duplicate.
 *
 * DRY RUN BY DEFAULT. It prints what it would do and writes nothing:
 *
 *   node scripts/migrate-legacy-to-entities.js
 *   node scripts/migrate-legacy-to-entities.js --apply
 *
 * Back the database up before --apply. There is no undo.
 */
import { query, getCurrentConfig } from '../src/database/connectionPool.js';
import * as entityTypeService from '../src/services/entityTypeService.js';

const APPLY = process.argv.includes('--apply');
const isMssql = () => getCurrentConfig().type === 'mssql';
const q = (t) => (isMssql() ? `[MyWork].[${t}]` : `\`${t}\``);

// Which legacy table becomes which type. Order matters only for readability -
// nothing here depends on another table having gone first.
const TABLES = [
  { table: 'work_items', slug: 'daily' },
  { table: 'priorities', slug: 'priority' },
  { table: 'tasks', slug: 'task' },
  { table: 'to_dos', slug: 'to_do' },
];

// Columns that are never field values: identity, bookkeeping, and the ones the
// entity row itself carries.
const NOT_FIELDS = new Set([
  'id', 'context_id', 'title', 'order_index', 'created_at', 'updated_at',
  'parent_id', 'folder_id', 'source_id',
]);

// A legacy column whose name changed on the way to being a field.
const RENAMED = {
  time_box_minutes: 'time_box',   // Dailies converged on the shared ladder
};

/** The entity_field_values column a value belongs in, by the field's type. */
function columnFor(fieldType) {
  switch (fieldType) {
    case 'number': case 'duration': case 'timebox': return 'value_number';
    case 'date': return 'value_date';
    case 'checkbox': case 'worked_with_claude': return 'value_bool';
    case 'textarea': case 'notes': case 'links': return 'value_long';
    case 'select': case 'radio': case 'status': case 'priority':
    case 'text': case 'url': case 'emoji': case 'emojis': return 'value_text';
    default: return 'value_text';
  }
}

async function tableExists(table) {
  const rows = await query(
    isMssql()
      ? "SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'MyWork' AND TABLE_NAME = ?"
      : 'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table],
  );
  return Number(rows[0]?.n || 0) > 0;
}

async function columnsOf(table) {
  const rows = await query(
    isMssql()
      ? "SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'MyWork' AND TABLE_NAME = ?"
      : 'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table],
  );
  return rows.map((r) => r.name || r.COLUMN_NAME);
}

async function migrateTable({ table, slug }) {
  if (!(await tableExists(table))) {
    console.log(`\n${table}: not present - nothing to do`);
    return { migrated: 0, skipped: 0, unmapped: [] };
  }

  const type = await entityTypeService.getEntityType(slug).catch(() => null);
  if (!type) {
    console.log(`\n${table}: no \`${slug}\` type in this database - SKIPPED`);
    return { migrated: 0, skipped: 0, unmapped: [] };
  }

  const fields = await entityTypeService.getEntityTypeFields(type.id);
  const fieldByKey = new Map(fields.map((f) => [f.field_key, f]));
  const columns = await columnsOf(table);
  const rows = await query(`SELECT * FROM ${q(table)}`);

  const mapped = [];
  const unmapped = [];
  for (const col of columns) {
    if (NOT_FIELDS.has(col)) continue;
    const key = RENAMED[col] || col;
    if (fieldByKey.has(key)) mapped.push([col, key]);
    else unmapped.push(col);
  }

  console.log(`\n${table} -> ${slug}: ${rows.length} row(s)`);
  console.log(`  carried:  ${mapped.map(([c, k]) => (c === k ? c : `${c}->${k}`)).join(', ') || '(only the title)'}`);
  if (unmapped.length) {
    console.log(`  NOT carried (no such field on \`${slug}\`): ${unmapped.join(', ')}`);
  }

  let migrated = 0;
  let skipped = 0;
  for (const row of rows) {
    // The same test "Drop Retired Tables" uses, so migrating makes that button
    // stop refusing - and so a second run is a no-op rather than a duplicate.
    const dup = await query(
      `SELECT COUNT(*) AS n FROM ${q('entities')} e
         JOIN ${q('entity_types')} t ON t.id = e.entity_type_id
        WHERE t.slug = ? AND e.title = ?`,
      [slug, row.title],
    );
    if (Number(dup[0]?.n || 0) > 0) { skipped += 1; continue; }

    if (!APPLY) { migrated += 1; continue; }

    await query(
      `INSERT INTO ${q('entities')} (entity_type_id, context_id, title, order_index, is_folder)
       VALUES (?, ?, ?, ?, 0)`,
      [type.id, row.context_id ?? 1, row.title, row.order_index ?? 0],
    );
    const [{ id: entityId }] = await query(
      `SELECT MAX(id) AS id FROM ${q('entities')} WHERE entity_type_id = ? AND title = ?`,
      [type.id, row.title],
    );

    for (const [col, key] of mapped) {
      const value = row[col];
      if (value === null || value === undefined || value === '') continue;
      const column = columnFor(fieldByKey.get(key).field_type);
      const stored = column === 'value_bool' ? (value ? 1 : 0) : value;
      await query(
        `INSERT INTO ${q('entity_field_values')} (entity_id, field_key, ${column}) VALUES (?, ?, ?)`,
        [entityId, key, stored],
      );
    }
    migrated += 1;
  }

  console.log(`  ${APPLY ? 'migrated' : 'WOULD migrate'}: ${migrated}   already present: ${skipped}`);
  return { migrated, skipped, unmapped };
}

async function main() {
  console.log(`Legacy -> entities migration  (${getCurrentConfig().type || 'mysql'})`);
  console.log(APPLY
    ? '*** APPLYING - this writes to the database. Back it up first. ***'
    : 'DRY RUN - nothing will be written. Re-run with --apply to do it.');

  let total = 0;
  for (const spec of TABLES) {
    const r = await migrateTable(spec);
    total += r.migrated;
  }

  console.log(`\n${APPLY ? 'Migrated' : 'Would migrate'} ${total} row(s) in total.`);
  if (!APPLY && total > 0) {
    console.log('Re-run with --apply once the numbers above look right.');
  }
  if (APPLY && total > 0) {
    console.log('Check the app, then use Settings -> Drop Retired Tables: it will '
      + 'only offer a table once every row in it has a matching entity.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
