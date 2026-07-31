import mysql from 'mysql2/promise.js';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import { ValidationError, NotFoundError } from '../config/errors.js';
import { mysqlSchemaExists, createMysqlSchema } from '../database/schema/mysqlSchema.js';
import * as db from '../database/connectionPool.js';

// Each context owns its own MySQL/MariaDB connection (contexts can point at
// entirely different physical databases, not just filter rows within a shared
// one). MSSQL isn't supported per-context - it never had a real query path
// anywhere in the app even as a global option, so there's nothing to carry
// forward by replicating it per-context too.

async function getContextRow(contextId) {
  const context = await db.queryOne('SELECT * FROM contexts WHERE id = ?', [contextId]);
  if (!context) {
    throw new NotFoundError('Context not found');
  }
  return context;
}

function buildLiveConfig(context, password) {
  return {
    host: context.db_host,
    port: context.db_port || 3306,
    user: context.db_user,
    password,
    database: context.db_name,
  };
}

export async function getDbConfig(contextId) {
  const context = await getContextRow(contextId);
  return {
    host: context.db_host,
    port: context.db_port,
    database: context.db_name,
    user: context.db_user,
    hasPassword: !!context.db_password_enc,
  };
}

// A blank password field means "leave the stored one alone" - only re-encrypt
// when the caller actually supplied a new value.
export async function saveDbConfig(contextId, data) {
  const context = await getContextRow(contextId);
  const { host, port, database, user, password } = data;

  const passwordEnc = password
    ? JSON.stringify(encrypt(password))
    : context.db_password_enc;

  await db.update(
    'UPDATE contexts SET db_host = ?, db_port = ?, db_name = ?, db_user = ?, db_password_enc = ? WHERE id = ?',
    [host || null, port || null, database || null, user || null, passwordEnc, contextId]
  );

  return getDbConfig(contextId);
}

function resolvePassword(context, submittedPassword) {
  if (submittedPassword) return submittedPassword;
  if (!context.db_password_enc) return '';
  return decrypt(JSON.parse(context.db_password_enc));
}

async function attemptConnection(options) {
  try {
    const connection = await mysql.createConnection(options);
    await connection.ping();
    return { connection };
  } catch (error) {
    return { error };
  }
}

async function testConnectionWith(data, password) {
  const baseOptions = {
    host: data.host,
    port: data.port ? Number(data.port) : 3306,
    user: data.user,
    password,
    connectTimeout: 5000,
  };

  if (data.database) {
    const attempt = await attemptConnection({ ...baseOptions, database: data.database });
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

  const attempt = await attemptConnection(baseOptions);
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

export async function testDbConnection(contextId, data) {
  const context = await getContextRow(contextId);
  const password = resolvePassword(context, data.password);
  return testConnectionWith(data, password);
}

export async function createDbSchema(contextId, data) {
  if (!data.database) {
    throw new ValidationError('A database name is required to create the schema');
  }

  const context = await getContextRow(contextId);
  const password = resolvePassword(context, data.password);

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

// Resolves a context's saved DB config into a ready-to-use connection config
// for connectionPool.reconfigure(). Returns null if the context has no
// complete profile saved yet, so the caller can decide what to fall back to.
export async function getLiveConnectionConfig(contextId) {
  const context = await getContextRow(contextId);
  if (!context.db_host || !context.db_user || !context.db_name) return null;

  const password = resolvePassword(context, undefined);
  return buildLiveConfig(context, password);
}
