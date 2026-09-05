import mysql from "mysql2/promise.js";
import mssql from "mssql";
import config from "../config/environment.js";
import logger from "../utils/logger.js";
import {
  rewriteInsertIgnoreForMssql,
  rewriteCharLengthForMssql,
  rewriteJsonExtractForMssql,
  rewriteLimitForMssql,
  rewriteNowForMssql,
  rewriteUpsertForMssql,
  toNamedParams,
  qualifyTablesForMssql,
  MSSQL_SCHEMA,
  assertNoUnqualifiedTables,} from "./mssqlTranslation.js";

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

// The tables that actually exist in [MyWork], used to pin every reference to
// that schema. Read from the server rather than hardcoded, so it cannot drift
// from the real schema and cannot invent a name. Cleared whenever the pool is
// reconfigured or closed, and refreshed after a schema build creates tables
// that were not there when it was first read.
let mssqlKnownTables = null;

export function clearMssqlTableCache() {
  mssqlKnownTables = null;
}

async function getMssqlKnownTables() {
  if (mssqlKnownTables) return mssqlKnownTables;
  try {
    const p = await getPool();
    const result = await p
      .request()
      .query(
        `SELECT name FROM sys.tables WHERE SCHEMA_NAME(schema_id) = '${MSSQL_SCHEMA}'`,
      );
    mssqlKnownTables = new Set(
      result.recordset.map((r) => String(r.name).toLowerCase()),
    );
  } catch (error) {
    // A FAILURE, not a fallback. Without the table list nothing can be
    // qualified, and continuing means every statement in this process
    // silently addresses dbo instead of [MyWork] - saving rows that are
    // never seen again, with no error anywhere. Empty-set-so-qualify-nothing
    // is exactly how that stayed invisible. See CLAUDE.md.
    logger.error("Could not read the MyWork table list:", error);
    mssqlKnownTables = null;
    throw new Error(
      `Cannot address the ${MSSQL_SCHEMA} schema: its table list could not be read (${error.message})`,
    );
  }
  return mssqlKnownTables;
}

// `getRequest` defaults to a fresh request off the ambient pool, but
// withTransaction() passes one pinned to a single mssql.Transaction instead -
// same translation/qualification pipeline either way, just a different
// connection underneath.
async function executeMssql(sqlText, values, getRequest = defaultMssqlRequest) {
  let rewritten = rewriteInsertIgnoreForMssql(sqlText, values);
  // Upsert before the rest: it rewrites the whole statement, so anything that
  // edits fragments has to see the finished shape.
  rewritten = rewriteUpsertForMssql(rewritten.sql, rewritten.values);
  rewritten.sql = rewriteNowForMssql(rewritten.sql);
  rewritten.sql = rewriteCharLengthForMssql(rewritten.sql);
  rewritten.sql = rewriteJsonExtractForMssql(rewritten.sql);
  rewritten.sql = rewriteLimitForMssql(rewritten.sql);
  // Last, so it sees the finished statement: the rewrites above can introduce
  // table references of their own (the upsert becomes a MERGE naming its
  // target), and those need pinning to [MyWork] just as much as the original.
  const knownTables = await getMssqlKnownTables();
  rewritten.sql = qualifyTablesForMssql(rewritten.sql, knownTables);
  // Checked, not trusted - see assertNoUnqualifiedTables.
  assertNoUnqualifiedTables(rewritten.sql, knownTables);
  const { translatedSql, params } = toNamedParams(
    rewritten.sql,
    rewritten.values,
  );

  const isInsert = /\bINSERT\s+INTO\b/i.test(translatedSql);
  const finalSql = isInsert
    ? `${translatedSql}; SELECT SCOPE_IDENTITY() AS insertId;`
    : translatedSql;

  const request = await getRequest();
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

async function defaultMssqlRequest() {
  const p = await getPool();
  return p.request();
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
      // Azure SQL requires encrypted connections, so that stays the default.
      // These used to be hardcoded, which made an on-prem SQL Server
      // unreachable - a self-signed or internal-CA certificate fails validation
      // and there was no way to say otherwise. See DB_MSSQL_ENCRYPT and
      // DB_MSSQL_TRUST_SERVER_CERT in .env.example.
      options: {
        encrypt: config.database.mssqlEncrypt,
        trustServerCertificate: config.database.mssqlTrustServerCertificate,
      },
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
  // Swap FIRST, close after. The old version awaited the close before
  // clearing `pool` and updating `currentConfig`, which left both still
  // pointing at the old target for the whole duration of that await - a
  // concurrent query arriving in that window used a pool that was in the
  // middle of closing, against a config that was about to be replaced out
  // from under it. Nulling `pool` and installing the new config synchronously,
  // before any await, means a concurrent getPool() sees no live pool the
  // instant this function starts and lazily opens a fresh one against the new
  // target - there is no window where the two disagree.
  const oldPool = pool;
  const oldType = currentConfig.type;
  pool = undefined;
  currentConfig = { type: "mysql", ...newConfig };
  clearMssqlTableCache();
  logger.info("Database connection pool reconfigured", {
    type: currentConfig.type,
    host: newConfig.host,
    database: newConfig.database,
  });

  if (oldPool) {
    try {
      if (oldType === "mssql") {
        await oldPool.close();
      } else {
        await oldPool.end();
      }
    } catch (error) {
      // The new pool is already live and in charge - a failure tearing down
      // the old one is a leak to log, not a reason to fail the reconfigure.
      logger.warn("Error closing the previous connection pool during reconfigure:", error);
    }
  }
}

// Same shape query() has always thrown - the friendly message from
// describeDbError, plus code/number/cause for anything (isDuplicateKeyError,
// callers matching on error.code) that needs the original underneath.
// Factored out so withTransaction()'s query function wraps errors identically
// rather than growing a second, slightly-different copy of this.
function wrapDbError(error, sqlText) {
  logger.error("Database query error:", { sql: sqlText, error });
  const dbError = new Error(describeDbError(error));
  dbError.code = error.code || error.errors?.[0]?.code;
  dbError.number = error.number;
  dbError.cause = error;
  return dbError;
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
    throw wrapDbError(error, sqlText);
  }
}

// Runs `work(txQuery)` inside one real database transaction: every txQuery()
// call shares the same connection, and either all of them are committed or
// none are. Use this for a multi-statement operation where a failure partway
// through must not leave the database half-changed - a restore, a multi-row
// move, anything the old MySQL-only code used to wrap in
// beginTransaction()/commit()/rollback() before this existed as a
// cross-engine primitive.
//
// `work` may throw anything, not just a query failure (a ValidationError
// deciding the operation shouldn't proceed at all, say) - that still rolls
// back and rethrows exactly what was thrown, unwrapped. Only errors from
// txQuery() itself go through wrapDbError, matching query()'s behaviour.
async function withTransaction(work) {
  if (currentConfig.type === "mssql") {
    const p = await getPool();
    const transaction = new mssql.Transaction(p);
    await transaction.begin();
    const txQuery = async (sqlText, values = []) => {
      try {
        return await executeMssql(sqlText, values, () => new mssql.Request(transaction));
      } catch (error) {
        throw wrapDbError(error, sqlText);
      }
    };
    try {
      const result = await work(txQuery);
      await transaction.commit();
      return result;
    } catch (error) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.warn("Error rolling back MSSQL transaction:", rollbackError);
      }
      throw error;
    }
  }

  const p = await getPool();
  const connection = await p.getConnection();
  try {
    await connection.beginTransaction();
    const txQuery = async (sqlText, values = []) => {
      try {
        const [results] = await connection.execute(sqlText, values);
        return results;
      } catch (error) {
        throw wrapDbError(error, sqlText);
      }
    };
    const result = await work(txQuery);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.warn("Error rolling back MySQL transaction:", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
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

// True for a duplicate-key violation on either engine, and unwrapped or
// wrapped (checks error.cause too, since query() wraps driver errors).
function isDuplicateKeyError(error) {
  if (!error) return false;
  const code = error.code || error.cause?.code;
  const number = error.number ?? error.cause?.number;
  return code === "ER_DUP_ENTRY" || number === 2601 || number === 2627;
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
  isDuplicateKeyError,
  withTransaction,
};
