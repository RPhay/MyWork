import express from 'express';
import EntraIdAuth from '../../auth/entraId.js';
import dataSourceAuthService from '../../services/dataSourceAuthService.js';
import { query } from '../../database/connectionPool.js';
import { decrypt } from '../../utils/credentialCrypto.js';
import logger from '../../utils/logger.js';

const router = express.Router();

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
