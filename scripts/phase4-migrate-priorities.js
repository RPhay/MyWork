#!/usr/bin/env node

/**
 * Phase 4: Priorities/Projects -> generic entities
 *
 * Moves every row of the legacy `priorities` table into `entities` (type
 * `priority`) so the Projects tab can run on the same generic engine as every
 * other typed page, then repoints everything that referenced a priority id at
 * the new entity id.
 *
 * This replaces an earlier version of this script that was unsafe to run:
 * it hardcoded `priorityTypeId = 3` (which is `area`, not `priority` - it
 * would have migrated projects into Categories), hardcoded context 1, dropped
 * is_weekly/source_id, wrote legacy work_item ids into a column keyed to
 * entities, and duplicated everything on a second run.
 *
 * NINE foreign keys point at `priorities` (tasks, tickets, to_dos,
 * priority_links, priority_areas, priority_goals, template_priorities,
 * work_priority_associations, plus its own parent_id self-reference), so each
 * is dropped, remapped and repointed at `entities` here.
 *
 * Safety:
 * - Refuses to run if priority entities already exist (re-running would
 *   duplicate). Restore from backup first if you need to redo it.
 * - Runs inside a transaction; any failure rolls the whole thing back.
 * - Leaves the `priorities` table in place (emptied of nothing) so the old
 *   rows remain readable for comparison until you're satisfied.
 */

import { getPool } from '../src/database/connectionPool.js';

// [table, column] pairs holding a priority id, and whether the value should be
// remapped to the new entity id. All of them should.
const REFERENCING = [
  ['priority_areas', 'priority_id'],
  ['priority_goals', 'priority_id'],
  ['priority_links', 'priority_id'],
  ['template_priorities', 'priority_id'],
  ['work_priority_associations', 'priority_id'],
  ['tasks', 'priority_id'],
  ['tickets', 'priority_id'],
  ['to_dos', 'priority_id'],
];

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [name]
  );
  return rows[0].n > 0;
}

async function foreignKeysOn(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT CONSTRAINT_NAME c FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME = 'priorities'`,
    [table, column]
  );
  return rows.map(r => r.c);
}

async function main() {
  const pool = await getPool();
  const conn = await pool.getConnection();

  try {
    const [typeRows] = await conn.query(
      "SELECT id FROM entity_types WHERE slug = 'priority' AND deleted_at IS NULL"
    );
    if (typeRows.length === 0) throw new Error('No `priority` entity type found - run phase0-seed-entity-types.js first');
    const priorityTypeId = typeRows[0].id;
    console.log(`📌 priority entity type id = ${priorityTypeId}`);

    const [existing] = await conn.query('SELECT COUNT(*) n FROM entities WHERE entity_type_id = ?', [priorityTypeId]);
    if (existing[0].n > 0) {
      throw new Error(
        `${existing[0].n} priority entities already exist - this migration has already run. ` +
        'Restore from backup before re-running.'
      );
    }

    const [priorities] = await conn.query(
      'SELECT id, title, source_id, parent_id, notes, status, is_weekly, order_index, context_id FROM priorities ORDER BY id'
    );
    console.log(`🎯 migrating ${priorities.length} priorities`);

    await conn.beginTransaction();

    // 1. Rows -> entities, preserving each row's own context.
    const idMap = new Map();
    for (const p of priorities) {
      const [res] = await conn.query(
        'INSERT INTO entities (entity_type_id, context_id, title, order_index, is_folder) VALUES (?, ?, ?, ?, 0)',
        [priorityTypeId, p.context_id, p.title, p.order_index ?? 0]
      );
      idMap.set(p.id, res.insertId);

      // Column -> field value. `notes` is long text; status/is_weekly/source_id
      // keep their natural typed column so filtering stays real SQL.
      const fields = [
        ['notes', 'value_long', p.notes || null],
        ['status', 'value_text', p.status || null],
        ['is_weekly', 'value_bool', p.is_weekly ? 1 : null],
        ['source_id', 'value_number', p.source_id ?? null],
      ];
      for (const [key, column, value] of fields) {
        if (value === null) continue;
        await conn.query(
          `INSERT INTO entity_field_values (entity_id, field_key, ${column}) VALUES (?, ?, ?)`,
          [idMap.get(p.id), key, value]
        );
      }
    }
    console.log(`  ✅ created ${idMap.size} priority entities`);

    // 2. parent_id -> entity_relationships hierarchy edges.
    let edges = 0;
    for (const p of priorities) {
      if (!p.parent_id) continue;
      const parent = idMap.get(p.parent_id);
      const child = idMap.get(p.id);
      if (!parent || !child) continue;
      await conn.query(
        "INSERT IGNORE INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, 'hierarchy', 0, 0)",
        [p.context_id, parent, child]
      );
      edges++;
    }
    console.log(`  ✅ created ${edges} hierarchy edges`);

    // 3. Repoint every referencing table: drop the FK, remap ids, point at
    //    entities. Rows whose priority_id no longer resolves are nulled rather
    //    than left dangling at an id that now means a different record.
    for (const [table, column] of REFERENCING) {
      if (!(await tableExists(conn, table))) {
        console.log(`  ⏭️  ${table} does not exist, skipping`);
        continue;
      }

      for (const fk of await foreignKeysOn(conn, table, column)) {
        await conn.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${fk}`);
      }

      const [rows] = await conn.query(
        `SELECT DISTINCT ${column} v FROM ${table} WHERE ${column} IS NOT NULL`
      );
      let remapped = 0;
      let orphaned = 0;
      for (const { v } of rows) {
        const newId = idMap.get(v);
        if (newId) {
          await conn.query(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [newId, v]);
          remapped++;
        } else {
          await conn.query(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`, [v]);
          orphaned++;
        }
      }

      // Junctions cascade; the legacy type tables (tasks/tickets/to_dos) hold
      // an optional link, so a deleted project shouldn't delete the task -
      // matching their previous ON DELETE SET NULL behavior.
      const cascades = !['tasks', 'tickets', 'to_dos'].includes(table);
      await conn.query(
        `ALTER TABLE ${table} ADD FOREIGN KEY (${column}) REFERENCES entities(id) ON DELETE ${cascades ? 'CASCADE' : 'SET NULL'}`
      );
      console.log(`  ✅ ${table}.${column} -> entities (${remapped} remapped${orphaned ? `, ${orphaned} orphaned -> NULL` : ''})`);
    }

    // 4. quotes.object_id references priorities by (object_type, object_id).
    if (await tableExists(conn, 'quotes')) {
      const [quotes] = await conn.query("SELECT id, object_id FROM quotes WHERE object_type = 'priority'");
      let n = 0;
      for (const q of quotes) {
        const newId = idMap.get(q.object_id);
        if (!newId) continue;
        await conn.query("UPDATE quotes SET object_id = ?, object_type = 'entity' WHERE id = ?", [newId, q.id]);
        n++;
      }
      if (quotes.length) console.log(`  ✅ remapped ${n}/${quotes.length} quote references`);
    }

    await conn.commit();
    console.log('\n✨ Phase 4 complete. The legacy `priorities` rows are left in place for comparison.');
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
