import mysql from 'mysql2/promise.js';
import mssql from 'mssql';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import { ValidationError, NotFoundError } from '../config/errors.js';
import { mysqlSchemaExists, createMysqlSchema } from '../database/schema/mysqlSchema.js';
import { mssqlSchemaExists, createMssqlSchema } from '../database/schema/mssqlSchema.js';
import * as db from '../database/connectionPool.js';

// Each context can save a profile for both MySQL/MariaDB and MSSQL (the
// Database sub-panel has a type toggle so either can be filled in, tested,
// and have its schema created independently, without losing the other's
// values). Only MySQL/MariaDB is ever the *live* backend though -
// connectionPool.js has no MSSQL query path, so db_type just records which
// one the toggle was last left on for this context; it does not change what
// the app actually queries through. See getLiveConnectionConfig below.

const VALID_TYPES = ['mysql', 'mssql'];

async function getContextRow(contextId) {
  const context = await db.queryOne('SELECT * FROM contexts WHERE id = ?', [contextId]);
  if (!context) {
    throw new NotFoundError('Context not found');
  }
  return context;
}

function columnPrefix(type) {
  return type === 'mssql' ? 'mssql_' : 'db_';
}

function profileFromRow(context, type) {
  const prefix = columnPrefix(type);
  return {
    host: context[`${prefix}host`],
    port: context[`${prefix}port`],
    database: context[`${prefix}name`],
    user: context[`${prefix}user`],
    hasPassword: !!context[`${prefix}password_enc`],
  };
}

export async function getDbConfig(contextId) {
  const context = await getContextRow(contextId);
  return {
    dbType: VALID_TYPES.includes(context.db_type) ? context.db_type : 'mysql',
    mysql: profileFromRow(context, 'mysql'),
    mssql: profileFromRow(context, 'mssql'),
  };
}

// A blank password field means "leave the stored one alone" - only re-encrypt
// when the caller actually supplied a new value.
function resolvePasswordEnc(existingEnc, submittedPassword) {
  return submittedPassword ? JSON.stringify(encrypt(submittedPassword)) : existingEnc;
}

export async function saveDbConfig(contextId, data) {
  const context = await getContextRow(contextId);
  const dbType = VALID_TYPES.includes(data.dbType) ? data.dbType : (context.db_type || 'mysql');
  const mysqlData = data.mysql || {};
  const mssqlData = data.mssql || {};

  const mysqlPasswordEnc = resolvePasswordEnc(context.db_password_enc, mysqlData.password);
  const mssqlPasswordEnc = resolvePasswordEnc(context.mssql_password_enc, mssqlData.password);

  await db.update(
    `UPDATE contexts SET
       db_type = ?,
       db_host = ?, db_port = ?, db_name = ?, db_user = ?, db_password_enc = ?,
       mssql_host = ?, mssql_port = ?, mssql_name = ?, mssql_user = ?, mssql_password_enc = ?
     WHERE id = ?`,
    [
      dbType,
      mysqlData.host || null, mysqlData.port || null, mysqlData.database || null, mysqlData.user || null, mysqlPasswordEnc,
      mssqlData.host || null, mssqlData.port || null, mssqlData.database || null, mssqlData.user || null, mssqlPasswordEnc,
      contextId,
    ]
  );

  return getDbConfig(contextId);
}

function resolvePassword(existingEnc, submittedPassword) {
  if (submittedPassword) return submittedPassword;
  if (!existingEnc) return '';
  try {
    return decrypt(JSON.parse(existingEnc));
  } catch {
    // Wrong-key/corrupted blob surfaces from Node's crypto as a raw, confusing
    // "Unsupported state or unable to authenticate data" GCM auth-tag error.
    // CONFIG_ENCRYPTION_KEY is a per-machine env value (not synced via git), so
    // this reliably means the password was saved from a different machine/
    // session than the one currently running. Re-entering the password is the
    // only fix - the original plaintext can't be recovered without that key.
    throw new ValidationError('Saved password could not be decrypted - it may have been saved from a different machine (CONFIG_ENCRYPTION_KEY is per-machine, not synced). Re-enter and save the password to fix this.');
  }
}

async function attemptMysqlConnection(options) {
  try {
    const connection = await mysql.createConnection(options);
    await connection.ping();
    return { connection };
  } catch (error) {
    return { error };
  }
}

async function testMysqlConnection(data, password) {
  const baseOptions = {
    host: data.host,
    port: data.port ? Number(data.port) : 3306,
    user: data.user,
    password,
    connectTimeout: 5000,
  };

  if (data.database) {
    const attempt = await attemptMysqlConnection({ ...baseOptions, database: data.database });
    if (attempt.connection) {
      try {
        const schemaExists = await mysqlSchemaExists(attempt.connection);
        return { success: true, message: 'Connected successfully', schemaExists };
      } finally {
        await attempt.connection.end();
      }
    }
    // Falls through - the named database may simply not exist yet, so confirm the
    // server/credentials are otherwise valid before reporting a hard failure.
  }

  const attempt = await attemptMysqlConnection(baseOptions);
  if (attempt.error) {
    return { success: false, message: attempt.error.message || 'Connection failed' };
  }
  await attempt.connection.end();
  return {
    success: true,
    message: 'Connected successfully',
    schemaExists: data.database ? false : null,
  };
}

function mssqlConnectOptions(data, password, database) {
  return {
    server: data.host,
    port: data.port ? Number(data.port) : 1433,
    user: data.user,
    password,
    database,
    connectionTimeout: 5000,
    options: { trustServerCertificate: true, encrypt: false },
  };
}

async function testMssqlConnection(data, password) {
  if (data.database) {
    try {
      const pool = await mssql.connect(mssqlConnectOptions(data, password, data.database));
      try {
        const schemaExists = await mssqlSchemaExists(pool);
        return { success: true, message: 'Connected successfully', schemaExists };
      } finally {
        await pool.close();
      }
    } catch {
      // Falls through - the named database may simply not exist yet, so confirm the
      // server/credentials are otherwise valid before reporting a hard failure.
    }
  }

  try {
    const pool = await mssql.connect(mssqlConnectOptions(data, password, undefined));
    await pool.close();
    return {
      success: true,
      message: 'Connected successfully',
      schemaExists: data.database ? false : null,
    };
  } catch (error) {
    return { success: false, message: error.message || 'Connection failed' };
  }
}

export async function testDbConnection(contextId, type, data) {
  const context = await getContextRow(contextId);
  const existingEnc = type === 'mssql' ? context.mssql_password_enc : context.db_password_enc;
  const password = resolvePassword(existingEnc, data.password);
  return type === 'mssql' ? testMssqlConnection(data, password) : testMysqlConnection(data, password);
}

export async function createDbSchema(contextId, type, data) {
  if (!data.database) {
    throw new ValidationError('A database name is required to create the schema');
  }

  const context = await getContextRow(contextId);
  const existingEnc = type === 'mssql' ? context.mssql_password_enc : context.db_password_enc;
  const password = resolvePassword(existingEnc, data.password);

  if (type === 'mssql') {
    let pool;
    try {
      pool = await mssql.connect(mssqlConnectOptions(data, password, 'master'));
      await pool.request().query(`IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${data.database}') CREATE DATABASE [${data.database}]`);
      await pool.close();
      pool = await mssql.connect(mssqlConnectOptions(data, password, data.database));
      await createMssqlSchema(pool);
    } finally {
      if (pool) await pool.close();
    }
    return { success: true, message: 'Schema created successfully' };
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: data.host,
      port: data.port ? Number(data.port) : 3306,
      user: data.user,
      password,
      connectTimeout: 10000,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${data.database}\``);
    await connection.query(`USE \`${data.database}\``);
    await createMysqlSchema(connection);
  } finally {
    if (connection) await connection.end();
  }

  return { success: true, message: 'Schema created successfully' };
}

// Resolves a context's saved MySQL/MariaDB profile into a ready-to-use
// connection config for connectionPool.reconfigure(). MySQL/MariaDB only,
// regardless of db_type - MSSQL has no live query path (see file header).
// Returns null if the context has no complete profile saved yet, so the
// caller can decide what to fall back to.
export async function getLiveConnectionConfig(contextId) {
  const context = await getContextRow(contextId);
  if (!context.db_host || !context.db_user || !context.db_name) return null;

  const password = resolvePassword(context.db_password_enc, undefined);
  return {
    host: context.db_host,
    port: context.db_port || 3306,
    user: context.db_user,
    password,
    database: context.db_name,
  };
}
