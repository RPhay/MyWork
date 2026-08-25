import express from 'express';
import contextSsoService from '../../services/contextSsoService.js';
import { ValidationError, NotFoundError } from '../../config/errors.js';

const router = express.Router();

/**
 * GET /api/contexts/:contextId/sso
 * Get SSO configuration for a context (without sensitive data)
 */
router.get('/contexts/:contextId/sso', async (req, res, next) => {
  try {
    const contextId = parseInt(req.params.contextId, 10);

    const query = `
      SELECT id, sso_enabled, sso_provider, sso_tenant_id_enc,
             sso_client_id_enc, sso_client_secret_enc, sso_redirect_uri,
             sso_configured_at
      FROM contexts
      WHERE id = ?
    `;

    const [rows] = await req.app.locals.connectionPool.query(query, [contextId]);
    if (rows.length === 0) {
      throw new NotFoundError('Context not found');
    }

    const config = rows[0];
    const maskedConfig = contextSsoService.maskContextSsoConfig(config);

    res.json({
      success: true,
      data: maskedConfig || {
        ssoEnabled: false,
        ssoProvider: 'entra-id',
        ssoConfigured: false
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/contexts/:contextId/sso
 * Save SSO configuration for a context
 */
router.put('/contexts/:contextId/sso', async (req, res, next) => {
  try {
    const contextId = parseInt(req.params.contextId, 10);
    const { ssoEnabled, ssoProvider, tenantId, clientId, clientSecret, redirectUri } = req.body;

    if (ssoEnabled && (!tenantId || !clientId || !clientSecret || !redirectUri)) {
      throw new ValidationError('SSO configuration requires all fields when enabled');
    }

    // Test the configuration if enabling
    if (ssoEnabled) {
      const testResult = await contextSsoService.testSsoConnection({
        tenantId,
        clientId,
        clientSecret,
        redirectUri
      });

      if (!testResult.success) {
        throw new ValidationError(`SSO configuration test failed: ${testResult.error}`);
      }
    }

    await contextSsoService.saveContextSsoConfig(contextId, {
      ssoEnabled,
      ssoProvider: ssoEnabled ? ssoProvider : null,
      tenantId: ssoEnabled ? tenantId : null,
      clientId: ssoEnabled ? clientId : null,
      clientSecret: ssoEnabled ? clientSecret : null,
      redirectUri: ssoEnabled ? redirectUri : null
    });

    res.json({ success: true, message: 'SSO configuration saved' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/contexts/:contextId/sso/test
 * Test SSO configuration without saving
 */
router.post('/contexts/:contextId/sso/test', async (req, res, next) => {
  try {
    const { tenantId, clientId, clientSecret, redirectUri } = req.body;

    if (!tenantId || !clientId || !clientSecret || !redirectUri) {
      throw new ValidationError('All SSO fields are required for testing');
    }

    const result = await contextSsoService.testSsoConnection({
      tenantId,
      clientId,
      clientSecret,
      redirectUri
    });

    res.json({
      success: result.success,
      message: result.success ? 'Configuration is valid' : result.error
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/contexts/:contextId/sso
 * Disable SSO for a context
 */
router.delete('/contexts/:contextId/sso', async (req, res, next) => {
  try {
    const contextId = parseInt(req.params.contextId, 10);

    await contextSsoService.disableContextSso(contextId);

    res.json({ success: true, message: 'SSO disabled for this context' });
  } catch (error) {
    next(error);
  }
});

export default router;
