import express from 'express';
import * as entityService from '../../services/entityService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

const handle = (res, promise) => promise
  .then(data => res.json({ success: true, data }))
  .catch(error => {
    logger.error('Recently deleted error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });

router.get('/', async (req, res) => {
  handle(res, (async () => {
    const contextId = await activeContextService.getActiveContextId();
    return entityService.getDeletedEntities(contextId, { limit: req.query.limit });
  })());
});

router.post('/:entityId/restore', async (req, res) => {
  handle(res, (async () => {
    const contextId = await activeContextService.getActiveContextId();
    return entityService.restoreEntity(req.params.entityId, contextId);
  })());
});

// The only hard delete in the app.
router.delete('/:entityId', async (req, res) => {
  handle(res, (async () => {
    const contextId = await activeContextService.getActiveContextId();
    return entityService.purgeEntity(req.params.entityId, contextId);
  })());
});

export default router;
