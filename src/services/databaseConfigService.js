import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise.js';
import mssql from 'mssql';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import { ValidationError } from '../config/errors.js';
import { mysqlSchemaExists, createMysqlSchema } from '../database/schema/mysqlSchema.js';
import { mssqlSchemaExists, createMssqlSchema } from '../database/schema/mssqlSchema.js';
import * as connectionPool from '../database/connectionPool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '../../data/db-connections.enc.json');

const VALID_TYPES = ['mysql', 'mssql'];

function readStore() {
  if (!fs.existsSync(STORE_PATH)) {
    return { activeType: 'mysql', mysql: null, mssql: null };
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

// The password is stored only as an encrypted blob and must never be sent back to
// the browser - callers only learn whether one has been set.
function maskProfile(profile) {
  if (!profile) return null;
  const { passwordEnc, ...rest } = profile;
  return { ...rest, hasPassword: !!passwordEnc };
}

function assertValidType(type) {
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError('Database type must be "mysql" (covers MySQL and MariaDB) or "mssql"');
  }
}

export function getConnectionConfig() {
  const store = readStore();
  return {
    activeType: store.activeType || 'mysql',
    mysql: maskProfile(store.mysql),
    mssql: maskProfile(store.mssql),
  };
}

export function saveConnectionProfile(type, data) {
  assertValidType(type);

  const store = readStore();
  const existing = store[type] || {};

  // A blank password field means "leave the stored one alone" - only re-encrypt
  // when the caller actually supplied a new value.
  const { password, ...fields } = data;
  const passwordEnc = password ? encrypt(password) : existing.passwordEnc || null;

  store[type] = { ...fields, passwordEnc };
  writeStore(store);

  return maskProfile(store[type]);
}

// Setting MySQL/MariaDB active actually switches the app's live connection
// pool, verified with a fresh connection test first so a bad profile can't
// break the running app. MSSQL has no query path anywhere in the app (every
// service queries through connectionPool.js, which is MySQL-only), so it
// can only ever record intent, not go live.
export async function setActiveType(type) {
  assertValidType(type);
  const store = readStore();

  if (type === 'mysql') {
    const profile = store.mysql;
    if (!profile || !profile.host || !profile.user || !profile.database) {
      throw new ValidationError('Save a complete MySQL/MariaDB profile (host, user, database) before setting it active');
    }

    const password = resolvePassword('mysql', undefined);
    const testResult = await testMysqlConnection(profile, password);
    if (!testResult.success) {
      throw new ValidationError(`Cannot activate - connection test failed: ${testResult.message}`);
    }

    await connectionPool.reconfigure({
      host: profile.host,
      port: profile.port ? Number(profile.port) : 3306,
      user: profile.user,
      password,
      database: profile.database,
    });
  }

  store.activeType = type;
  writeStore(store);
  return { activeType: type };
}

function resolvePassword(type, submittedPassword) {
  if (submittedPassword) return submittedPassword;
  const store = readStore();
  return decrypt(store[type]?.passwordEnc);
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

async function attemptMssqlConnection(options) {
  const pool = new mssql.ConnectionPool(options);
  try {
    await pool.connect();
    await pool.request().query('SELECT 1');
    return { pool };
  } catch (error) {
    try {
      await pool.close();
    } catch {
      // pool never connected - nothing to close
    }
    return { error };
  }
}

async function testMssqlConnection(data, password) {
  const baseOptions = {
    server: data.host,
    port: data.port ? Number(data.port) : 1433,
    user: data.user,
    password,
    connectionTimeout: 5000,
    options: {
      encrypt: data.encrypt !== false,
      trustServerCertificate: !!data.trustServerCertificate,
    },
  };

  if (data.database) {
    const attempt = await attemptMssqlConnection({ ...baseOptions, database: data.database });
    if (attempt.pool) {
      try {
        const schemaExists = await mssqlSchemaExists(attempt.pool);
        return { success: true, message: 'Connected successfully', schemaExists };
      } finally {
        await attempt.pool.close();
      }
    }
    // Falls through - the named database may simply not exist yet, so confirm the
    // server/credentials are otherwise valid before reporting a hard failure.
  }

  const attempt = await attemptMssqlConnection(baseOptions);
  if (attempt.error) {
    return { success: false, message: attempt.error.message || 'Connection failed' };
  }
  await attempt.pool.close();
  return {
    success: true,
    message: 'Connected successfully',
    schemaExists: data.database ? false : null,
  };
}

export async function testConnection(type, data) {
  assertValidType(type);

  const password = resolvePassword(type, data.password);
  return type === 'mysql'
    ? testMysqlConnection(data, password)
    : testMssqlConnection(data, password);
}

export async function createSchema(type, data) {
  assertValidType(type);

  if (!data.database) {
    throw new ValidationError('A database name is required to create the schema');
  }

  const password = resolvePassword(type, data.password);

  if (type === 'mysql') {
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
  } else {
    const baseOptions = {
      server: data.host,
      port: data.port ? Number(data.port) : 1433,
      user: data.user,
      password,
      connectionTimeout: 10000,
      options: {
        encrypt: data.encrypt !== false,
        trustServerCertificate: !!data.trustServerCertificate,
      },
    };

    // Connect to master first to create the database if it doesn't exist yet
    // (mirrors MySQL's CREATE DATABASE IF NOT EXISTS). CREATE DATABASE must be
    // the only statement in its batch.
    const masterPool = new mssql.ConnectionPool({ ...baseOptions, database: 'master' });
    try {
      await masterPool.connect();
      const request = masterPool.request();
      request.input('dbname', data.database);
      const existsResult = await request.query('SELECT database_id FROM sys.databases WHERE name = @dbname');
      if (existsResult.recordset.length === 0) {
        await masterPool.request().query(`CREATE DATABASE [${data.database}]`);
      }
    } finally {
      await masterPool.close();
    }

    const pool = new mssql.ConnectionPool({ ...baseOptions, database: data.database });
    try {
      await pool.connect();
      await createMssqlSchema(pool);
    } finally {
      await pool.close();
    }
  }

  return { success: true, message: 'Schema created successfully' };
}
