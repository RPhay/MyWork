// Inspecting and dropping the tables the app no longer reads.
//
// Both schema files already drop these on a schema run. This exists so it can
// be done deliberately, from Settings, with the user shown exactly what will go
// and what it holds BEFORE anything happens - which a schema run cannot do,
// because by the time it reports, the tables are gone.
//
// The list itself is in ../database/retiredTables.js, shared with both schema
// files so this cannot drift from what they drop.
import { query, getCurrentConfig } from '../database/connectionPool.js';
import { RETIRED_TABLES, LEGACY_TABLE_TYPE } from '../database/retiredTables.js';
import logger from '../utils/logger.js';

const isMssql = () => getCurrentConfig().type === 'mssql';

/** `[MyWork].[x]` on SQL Server, `` `x` `` on MySQL. */
const qualify = (table) => (isMssql() ? `[MyWork].[${table}]` : `\`${table}\``);

async function tableExists(table) {
  const rows = await query(
    isMssql()
      ? `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = 'MyWork' AND TABLE_NAME = ?`
      : `SELECT COUNT(*) AS n FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return Number(rows[0]?.n || 0) > 0;
}

async function rowCount(table) {
  const rows = await query(`SELECT COUNT(*) AS n FROM ${qualify(table)}`);
  return Number(rows[0]?.n || 0);
}

/**
 * Rows in a retired table with no matching entity - the ones that would be
 * destroyed rather than merely tidied away.
 *
 * Matched on title, for the reason given in retiredTables.js. A table with no
 * entry in LEGACY_TABLE_TYPE has no evidence to check, so it reports 0.
 */
async function orphanCount(table) {
  const typeSlug = LEGACY_TABLE_TYPE[table];
  if (!typeSlug) return 0;
  const rows = await query(
    `SELECT COUNT(*) AS n FROM ${qualify(table)} l
      WHERE NOT EXISTS (
        SELECT 1 FROM ${qualify('entities')} e
          JOIN ${qualify('entity_types')} t ON t.id = e.entity_type_id
         WHERE t.slug = ? AND e.title = l.title)`,
    [typeSlug],
  );
  return Number(rows[0]?.n || 0);
}

/**
 * What is actually there, what it holds, and whether it is safe to drop.
 * Read-only: this is what the confirmation is built from.
 */
export async function inspectRetiredTables() {
  const tables = [];
  for (const table of RETIRED_TABLES) {
    if (!(await tableExists(table))) {
      tables.push({ table, present: false, rows: 0, orphans: 0, safe: true });
      continue;
    }
    const rows = await rowCount(table);
    let orphans = 0;
    try {
      orphans = rows > 0 ? await orphanCount(table) : 0;
    } catch (err) {
      // No evidence is not the same as evidence of safety.
      logger.warn(`[retired-tables] could not check ${table} for orphans: ${err.message}`);
      tables.push({
        table, present: true, rows, orphans: null, safe: false,
        reason: `could not verify its rows: ${err.message}`,
      });
      continue;
    }
    tables.push({
      table,
      present: true,
      rows,
      orphans,
      safe: orphans === 0,
      reason: orphans === 0 ? undefined
        : `${orphans} row(s) have no matching entity - dropping would destroy them`,
    });
  }

  const present = tables.filter((t) => t.present);
  return {
    tables,
    presentCount: present.length,
    droppable: present.filter((t) => t.safe).map((t) => t.table),
    blocked: present.filter((t) => !t.safe).map((t) => ({ table: t.table, reason: t.reason })),
    totalRows: present.reduce((n, t) => n + t.rows, 0),
  };
}

/** Foreign keys pointing AT a table, which must go before the table can. */
async function dropReferencingForeignKeys(table) {
  if (isMssql()) {
    const fks = await query(
      `SELECT fk.name AS constraintName, OBJECT_NAME(fk.parent_object_id) AS tableName
         FROM sys.foreign_keys fk
        WHERE fk.referenced_object_id = OBJECT_ID(?)`,
      [`MyWork.${table}`],
    );
    for (const fk of fks) {
      await query(`ALTER TABLE [MyWork].[${fk.tableName}] DROP CONSTRAINT [${fk.constraintName}]`);
    }
    return fks.length;
  }
  const fks = await query(
    `SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS constraintName
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ?`,
    [table],
  );
  for (const fk of fks) {
    await query(`ALTER TABLE \`${fk.tableName}\` DROP FOREIGN KEY \`${fk.constraintName}\``);
  }
  return fks.length;
}

/**
 * Drop every retired table that is safe to drop, and REFUSE the rest.
 *
 * Refusing is the point: a table holding rows that never became entities is the
 * one case where this is destructive rather than tidy, and it is exactly the
 * case a button makes easy to trigger by accident.
 */
export async function dropRetiredTables() {
  const report = await inspectRetiredTables();
  const dropped = [];
  const failed = [];

  for (const table of report.droppable) {
    try {
      const fks = await dropReferencingForeignKeys(table);
      await query(`DROP TABLE ${qualify(table)}`);
      dropped.push({ table, foreignKeysRemoved: fks });
      logger.info(`[retired-tables] dropped ${table} (${fks} referencing FK(s) removed first)`);
    } catch (err) {
      logger.error(`[retired-tables] could not drop ${table}: ${err.message}`);
      failed.push({ table, message: err.message });
    }
  }

  return {
    dropped,
    failed,
    refused: report.blocked,
    remaining: (await inspectRetiredTables()).presentCount,
  };
}
