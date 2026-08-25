#!/usr/bin/env node

/**
 * Phase 10: work_items -> generic entities (Dailies migration, Phase 1)
 *
 * Moves every row of the legacy `work_items` table into `entities` (type
 * `work_item`) so Dailies can eventually run on the same generic engine as
 * every other typed page, then repoints work_entity_associations and
 * work_source_associations - the two junctions that used to reference
 * work_items(id) - at the new entity ids.
 *
 * Unlike the earlier phase migrations, the LEGACY `work_items` table and its
 * `legacy_work_item_id` bridge column on `entities` are deliberately left
 * intact afterward, not cleared: workItemService.js now reads and writes only
 * through entityService, so nothing depends on work_items any more, but it
 * stays as a rollback/comparison reference. Dropping it is a later, separate
 * decision.
 *
 * Safety:
 * - Refuses to run if work_item entities already exist (re-running would
 *   duplicate). Restore from backup first if you need to redo it.
 * - Runs inside a transaction; any failure rolls the whole thing back.
 * - MySQL only, matching every other scripts/phaseN-migrate-*.js - the mysql2
 *   pool API used here (conn.beginTransaction/commit/getConnection) has no
 *   equivalent shape against the `mssql` package. An MSSQL install needs this
 *   migration performed separately; do not assume this script covers it.
 *
 *   node scripts/phase10-migrate-work-items.js
 */

import { getPool } from '../src/database/connectionPool.js';

// [table, legacy value column] pairs whose work_item_id column pointed at the
// legacy work_items table and now points at entities instead.
const REPOINTED_JUNCTIONS = ['work_entity_associations', 'work_source_associations'];

async function foreignKeysOn(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT CONSTRAINT_NAME c FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [table, column]
  );
  return rows.map(r => r.c);
}

async function main() {
  const pool = await getPool();
  const conn = await pool.getConnection();

  try {
    const [typeRows] = await conn.query(
      "SELECT id FROM entity_types WHERE slug = 'work_item' AND deleted_at IS NULL"
    );
    if (typeRows.length === 0) throw new Error('No `work_item` entity type found - run npm run db:init first');
    const workItemTypeId = typeRows[0].id;
    console.log(`📌 work_item entity type id = ${workItemTypeId}`);

    const [existing] = await conn.query('SELECT COUNT(*) n FROM entities WHERE entity_type_id = ?', [workItemTypeId]);
    if (existing[0].n > 0) {
      throw new Error(
        `${existing[0].n} work_item entities already exist - this migration has already run. ` +
        'Restore from backup before re-running.'
      );
    }

    const [workItems] = await conn.query('SELECT * FROM work_items ORDER BY id');
    console.log(`📅 migrating ${workItems.length} work items`);

    await conn.beginTransaction();

    // 1. Rows -> entities, preserving each row's own context and order, and
    //    recording legacy_work_item_id - the bridge column entities has
    //    always had for exactly this.
    const idMap = new Map();
    for (const wi of workItems) {
      const [res] = await conn.query(
        'INSERT INTO entities (entity_type_id, context_id, title, order_index, is_folder, legacy_work_item_id) VALUES (?, ?, ?, ?, 0, ?)',
        [workItemTypeId, wi.context_id, wi.title, wi.order_index ?? 0, wi.id]
      );
      idMap.set(wi.id, res.insertId);

      const fields = [
        ['date', 'value_date', wi.date],
        ['description', 'value_long', wi.description],
        ['notes', 'value_long', wi.notes],
        ['emoji', 'value_text', wi.emoji],
        ['status', 'value_text', wi.status],
        ['time_box_minutes', 'value_number', wi.time_box_minutes],
        ['start_time', 'value_text', wi.start_time],
        // Stored only when true - absence already reads as false through
        // toLegacyShape()'s `!!fields.worked_with_claude`.
        ['worked_with_claude', 'value_bool', wi.worked_with_claude ? 1 : null],
        ['recurring_from_todo_id', 'value_number', wi.recurring_from_todo_id],
        ['recurring_from_task_id', 'value_number', wi.recurring_from_task_id],
      ];
      for (const [key, column, value] of fields) {
        if (value === null || value === undefined) continue;
        await conn.query(
          `INSERT INTO entity_field_values (entity_id, field_key, ${column}) VALUES (?, ?, ?)`,
          [idMap.get(wi.id), key, value]
        );
      }
    }
    console.log(`  ✅ created ${idMap.size} work_item entities`);

    // 2. Repoint work_entity_associations.work_item_id and
    //    work_source_associations.work_item_id from work_items(id) to
    //    entities(id) - drop the old FK, remap values, add the new one.
    for (const table of REPOINTED_JUNCTIONS) {
      for (const fk of await foreignKeysOn(conn, table, 'work_item_id')) {
        // Backtick-quoted: MariaDB gave these purely-numeric constraint names
        // ("1", "2", ...), which is invalid as a bare identifier.
        await conn.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk}\``);
      }

      const [rows] = await conn.query(`SELECT DISTINCT work_item_id v FROM ${table} WHERE work_item_id IS NOT NULL`);
      let remapped = 0;
      let orphaned = 0;
      for (const { v } of rows) {
        const newId = idMap.get(v);
        if (newId) {
          await conn.query(`UPDATE ${table} SET work_item_id = ? WHERE work_item_id = ?`, [newId, v]);
          remapped++;
        } else {
          // A row whose work_item_id doesn't match any migrated work item is
          // orphaned data (the work item was deleted some other way without
          // cleaning up its associations) - remove rather than leave it
          // pointing at nothing, since entities has no row at the old id.
          await conn.query(`DELETE FROM ${table} WHERE work_item_id = ?`, [v]);
          orphaned++;
        }
      }

      await conn.query(
        `ALTER TABLE ${table} ADD FOREIGN KEY (work_item_id) REFERENCES entities(id) ON DELETE CASCADE`
      );
      console.log(`  ✅ ${table}.work_item_id -> entities (${remapped} remapped${orphaned ? `, ${orphaned} orphaned rows removed` : ''})`);
    }

    await conn.commit();
    console.log('\n✨ Phase 10 complete. The legacy `work_items` rows are left in place for comparison.');
    console.log('   Mapping (old -> new):', [...idMap.entries()].map(([o, n]) => `${o}->${n}`).join(', '));
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error('❌ Rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
  }
}

main().then(() => process.exit(process.exitCode || 0));
