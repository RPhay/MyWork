// Ad-hoc connections to a context's database, whichever engine it runs on.
//
// Why this exists rather than `connectionPool.js`: that pool is THE live
// connection - one context, one engine, swapped by Settings. Comparing two
// contexts means holding two connections open at once, and one of them is
// usually not the active one, so it cannot come from there.
//
// It is deliberately small. `connectionPool.js` translates arbitrary
// MySQL-flavoured SQL into T-SQL through `mssqlTranslation.js`, and relies on a
// cached table list to qualify names into `[MyWork]`. Nothing here needs that
// generality: every statement is written in this repo, against six known
// tables, so table names are emitted through `t()` and the only other dialect
// difference is `?` versus `@pN`. Routing these queries through the full
// translator would mean depending on its per-pool caches from a pool it does
// not own.
//
// The rule from CLAUDE.md still applies: MSSQL is verified by RUNNING it.

import mysql from 'mysql2/promise';
import sql from 'mssql';
import { getLiveConnectionConfig } from '../services/contextDatabaseConfigService.js';
import { ValidationError } from '../config/errors.js';
import env from '../config/environment.js';

// Every object lives in [MyWork] on SQL Server, never dbo - an unqualified
// name resolves against the caller's DEFAULT_SCHEMA and then dbo, silently
// finding nothing. See "MSSQL schema rules" in CLAUDE_REFERENCE.md.
const MSSQL_SCHEMA = 'MyWork';

/**
 * Open a connection to one context's database.
 *
 * Returns `{ type, query, close }`, where `query(sql, params)` takes
 * MySQL-style `?` placeholders and returns a plain array of rows on both
 * engines. Always close it - these are real connections, not pooled handles,
 * and a comparison opens two.
 */
export async function openContextConnection(contextId) {
  const config = await getLiveConnectionConfig(contextId);
  if (!config) {
    throw new ValidationError(
      `Context ${contextId} has no database connection configured`,
    );
  }

  if (config.type === 'mysql') return openMysql(config);
  if (config.type === 'mssql') return openMssql(config);
  throw new ValidationError(`Unknown database type: ${config.type}`);
}

/** Table name for the engine this connection speaks. */
export function tableName(type, name) {
  return type === 'mssql' ? `[${MSSQL_SCHEMA}].[${name}]` : name;
}

async function openMysql(config) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  return {
    type: 'mysql',
    database: config.database,
    t: (name) => tableName('mysql', name),
    async query(text, params = []) {
      const [rows] = await connection.query(text, params);
      return rows;
    },
    async close() {
      await connection.end();
    },
  };
}

async function openMssql(config) {
  const pool = await new sql.ConnectionPool({
    server: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    options: {
      // The same env-driven flags connectionPool.js uses, NOT the hardcoded
      // `encrypt: true, trustServerCertificate: false` in homePool.js and
      // contextService.js. Those defaults target Azure SQL; an on-prem server
      // with a self-signed or internal-CA certificate needs DB_MSSQL_ENCRYPT /
      // DB_MSSQL_TRUST_SERVER_CERT, and a comparison that cannot open the
      // connection is a comparison that never runs.
      encrypt: env.database.mssqlEncrypt,
      trustServerCertificate: env.database.mssqlTrustServerCertificate,
    },
  }).connect();

  return {
    type: 'mssql',
    database: config.database,
    t: (name) => tableName('mssql', name),
    async query(text, params = []) {
      // `?` -> `@pN`, positionally. Values are BOUND, never interpolated: the
      // driver sends a JS string as NVarChar, which is the only Unicode-safe
      // way in. Building the literal instead is what silently turned every
      // entity type icon into '?' - see the note in mssqlSchema.js.
      let i = 0;
      const named = text.replace(/\?/g, () => `@p${i++}`);
      const request = pool.request();
      params.forEach((value, index) => request.input(`p${index}`, value));
      const result = await request.query(named);
      return result.recordset || [];
    },
    async close() {
      await pool.close();
    },
  };
}

/**
 * Open both ends of a comparison, run `fn`, and close them whatever happens.
 * The close is in a `finally` for the same reason test teardown is in an
 * `afterEach`: the failure path is the one that leaks.
 */
export async function withContextPair(sourceContextId, targetContextId, fn) {
  if (String(sourceContextId) === String(targetContextId)) {
    throw new ValidationError('Source and target must be different contexts');
  }
  const source = await openContextConnection(sourceContextId);
  let target;
  try {
    target = await openContextConnection(targetContextId);
  } catch (error) {
    await source.close();
    throw error;
  }
  try {
    return await fn(source, target);
  } finally {
    await source.close().catch(() => {});
    await target.close().catch(() => {});
  }
}
