import mysql from 'mysql2/promise.js';
import mssql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import { ValidationError } from '../config/errors.js';
import { getCurrentConfig } from '../database/connectionPool.js';
import { createMysqlSchema } from '../database/schema/mysqlSchema.js';
import { createMssqlSchema } from '../database/schema/mssqlSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, '../..', 'data', 'system-db-config.enc.json');

const VALID_TYPES = ['mysql', 'mssql'];

function loadSystemDbConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading system DB config:', error);
  }
  return null;
}

function writeSystemDbConfigFile(config) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
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

export async function getSystemDbConfig() {
  const config = loadSystemDbConfig();

  if (!config) {
    // Return current environment config
    const current = getCurrentConfig();
    return {
      dbType: current.type || 'mysql',
      config: {
        host: current.host || null,
        port: current.port || null,
        database: current.database || null,
        user: current.user || null,
        hasPassword: !!current.password,
      },
    };
  }

  return {
    dbType: config.dbType,
    config: {
      host: config.host || null,
      port: config.port || null,
      database: config.database || null,
      user: config.user || null,
      hasPassword: !!config.password_enc,
    },
  };
}

export async function saveSystemDbConfig(data) {
  const dbType = VALID_TYPES.includes(data.dbType) ? data.dbType : null;

  if (!dbType) {
    throw new ValidationError('Database type (mysql or mssql) is required');
  }

  const configData = data.config || {};
  if (!configData.host || !configData.user || !configData.database) {
    throw new ValidationError('Host, user, and database name are required');
  }

  // Get existing config to preserve password if not changed
  const existing = loadSystemDbConfig();
  let passwordEnc = null;

  if (configData.password) {
    passwordEnc = JSON.stringify(encrypt(configData.password));
  } else if (configData.password === '' && !configData.hasPassword) {
    passwordEnc = null;
  } else if (existing && existing.password_enc) {
    passwordEnc = existing.password_enc;
  }

  const config = {
    dbType,
    host: configData.host,
    port: configData.port || (dbType === 'mssql' ? 1433 : 3306),
    database: configData.database,
    user: configData.user,
    password_enc: passwordEnc,
  };

  writeSystemDbConfigFile(config);
  return getSystemDbConfig();
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
        await attempt.connection.end();
        return { success: true, message: 'Connected successfully' };
      } catch (e) {
        return { success: true, message: 'Connected successfully' };
      }
    }
  }

  const attempt = await attemptMysqlConnection(baseOptions);
  if (attempt.error) {
    return { success: false, message: attempt.error.message || 'Connection failed' };
  }
  await attempt.connection.end();
  return { success: true, message: 'Connected successfully' };
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
      await pool.close();
      return { success: true, message: 'Connected successfully' };
    } catch {
      // Fall through to server test
    }
  }

  try {
    const pool = await mssql.connect(mssqlConnectOptions(data, password, undefined));
    await pool.close();
    return { success: true, message: 'Connected successfully' };
  } catch (error) {
    return { success: false, message: error.message || 'Connection failed' };
  }
}

export async function testSystemDbConnection(type, data) {
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError('Invalid database type');
  }

  const config = loadSystemDbConfig();
  let existingEnc = null;

  if (config && config.dbType === type) {
    existingEnc = config.password_enc;
  }

  const password = resolvePassword(existingEnc, data.password);
  return type === 'mssql' ? testMssqlConnection(data, password) : testMysqlConnection(data, password);
}

export async function updateSystemDbSchema() {
  const config = loadSystemDbConfig();
  const current = getCurrentConfig();

  // Use saved config if available, otherwise use current environment config
  const targetConfig = config || {
    dbType: current.type || 'mysql',
    host: current.host,
    port: current.port,
    database: current.database,
    user: current.user,
    password: current.password,
  };

  if (!targetConfig.host || !targetConfig.user || !targetConfig.database) {
    throw new ValidationError('System database configuration is incomplete');
  }

  try {
    if (targetConfig.dbType === 'mssql') {
      const password = targetConfig.password_enc
        ? resolvePassword(targetConfig.password_enc, undefined)
        : targetConfig.password;

      const pool = await mssql.connect({
        server: targetConfig.host,
        port: targetConfig.port ? Number(targetConfig.port) : 1433,
        user: targetConfig.user,
        password,
        database: targetConfig.database,
        options: { encrypt: true, trustServerCertificate: false },
      });

      try {
        await createMssqlSchema(pool);
      } finally {
        await pool.close();
      }
    } else {
      const password = targetConfig.password_enc
        ? resolvePassword(targetConfig.password_enc, undefined)
        : targetConfig.password;

      const connection = await mysql.createConnection({
        host: targetConfig.host,
        port: targetConfig.port ? Number(targetConfig.port) : 3306,
        user: targetConfig.user,
        password,
        database: targetConfig.database,
      });

      try {
        await createMysqlSchema(connection);
      } finally {
        await connection.end();
      }
    }

    return {
      message: 'System database schema updated successfully',
      tablesCreated: [],
      columnsAdded: [],
      indexesAdded: [],
      errors: [],
    };
  } catch (error) {
    console.error('Error updating system database schema:', error);
    throw new ValidationError(`Failed to update system database schema: ${error.message}`);
  }
}

export async function checkSystemDbSchema() {
  const config = loadSystemDbConfig();
  const current = getCurrentConfig();

  const targetConfig = config || {
    dbType: current.type || 'mysql',
    host: current.host,
    port: current.port,
    database: current.database,
    user: current.user,
    password: current.password,
  };

  if (!targetConfig.host || !targetConfig.user || !targetConfig.database) {
    throw new ValidationError('System database configuration is incomplete');
  }

  try {
    if (targetConfig.dbType === 'mssql') {
      const password = targetConfig.password_enc
        ? resolvePassword(targetConfig.password_enc, undefined)
        : targetConfig.password;

      const pool = await mssql.connect({
        server: targetConfig.host,
        port: targetConfig.port ? Number(targetConfig.port) : 1433,
        user: targetConfig.user,
        password,
        database: targetConfig.database,
        options: { encrypt: true, trustServerCertificate: false },
      });

      try {
        const result = await pool.request().query(`
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = 'MyWork'
        `);
        const existingTables = new Set(result.recordset.map(r => r.TABLE_NAME));
        const allTables = [
          'users', 'sso_identities', 'contexts', 'context_folders', 'day_highlights',
          'sources', 'source_auth', 'categories', 'areas', 'priorities', 'priority_templates',
          'goals', 'work_items', 'work_item_templates', 'work_item_associations',
          'to_do_folders', 'to_dos', 'to_do_items', 'idea_folders', 'ideas', 'idea_items',
          'tasks', 'tickets', 'priority_links', 'to_do_links', 'idea_links', 'task_links',
          'ticket_links', 'context_tab_settings'
        ];
        return allTables.filter(t => !existingTables.has(t));
      } finally {
        await pool.close();
      }
    } else {
      const password = targetConfig.password_enc
        ? resolvePassword(targetConfig.password_enc, undefined)
        : targetConfig.password;

      const connection = await mysql.createConnection({
        host: targetConfig.host,
        port: targetConfig.port ? Number(targetConfig.port) : 3306,
        user: targetConfig.user,
        password,
        database: targetConfig.database,
      });

      try {
        const [rows] = await connection.query(`
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = ?
        `, [targetConfig.database]);
        const existingTables = new Set(rows.map(r => r.TABLE_NAME));
        const allTables = [
          'users', 'sso_identities', 'contexts', 'context_folders', 'day_highlights',
          'sources', 'source_auth', 'categories', 'areas', 'priorities', 'priority_templates',
          'goals', 'work_items', 'work_item_templates', 'work_item_associations',
          'to_do_folders', 'to_dos', 'to_do_items', 'idea_folders', 'ideas', 'idea_items',
          'tasks', 'tickets', 'priority_links', 'to_do_links', 'idea_links', 'task_links',
          'ticket_links', 'context_tab_settings'
        ];
        return allTables.filter(t => !existingTables.has(t));
      } finally {
        await connection.end();
      }
    }
  } catch (error) {
    console.error('Error checking system database schema:', error);
    throw new ValidationError(`Failed to check system database schema: ${error.message}`);
  }
}

export async function createSystemDbTable(tableName) {
  const config = loadSystemDbConfig();
  const current = getCurrentConfig();

  const targetConfig = config || {
    dbType: current.type || 'mysql',
    host: current.host,
    port: current.port,
    database: current.database,
    user: current.user,
    password: current.password,
  };

  if (!targetConfig.host || !targetConfig.user || !targetConfig.database) {
    throw new ValidationError('System database configuration is incomplete');
  }

  try {
    if (targetConfig.dbType === 'mssql') {
      const password = targetConfig.password_enc
        ? resolvePassword(targetConfig.password_enc, undefined)
        : targetConfig.password;

      const pool = await mssql.connect({
        server: targetConfig.host,
        port: targetConfig.port ? Number(targetConfig.port) : 1433,
        user: targetConfig.user,
        password,
        database: targetConfig.database,
        options: { encrypt: true, trustServerCertificate: false },
      });

      try {
        // Run full schema which is idempotent - will create the table if missing
        await createMssqlSchema(pool);
      } finally {
        await pool.close();
      }
    } else {
      const password = targetConfig.password_enc
        ? resolvePassword(targetConfig.password_enc, undefined)
        : targetConfig.password;

      const connection = await mysql.createConnection({
        host: targetConfig.host,
        port: targetConfig.port ? Number(targetConfig.port) : 3306,
        user: targetConfig.user,
        password,
        database: targetConfig.database,
      });

      try {
        // Run full schema which is idempotent - will create the table if missing
        await createMysqlSchema(connection);
      } finally {
        await connection.end();
      }
    }

    return { message: `Table ${tableName} created successfully` };
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error);
    throw new ValidationError(`Failed to create table ${tableName}: ${error.message}`);
  }
}
