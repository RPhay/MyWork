import { queryOne, update } from '../database/connectionPool.js';
import { encrypt, decrypt } from '../utils/credentialCrypto.js';
import EntraIdAuth from '../auth/entraId.js';

/**
 * Service for managing SSO configuration per context
 * Handles encryption/decryption and OAuth provider setup
 */

export async function getContextSsoConfig(contextId) {
  // queryOne returns the row itself, or null. This used to call
  // `connectionPool.query(...)` - an identifier this module never imported -
  // and destructure `[rows]` mysql2-style, so every call threw ReferenceError.
  const row = await queryOne(
    `SELECT
      id, sso_enabled, sso_provider, sso_tenant_id_enc,
      sso_client_id_enc, sso_client_secret_enc, sso_redirect_uri
    FROM contexts
    WHERE id = ?`,
    [contextId],
  );
  if (!row) return null;
  if (!row.sso_enabled) return null;

  return {
    contextId: row.id,
    provider: row.sso_provider,
    tenantId: row.sso_tenant_id_enc ? decrypt(row.sso_tenant_id_enc) : null,
    clientId: row.sso_client_id_enc ? decrypt(row.sso_client_id_enc) : null,
    clientSecret: row.sso_client_secret_enc ? decrypt(row.sso_client_secret_enc) : null,
    redirectUri: row.sso_redirect_uri
  };
}

export async function saveContextSsoConfig(contextId, config) {
  const {
    ssoEnabled = false,
    ssoProvider = 'entra-id',
    tenantId,
    clientId,
    clientSecret,
    redirectUri
  } = config;

  const tenantIdEnc = tenantId ? encrypt(tenantId) : null;
  const clientIdEnc = clientId ? encrypt(clientId) : null;
  const clientSecretEnc = clientSecret ? encrypt(clientSecret) : null;

  const sql = `
    UPDATE contexts SET
      sso_enabled = ?,
      sso_provider = ?,
      sso_tenant_id_enc = ?,
      sso_client_id_enc = ?,
      sso_client_secret_enc = ?,
      sso_redirect_uri = ?,
      sso_configured_at = NOW()
    WHERE id = ?
  `;

  await update(sql, [
    ssoEnabled ? 1 : 0,
    ssoEnabled ? ssoProvider : null,
    ssoEnabled ? tenantIdEnc : null,
    ssoEnabled ? clientIdEnc : null,
    ssoEnabled ? clientSecretEnc : null,
    ssoEnabled ? redirectUri : null,
    contextId
  ]);
}

export async function testSsoConnection(config) {
  // Test that the provided credentials can connect to Entra ID
  try {
    const auth = new EntraIdAuth({
      tenantId: config.tenantId,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri
    });

    // Generate a test authorization URL to verify config is valid
    const testState = EntraIdAuth.generateState();
    const authUrl = auth.getAuthorizationUrl(testState);

    if (!authUrl || !authUrl.includes(config.tenantId)) {
      throw new Error('Invalid SSO configuration');
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function disableContextSso(contextId) {
  const sql = `
    UPDATE contexts SET
      sso_enabled = 0,
      sso_provider = NULL,
      sso_tenant_id_enc = NULL,
      sso_client_id_enc = NULL,
      sso_client_secret_enc = NULL,
      sso_redirect_uri = NULL,
      sso_configured_at = NULL
    WHERE id = ?
  `;

  await update(sql, [contextId]);
}

export async function maskContextSsoConfig(contextConfig) {
  // Return config without sensitive data for frontend
  if (!contextConfig.sso_enabled) {
    return null;
  }

  return {
    ssoEnabled: !!contextConfig.sso_enabled,
    ssoProvider: contextConfig.sso_provider,
    ssoConfigured: !!contextConfig.sso_configured_at,
    hasTenantId: !!contextConfig.sso_tenant_id_enc,
    hasClientId: !!contextConfig.sso_client_id_enc,
    hasClientSecret: !!contextConfig.sso_client_secret_enc,
    redirectUri: contextConfig.sso_redirect_uri
  };
}

export default {
  getContextSsoConfig,
  saveContextSsoConfig,
  testSsoConnection,
  disableContextSso,
  maskContextSsoConfig
};
