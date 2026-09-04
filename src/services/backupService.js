import { query, getCurrentConfig } from '../database/connectionPool.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import logger from '../utils/logger.js';
import { ValidationError } from '../config/errors.js';
import { ALL_SYSTEM_TABLES } from './systemDatabaseService.js';
import { MSSQL_SCHEMA } from '../database/mssqlTranslation.js';

const execAsync = promisify(exec);
const writeFile = promisify(fs.writeFile);

/**
 * Create a backup of the current context's database
 * Returns the zip file buffer for download
 */
export async function createContextBackup(contextId, contextName) {
  const tempDir = path.join('/tmp', `mywork-backup-${contextId}-${Date.now()}`);

  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const config = getCurrentConfig();
    const dbName = config.database;
    const dbHost = config.host;
    const dbPort = config.port;
    const dbUser = config.user;
    const dbPassword = config.password;

    // Create SQL dump
    const sqlFile = path.join(tempDir, 'database.sql');

    // The password goes in the ENVIRONMENT, never in the command.
    //
    // It used to be built in as `-p<password>`, shell-escaped. Escaping made it
    // syntactically safe and did nothing about the two real problems: an
    // argument vector is world-readable, so any `ps` on the machine showed the
    // credential in full, and the command string is echoed verbatim in the
    // error whenever mysqldump fails. That is not theoretical - it is how the
    // password ended up written 38 times into logs/error.log and once into a
    // Playwright run log.
    //
    // MYSQL_PWD is read by the mysql client family for exactly this purpose and
    // is not visible in the process list. It is scoped to this child process,
    // so it does not leak into anything else this server spawns.
    const dumpEnv = {
      env: { ...process.env, ...(dbPassword ? { MYSQL_PWD: dbPassword } : {}) },
      // A dump of a real database can exceed the default 1MB stdout buffer;
      // output is redirected to a file, but the warning stream still counts.
      maxBuffer: 10 * 1024 * 1024,
    };
    const dumpCmd = (extra) =>
      `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${extra} --lock-tables=false ${dbName} > "${sqlFile}"`;

    // `--single-transaction` is what makes the dump a consistent point in time
    // rather than a smear across whatever was written while it ran. Since MySQL
    // 8.0.32 it also briefly flushes tables, which needs RELOAD or
    // FLUSH_TABLES - a privilege this app's database user does not have:
    //
    //   Access denied; you need (at least one of) the RELOAD or
    //   FLUSH_TABLES privilege(s) for this operation (1227)
    //
    // So every context backup has been failing outright. A backup button that
    // reliably produces nothing is worse than one that produces a slightly
    // weaker backup, so fall back rather than give up - and say clearly which
    // kind was made, because "consistent" is the whole value of the first.
    //
    // Granting RELOAD to the database user removes the fallback entirely; that
    // is a privilege change for whoever administers the database to make, not
    // something this code should assume.
    logger.info(`Creating database dump for context ${contextId}...`);
    let consistent = true;
    try {
      await execAsync(dumpCmd('--single-transaction'), dumpEnv);
    } catch (error) {
      const privilegeIssue = /RELOAD|FLUSH_TABLES|1227/.test(error.message || '');
      if (!privilegeIssue) throw error;

      consistent = false;
      logger.warn('mysqldump could not take a consistent snapshot (the database user '
        + 'lacks RELOAD/FLUSH_TABLES). Falling back to a non-transactional dump - it is '
        + 'a valid backup, but not a single point in time. Grant RELOAD to remove this.');
      await execAsync(dumpCmd('--skip-lock-tables'), dumpEnv);
    }

    // Create metadata file
    const metadata = {
      contextId,
      contextName,
      databaseName: dbName,
      databaseType: config.type,
      createdAt: new Date().toISOString(),
      backupVersion: '1.0',
      // Whether this dump is a single point in time. A restore from a
      // non-consistent dump can contain a half-finished write, and the person
      // restoring it should be able to tell without rerunning anything.
      consistentSnapshot: consistent
    };

    const metadataFile = path.join(tempDir, 'backup-metadata.json');
    await writeFile(metadataFile, JSON.stringify(metadata, null, 2));

    logger.info(`Creating backup zip file...`);
    // Create zip buffer
    const zipBuffer = await createZipBuffer(tempDir);

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true });

    logger.info(`Backup created successfully`);
    return zipBuffer;

  } catch (error) {
    logger.error('Error creating backup:', error);
    // Clean up on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * Create a zip buffer from directory contents
 */
function createZipBuffer(sourceDir) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (data) => {
      chunks.push(data);
    });

    archive.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Date/datetime columns round-trip through JSON as ISO 8601 strings (e.g.
// "2026-07-30T00:00:00.000Z"), which mysql2 rejects as a raw string parameter -
// it wants a Date object (or its own MySQL-formatted string) for those columns.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

// JSON columns (e.g. sources.config) come back from a SELECT as parsed JS
// objects; re-stringify anything object-like (but not Date/null) before it goes
// back into a parameterized INSERT.
function serializeValue(value) {
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'string' && ISO_DATETIME_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

// The tables a JSON backup covers, and the ONLY tables an import will empty.
//
// Reused from systemDatabaseService rather than listed a second time: this is
// the same question ("which tables is this app's data in?"), and two copies is
// how a retired table stays in one list after being removed from the other -
// which here would mean an import trying to DELETE FROM a table that no longer
// exists, and rolling the whole restore back.
const TABLES = ALL_SYSTEM_TABLES;

// Parents before children, read off the FOREIGN KEY clauses in mysqlSchema.js
// (mirrored on mssqlSchema.js): users/sources/years/context_folders have no
// dependency among these tables; contexts depends on users and
// context_folders; day_highlights and entities depend on contexts;
// entity_type_fields/entity_type_relationships depend on entity_types;
// entity_field_values depends on entities; entity_relationships depends on
// contexts and entities (both directions); the two work_* junctions depend on
// entities (and, for work_source_associations, sources). importDatabase()
// deletes this list in reverse (children first) and inserts it forwards
// (parents first), which is the two directions a restore actually needs -
// see "How to delete" in CLAUDE_PROJECT_TESTS.md for the same ordering
// reasoning applied to a live delete instead of a restore.
const TABLE_INSERT_ORDER = [
  'users', 'sources', 'years', 'context_folders', 'contexts',
  'day_highlights', 'source_auth',
  'entity_types', 'entity_type_fields', 'entity_type_relationships',
  'entities', 'entity_field_values', 'entity_relationships',
  'work_entity_associations', 'work_source_associations',
];

// Every table a backup can carry needs a place in the order above - a table
// TABLE_INSERT_ORDER hasn't been extended for is a bug in THIS list, not
// something to guess an order for at restore time.
{
  const missing = TABLES.filter((t) => !TABLE_INSERT_ORDER.includes(t));
  if (missing.length) {
    throw new Error(
      `backupService.TABLE_INSERT_ORDER is missing ${missing.join(', ')} - `
      + 'add them in FK-safe order before importDatabase() can run.',
    );
  }
}

// Table and column names cannot be parameterised, so they are interpolated -
// which means they have to be checked. Everything here comes from a file the
// user supplies, so this is the boundary where a hostile backup would try to
// get SQL into an identifier position.
function validateIdentifier(name, what) {
  if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new ValidationError(`${what} is not a valid identifier: ${JSON.stringify(name)}`);
  }
  return name;
}

/**
 * Every row of every table, as JSON. This is what GET /api/backup/export
 * downloads and what importDatabase() reads back.
 *
 * A table that does not exist is skipped rather than throwing: a database that
 * predates a table, or has had one retired, should still be backup-able.
 */
// True only for "this table does not exist" - ER_NO_SUCH_TABLE on MySQL,
// error number 208 on MSSQL (checked on the error and its .cause, since
// connectionPool.query() wraps the driver error). Anything else is a real
// failure and must not be treated as "nothing to back up here".
function isMissingTableError(error) {
  if (!error) return false;
  const code = error.code || error.cause?.code;
  const number = error.number ?? error.cause?.number;
  return code === 'ER_NO_SUCH_TABLE' || number === 208;
}

export async function exportDatabase() {
  const tables = {};
  let rowsExported = 0;

  for (const table of TABLES) {
    validateIdentifier(table, 'Table name');
    try {
      // Plain, unquoted names - qualifyTablesForMssql() only recognises
      // `\`table\`` incidentally, and backticks previously hid every table
      // name from it, so MSSQL backups silently exported nothing.
      const rows = await query(`SELECT * FROM ${table}`);
      tables[table] = rows;
      rowsExported += rows.length;
    } catch (error) {
      // ER_NO_SUCH_TABLE and its MSSQL equivalent both mean "nothing to back
      // up here", which is not a failed backup. Anything else - a bad
      // connection, a permissions error, a qualification failure - IS a
      // failed backup and must not be swallowed into a quietly-incomplete one.
      if (!isMissingTableError(error)) throw error;
      logger.warn(`Backup: skipping ${table} (${error.message})`);
    }
  }

  if (Object.keys(tables).length === 0) {
    throw new Error(
      'Backup export produced zero tables - refusing to return a well-formed '
      + 'empty backup. Check the database connection and the [MyWork] table list.',
    );
  }

  return {
    exportedAt: new Date().toISOString(),
    database: getCurrentConfig()?.database ?? null,
    tableCount: Object.keys(tables).length,
    rowsExported,
    tables,
  };
}

// How many bind parameters one MSSQL batch may carry when restoring a table
// under IDENTITY_INSERT (see insertRowsMssql below). SQL Server rejects a
// request with more than 2100 parameters, and a 200-row chunk of a wide table
// (entities is ~12 columns) already exceeds that - so the chunk boundary is a
// parameter budget, not a row count.
const MSSQL_IMPORT_PARAM_BUDGET = 2000;

// MSSQL's `id` columns are IDENTITY, so an INSERT carrying an explicit id
// (which a restore must, to keep every foreign key it already recorded)
// needs IDENTITY_INSERT ON for that table - and that property is
// SESSION-scoped, so the SET and the inserts it covers have to run on the
// same connection. connectionPool's query() hands back a fresh request per
// call, which does not guarantee that across separate calls - so this sends
// one combined batch per chunk instead of one call per row. Identifiers are
// written already qualified ([MyWork].[table]/[col]) so qualifyTablesForMssql
// - which only recognises FROM/JOIN/INTO/UPDATE/TABLE/MERGE - leaves them
// alone rather than missing them (see its "already qualified" branch).
//
// No AUTO_INCREMENT-style reseed afterwards: SQL Server sets a table's
// current identity value to the highest value explicitly inserted while
// IDENTITY_INSERT is ON, so the next auto-generated id already continues
// from there.
async function insertRowsMssql(table, preparedRows) {
  const qualifiedTable = `[${MSSQL_SCHEMA}].[${table}]`;

  let start = 0;
  while (start < preparedRows.length) {
    const statements = [`SET IDENTITY_INSERT ${qualifiedTable} ON;`];
    const values = [];

    let i = start;
    for (; i < preparedRows.length; i++) {
      const { columns, values: rowValues } = preparedRows[i];
      if (i > start && values.length + rowValues.length > MSSQL_IMPORT_PARAM_BUDGET) break;
      const placeholders = columns.map(() => '?').join(',');
      const columnList = columns.map((c) => `[${c}]`).join(',');
      statements.push(`INSERT INTO ${qualifiedTable} (${columnList}) VALUES (${placeholders});`);
      values.push(...rowValues);
    }
    start = i;

    statements.push(`SET IDENTITY_INSERT ${qualifiedTable} OFF;`);
    await query(statements.join('\n'), values);
  }
}

export async function importDatabase(payload) {
  if (!payload || typeof payload !== 'object' || !payload.tables) {
    throw new ValidationError('That file doesn\'t look like a MyWork backup');
  }

  const { type: dbType, database: dbName } = getCurrentConfig();
  const isMssql = dbType === 'mssql';
  // information_schema.columns is one of the few things both engines answer
  // identically, but TABLE_SCHEMA means different things: the database name
  // on MySQL, the SQL schema (always [MyWork] here, never dbo) on MSSQL.
  const columnsSchemaFilter = isMssql ? MSSQL_SCHEMA : dbName;

  // Only the tables this backup actually carries, in FK-safe order. Emptying
  // a table the file says nothing about would silently destroy data the
  // restore cannot then put back - a "restore" that deletes is the worst
  // possible outcome here.
  const present = TABLE_INSERT_ORDER.filter((t) => Array.isArray(payload.tables[t]));
  if (!present.length) {
    throw new ValidationError('That backup contains no recognisable tables');
  }

  // Children before parents.
  for (const table of [...present].reverse()) {
    validateIdentifier(table, 'Table name');
    await query(`DELETE FROM ${table}`);
  }

  let rowsImported = 0;

  // Parents before children.
  for (const table of present) {
    const rows = payload.tables[table] || [];
    if (!rows.length) continue;

    // Which columns this table ACTUALLY has right now. A backup taken against
    // an older schema carries columns that have since been dropped
    // (`priorities.is_weekly` is a real example), and inserting one of those
    // failed the entire restore with "Unknown column" - so the one file you
    // reach for when something has gone wrong was the one that would not
    // load. Unknown columns are skipped and logged instead.
    const columnRows = await query(
      `SELECT COLUMN_NAME c FROM information_schema.columns
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [columnsSchemaFilter, table],
    );
    const liveColumns = new Set(columnRows.map(r => r.c));
    const dropped = new Set();

    const preparedRows = [];
    let maxId = 0;

    for (const row of rows) {
      const columns = Object.keys(row)
        .map(c => validateIdentifier(c, `Column name in ${table}`))
        .filter((c) => {
          if (liveColumns.has(c)) return true;
          dropped.add(c);
          return false;
        });
      if (!columns.length) continue;

      preparedRows.push({ columns, values: columns.map(c => serializeValue(row[c])) });

      if (typeof row.id === 'number' && row.id > maxId) {
        maxId = row.id;
      }
    }

    if (dropped.size) {
      logger.warn(
        `Restore: ${table} - ignored ${dropped.size} column(s) this schema no `
        + `longer has: ${[...dropped].join(', ')}`,
      );
    }

    if (isMssql) {
      await insertRowsMssql(table, preparedRows);
      // No reseed here - see insertRowsMssql's comment.
    } else {
      for (const { columns, values } of preparedRows) {
        const placeholders = columns.map(() => '?').join(',');
        await query(
          `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
          values,
        );
      }
      if (maxId > 0) {
        await query(`ALTER TABLE ${table} AUTO_INCREMENT = ${maxId + 1}`);
      }
    }

    rowsImported += preparedRows.length;
  }

  return { tablesImported: present.length, rowsImported };
}
