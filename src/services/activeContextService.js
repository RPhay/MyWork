import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ValidationError } from '../config/errors.js';
import { getContextById, getAllContexts } from './contextService.js';
import { getLiveConnectionConfig } from './contextDatabaseConfigService.js';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import * as connectionPool from '../database/connectionPool.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '../../data/active-context.json');

function readStore() {
  if (!fs.existsSync(STORE_PATH)) {
    return { activeContextId: null, lastLiveConfig: null };
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Resolves the server's current active context id, persisted across restarts
// (data/active-context.json, not session-based). Falls back to the first
// context (by order_index) if none has been explicitly set yet, or if the
// previously-set one no longer exists (e.g. was deleted). Assumes the caller
// is already connected to the right database - see applyCachedConnectionAtBoot
// for why that has to happen first.
export async function getActiveContextId() {
  const store = readStore();

  if (store.activeContextId) {
    const contexts = await getAllContexts();
    if (contexts.some(c => c.id === store.activeContextId)) {
      return store.activeContextId;
    }
  }

  const contexts = await getAllContexts();
  if (contexts.length === 0) {
    throw new ValidationError('No contexts exist');
  }
  return contexts[0].id;
}

// Switches the live connection pool to whatever context is passed in - its own
// saved DB config if it has one, otherwise leaves the current connection alone
// (so a context with no DB config yet doesn't strand the app with no database).
// Never throws: a bad/unreachable config shouldn't block switching contexts or
// starting the server, it just logs and keeps the previous connection live.
// On success, also caches the resolved config (password encrypted) so the next
// process start can reconnect directly - see applyCachedConnectionAtBoot.
export async function applyContextDatabaseConnection(contextId) {
  try {
    const liveConfig = await getLiveConnectionConfig(contextId);
    if (liveConfig) {
      await connectionPool.reconfigure(liveConfig);
      logger.info('Applied context database connection', { contextId, host: liveConfig.host, database: liveConfig.database });

      const store = readStore();
      writeStore({
        ...store,
        lastLiveConfig: {
          host: liveConfig.host,
          port: liveConfig.port,
          database: liveConfig.database,
          user: liveConfig.user,
          passwordEnc: liveConfig.password ? encrypt(liveConfig.password) : null,
        },
      });
    }
  } catch (error) {
    logger.error('Could not apply context database connection, leaving current connection live:', error);
  }
}

// Called once at process startup, before anything queries a database at all.
// Contexts can each point at an entirely different physical database, so
// there's a chicken-and-egg problem: figuring out "which context is active"
// requires a database query, but which database to query depends on which
// context is active. Solved by caching the last successfully-applied
// connection's details (see applyContextDatabaseConnection) and reconnecting
// to that directly on boot, before ever querying for the active context -
// .env.local's default is only used the very first time, before any context
// has ever gone live.
export async function applyCachedConnectionAtBoot() {
  const store = readStore();
  if (!store.lastLiveConfig) return;

  try {
    await connectionPool.reconfigure({
      host: store.lastLiveConfig.host,
      port: store.lastLiveConfig.port,
      user: store.lastLiveConfig.user,
      database: store.lastLiveConfig.database,
      password: store.lastLiveConfig.passwordEnc ? decrypt(store.lastLiveConfig.passwordEnc) : '',
    });
    logger.info('Reconnected to last active context\'s database', { host: store.lastLiveConfig.host, database: store.lastLiveConfig.database });
  } catch (error) {
    logger.error('Could not reconnect to last active context\'s database, falling back to .env.local:', error);
  }
}

export async function setActiveContextId(id) {
  // Throws NotFoundError if it doesn't exist
  const context = await getContextById(id);
  const store = readStore();
  writeStore({ ...store, activeContextId: context.id });
  await applyContextDatabaseConnection(context.id);
  return context;
}

export async function getActiveContext() {
  const id = await getActiveContextId();
  return getContextById(id);
}
