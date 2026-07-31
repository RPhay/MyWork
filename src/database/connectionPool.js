import mysql from 'mysql2/promise.js';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

let pool;
let currentConfig = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
};

// mysql2 connection failures often surface as an AggregateError with an empty
// top-level message, so callers see "Error: " with no detail. Translate known
// error codes into a clear, human-readable message before it reaches the API response.
function describeDbError(error) {
  const code = error.code || error.errors?.[0]?.code;

  switch (code) {
    case 'ECONNREFUSED':
      return 'Unable to connect to the database. Please verify the database server is running and reachable.';
    case 'ETIMEDOUT':
      return 'The database connection timed out. Please try again in a moment.';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Database access was denied. Check the configured database credentials.';
    case 'ER_BAD_DB_ERROR':
      return 'The configured database does not exist. Run the database setup script.';
    case 'ER_NO_SUCH_TABLE':
      return 'A required database table is missing. Run the database setup script.';
    case 'ER_DUP_ENTRY':
      return 'A record with that value already exists.';
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return 'That references a record which does not exist.';
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return 'That is still in use by other records and cannot be deleted.';
    default:
      return error.message || 'An unexpected database error occurred.';
  }
}

async function getPool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    ...currentConfig,
    waitForConnections: true,
    connectionLimit: config.database.poolMax,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0,
  });

  pool.on('error', (err) => {
    logger.error('Pool error:', err);
  });

  logger.info('Database connection pool created');
  return pool;
}

// Switches the live pool to a different MySQL/MariaDB target - used when a
// Settings > Database Configuration profile is set active. Closes the existing
// pool; the next query lazily opens a fresh one against the new target.
async function reconfigure(newConfig) {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
  currentConfig = { ...newConfig };
  logger.info('Database connection pool reconfigured', { host: newConfig.host, database: newConfig.database });
}

async function query(sql, values = []) {
  try {
    const p = await getPool();
    const [results] = await p.execute(sql, values);
    return results;
  } catch (error) {
    logger.error('Database query error:', { sql, error });
    const dbError = new Error(describeDbError(error));
    dbError.code = error.code || error.errors?.[0]?.code;
    dbError.cause = error;
    throw dbError;
  }
}

async function queryOne(sql, values = []) {
  const results = await query(sql, values);
  return results.length > 0 ? results[0] : null;
}

async function insert(sql, values = []) {
  try {
    const results = await query(sql, values);
    return results.insertId;
  } catch (error) {
    logger.error('Insert error:', error);
    throw error;
  }
}

async function update(sql, values = []) {
  try {
    const results = await query(sql, values);
    return results.affectedRows;
  } catch (error) {
    logger.error('Update error:', error);
    throw error;
  }
}

async function deleteRecord(sql, values = []) {
  try {
    const results = await query(sql, values);
    return results.affectedRows;
  } catch (error) {
    logger.error('Delete error:', error);
    throw error;
  }
}

// Used by setupService when resuming a first-run setup where the connection
// already succeeded (page reload, schema creation not yet done) - lets it
// reuse the live config to create the schema without asking the user to
// re-enter host/user/password they already gave on a previous step.
function getCurrentConfig() {
  return { ...currentConfig };
}

async function closePool() {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
}

export { getPool, query, queryOne, insert, update, deleteRecord, closePool, reconfigure, getCurrentConfig };
