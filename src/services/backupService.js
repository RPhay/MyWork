import { query, getCurrentConfig } from '../database/connectionPool.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import logger from '../utils/logger.js';

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

    // Properly escape the password for shell execution
    const escapeShell = (str) => {
      if (!str) return '';
      return `'${str.replace(/'/g, "'\\''")}'`;
    };

    const passwordArg = dbPassword ? `-p${escapeShell(dbPassword)}` : '';
    const dumpCmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passwordArg} --single-transaction --lock-tables=false ${dbName} > "${sqlFile}"`;

    logger.info(`Creating database dump for context ${contextId}...`);
    await execAsync(dumpCmd);

    // Create metadata file
    const metadata = {
      contextId,
      contextName,
      databaseName: dbName,
      databaseType: config.type,
      createdAt: new Date().toISOString(),
      backupVersion: '1.0'
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

export async function importDatabase(payload) {
  if (!payload || typeof payload !== 'object' || !payload.tables) {
    throw new ValidationError('That file doesn\'t look like a MyWork backup');
  }

  const pool = await db.getPool();
  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.beginTransaction();

    for (const table of [...TABLES].reverse()) {
      await connection.query(`DELETE FROM \`${table}\``);
    }

    let rowsImported = 0;

    for (const table of TABLES) {
      const rows = payload.tables[table] || [];
      let maxId = 0;

      for (const row of rows) {
        const columns = Object.keys(row).map(c => validateIdentifier(c, `Column name in ${table}`));
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

      rowsImported += rows.length;

      if (maxId > 0) {
        await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${maxId + 1}`);
      }
    }

    await connection.commit();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    return { tablesImported: TABLES.length, rowsImported };
  } catch (error) {
    await connection.rollback();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  } finally {
    connection.release();
  }
}
