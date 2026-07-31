import app from './src/app.js';
import config from './src/config/environment.js';
import logger from './src/utils/logger.js';
import { closePool } from './src/database/connectionPool.js';
import { applyCachedConnectionAtBoot } from './src/services/activeContextService.js';

const port = config.app.port;

// Each context can point at its own database, so reconnect to whichever one
// was live last time before anything else runs - see
// activeContextService.applyCachedConnectionAtBoot for why. .env.local's
// default is only ever used the very first time, before any context has gone
// live. Never blocks startup: falls back to .env.local's default on any
// failure (e.g. that database being unreachable right now).
await applyCachedConnectionAtBoot();

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
