import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// A hardcoded fallback session secret would mean every install that forgets
// to set SESSION_SECRET signs cookies with the same publicly-known value
// (it's sitting right here in the repo) - anyone could forge a valid
// session. Falls back to a random secret generated once and cached in
// data/ instead, so sessions still survive restarts without ever using a
// known value. Set SESSION_SECRET explicitly for any multi-process/load-
// balanced deployment, where every process needs the same secret.
function getOrCreateSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  const secretPath = path.join(__dirname, '../../data/.session-secret');
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    // Filesystem unavailable for some reason - a secret that's at least
    // random and unique to this process is still far better than a
    // hardcoded, publicly-known one, even though it won't survive a restart.
    return crypto.randomBytes(48).toString('hex');
  }
}

// Same self-managing pattern as getOrCreateSessionSecret, but deliberately
// does NOT fall back to an ephemeral in-memory key on filesystem failure.
// A session secret that fails to persist just logs everyone out early; an
// encryption key that fails to persist would silently doom every DB
// password saved this run to the exact "could not be decrypted" state this
// is meant to prevent - better to fail loudly at startup than corrupt data.
function getOrCreateConfigEncryptionKey() {
  if (process.env.CONFIG_ENCRYPTION_KEY) return process.env.CONFIG_ENCRYPTION_KEY;

  const keyPath = path.join(__dirname, '../../data/.config-encryption-key');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8').trim();
  }

  const generated = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, generated, { mode: 0o600 });
  return generated;
}

const config = {
  app: {
    name: process.env.APP_NAME || 'MyWork',
    port: parseInt(process.env.APP_PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    url: process.env.APP_URL || 'http://localhost:3000',
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
    // MSSQL TLS. The defaults are Azure SQL's requirements and are what the
    // pool used to hardcode, so nothing changes unless these are set. They
    // exist because those defaults make an on-prem SQL Server unreachable: a
    // self-signed or internal-CA certificate fails validation, and there was no
    // way to say so. Only relax the second one on a network you trust.
    mssqlEncrypt: process.env.DB_MSSQL_ENCRYPT !== 'false',
    mssqlTrustServerCertificate: process.env.DB_MSSQL_TRUST_SERVER_CERT === 'true',
  },
  session: {
    secret: getOrCreateSessionSecret(),
    timeout: parseInt(process.env.SESSION_TIMEOUT || '1800000', 10),
  },
  security: {
    csrf: process.env.CSRF_ENABLED === 'true',
    helmet: process.env.HELMET_ENABLED !== 'false',
    cors: process.env.CORS_ENABLED === 'true',
    configEncryptionKey: getOrCreateConfigEncryptionKey(),
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
  oauth: {
    microsoft: {
      tenantId: process.env.OAUTH_MICROSOFT_TENANT_ID || 'common',
      clientId: process.env.OAUTH_MICROSOFT_CLIENT_ID,
      clientSecret: process.env.OAUTH_MICROSOFT_CLIENT_SECRET,
    },
  },
};

export default config;
