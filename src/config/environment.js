import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const config = {
  app: {
    name: process.env.APP_NAME || 'MyWork',
    port: parseInt(process.env.APP_PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    type: process.env.DB_TYPE || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'mywork',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
    timeout: parseInt(process.env.DB_TIMEOUT || '30000', 10),
  },
  session: {
    secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    timeout: parseInt(process.env.SESSION_TIMEOUT || '1800000', 10),
  },
  security: {
    csrf: process.env.CSRF_ENABLED === 'true',
    helmet: process.env.HELMET_ENABLED !== 'false',
    cors: process.env.CORS_ENABLED === 'true',
    configEncryptionKey: process.env.CONFIG_ENCRYPTION_KEY || '',
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
  export: {
    maxRecords: parseInt(process.env.EXPORT_MAX_RECORDS || '10000', 10),
    tempDir: process.env.EXPORT_TEMP_DIR || './tmp/exports',
    logoPath: process.env.PDF_LOGO_PATH || './public/images/logo.png',
  },
};

export default config;
