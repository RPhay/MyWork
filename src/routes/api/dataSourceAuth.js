import express from 'express';
import EntraIdAuth from '../../auth/entraId.js';
import MsOutlookAuth from '../../auth/msOutlookAuth.js';
import dataSourceAuthService from '../../services/dataSourceAuthService.js';
import * as sourceService from '../../services/sourceService.js';
import * as activeContextService from '../../services/activeContextService.js';
import { query } from '../../database/connectionPool.js';
import { decrypt } from '../../utils/credentialCrypto.js';
import config from '../../config/environment.js';
import logger from '../../utils/logger.js';

const router = express.Router();

const PROVIDER_CONFIG = {
  'outlook': {
    authClass: MsOutlookAuth,
    getConfig: () => ({
      tenantId: config.oauth?.microsoft?.tenantId || 'common',
      clientId: config.oauth?.microsoft?.clientId,
      clientSecret: config.oauth?.microsoft?.clientSecret,
      redirectUri: `${config.app.url}/api/sources/auth/sso/callback`
    })
  },
  'teams': {
    authClass: MsOutlookAuth, // Same as Outlook (both use Entra ID)
    getConfig: () => ({
      tenantId: config.oauth?.microsoft?.tenantId || 'common',
      clientId: config.oauth?.microsoft?.clientId,
      clientSecret: config.oauth?.microsoft?.clientSecret,
      redirectUri: `${config.app.url}/api/sources/auth/sso/callback`
    })
  }
};

/**
 * GET /api/sources/auth/sso/initiate
 * Initiate SSO login - redirects to OAuth provider login page
 */
router.get('/sources/auth/sso/initiate', async (req, res, next) => {
  try {
    const { type } = req.query;

    if (!type || !PROVIDER_CONFIG[type]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unsupported provider type'
      });
    }

    const authConfig = PROVIDER_CONFIG[type];
    const oauthConfig = authConfig.getConfig();

    // Create OAuth handler with available config (uses defaults if not configured)
    const oauth = new authConfig.authClass(oauthConfig);

    // Generate state for CSRF protection
    const state = authConfig.authClass.generateState();

    // Store setup intent in session
    if (!req.session.sourceSetupStates) {
      req.session.sourceSetupStates = {};
    }
    req.session.sourceSetupStates[state] = {
      type,
      timestamp: Date.now()
    };

    // Redirect to OAuth provider login page
    const authUrl = oauth.getAuthorizationUrl(state);
    logger.info(`Redirecting to ${type} OAuth: ${authUrl.split('?')[0]}`);
    res.redirect(authUrl);
  } catch (error) {
    logger.error('SSO initiate error:', error);
    next(error);
  }
});

/**
 * GET /api/sources/auth/sso/callback
 * Handle OAuth callback and auto-save source
 */
router.get('/sources/auth/sso/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!state || !req.session.sourceSetupStates?.[state]) {
      return res.send(`<html><body><p>Authorization failed.</p><script>if(window.parent!==window) window.parent.location.href='/settings?tab=data-sources'; else window.close();</script></body></html>`);
    }

    const setupState = req.session.sourceSetupStates[state];
    delete req.session.sourceSetupStates[state];

    if (!code) {
      return res.send(`<html><body><p>No authorization code.</p><script>if(window.parent!==window) window.parent.location.href='/settings?tab=data-sources'; else window.close();</script></body></html>`);
    }

    const { type } = setupState;
    const authConfig = PROVIDER_CONFIG[type];
    const oauth = new authConfig.authClass(authConfig.getConfig());

    // Exchange code for token
    const tokens = await oauth.exchangeCodeForToken(code);
    const userInfo = await oauth.getUserInfo(tokens.accessToken);

    // Get active context
    const contextId = await activeContextService.getActiveContextId();

    // Create source with auto-generated name
    const source = await sourceService.createSource({
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} (${new Date().toLocaleDateString()})`,
      type,
      authMethod: 'sso_entra_id',
      enabled: true,
      config: {}
    }, contextId);

    // Save auth
    await dataSourceAuthService.saveSourceAuth(source.id, 'sso_entra_id', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || null,
      expiresIn: tokens.expiresIn
    }, {
      userEmail: userInfo.email,
      userName: userInfo.displayName
    });

    // Return success and close popup
    res.send(`
      <html>
        <head><title>Authentication Successful</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5;">
          <div style="text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #28a745; margin: 0 0 10px 0; font-size: 24px;">✓ Connected!</h2>
            <p style="color: #666; margin: 0;">You can close this window.</p>
          </div>
          <script>
            // Close popup after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('SSO callback error:', error);
    res.send(`
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <h2 style="color: #dc3545; margin: 0 0 10px 0;">✗ Failed</h2>
            <p style="color: #666; margin: 0;">${error.message}</p>
          </div>
          <script>
            setTimeout(() => {
              if(window.parent !== window) {
                window.parent.location.href = '/settings?tab=data-sources&error=auth-failed';
              } else {
                window.close();
              }
            }, 3000);
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * GET /api/sources/:sourceId/auth/status
 * Get authentication status for a data source
 */
router.get('/sources/:sourceId/auth/status', async (req, res, next) => {
  try {
    const { sourceId } = req.params;
    const status = await dataSourceAuthService.getAuthStatus(sourceId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sources/:sourceId/auth/sso/login
 * Initiate SSO login for a data source
 */
router.post('/sources/:sourceId/auth/sso/login', async (req, res, next) => {
  try {
    const { sourceId } = req.params;
    const { contextId, provider } = req.body;

    if (!contextId || !provider) {
      return res.status(400).json({
        success: false,
        message: 'contextId and provider required'
      });
    }

    // Get context SSO config
    const [contexts] = await query(
      'SELECT sso_tenant_id_enc, sso_client_id_enc, sso_client_secret_enc, sso_redirect_uri FROM contexts WHERE id = ?',
      [contextId]
    );

    if (contexts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Context not found or SSO not configured'
      });
    }

    const contextAuth = contexts[0];
    if (!contextAuth.sso_tenant_id_enc) {
      return res.status(400).json({
        success: false,
        message: 'SSO not configured for this context'
      });
    }

    // Initialize auth handler
    const auth = new EntraIdAuth({
      tenantId: decrypt(JSON.parse(contextAuth.sso_tenant_id_enc)),
      clientId: decrypt(JSON.parse(contextAuth.sso_client_id_enc)),
      clientSecret: decrypt(JSON.parse(contextAuth.sso_client_secret_enc)),
      redirectUri: contextAuth.sso_redirect_uri
    });

    // Generate state for CSRF protection
    const state = EntraIdAuth.generateState();

    // Store in session for verification on callback
    if (!req.session.dataSourceAuthStates) {
      req.session.dataSourceAuthStates = {};
    }
    req.session.dataSourceAuthStates[state] = {
      sourceId: parseInt(sourceId),
      contextId: parseInt(contextId),
      provider,
      timestamp: Date.now()
    };

    // Get authorization URL
    const authUrl = auth.getAuthorizationUrl(state);

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    logger.error('SSO login init error:', error);
    next(error);
  }
});

/**
 * GET /api/sources/:sourceId/auth/sso/callback
 * Handle OAuth callback for data source SSO
 */
router.get('/sources/:sourceId/auth/sso/callback', async (req, res, next) => {
  try {
    const { sourceId } = req.params;
    const { code, state } = req.query;

    // Verify state
    if (!state || !req.session.dataSourceAuthStates?.[state]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state parameter'
      });
    }

    const authState = req.session.dataSourceAuthStates[state];
    if (String(authState.sourceId) !== sourceId) {
      return res.status(400).json({
        success: false,
        message: 'Source ID mismatch'
      });
    }

    // Clean up state
    delete req.session.dataSourceAuthStates[state];

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'No authorization code'
      });
    }

    // Get context config
    const [contexts] = await query(
      'SELECT sso_tenant_id_enc, sso_client_id_enc, sso_client_secret_enc, sso_redirect_uri FROM contexts WHERE id = ?',
      [authState.contextId]
    );

    if (contexts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Context not found'
      });
    }

    // Exchange code for token
    const contextAuth = contexts[0];
    const auth = new EntraIdAuth({
      tenantId: decrypt(JSON.parse(contextAuth.sso_tenant_id_enc)),
      clientId: decrypt(JSON.parse(contextAuth.sso_client_id_enc)),
      clientSecret: decrypt(JSON.parse(contextAuth.sso_client_secret_enc)),
      redirectUri: contextAuth.sso_redirect_uri
    });

    const tokens = await auth.exchangeCodeForToken(code);
    const userInfo = await auth.getUserInfo(tokens.accessToken);

    // Save auth for this source
    await dataSourceAuthService.saveSourceAuth(sourceId, 'sso_entra_id', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    }, {
      userEmail: userInfo.email,
      userName: userInfo.displayName
    });

    res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        email: userInfo.email,
        name: userInfo.displayName
      }
    });
  } catch (error) {
    logger.error('SSO callback error:', error);
    next(error);
  }
});

/**
 * POST /api/sources/:sourceId/auth/credentials
 * Save credentials for a data source
 */
router.post('/sources/:sourceId/auth/credentials', async (req, res, next) => {
  try {
    const { sourceId } = req.params;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password required'
      });
    }

    await dataSourceAuthService.saveSourceAuth(sourceId, 'credentials', {
      username,
      password
    }, {
      username
    });

    res.json({
      success: true,
      message: 'Credentials saved'
    });
  } catch (error) {
    logger.error('Error saving credentials:', error);
    next(error);
  }
});

/**
 * DELETE /api/sources/:sourceId/auth/:authType
 * Clear auth for a data source
 */
router.delete('/sources/:sourceId/auth/:authType', async (req, res, next) => {
  try {
    const { sourceId, authType } = req.params;

    await dataSourceAuthService.clearSourceAuth(sourceId, authType);

    res.json({
      success: true,
      message: 'Authentication cleared'
    });
  } catch (error) {
    logger.error('Error clearing auth:', error);
    next(error);
  }
});

export default router;
