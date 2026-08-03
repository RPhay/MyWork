import express from 'express';
import EntraIdAuth from '../../auth/entraId.js';
import contextSsoService from '../../services/contextSsoService.js';
import ssoUserService from '../../services/ssoUserService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * GET /api/sso/auth/login
 * Initiates SSO login flow by redirecting to Entra ID
 */
router.get('/auth/login', async (req, res) => {
  try {
    const { contextId } = req.query;

    if (!contextId) {
      return res.status(400).json({ success: false, message: 'contextId required' });
    }

    const ssoConfig = await contextSsoService.getContextSsoConfig(contextId);
    if (!ssoConfig) {
      return res.status(400).json({ success: false, message: 'SSO not configured for this context' });
    }

    const auth = new EntraIdAuth(ssoConfig);
    const state = EntraIdAuth.generateState();

    // Store state in session for verification on callback
    req.session.ssoState = state;
    req.session.ssoContextId = contextId;

    const authUrl = auth.getAuthorizationUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    logger.error('SSO login error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate SSO login' });
  }
});

/**
 * GET /api/sso/auth/callback
 * Handles OAuth callback from Entra ID
 */
router.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { ssoState, ssoContextId } = req.session;

    // Verify state to prevent CSRF
    if (!state || state !== ssoState) {
      return res.status(400).json({ success: false, message: 'Invalid state parameter' });
    }

    if (!code || !ssoContextId) {
      return res.status(400).json({ success: false, message: 'Missing authorization code or context' });
    }

    // Get SSO config for this context
    const ssoConfig = await contextSsoService.getContextSsoConfig(ssoContextId);
    if (!ssoConfig) {
      return res.status(400).json({ success: false, message: 'SSO not configured' });
    }

    // Exchange code for token
    const auth = new EntraIdAuth(ssoConfig);
    const tokens = await auth.exchangeCodeForToken(code);

    // Get user info from Entra ID
    const providerUser = await auth.getUserInfo(tokens.accessToken);

    // Find or create MyWork user from SSO identity
    const userId = await ssoUserService.findOrCreateSsoUser('entra-id', providerUser);

    // Store in session
    req.session.userId = userId;
    req.session.activeContextId = ssoContextId;
    req.session.ssoTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + (tokens.expiresIn * 1000)
    };

    // Clear SSO state from session
    delete req.session.ssoState;
    delete req.session.ssoContextId;

    // Redirect to dashboard
    res.redirect('/?tab=dailies');
  } catch (error) {
    logger.error('SSO callback error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete SSO authentication' });
  }
});

/**
 * POST /api/sso/logout
 * Logs out user and revokes SSO tokens
 */
router.post('/logout', async (req, res) => {
  try {
    const { ssoTokens, activeContextId } = req.session;

    if (ssoTokens?.refreshToken && activeContextId) {
      try {
        const ssoConfig = await contextSsoService.getContextSsoConfig(activeContextId);
        if (ssoConfig) {
          const auth = new EntraIdAuth(ssoConfig);
          await auth.revokeRefreshToken(ssoTokens.refreshToken);
        }
      } catch (error) {
        logger.error('Error revoking SSO token:', error);
      }
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to logout' });
      }
      res.json({ success: true });
    });
  } catch (error) {
    logger.error('SSO logout error:', error);
    res.status(500).json({ success: false, message: 'Failed to logout' });
  }
});

export default router;
