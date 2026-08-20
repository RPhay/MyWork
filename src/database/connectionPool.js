import mysql from "mysql2/promise.js";
import mssql from "mssql";
import config from "../config/environment.js";
import logger from "../utils/logger.js";
import {
  rewriteInsertIgnoreForMssql,
  rewriteJsonExtractForMssql,
  rewriteLimitForMssql,
  rewriteNowForMssql,
  rewriteUpsertForMssql,
  toNamedParams,
} from "./mssqlTranslation.js";

let pool;
let currentConfig = {
  type: config.database.type || "mysql",
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
    case "ECONNREFUSED":
      return "Unable to connect to the database. Please verify the database server is running and reachable.";
    case "ETIMEDOUT":
    case "ETIMEOUT":
      return "The database connection timed out. Please try again in a moment.";
    case "ER_ACCESS_DENIED_ERROR":
      return "Database access was denied. Check the configured database credentials.";
    case "ELOGIN":
      return "Database login failed. Check the configured database credentials.";
    case "ER_BAD_DB_ERROR":
    case "ER_DBACCESS_DENIED_ERROR":
      return "The configured database does not exist or is not accessible to this login. Run the database setup script.";
    case "ER_NO_SUCH_TABLE":
      return "A required database table is missing. Run the database setup script.";
    case "ER_DUP_ENTRY":
      return "A record with that value already exists.";
    case "ER_NO_REFERENCED_ROW":
    case "ER_NO_REFERENCED_ROW_2":
      return "That references a record which does not exist.";
    case "ER_ROW_IS_REFERENCED":
    case "ER_ROW_IS_REFERENCED_2":
      return "That is still in use by other records and cannot be deleted.";
    case "EREQUEST": {
      // MSSQL wraps the actual SQL Server error number here rather than a code string.
      switch (error.number) {
        case 2601:
        case 2627:
          return "A record with that value already exists.";
        case 547:
          return "That references or is referenced by a record that does not exist, or is still in use.";
        default:
          return error.message || "An unexpected database error occurred.";
      }
    }
    default:
      return error.message || "An unexpected database error occurred.";
  }
}

// ---- MSSQL query translation -----------------------------------------------
// The rest of the app writes MySQL-flavored SQL (positional `?` placeholders,
// occasionally `INSERT IGNORE`). Rather than maintaining parallel queries
// everywhere, translate that into MSSQL-compatible SQL + named parameters
// here, in one place. This covers every query pattern actually used in this
// codebase - see connectionPool's test suite / the MSSQL smoke test for what
// that covers.

async function executeMssql(sqlText, values) {
  let rewritten = rewriteInsertIgnoreForMssql(sqlText, values);
  // Upsert before the rest: it rewrites the whole statement, so anything that
  // edits fragments has to see the finished shape.
  rewritten = rewriteUpsertForMssql(rewritten.sql, rewritten.values);
  rewritten.sql = rewriteNowForMssql(rewritten.sql);
  rewritten.sql = rewriteJsonExtractForMssql(rewritten.sql);
  rewritten.sql = rewriteLimitForMssql(rewritten.sql);
  const { translatedSql, params } = toNamedParams(
    rewritten.sql,
    rewritten.values,
  );

  const isInsert = /\bINSERT\s+INTO\b/i.test(translatedSql);
  const finalSql = isInsert
    ? `${translatedSql}; SELECT SCOPE_IDENTITY() AS insertId;`
    : translatedSql;

  const p = await getPool();
  const request = p.request();
  for (const [name, value] of Object.entries(params)) {
    request.input(name, value);
  }

  const result = await request.query(finalSql);
  const affectedRows = (result.rowsAffected && result.rowsAffected[0]) || 0;

  if (isInsert) {
    const insertId =
      result.recordset &&
      result.recordset[0] &&
      result.recordset[0].insertId != null
        ? Math.trunc(Number(result.recordset[0].insertId))
        : 0;
    return Object.assign([], { insertId, affectedRows });
  }

  return Object.assign(result.recordset || [], { affectedRows, insertId: 0 });
}

// ---- Pool management --------------------------------------------------------

async function getPool() {
  if (pool) {
    return pool;
  }

  if (currentConfig.type === "mssql") {
    const mssqlPool = new mssql.ConnectionPool({
      server: currentConfig.host,
      port: currentConfig.port ? Number(currentConfig.port) : 1433,
      user: currentConfig.user,
      password: currentConfig.password,
      database: currentConfig.database,
      connectionTimeout: 10000,
      // Azure SQL requires encrypted connections; this app only targets
      // SQL-login auth against Azure SQL for MSSQL (see contexts.ejs), so
      // these are fixed rather than user-configurable for now.
      options: { encrypt: true, trustServerCertificate: false },
      pool: { max: config.database.poolMax, min: config.database.poolMin },
    });
    mssqlPool.on("error", (err) => {
      logger.error("Pool error:", err);
    });
    pool = await mssqlPool.connect();
    logger.info("Database connection pool created (MSSQL)");
    return pool;
  }

  pool = mysql.createPool({
    host: currentConfig.host,
    port: currentConfig.port,
    user: currentConfig.user,
    password: currentConfig.password,
    database: currentConfig.database,
    waitForConnections: true,
    connectionLimit: config.database.poolMax,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0,
  });

  pool.on("error", (err) => {
    logger.error("Pool error:", err);
  });

  logger.info("Database connection pool created");
  return pool;
}

// Switches the live pool to a different target - used when a context's own
// database profile is applied. newConfig.type selects the driver ('mysql',
// the default, or 'mssql'). Closes the existing pool; the next query lazily
// opens a fresh one against the new target.
async function reconfigure(newConfig) {
  if (pool) {
    if (currentConfig.type === "mssql") {
      await pool.close();
    } else {
      await pool.end();
    }
    pool = undefined;
  }
  currentConfig = { type: "mysql", ...newConfig };
  logger.info("Database connection pool reconfigured", {
    type: currentConfig.type,
    host: newConfig.host,
    database: newConfig.database,
  });
}

async function query(sqlText, values = []) {
  try {
    if (currentConfig.type === "mssql") {
      return await executeMssql(sqlText, values);
    }
    const p = await getPool();
    const [results] = await p.execute(sqlText, values);
    return results;
  } catch (error) {
    logger.error("Database query error:", { sql: sqlText, error });
    const dbError = new Error(describeDbError(error));
    dbError.code = error.code || error.errors?.[0]?.code;
    dbError.cause = error;
    throw dbError;
  }
}

async function queryOne(sqlText, values = []) {
  const results = await query(sqlText, values);
  return results.length > 0 ? results[0] : null;
}

async function insert(sqlText, values = []) {
  try {
    const results = await query(sqlText, values);
    return results.insertId;
  } catch (error) {
    logger.error("Insert error:", error);
    throw error;
  }
}

async function update(sqlText, values = []) {
  try {
    const results = await query(sqlText, values);
    return results.affectedRows;
  } catch (error) {
    logger.error("Update error:", error);
    throw error;
  }
}

async function deleteRecord(sqlText, values = []) {
  try {
    const results = await query(sqlText, values);
    return results.affectedRows;
  } catch (error) {
    logger.error("Delete error:", error);
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
    if (currentConfig.type === "mssql") {
      await pool.close();
    } else {
      await pool.end();
    }
    logger.info("Database connection pool closed");
  }
}

export {
  getPool,
  query,
  queryOne,
  insert,
  update,
  deleteRecord,
  closePool,
  reconfigure,
  getCurrentConfig,
};
