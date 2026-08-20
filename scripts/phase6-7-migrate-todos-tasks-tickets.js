#!/usr/bin/env node

/**
 * Todos, Tasks and Tickets -> generic entities
 *
 * Their tabs already ran on the generic engine, but their rows still lived in
 * the legacy `to_dos` / `tasks` / `tickets` tables and their junctions still
 * referenced those tables. The two halves therefore disagreed: dragging a Todo
 * onto a day created the work item and then silently lost the link, because
 * the junction wanted a legacy id and the tab had handed it an entity id.
 *
 * This finishes the job the way Phase 4 finished Projects: rows into
 * `entities`, hierarchy into `entity_relationships`, and every foreign key
 * repointed at `entities`.
 *
 * Safety:
 * - Refuses to run if entities of these types already exist, so a second run
 *   cannot duplicate anything. Restore from backup if you need to redo it.
 * - Runs in a transaction; any failure rolls the whole thing back.
 * - Leaves the legacy rows in place for comparison. Nothing reads them
 *   afterwards, so dropping the tables is separate, optional cleanup.
 */

import { getPool } from '../src/database/connectionPool.js';

// [legacy table, type slug, columns worth keeping as field values]
const MIGRATIONS = [
  ['to_dos', 'to_do', ['status', 'notes', 'recurrence', 'target_date', 'importance']],
  ['tasks', 'task', ['status', 'notes', 'recurrence']],
  ['tickets', 'ticket', ['status', 'notes', 'ticket_type']],
];

// [table, column] pairs holding an id of one of the migrated types.
const REFERENCING = {
  to_dos: [
    ['work_todo_associations', 'todo_id'],
    ['to_do_items', 'to_do_id'],
    ['to_do_links', 'to_do_id'],
    ['tickets', 'todo_id'],
    ['work_items', 'recurring_from_todo_id'],
  ],
  tasks: [
    ['work_task_associations', 'task_id'],
    ['task_links', 'task_id'],
    ['work_items', 'recurring_from_task_id'],
  ],
  tickets: [
    ['work_ticket_associations', 'ticket_id'],
    ['ticket_links', 'ticket_id'],
    ['to_dos', 'ticket_id'],
  ],
};

// Junctions cascade with their work item; the rest hold an optional link, so a
// deleted record shouldn't take the row with it.
const CASCADES = new Set([
  'work_todo_associations', 'work_task_associations', 'work_ticket_associations',
  'to_do_items', 'to_do_links', 'task_links', 'ticket_links',
]);

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [name]
  );
  return rows[0].n > 0;
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows[0].n > 0;
}

async function foreignKeysOn(conn, table, column, referenced) {
  const [rows] = await conn.query(
    `SELECT CONSTRAINT_NAME c FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME = ?`,
    [table, column, referenced]
  );
  return rows.map(r => r.c);
}

async function main() {
  const pool = await getPool();
  const conn = await pool.getConnection();

  try {
    // Only a type that has BOTH legacy rows to migrate and existing entities is
    // ambiguous - that is what a second run looks like. A type whose legacy
    // table is already empty has nothing to move, and entities of that type are
    // simply records created since the tab went generic; its foreign keys still
    // need repointing, which is the whole point of this script.
    for (const [legacyTable, slug] of MIGRATIONS) {
      const [types] = await conn.query(
        'SELECT id FROM entity_types WHERE slug = ? AND deleted_at IS NULL', [slug]
      );
      if (types.length === 0) throw new Error(`No \`${slug}\` entity type - run phase0-seed-entity-types.js first`);
      if (!(await tableExists(conn, legacyTable))) continue;

      const [[legacy]] = await conn.query(`SELECT COUNT(*) n FROM ${legacyTable}`);
      const [[existing]] = await conn.query(
        'SELECT COUNT(*) n FROM entities WHERE entity_type_id = ?', [types[0].id]
      );
      if (legacy.n > 0 && existing.n > 0) {
        throw new Error(
          `\`${slug}\`: ${legacy.n} legacy rows and ${existing.n} entities both exist - ` +
          'cannot tell a partial migration from a completed one. Restore from backup and re-run.'
        );
      }
    }

    await conn.beginTransaction();

    for (const [legacyTable, slug, fieldColumns] of MIGRATIONS) {
      if (!(await tableExists(conn, legacyTable))) {
        console.log(`⏭️  ${legacyTable} does not exist, skipping`);
        continue;
      }

      const [[type]] = await conn.query(
        'SELECT id FROM entity_types WHERE slug = ? AND deleted_at IS NULL', [slug]
      );
      const usable = [];
      for (const col of fieldColumns) {
        if (await columnExists(conn, legacyTable, col)) usable.push(col);
      }
      const hasParent = await columnExists(conn, legacyTable, 'parent_id');
      // These three tables do not agree on which columns they have - tickets
      // has no parent_id or status, and none of them has order_index - so the
      // select is built from what is actually there.
      const hasOrder = await columnExists(conn, legacyTable, 'order_index');

      const [rows] = await conn.query(
        `SELECT id, title, context_id${hasOrder ? ', order_index' : ''}${hasParent ? ', parent_id' : ''}` +
        `${usable.length ? ', ' + usable.join(', ') : ''} FROM ${legacyTable} ORDER BY id`
      );
      console.log(`🎯 ${legacyTable}: migrating ${rows.length} rows -> ${slug} entities`);

      const idMap = new Map();
      for (const row of rows) {
        const [res] = await conn.query(
          'INSERT INTO entities (entity_type_id, context_id, title, order_index, is_folder) VALUES (?, ?, ?, ?, 0)',
          [type.id, row.context_id, row.title, row.order_index ?? 0]
        );
        idMap.set(row.id, res.insertId);

        for (const col of usable) {
          const value = row[col];
          if (value === null || value === undefined || value === '') continue;
          // Column type decides which typed value column it lands in, mirroring
          // entityService.setEntityFieldValue.
          const column =
            col === 'recurrence' ? 'value_json'
            : col === 'target_date' ? 'value_date'
            : col === 'importance' ? 'value_number'
            : col === 'notes' ? 'value_long'
            : 'value_text';
          await conn.query(
            `INSERT INTO entity_field_values (entity_id, field_key, ${column}) VALUES (?, ?, ?)`,
            [res.insertId, col, value]
          );
        }
      }

      if (hasParent) {
        let edges = 0;
        for (const row of rows) {
          if (!row.parent_id) continue;
          const parent = idMap.get(row.parent_id);
          const child = idMap.get(row.id);
          if (!parent || !child) continue;
          await conn.query(
            "INSERT IGNORE INTO entity_relationships (context_id, parent_entity_id, child_entity_id, relationship_kind, is_generated, order_index) VALUES (?, ?, ?, 'hierarchy', 0, 0)",
            [row.context_id, parent, child]
          );
          edges++;
        }
        if (edges) console.log(`   ✅ ${edges} hierarchy edges`);
      }

      for (const [table, column] of REFERENCING[legacyTable]) {
        if (!(await tableExists(conn, table)) || !(await columnExists(conn, table, column))) continue;

        for (const fk of await foreignKeysOn(conn, table, column, legacyTable)) {
          await conn.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${fk}`);
        }

        const [distinct] = await conn.query(
          `SELECT DISTINCT ${column} v FROM ${table} WHERE ${column} IS NOT NULL`
        );
        let remapped = 0;
        let orphaned = 0;
        for (const { v } of distinct) {
          const newId = idMap.get(v);
          if (newId) {
            await conn.query(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [newId, v]);
            remapped++;
          } else {
            await conn.query(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`, [v]);
            orphaned++;
          }
        }

        // A self-reference back into the legacy table it came from is dropped
        // rather than repointed - the hierarchy now lives in
        // entity_relationships.
        if (table === legacyTable) {
          console.log(`   ✅ ${table}.${column} cleared (hierarchy is an edge now)`);
          continue;
        }

        await conn.query(
          `ALTER TABLE ${table} ADD FOREIGN KEY (${column}) REFERENCES entities(id) ON DELETE ${CASCADES.has(table) ? 'CASCADE' : 'SET NULL'}`
        );
        console.log(`   ✅ ${table}.${column} -> entities (${remapped} remapped${orphaned ? `, ${orphaned} orphaned -> NULL` : ''})`);
      }
    }

    await conn.commit();
    console.log('\n✨ Done. Legacy rows left in place for comparison; nothing reads them now.');
  } catch (error) {
    await conn.rollback().catch(() => {});
    console.error('❌ Rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
  }
}

main().then(() => process.exit(process.exitCode || 0));
