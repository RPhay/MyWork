import { query, getPool, getCurrentConfig } from '../database/connectionPool.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import logger from '../utils/logger.js';
import { ValidationError } from '../config/errors.js';
import { ALL_SYSTEM_TABLES } from './systemDatabaseService.js';

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
export async function exportDatabase() {
  const tables = {};
  let rowsExported = 0;

  for (const table of TABLES) {
    validateIdentifier(table, 'Table name');
    try {
      const rows = await query(`SELECT * FROM \`${table}\``);
      tables[table] = rows;
      rowsExported += rows.length;
    } catch (error) {
      // ER_NO_SUCH_TABLE and its MSSQL equivalent both mean "nothing to back
      // up here", which is not a failed backup.
      logger.warn(`Backup: skipping ${table} (${error.message})`);
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    database: getCurrentConfig()?.database ?? null,
    tableCount: Object.keys(tables).length,
    rowsExported,
    tables,
  };
}

export async function importDatabase(payload) {
  if (!payload || typeof payload !== 'object' || !payload.tables) {
    throw new ValidationError('That file doesn\'t look like a MyWork backup');
  }

  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.beginTransaction();

    // Only the tables this backup actually carries. Emptying a table the file
    // says nothing about would silently destroy data the restore cannot then
    // put back - a "restore" that deletes is the worst possible outcome here.
    const present = TABLES.filter((t) => Array.isArray(payload.tables[t]));
    if (!present.length) {
      throw new ValidationError('That backup contains no recognisable tables');
    }
    for (const table of [...present].reverse()) {
      validateIdentifier(table, 'Table name');
      await connection.query(`DELETE FROM \`${table}\``);
    }

    let rowsImported = 0;

    for (const table of present) {
      const rows = payload.tables[table] || [];
      let maxId = 0;

      // Which columns this table ACTUALLY has right now. A backup taken against
      // an older schema carries columns that have since been dropped
      // (`priorities.is_weekly` is a real example), and inserting one of those
      // failed the entire restore with "Unknown column" - so the one file you
      // reach for when something has gone wrong was the one that would not
      // load. Unknown columns are skipped and logged instead.
      const [columnRows] = await connection.query(
        `SELECT COLUMN_NAME c FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      );
      const liveColumns = new Set(columnRows.map(r => r.c));
      const dropped = new Set();

      for (const row of rows) {
        const columns = Object.keys(row)
          .map(c => validateIdentifier(c, `Column name in ${table}`))
          .filter((c) => {
            if (liveColumns.has(c)) return true;
            dropped.add(c);
            return false;
          });
        if (!columns.length) continue;
        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map(c => serializeValue(row[c]));

        await connection.query(
          `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(',')}) VALUES (${placeholders})`,
          values
        );

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

      rowsImported += rows.length;

      if (maxId > 0) {
        await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${maxId + 1}`);
      }
    }

    await connection.commit();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    return { tablesImported: present.length, rowsImported };
  } catch (error) {
    await connection.rollback();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  } finally {
    connection.release();
  }
}
