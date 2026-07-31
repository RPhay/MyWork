import app from './src/app.js';
import config from './src/config/environment.js';
import logger from './src/utils/logger.js';
import { closePool, reconfigure } from './src/database/connectionPool.js';
import { getActiveMysqlConnectionConfig } from './src/services/databaseConfigService.js';

const port = config.app.port;

// If a MySQL/MariaDB profile is set active in Settings > Database Configuration,
// it takes over as the live connection at every startup - .env.local is only
// the fallback when no active profile is saved. Never blocks startup: falls
// back to .env.local's default on any failure (e.g. CONFIG_ENCRYPTION_KEY unset).
try {
  const activeConfig = getActiveMysqlConnectionConfig();
  if (activeConfig) {
    await reconfigure(activeConfig);
    logger.info('Using active MySQL/MariaDB profile from Database Configuration', { host: activeConfig.host, database: activeConfig.database });
  }
} catch (error) {
  logger.error('Could not apply active database profile, falling back to .env.local:', error);
}

const server = app.listen(port, () => {
  logger.info(`${config.app.name} server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    await closePool();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    await closePool();
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
