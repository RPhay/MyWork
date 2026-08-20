import mysql from 'mysql2/promise.js';
import config from '../src/config/environment.js';
import logger from '../src/utils/logger.js';
import { createMysqlSchema } from '../src/database/schema/mysqlSchema.js';

async function initDatabase() {
  let connection;
  try {
    logger.info('Initializing database...');

    // Connect to MySQL without specifying database
    connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
    });

    logger.info(`Creating database: ${config.database.name}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.name}\``);

    // Switch to the database
    await connection.query(`USE \`${config.database.name}\``);

    logger.info('Creating tables...');
    await createMysqlSchema(connection);

    logger.info('Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
