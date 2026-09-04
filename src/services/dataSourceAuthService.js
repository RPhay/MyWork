import { query, update, insert } from '../database/connectionPool.js';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import EntraIdAuth from '../auth/entraId.js';
import logger from '../utils/logger.js';
import config from '../config/environment.js';
import { getConfigurationState } from './ssoModeService.js';

/**
 * Service for managing data source authentication
 * Handles credentials, SSO tokens, and token refresh per data source
 */

/**
 * Build an EntraIdAuth from the machine's .env.local SSO_* values, or null
 * when this machine has no tenant configured.
 *
 * Returning null rather than throwing is deliberate: a home machine with no
 * SSO_* set should make data-source auth simply unavailable, not error.
 */
export function buildEntraAuthFromEnv({ redirectUri = '' } = {}) {
  const { configured } = getConfigurationState();
  if (!configured) return null;

  return new EntraIdAuth({
    tenantId: config.sso.tenantId,
    clientId: config.sso.clientId,
    clientSecret: config.sso.clientSecret,
    redirectUri,
  });
}

/**
 * Get current auth for a data source
 */
export async function getSourceAuth(sourceId, authType = null) {
  try {
    let sql = `
      SELECT id, source_id, auth_type, auth_data_enc, auth_metadata, authenticated_at, expires_at
      FROM source_auth
      WHERE source_id = ?
    `;
    const params = [sourceId];

    if (authType) {
      sql += ' AND auth_type = ?';
      params.push(authType);
    }

    const rows = await query(sql, params);

    if (rows.length === 0) return null;

    const auth = rows[0];
    return {
      id: auth.id,
      sourceId: auth.source_id,
      authType: auth.auth_type,
      authData: auth.auth_data_enc ? JSON.parse(decrypt(JSON.parse(auth.auth_data_enc))) : null,
      metadata: auth.auth_metadata ? JSON.parse(auth.auth_metadata) : {},
      authenticatedAt: auth.authenticated_at,
      expiresAt: auth.expires_at
    };
  } catch (error) {
    logger.error('Error getting source auth:', error);
    return null;
  }
}

/**
 * Save or update auth for a data source
 */
export async function saveSourceAuth(sourceId, authType, authData, metadata = {}) {
  try {
    const encryptedData = JSON.stringify(encrypt(authData));
    const metadataJson = JSON.stringify(metadata);
    const now = new Date();
    const expiresAt = authData.expiresIn
      ? new Date(now.getTime() + (authData.expiresIn * 1000))
      : null;

    const existing = await query(
      'SELECT id FROM source_auth WHERE source_id = ? AND auth_type = ?',
      [sourceId, authType]
    );

    if (existing.length > 0) {
      // Update existing auth
      await update(
        `UPDATE source_auth
         SET auth_data_enc = ?, auth_metadata = ?, authenticated_at = ?, expires_at = ?, updated_at = NOW()
         WHERE source_id = ? AND auth_type = ?`,
        [encryptedData, metadataJson, now, expiresAt, sourceId, authType]
      );
    } else {
      // Insert new auth
      await insert(
        `INSERT INTO source_auth (source_id, auth_type, auth_data_enc, auth_metadata, authenticated_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sourceId, authType, encryptedData, metadataJson, now, expiresAt]
      );
    }

    return { sourceId, authType, expiresAt };
  } catch (error) {
    logger.error('Error saving source auth:', error);
    throw error;
  }
}

/**
 * Check if auth is still valid (not expired)
 */
export function isAuthValid(auth) {
  if (!auth) return false;
  if (!auth.expiresAt) return true; // No expiry means always valid
  return new Date() < new Date(auth.expiresAt);
}

/**
 * Refresh SSO token if needed.
 *
 * Took a `contextId` until 2026-08-27, when the tenant stopped coming from
 * per-context columns. Dropped rather than underscore-prefixed: it had no
 * callers, and a parameter that is accepted and ignored invites someone to
 * pass a context id and believe it selected a tenant.
 */
export async function refreshSsoTokenIfNeeded(sourceId, authType) {
  try {
    const auth = await getSourceAuth(sourceId, authType);
    if (!auth) return null;

    // Check if token is expired or expiring soon (within 5 minutes)
    if (auth.expiresAt) {
      const expiresAt = new Date(auth.expiresAt);
      const now = new Date();
      const timeUntilExpiry = expiresAt - now;

      // If more than 5 minutes left, no need to refresh
      if (timeUntilExpiry > 5 * 60 * 1000) {
        return auth;
      }
    }

    // Token expired or expiring, try to refresh
    if (!auth.authData?.refreshToken) {
      return null; // Can't refresh without refresh token
    }

    // Tenant config comes from .env.local (config.sso), NOT from per-context
    // encrypted columns. Those columns were dropped with the SSO login
    // subsystem on 2026-08-26, and this SELECT went on referencing them - so
    // every refresh threw "Unknown column 'sso_tenant_id_enc'". It also
    // destructured `[contextRows]` mysql2-style when this repo's query()
    // returns rows directly, which made the length guard below `undefined
    // === 0` and therefore never true.
    //
    // Machine-wide rather than per-context is the deliberate part: which
    // tenant you can reach is a property of the MACHINE and NETWORK, which is
    // the same reason SSO_MODE lives there. One tenant per machine.
    const entraAuth = buildEntraAuthFromEnv({ redirectUri: '' });
    if (!entraAuth) return null;

    const refreshResult = await entraAuth.refreshAccessToken(auth.authData.refreshToken);

    // Save refreshed token
    const updatedAuthData = {
      ...auth.authData,
      accessToken: refreshResult.accessToken,
      expiresIn: refreshResult.expiresIn
    };

    await saveSourceAuth(sourceId, authType, updatedAuthData, auth.metadata);

    // Return updated auth
    return await getSourceAuth(sourceId, authType);
  } catch (error) {
    logger.error('Error refreshing SSO token:', error);
    return null;
  }
}

/**
 * Clear auth for a source (e.g., on logout)
 */
export async function clearSourceAuth(sourceId, authType = null) {
  try {
    let sql = 'DELETE FROM source_auth WHERE source_id = ?';
    const params = [sourceId];

    if (authType) {
      sql += ' AND auth_type = ?';
      params.push(authType);
    }

    await query(sql, params);
  } catch (error) {
    logger.error('Error clearing source auth:', error);
    throw error;
  }
}

/**
 * Get auth status for display
 */
export async function getAuthStatus(sourceId) {
  try {
    const rows = await query(
      `SELECT auth_type, auth_metadata, authenticated_at, expires_at
       FROM source_auth
       WHERE source_id = ?
       ORDER BY authenticated_at DESC
       LIMIT 5`,
      [sourceId]
    );

    return rows.map(row => ({
      authType: row.auth_type,
      metadata: row.auth_metadata ? JSON.parse(row.auth_metadata) : {},
      authenticatedAt: row.authenticated_at,
      expiresAt: row.expires_at,
      isValid: isAuthValid({ expiresAt: row.expires_at })
    }));
  } catch (error) {
    logger.error('Error getting auth status:', error);
    return [];
  }
}

export default {
  getSourceAuth,
  saveSourceAuth,
  isAuthValid,
  refreshSsoTokenIfNeeded,
  clearSourceAuth,
  getAuthStatus
};
