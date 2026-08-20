#!/usr/bin/env node

/**
 * Retire the seven per-type work_*_associations junctions.
 *
 * Audit 07 rewrote workItemService to derive every typed list a day exposes
 * (priorities, goals, areas, todos...) from ONE junction, work_entity_
 * associations, and removed the seven per-type tables from both schema files.
 * What it did not do was move the rows. On MySQL that left 20 links sitting in
 * tables nothing read any more: present in the database, invisible in the app,
 * erroring nowhere.
 *
 * This script is the missing half, written to be run against either engine
 * because the two databases are separate and drift independently - MySQL is
 * shared by the development machines, MSSQL is the work machine.
 *
 *   node scripts/migrate-work-junctions.js            # report only
 *   node scripts/migrate-work-junctions.js --migrate  # copy the rows
 *   node scripts/migrate-work-junctions.js --migrate --drop
 *
 * Safe to run on a database that has nothing to do: it reports and exits.
 *
 * Why this is a copy and not an id mapping: the right-hand column of each
 * junction ALREADY holds an entities.id. The tables were converted to the
 * legacy<->entity bridge before they were retired, so `todo_id` names a column
 * that points at `entities`, not at `to_dos`. Reading them as legacy ids finds
 * nothing and looks like total data loss - it is not, the column is just
 * misnamed for its history.
 */

import { query, getCurrentConfig } from '../src/database/connectionPool.js';

// junction -> the column holding the entity id
const RETIRED = [
  ['work_area_associations', 'area_id'],
  ['work_goal_associations', 'goal_id'],
  ['work_idea_associations', 'idea_id'],
  ['work_priority_associations', 'priority_id'],
  ['work_todo_associations', 'todo_id'],
  ['work_task_associations', 'task_id'],
  ['work_ticket_associations', 'ticket_id'],
];

// NOT retired, and not to be touched: a source is not an entity, so its link
// cannot live in work_entity_associations, whose FK is to `entities`.
const KEEP = 'work_source_associations';

const isMssql = () => getCurrentConfig().type === 'mssql';

const quote = (name) => isMssql()
  ? `[${name.replace(/]/g, ']]')}]`
  : `\`${name.replace(/`/g, '``')}\``;

async function tableExists(name) {
  const sql = isMssql()
    ? `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?`
    : `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`;
  const rows = await query(sql, [name]);
  return rows.length > 0;
}

async function countRows(name) {
  const rows = await query(`SELECT COUNT(*) AS c FROM ${quote(name)}`);
  return Number(rows[0].c ?? rows[0].C ?? 0);
}

async function main() {
  const migrate = process.argv.includes('--migrate');
  const drop = process.argv.includes('--drop');

  const cfg = getCurrentConfig();
  console.log(`\nDatabase: ${cfg.database} on ${cfg.host} (${cfg.type})`);
  console.log(migrate ? (drop ? 'Mode: migrate + drop\n' : 'Mode: migrate\n') : 'Mode: report only\n');

  if (!await tableExists('work_entity_associations')) {
    console.log('work_entity_associations does not exist - the schema is older than');
    console.log('the change this migrates to. Update the schema first (Settings ->');
    console.log('Database Configuration), then run this again.');
    process.exit(1);
  }

  // Survey before touching anything.
  const present = [];
  for (const [table, column] of RETIRED) {
    if (!await tableExists(table)) continue;
    present.push({ table, column, rows: await countRows(table) });
  }

  const before = await countRows('work_entity_associations');
  console.log(`work_entity_associations currently holds ${before} row(s).`);

  if (present.length === 0) {
    console.log('\nNone of the seven retired junctions exist here. Nothing to do.');
    process.exit(0);
  }

  console.log('\nRetired junctions still present:');
  for (const p of present) console.log(`  ${String(p.rows).padStart(6)}  ${p.table}`);

  const total = present.reduce((n, p) => n + p.rows, 0);
  if (total === 0) {
    console.log('\nAll empty - nothing to migrate.');
  }

  if (!migrate) {
    console.log('\nReport only. Re-run with --migrate to copy these rows across,');
    console.log('and --drop as well to remove the tables once the copy succeeds.');
    process.exit(0);
  }

  // Copy. Each row is checked against both parents first: a link whose entity
  // or work item has since been deleted would fail the foreign key and abort
  // the run, and it describes nothing worth keeping anyway.
  let moved = 0, dangling = 0;
  for (const { table, column } of present) {
    const rows = await query(
      `SELECT work_item_id, ${column} AS entity_id FROM ${quote(table)}`
    );
    for (const r of rows) {
      const [e] = await query('SELECT id FROM entities WHERE id = ?', [r.entity_id]);
      const [w] = await query('SELECT id FROM work_items WHERE id = ?', [r.work_item_id]);
      if (!e || !w) { dangling++; continue; }

      // INSERT IGNORE has no T-SQL equivalent; connectionPool's translation
      // layer rewrites it, but a NOT EXISTS guard is clearer here and works
      // identically on both engines.
      await query(
        `INSERT INTO work_entity_associations (work_item_id, entity_id)
         SELECT ?, ? WHERE NOT EXISTS (
           SELECT 1 FROM work_entity_associations WHERE work_item_id = ? AND entity_id = ?
         )`,
        [r.work_item_id, r.entity_id, r.work_item_id, r.entity_id]
      );
      moved++;
    }
  }

  const after = await countRows('work_entity_associations');
  console.log(`\nMigrated ${moved} link(s)${dangling ? `, skipped ${dangling} dangling` : ''}.`);
  console.log(`work_entity_associations now holds ${after} row(s).`);

  if (!drop) {
    console.log('\nTables left in place. Re-run with --drop once you are satisfied.');
    process.exit(0);
  }

  // Refuse to drop unless the copy actually landed. A drop guarded by nothing
  // is how the rows would have been lost rather than merely orphaned.
  const expected = before + moved - 0;
  if (after < expected) {
    console.log(`\nREFUSING TO DROP: expected at least ${expected} rows, found ${after}.`);
    process.exit(1);
  }

  for (const { table } of present) {
    await query(`DROP TABLE ${quote(table)}`);
    console.log(`  dropped ${table}`);
  }
  console.log(`\n${KEEP} deliberately left alone - a source is not an entity.`);
  process.exit(0);
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
