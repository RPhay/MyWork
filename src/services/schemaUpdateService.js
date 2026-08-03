import { getPool, getCurrentConfig } from '../database/connectionPool.js';
import { createMysqlSchema } from '../database/schema/mysqlSchema.js';
import { createMssqlSchema } from '../database/schema/mssqlSchema.js';

async function checkAndUpdateSchema(contextId) {
  const config = getCurrentConfig();
  const dbType = config.type || 'mysql';

  const results = {
    message: '',
    errors: []
  };

  try {
    if (dbType === 'mysql') {
      const pool = await getPool();
      const conn = await pool.getConnection();
      try {
        await createMysqlSchema(conn);
        results.message = 'Database schema is up to date';
      } finally {
        conn.release();
      }
    } else if (dbType === 'mssql') {
      const pool = await getPool();
      await createMssqlSchema(pool);
      results.message = 'Database schema is up to date';
    } else {
      throw new Error(`Unsupported database type: ${dbType}`);
    }

    return results;
  } catch (error) {
    results.errors.push({
      message: error.message
    });
    results.message = 'Error updating schema: ' + error.message;
    return results;
  }
}

export { checkAndUpdateSchema };
