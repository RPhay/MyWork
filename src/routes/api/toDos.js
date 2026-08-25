import express from 'express';
import * as entityService from '../../services/entityService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// to_dos are generic entities now (their tab has been for a while, and their
// rows moved across with phase6-7-migrate-todos-tasks-tickets.js). This router
// stays because Dailies' associate panel and a few helpers still call it; it is
// a thin shim over entityService, exactly like routes/api/categories.js.

router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const rows = await entityService.getAllEntities('to_do', contextId);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching to_dos:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const row = await entityService.getEntityById(Number(req.params.id), contextId);
    res.json({ success: true, data: row });
  } catch (error) {
    logger.error('Error fetching to_do:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const row = await entityService.createEntity('to_do', req.body, contextId);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    logger.error('Error creating to_do:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const row = await entityService.updateEntity(Number(req.params.id), req.body, contextId);
    res.json({ success: true, data: row });
  } catch (error) {
    logger.error('Error updating to_do:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    await entityService.deleteEntity(Number(req.params.id), contextId);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    logger.error('Error deleting to_do:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
