import mysql from 'mysql2/promise.js';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

let pool;

async function getPool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
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

async function query(sql, values = []) {
  try {
    const p = await getPool();
    const [results] = await p.execute(sql, values);
    return results;
  } catch (error) {
    logger.error('Database query error:', { sql, error });
    throw error;
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

async function closePool() {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
}

export { getPool, query, queryOne, insert, update, deleteRecord, closePool };
