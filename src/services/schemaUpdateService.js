import { getPool, getCurrentConfig } from '../database/connectionPool.js';
import { mysqlSchemaExists, createMysqlSchema } from '../database/schema/mysqlSchema.js';
import { mssqlSchemaExists, createMssqlSchema } from '../database/schema/mssqlSchema.js';

async function checkAndUpdateSchema(contextId) {
  const config = getCurrentConfig();
  const dbType = config.type || 'mysql';

  if (dbType === 'mysql') {
    return await checkAndUpdateMysqlSchema(contextId);
  } else if (dbType === 'mssql') {
    return await checkAndUpdateMssqlSchema(contextId);
  }

  throw new Error(`Unsupported database type: ${dbType}`);
}

async function checkAndUpdateMysqlSchema(contextId) {
  const pool = await getPool();
  const results = {
    schemaExists: false,
    schemaUpdated: false,
    message: '',
    errors: []
  };

  try {
    const conn = await pool.getConnection();
    try {
      const exists = await mysqlSchemaExists(conn);
      results.schemaExists = exists;

      if (!exists) {
        await createMysqlSchema(conn);
        results.schemaUpdated = true;
        results.message = 'Database schema created successfully';
      } else {
        // Schema already exists - run create again which will add any missing tables/columns
        // The CREATE TABLE IF NOT EXISTS statements are idempotent
        await createMysqlSchema(conn);
        results.message = 'Database schema is up to date';
      }

      return results;
    } finally {
      conn.release();
    }
  } catch (error) {
    results.errors.push(error.message);
    results.message = 'Error updating schema';
    return results;
  }
}

async function checkAndUpdateMssqlSchema(contextId) {
  const pool = await getPool();
  const results = {
    schemaExists: false,
    schemaUpdated: false,
    message: '',
    errors: []
  };

  try {
    const exists = await mssqlSchemaExists(pool);
    results.schemaExists = exists;

    if (!exists) {
      await createMssqlSchema(pool);
      results.schemaUpdated = true;
      results.message = 'Database schema created successfully';
    } else {
      results.message = 'Database schema is up to date';
    }

    return results;
  } catch (error) {
    results.errors.push(error.message);
    results.message = 'Error updating schema';
    return results;
  }
}

export { checkAndUpdateSchema };
