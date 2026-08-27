// Permanent connection pool for the machine's home database (from .env.local).
// Unlike connectionPool.js, this pool is NEVER reconfigured — it always targets
// the DB that was set up at first run. Structural tables (contexts, users,
// context_folders, context_tab_settings) always read/write here so they remain
// visible regardless of which per-context database the content pool is using.

import mysql from "mysql2/promise.js";
import mssql from "mssql";
import config from "../config/environment.js";
import logger from "../utils/logger.js";
import {
  rewriteInsertIgnoreForMssql,
  rewriteNowForMssql,
  toNamedParams,
  qualifyTablesForMssql,
  assertNoUnqualifiedTables,
  MSSQL_SCHEMA,
} from "./mssqlTranslation.js";
import { createMysqlSchema } from "./schema/mysqlSchema.js";
import { createMssqlSchema } from "./schema/mssqlSchema.js";

const homeConfig = {
  type: config.database.type || "mysql",
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
};

let pool;
let schemaInitialized = false;

async function getPool() {
  if (pool) return pool;

  if (homeConfig.type === "mssql") {
    const mssqlPool = new mssql.ConnectionPool({
      server: homeConfig.host,
      port: homeConfig.port ? Number(homeConfig.port) : 1433,
      user: homeConfig.user,
      password: homeConfig.password,
      database: homeConfig.database,
      connectionTimeout: 10000,
      options: { encrypt: true, trustServerCertificate: false },
      pool: { max: config.database.poolMax, min: config.database.poolMin },
    });
    mssqlPool.on("error", (err) => logger.error("Home pool error:", err));
    pool = await mssqlPool.connect();
    logger.info("Home database pool created (MSSQL)");

    // Initialize schema on first pool creation
    if (!schemaInitialized) {
      try {
        await createMssqlSchema(pool);
        schemaInitialized = true;
      } catch (error) {
        logger.error("Error initializing MSSQL schema:", error);
      }
    }

    return pool;
  }

  pool = mysql.createPool({
    host: homeConfig.host,
    port: homeConfig.port,
    user: homeConfig.user,
    password: homeConfig.password,
    database: homeConfig.database,
    waitForConnections: true,
    connectionLimit: config.database.poolMax,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0,
  });
  pool.on("error", (err) => logger.error("Home pool error:", err));
  logger.info("Home database pool created (MySQL/MariaDB)");

  // Initialize schema on first pool creation
  if (!schemaInitialized) {
    try {
      const connection = await pool.getConnection();
      try {
        await createMysqlSchema(connection);
        schemaInitialized = true;
      } finally {
        await connection.release();
      }
    } catch (error) {
      logger.error("Error initializing MySQL schema:", error);
    }
  }

  return pool;
}

// The [MyWork] table list, for qualification. Mirrors connectionPool's cache
// deliberately rather than sharing it: the two pools point at different
// databases, so one set of table names cannot describe both.
let mssqlKnownTables = null;

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
    // A failure, not a fallback - see the dbo section in CLAUDE.md.
    logger.error("Could not read the MyWork table list (home pool):", error);
    mssqlKnownTables = null;
    throw new Error(
      `Cannot address the ${MSSQL_SCHEMA} schema: its table list could not be read (${error.message})`,
    );
  }
  return mssqlKnownTables;
}

async function executeMssql(sqlText, values) {
  const rewritten = rewriteInsertIgnoreForMssql(sqlText, values);
  rewritten.sql = rewriteNowForMssql(rewritten.sql);

  // THIS POOL QUALIFIES TOO. It did not until 2026-08-27, so every read and
  // write of users, contexts, context_folders, context_tab_settings and
  // user_identities went out unqualified and resolved against the login's
  // default schema - silently addressing dbo whenever that was not [MyWork].
  // It appeared to work only by luck. See CLAUDE.md.
  const knownTables = await getMssqlKnownTables();
  rewritten.sql = qualifyTablesForMssql(rewritten.sql, knownTables);
  assertNoUnqualifiedTables(rewritten.sql, knownTables);

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

export async function query(sqlText, values = []) {
  try {
    if (homeConfig.type === "mssql") return await executeMssql(sqlText, values);
    const p = await getPool();
    const [results] = await p.execute(sqlText, values);
    return results;
  } catch (error) {
    logger.error("Home pool query error:", { sql: sqlText, error });
    throw error;
  }
}

export async function queryOne(sqlText, values = []) {
  const results = await query(sqlText, values);
  return results.length > 0 ? results[0] : null;
}

export async function insert(sqlText, values = []) {
  const results = await query(sqlText, values);
  return results.insertId;
}

export async function update(sqlText, values = []) {
  const results = await query(sqlText, values);
  return results.affectedRows;
}

export async function deleteRecord(sqlText, values = []) {
  const results = await query(sqlText, values);
  return results.affectedRows;
}

export function getHomeConfig() {
  return { ...homeConfig };
}
