import mysql from 'mysql2/promise.js';
import mssql from 'mssql';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import { validateIdentifier } from '../utils/validateIdentifier.js';
import { ValidationError, NotFoundError } from '../config/errors.js';
import { mysqlSchemaExists, createMysqlSchema } from '../database/schema/mysqlSchema.js';
import { mssqlSchemaExists, createMssqlSchema } from '../database/schema/mssqlSchema.js';
import * as db from '../database/connectionPool.js';

// Each context has exactly ONE database connection: either MySQL/MariaDB OR MSSQL.
// If none is configured, db_type is null and db_config_json is null.
// When saving, the new connection is stored in db_config_json and db_type indicates
// the type (mysql|mssql). The old column-based storage (db_host, mssql_host, etc.)
// is kept for backwards compatibility but not used for active queries.

const VALID_TYPES = ['mysql', 'mssql'];

async function getContextRow(contextId) {
  const context = await db.queryOne('SELECT * FROM contexts WHERE id = ?', [contextId]);
  if (!context) {
    throw new NotFoundError('Context not found');
  }
  return context;
}

function resolvePassword(existingEnc, submittedPassword) {
  if (submittedPassword) return submittedPassword;
  if (!existingEnc) return '';
  try {
    return decrypt(JSON.parse(existingEnc));
  } catch {
    throw new ValidationError('Saved password could not be decrypted - it may have been saved from a different machine (CONFIG_ENCRYPTION_KEY is per-machine, not synced). Re-enter and save the password to fix this.');
  }
}

// Parse db_config_json and decrypt password if present
function parseDbConfig(context) {
  if (!context.db_config_json) {
    return null;
  }
  try {
    const config = JSON.parse(context.db_config_json);
    return {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      hasPassword: !!config.password_enc,
      password_enc: config.password_enc,
    };
  } catch {
    return null;
  }
}

export async function getDbConfig(contextId) {
  const context = await getContextRow(contextId);
  const dbType = VALID_TYPES.includes(context.db_type) ? context.db_type : null;
  const configData = parseDbConfig(context);

  // If no connection configured, return null dbType with empty config
  if (!dbType || !configData) {
    return {
      dbType: null,
      config: null,
    };
  }

  return {
    dbType,
    config: {
      host: configData.host,
      port: configData.port,
      database: configData.database,
      user: configData.user,
      hasPassword: configData.hasPassword,
    },
  };
}

export async function saveDbConfig(contextId, data) {
  const context = await getContextRow(contextId);
  const dbType = VALID_TYPES.includes(data.dbType) ? data.dbType : null;

  if (!dbType) {
    throw new ValidationError('Database type (mysql or mssql) is required');
  }

  const configData = data.config || {};
  if (!configData.host || !configData.user || !configData.database) {
    throw new ValidationError('Host, user, and database name are required');
  }

  // Encrypt password if provided
  let passwordEnc = null;
  if (configData.password) {
    passwordEnc = JSON.stringify(encrypt(configData.password));
  } else if (configData.password === '' && !configData.hasPassword) {
    // User explicitly cleared password
    passwordEnc = null;
  } else if (context.db_config_json) {
    // Preserve existing password if not provided
    try {
      const existing = JSON.parse(context.db_config_json);
      passwordEnc = existing.password_enc;
    } catch {
      passwordEnc = null;
    }
  }

  const dbConfigJson = JSON.stringify({
    host: configData.host,
    port: configData.port,
    database: configData.database,
    user: configData.user,
    password_enc: passwordEnc,
  });

  await db.update(
    'UPDATE contexts SET db_type = ?, db_config_json = ? WHERE id = ?',
    [dbType, dbConfigJson, contextId]
  );

  return getDbConfig(contextId);
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
    options: { encrypt: true, trustServerCertificate: false },
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
      // Server test without specific database
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
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError('Invalid database type');
  }

  const context = await getContextRow(contextId);

  // Try to get existing password from db_config_json
  let existingEnc = null;
  if (context.db_config_json && context.db_type === type) {
    try {
      const config = JSON.parse(context.db_config_json);
      existingEnc = config.password_enc;
    } catch {
      existingEnc = null;
    }
  }

  const password = resolvePassword(existingEnc, data.password);
  return type === 'mssql' ? testMssqlConnection(data, password) : testMysqlConnection(data, password);
}

export async function createDbSchema(contextId, type, data) {
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError('Invalid database type');
  }

  if (!data.database) {
    throw new ValidationError('A database name is required to create the schema');
  }
  validateIdentifier(data.database, 'Database name');

  const context = await getContextRow(contextId);

  // Get existing password from db_config_json if available
  let existingEnc = null;
  if (context.db_config_json && context.db_type === type) {
    try {
      const config = JSON.parse(context.db_config_json);
      existingEnc = config.password_enc;
    } catch {
      existingEnc = null;
    }
  }

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

export async function removeDbConfig(contextId) {
  await db.update(
    'UPDATE contexts SET db_type = NULL, db_config_json = NULL WHERE id = ?',
    [contextId]
  );
}

export async function getLiveConnectionConfig(contextId) {
  const context = await getContextRow(contextId);
  const dbType = VALID_TYPES.includes(context.db_type) ? context.db_type : null;

  if (!dbType || !context.db_config_json) {
    return null;
  }

  try {
    const config = JSON.parse(context.db_config_json);
    if (!config.host || !config.user || !config.database) {
      return null;
    }

    return {
      type: dbType,
      host: config.host,
      port: config.port || (dbType === 'mssql' ? 1433 : 3306),
      user: config.user,
      password: resolvePassword(config.password_enc, undefined),
      database: config.database,
    };
  } catch {
    return null;
  }
}
