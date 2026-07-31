import mysql from 'mysql2/promise.js';
import { mysqlSchemaExists, createMysqlSchema } from '../database/schema/mysqlSchema.js';
import { applyBootstrapConnection } from './activeContextService.js';
import { getCurrentConfig } from '../database/connectionPool.js';
import { invalidateDbHealthCache } from '../utils/dbHealth.js';
import { validateIdentifier } from '../utils/validateIdentifier.js';
import { ValidationError } from '../config/errors.js';

// First-run bootstrap: get MyWork pointed at *a* working MySQL/MariaDB server
// and schema before anything else (contexts, tabs, etc.) can exist. Mirrors
// contextDatabaseConfigService.js's MySQL test/create-schema logic, but
// deliberately has no dependency on the `contexts` table - it may not exist
// yet, which is exactly the situation this is for.

async function attemptConnection(options) {
  try {
    const connection = await mysql.createConnection(options);
    await connection.ping();
    return { connection };
  } catch (error) {
    return { error };
  }
}

export async function testConnection(data) {
  if (!data.host || !data.user) {
    throw new ValidationError('Host and user are required');
  }

  const baseOptions = {
    host: data.host,
    port: data.port ? Number(data.port) : 3306,
    user: data.user,
    password: data.password || '',
    connectTimeout: 5000,
  };

  if (data.database) {
    const attempt = await attemptConnection({ ...baseOptions, database: data.database });
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

  const attempt = await attemptConnection(baseOptions);
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

// Tests, then (if successful) commits to this connection as the live pool and
// caches it for future restarts. This is the "once successfully connected"
// moment the setup flow hinges on.
export async function connectAndActivate(data) {
  const testResult = await testConnection(data);
  if (!testResult.success) {
    return testResult;
  }

  await applyBootstrapConnection({
    host: data.host,
    port: data.port ? Number(data.port) : 3306,
    user: data.user,
    password: data.password || '',
    database: data.database || undefined,
  });
  invalidateDbHealthCache();

  return testResult;
}

export async function createSchema(data) {
  // Resuming after a reload: the connection already succeeded on a previous
  // step (page reload before schema creation), so no fresh form data was
  // submitted this time - reuse the live pool's own config instead of
  // requiring the user to type the same details in again.
  const effective = data && data.host ? data : getCurrentConfig();

  if (!effective.database) {
    throw new ValidationError('A database name is required to create the schema');
  }
  validateIdentifier(effective.database, 'Database name');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: effective.host,
      port: effective.port ? Number(effective.port) : 3306,
      user: effective.user,
      password: effective.password || '',
      connectTimeout: 10000,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${effective.database}\``);
    await connection.query(`USE \`${effective.database}\``);
    await createMysqlSchema(connection);
  } finally {
    if (connection) await connection.end();
  }

  // The schema now exists in the database the live pool is already pointed
  // at (connectAndActivate must run first - see setup.js), so re-checking
  // health immediately after this reflects the new schema.
  invalidateDbHealthCache();

  return { success: true, message: 'Schema created successfully' };
}
