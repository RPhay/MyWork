import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ValidationError } from '../config/errors.js';
import { getContextById, getAllContexts, getContextsForUser } from './contextService.js';
import { getActiveUserId } from './activeUserService.js';
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
// *owned* context (by order_index) if none has been explicitly set yet, or
// if the previously-set one no longer exists or has no user assigned (e.g.
// its owner was deleted) - a context with no user isn't usable, see
// setActiveContextId. Assumes the caller is already connected to the right
// database - see applyCachedConnectionAtBoot for why that has to happen first.
export async function getActiveContextId() {
  const store = readStore();

  // Narrowed from "any owned context" to "a context owned by the person using
  // the app". That single change is what makes profiles work: everything the
  // app reads comes from the active context's database, so restricting which
  // context can be active restricts everything downstream with it.
  //
  // With nobody chosen yet, fall back to the old behaviour rather than
  // throwing. A fresh install boots with no data/active-user.json, and the
  // picker itself has to be able to load.
  const activeUserId = await getActiveUserId();
  const candidates = activeUserId
    ? await getContextsForUser(activeUserId)
    : (await getAllContexts()).filter(c => c.user_id);

  if (store.activeContextId && candidates.some(c => c.id === store.activeContextId)) {
    return store.activeContextId;
  }

  if (candidates.length === 0) {
    throw new ValidationError(activeUserId
      ? 'This user has no contexts yet - create one to get started'
      : 'No contexts have an owner assigned yet - assign one in Settings > Contexts before this context can be used');
  }
  return candidates[0].id;
}

// Switches the live connection pool to whatever context is passed in.
// Requires that the context has a database configuration - throws ValidationError if not.
// On success, also caches the resolved config (password encrypted) so the next
// process start can reconnect directly - see applyCachedConnectionAtBoot.
// Throws on connection failure or if context has no database configured.
export async function applyContextDatabaseConnection(contextId) {
  const liveConfig = await getLiveConnectionConfig(contextId);
  if (!liveConfig) {
    throw new ValidationError(`Context ${contextId} has no database configured. Configure a database in Settings > Contexts first.`);
  }

  try {
    await connectionPool.reconfigure(liveConfig);
    logger.info('Applied context database connection', { contextId, host: liveConfig.host, database: liveConfig.database });

    const store = readStore();
    writeStore({
      ...store,
      lastLiveConfig: {
        type: liveConfig.type || 'mysql',
        host: liveConfig.host,
        port: liveConfig.port,
        database: liveConfig.database,
        user: liveConfig.user,
        passwordEnc: liveConfig.password ? encrypt(liveConfig.password) : null,
      },
    });
  } catch (error) {
    if (error.message?.includes('no database configured')) {
      throw error;
    }
    logger.error('Could not apply context database connection:', error);
    throw new ValidationError(`Failed to connect to context database: ${error.message}`);
  }
}

// Used by the first-run /setup flow, before any context (or even the
// `contexts` table) necessarily exists yet - just points the live pool at
// whatever the user entered and caches it the same way
// applyContextDatabaseConnection does, so it survives the next restart via
// applyCachedConnectionAtBoot. Unlike applyContextDatabaseConnection, this
// throws on failure - the setup page needs to know if it didn't work.
export async function applyBootstrapConnection(liveConfig) {
  await connectionPool.reconfigure(liveConfig);
  logger.info('Applied bootstrap database connection', { host: liveConfig.host, database: liveConfig.database });

  const store = readStore();
  writeStore({
    ...store,
    lastLiveConfig: {
      type: liveConfig.type || 'mysql',
      host: liveConfig.host,
      port: liveConfig.port,
      database: liveConfig.database,
      user: liveConfig.user,
      passwordEnc: liveConfig.password ? encrypt(liveConfig.password) : null,
    },
  });
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
// On boot, this is lenient: if the cached connection fails, we fall back to env.local.
export async function applyCachedConnectionAtBoot() {
  const store = readStore();
  if (!store.lastLiveConfig) return;

  // Printed BEFORE the attempt, not just on success or failure - this call
  // is the one thing standing between nodemon's startup banner and the
  // "server running on port" line, and it can take a while to fail (an
  // MSSQL host behind an IP-restricted firewall doesn't refuse the
  // connection, it silently drops it, so even the driver's own
  // connectionTimeout can take longer than expected to fire). Without this,
  // that whole wait looks identical to the process being hung outright -
  // there is no way to tell "about to fail in a few seconds" from "stuck
  // forever" without it.
  logger.info('Reconnecting to last active context\'s database...', { type: store.lastLiveConfig.type || 'mysql', host: store.lastLiveConfig.host, database: store.lastLiveConfig.database });

  try {
    await connectionPool.reconfigure({
      type: store.lastLiveConfig.type || 'mysql',
      host: store.lastLiveConfig.host,
      port: store.lastLiveConfig.port,
      user: store.lastLiveConfig.user,
      database: store.lastLiveConfig.database,
      password: store.lastLiveConfig.passwordEnc ? decrypt(store.lastLiveConfig.passwordEnc) : '',
    });
    logger.info('Reconnected to last active context\'s database', { type: store.lastLiveConfig.type || 'mysql', host: store.lastLiveConfig.host, database: store.lastLiveConfig.database });
  } catch (error) {
    logger.warn('Could not reconnect to last active context\'s database, falling back to .env.local:', error.message);
  }
}

export async function setActiveContextId(id) {
  // Throws NotFoundError if it doesn't exist
  const context = await getContextById(id);
  if (!context.user_id) {
    throw new ValidationError('Assign a user to this context (Settings > Contexts) before activating it');
  }
  // Nobody may activate somebody else's context. Without this the picker is
  // decorative: the contexts LIST is filtered, but the endpoint behind it would
  // still accept any id that was typed or remembered in a URL.
  const activeUserId = await getActiveUserId();
  if (activeUserId && context.user_id !== activeUserId) {
    throw new ValidationError('That context belongs to another user - switch user to open it');
  }
  const store = readStore();
  writeStore({ ...store, activeContextId: context.id });
  await applyContextDatabaseConnection(context.id);
  return context;
}

export async function getActiveContext() {
  const id = await getActiveContextId();
  return getContextById(id);
}
