import * as db from "../database/connectionPool.js";
import { mysqlSchemaExists } from "../database/schema/mysqlSchema.js";
import { mssqlSchemaExists } from "../database/schema/mssqlSchema.js";

// Cheap, cached health check used to gate whether the app can render normally
// or needs to send the user to /setup. Cached briefly so the gate middleware
// (which runs on every page load) doesn't hit the database on every request.
let cached = null;
let cachedAt = 0;
const TTL_MS = 5000;

export async function checkDbHealth(force = false) {
  if (!force && cached && Date.now() - cachedAt < TTL_MS) {
    return cached;
  }

  let result;
  try {
    const config = db.getCurrentConfig();
    const pool = await db.getPool();
    if (config.type === "mssql") {
      const schemaExists = await mssqlSchemaExists(pool);
      result = { connected: true, schemaExists, error: null };
    } else {
      const connection = await pool.getConnection();
      try {
        const schemaExists = await mysqlSchemaExists(connection);
        result = { connected: true, schemaExists, error: null };
      } finally {
        connection.release();
      }
    }
  } catch (error) {
    result = { connected: false, schemaExists: null, error: error.message };
  }

  cached = result;
  cachedAt = Date.now();
  return result;
}

// Called after anything that changes what the live pool points at or creates
// the schema, so the very next check reflects reality instead of serving a
// stale cached result for up to TTL_MS.
export function invalidateDbHealthCache() {
  cached = null;
}
