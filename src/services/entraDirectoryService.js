// Azure Entra ID directory integration: optional, off by default. Two things
// live behind the one toggle - a cached pull of { displayName, email } for
// every user (syncNow, below), and the LIVE Graph search that backs Person
// and Group fields on any entity type (searchPeople/searchGroups, at the
// bottom of this file). Neither is a login.
//
// Deliberately reuses the SSO_* app registration from .env.local rather than
// asking for a second set of credentials: listing/searching the tenant just
// needs the same tenant/client id with ADMIN-CONSENTED application
// permissions (User.Read.All and, for Group fields, Group.Read.All) added to
// that app registration, not a new one. See CLAUDE.md's SSO section for why
// credentials live in .env.local rather than the database.
import * as homeDb from "../database/homePool.js";
import EntraIdAuth from "../auth/entraId.js";
import config from "../config/environment.js";
import { getConfigurationState } from "./ssoModeService.js";
import { ValidationError } from "../config/errors.js";
import logger from "../utils/logger.js";

const INTEGRATION_KEY = "entra_directory";
const PROVIDER = "entra";

function buildAppOnlyClient() {
  const { configured } = getConfigurationState();
  if (!configured) return null;
  // No redirect URI: the client-credentials grant never redirects anywhere,
  // it's a direct server-to-server token request.
  return new EntraIdAuth({
    tenantId: config.sso.tenantId,
    clientId: config.sso.clientId,
    clientSecret: config.sso.clientSecret,
    redirectUri: "",
  });
}

async function getSettingsRow() {
  return homeDb.queryOne(
    "SELECT enabled, last_synced_at FROM integration_settings WHERE integration_key = ?",
    [INTEGRATION_KEY],
  );
}

// Person/Group fields search on every (debounced) keystroke, which would
// otherwise mean a fresh client-credentials token request per keystroke -
// this caches the last one in memory until it's within a minute of expiring.
// Process-local and fine to lose on restart, same as any other token cache.
let cachedAppOnlyToken = null; // { accessToken, expiresAt }

async function getValidAppOnlyToken() {
  const now = Date.now();
  if (cachedAppOnlyToken && cachedAppOnlyToken.expiresAt - now > 60_000) {
    return cachedAppOnlyToken.accessToken;
  }
  const client = buildAppOnlyClient();
  if (!client) return null;
  const { accessToken, expiresIn } = await client.getAppOnlyToken();
  cachedAppOnlyToken = { accessToken, expiresAt: now + (expiresIn || 3600) * 1000 };
  return accessToken;
}

/** Both search functions below share this: not configured is a hard error,
 * configured-but-off is a distinct one so the UI can say "turn it on in
 * Settings" rather than "set up .env.local" to someone who already has. */
function assertSearchable(status) {
  if (!status.configured) {
    throw new ValidationError(
      `Azure Entra ID is not configured on this machine - missing ${status.missing.join(", ")} in .env.local.`,
    );
  }
  if (!status.enabled) {
    throw new ValidationError(
      "Azure Entra ID Directory is turned off - enable it in Settings > Integrations first.",
    );
  }
}

/**
 * Everything the Settings > Integrations tab needs to render the Entra
 * Directory card in one call: whether it CAN work (credentials present),
 * whether it's turned ON, and what it last pulled.
 */
export async function getStatus() {
  const { configured, missing } = getConfigurationState();
  const row = await getSettingsRow();
  const countRow = await homeDb.queryOne(
    "SELECT COUNT(*) as cnt FROM directory_users WHERE provider = ?",
    [PROVIDER],
  );

  return {
    configured,
    missing,
    enabled: Boolean(row?.enabled),
    lastSyncedAt: row?.last_synced_at || null,
    userCount: countRow?.cnt || 0,
  };
}

/** Turn the integration on/off. Off does not clear the directory cache - a
 * toggle you can undo, not a reset. */
export async function setEnabled(enabled) {
  const existing = await homeDb.queryOne(
    "SELECT id FROM integration_settings WHERE integration_key = ?",
    [INTEGRATION_KEY],
  );
  if (existing) {
    await homeDb.update(
      "UPDATE integration_settings SET enabled = ? WHERE integration_key = ?",
      [Boolean(enabled), INTEGRATION_KEY],
    );
  } else {
    await homeDb.insert(
      "INSERT INTO integration_settings (integration_key, enabled) VALUES (?, ?)",
      [INTEGRATION_KEY, Boolean(enabled)],
    );
  }
  return getStatus();
}

/**
 * Pull the tenant's users from Microsoft Graph and upsert them into
 * directory_users by (provider, external_id). Does not delete rows for users
 * removed from the tenant since the last sync - stale-but-present beats a
 * name silently vanishing out from under something it was assigned to.
 */
export async function syncNow() {
  const { configured, missing } = getConfigurationState();
  if (!configured) {
    throw new ValidationError(
      `Azure Entra ID is not configured on this machine - missing ${missing.join(", ")} in .env.local.`,
    );
  }

  const client = buildAppOnlyClient();
  const { accessToken } = await client.getAppOnlyToken();
  const users = await client.listDirectoryUsers(accessToken);

  for (const u of users) {
    const existing = await homeDb.queryOne(
      "SELECT id FROM directory_users WHERE provider = ? AND external_id = ?",
      [PROVIDER, u.id],
    );
    if (existing) {
      await homeDb.update(
        "UPDATE directory_users SET display_name = ?, email = ?, synced_at = NOW() WHERE id = ?",
        [u.displayName, u.email, existing.id],
      );
    } else {
      await homeDb.insert(
        "INSERT INTO directory_users (provider, external_id, display_name, email) VALUES (?, ?, ?, ?)",
        [PROVIDER, u.id, u.displayName, u.email],
      );
    }
  }

  const existingSettings = await homeDb.queryOne(
    "SELECT id FROM integration_settings WHERE integration_key = ?",
    [INTEGRATION_KEY],
  );
  if (existingSettings) {
    await homeDb.update(
      // TRUE is not a valid T-SQL literal (bare TRUE/FALSE is MySQL-only) - 1
      // works on both engines.
      "UPDATE integration_settings SET enabled = 1, last_synced_at = NOW() WHERE integration_key = ?",
      [INTEGRATION_KEY],
    );
  } else {
    await homeDb.insert(
      "INSERT INTO integration_settings (integration_key, enabled, last_synced_at) VALUES (?, 1, NOW())",
      [INTEGRATION_KEY],
    );
  }

  logger.info("Entra directory sync complete", { count: users.length });
  return { count: users.length };
}

/** The cached directory, for an assignment picker. Alphabetical - it's a
 * name list to scan, not an activity feed. */
export async function getDirectoryUsers() {
  return homeDb.query(
    "SELECT id, external_id, display_name, email FROM directory_users WHERE provider = ? ORDER BY display_name ASC",
    [PROVIDER],
  );
}

/**
 * Live search backing a Person field - hits Microsoft Graph directly on
 * every call (through the cached app-only token above), NOT the
 * directory_users cache. That cache can be stale by design (see syncNow's
 * comment); a search box shouldn't be.
 */
export async function searchPeople(q) {
  assertSearchable(await getStatus());
  const term = String(q || "").trim();
  if (term.length < 2) return [];

  const client = buildAppOnlyClient();
  const accessToken = await getValidAppOnlyToken();
  return client.searchUsers(accessToken, term);
}

/** The Group field's counterpart to searchPeople() above. */
export async function searchGroups(q) {
  assertSearchable(await getStatus());
  const term = String(q || "").trim();
  if (term.length < 2) return [];

  const client = buildAppOnlyClient();
  const accessToken = await getValidAppOnlyToken();
  return client.searchGroups(accessToken, term);
}
