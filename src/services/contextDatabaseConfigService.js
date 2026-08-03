import mysql from 'mysql2/promise.js';
import mssql from 'mssql';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import { validateIdentifier } from '../utils/validateIdentifier.js';
import { ValidationError, NotFoundError } from '../config/errors.js';
import { mysqlSchemaExists, createMysqlSchema } from '../database/schema/mysqlSchema.js';
import { mssqlSchemaExists, createMssqlSchema } from '../database/schema/mssqlSchema.js';
import * as db from '../database/connectionPool.js';
import * as homePool from '../database/homePool.js';

// Each context has exactly ONE database connection: either MySQL/MariaDB OR MSSQL.
// If none is configured, db_type is null and db_config_json is null.
// When saving, the new connection is stored in db_config_json and db_type indicates
// the type (mysql|mssql). The old column-based storage (db_host, mssql_host, etc.)
// is kept for backwards compatibility but not used for active queries.

const VALID_TYPES = ['mysql', 'mssql'];

async function getContextRow(contextId) {
  try {
    const context = await db.queryOne('SELECT * FROM contexts WHERE id = ?', [contextId]);
    if (!context) {
      throw new NotFoundError('Context not found');
    }
    return context;
  } catch (error) {
    // If the query fails due to missing db_config_json column, try without it
    if (error.message && error.message.includes('db_config_json')) {
      const context = await db.queryOne(
        'SELECT id, name, db_type, db_host, db_port, db_name, db_user, db_password_enc, mssql_host, mssql_port, mssql_name, mssql_user, mssql_password_enc FROM contexts WHERE id = ?',
        [contextId]
      );
      if (!context) {
        throw new NotFoundError('Context not found');
      }
      // Add null db_config_json so parseDbConfig falls back to old columns
      context.db_config_json = null;
      return context;
    }
    throw error;
  }
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

// Parse db_config_json and decrypt password if present, with fallback to old columns
// Note: We don't throw on password decryption failure here - we just mark that a password exists.
// If the password can't be decrypted, that error surfaces later when trying to use it.
function parseDbConfig(context) {
  // Try new format first (db_config_json)
  if (context.db_config_json) {
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
      // Fall through to old format fallback
    }
  }

  // Fallback to old column format for backwards compatibility
  // (for machines that haven't yet run the schema migration)
  if (context.db_type === 'mysql' && context.db_host) {
    return {
      host: context.db_host,
      port: context.db_port,
      database: context.db_name,
      user: context.db_user,
      hasPassword: !!context.db_password_enc,
      password_enc: context.db_password_enc,
    };
  }

  if (context.db_type === 'mssql' && context.mssql_host) {
    return {
      host: context.mssql_host,
      port: context.mssql_port,
      database: context.mssql_name,
      user: context.mssql_user,
      hasPassword: !!context.mssql_password_enc,
      password_enc: context.mssql_password_enc,
    };
  }

  return null;
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

  try {
    await db.update(
      'UPDATE contexts SET db_type = ?, db_config_json = ? WHERE id = ?',
      [dbType, dbConfigJson, contextId]
    );
  } catch (error) {
    console.error('SaveDbConfig error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      fullError: error
    });

    if (error.message && (error.message.includes('db_config_json') || error.message.includes('Unknown column'))) {
      // Column doesn't exist yet - try to add it, then retry the update
      try {
        console.log('Attempting to add db_config_json column via homePool...');
        await homePool.query(`
          ALTER TABLE contexts
          ADD COLUMN IF NOT EXISTS db_config_json TEXT COMMENT 'Encrypted JSON with active db connection config'
        `);
        console.log('Column added successfully via homePool');

        // Retry the update now that column exists
        await db.update(
          'UPDATE contexts SET db_type = ?, db_config_json = ? WHERE id = ?',
          [dbType, dbConfigJson, contextId]
        );
      } catch (alterError) {
        console.error('Failed to add column or retry update:', alterError);
        throw new ValidationError('Database schema needs to be updated. Please go to Settings → Contexts → Schema tab and click "Check and Update Schema".');
      }
    } else {
      throw error;
    }
  }

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

  if (!dbType) {
    return null;
  }

  // Try new format first (db_config_json)
  if (context.db_config_json) {
    try {
      const config = JSON.parse(context.db_config_json);
      if (config.host && config.user && config.database) {
        return {
          type: dbType,
          host: config.host,
          port: config.port || (dbType === 'mssql' ? 1433 : 3306),
          user: config.user,
          password: resolvePassword(config.password_enc, undefined),
          database: config.database,
        };
      }
    } catch {
      // Fall through to old format fallback
    }
  }

  // Fallback to old column format for backwards compatibility
  if (dbType === 'mysql' && context.db_host) {
    return {
      type: 'mysql',
      host: context.db_host,
      port: context.db_port || 3306,
      user: context.db_user,
      password: resolvePassword(context.db_password_enc, undefined),
      database: context.db_name,
    };
  }

  if (dbType === 'mssql' && context.mssql_host) {
    return {
      type: 'mssql',
      host: context.mssql_host,
      port: context.mssql_port || 1433,
      user: context.mssql_user,
      password: resolvePassword(context.mssql_password_enc, undefined),
      database: context.mssql_name,
    };
  }

  return null;
}
