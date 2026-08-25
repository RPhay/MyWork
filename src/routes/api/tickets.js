import express from 'express';
import * as entityService from '../../services/entityService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// tickets are generic entities now (their tab has been for a while, and their
// rows moved across with phase6-7-migrate-todos-tasks-tickets.js). This router
// stays because Dailies' associate panel and a few helpers still call it; it is
// a thin shim over entityService, exactly like routes/api/categories.js.

router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const rows = await entityService.getAllEntities('ticket', contextId);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const row = await entityService.getEntityById(Number(req.params.id), contextId);
    res.json({ success: true, data: row });
  } catch (error) {
    logger.error('Error fetching ticket:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const row = await entityService.createEntity('ticket', req.body, contextId);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    logger.error('Error creating ticket:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const row = await entityService.updateEntity(Number(req.params.id), req.body, contextId);
    res.json({ success: true, data: row });
  } catch (error) {
    logger.error('Error updating ticket:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    await entityService.deleteEntity(Number(req.params.id), contextId);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    logger.error('Error deleting ticket:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
