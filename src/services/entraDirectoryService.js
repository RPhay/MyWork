// Azure Entra ID directory integration: optional, off by default. Pulls a
// list of { displayName, email } from Microsoft Graph so they can later be
// assigned to things like Ideas or Tasks - a directory cache, not a login.
//
// Deliberately reuses the SSO_* app registration from .env.local rather than
// asking for a second set of credentials: listing the whole tenant just
// needs the same tenant/client id with an ADMIN-CONSENTED application
// permission (User.Read.All or Directory.Read.All) added to that app
// registration, not a new one. See CLAUDE.md's SSO section for why
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
      "UPDATE integration_settings SET enabled = TRUE, last_synced_at = NOW() WHERE integration_key = ?",
      [INTEGRATION_KEY],
    );
  } else {
    await homeDb.insert(
      "INSERT INTO integration_settings (integration_key, enabled, last_synced_at) VALUES (?, TRUE, NOW())",
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
