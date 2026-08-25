import express from 'express';
import * as focusService from '../../services/focusService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

const send = (res, promise) => promise
  .then(data => res.json({ success: true, data, max: focusService.MAX_FOCUS_ITEMS }))
  .catch(error => {
    logger.error('Focus bar error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });

router.get('/', async (req, res) => {
  const contextId = await activeContextService.getActiveContextId();
  send(res, focusService.getFocusItems(contextId));
});

router.post('/', async (req, res) => {
  const contextId = await activeContextService.getActiveContextId();
  send(res, focusService.addFocus(req.body.entityId, contextId, req.body.monitor));
});

router.delete('/:entityId', async (req, res) => {
  const contextId = await activeContextService.getActiveContextId();
  send(res, focusService.removeFocus(req.params.entityId, contextId));
});

// PATCH /api/focus/monitors/:monitor/order - order of items within one monitor
// Declared before /:entityId routes so "monitors" is not read as an id.
router.patch('/monitors/:monitor/order', async (req, res) => {
  send(res, focusService.reorderFocus(req.params.monitor, req.body?.orderedIds || []));
});

// PATCH /api/focus/:entityId/monitor - move a pinned item to a different monitor
router.patch('/:entityId/monitor', async (req, res) => {
  const contextId = await activeContextService.getActiveContextId();
  send(res, focusService.moveFocus(req.params.entityId, req.body?.monitor, contextId));
});

// PATCH /api/focus/:entityId/color - chip background ('#rrggbb', or null)
router.patch('/:entityId/color', async (req, res) => {
  send(res, focusService.setFocusColor(req.params.entityId, req.body?.color ?? null));
});

// One endpoint for start and stop: the clock has two states and the caller
// always wants the other one.
router.post('/:entityId/toggle', async (req, res) => {
  const contextId = await activeContextService.getActiveContextId();
  send(res, focusService.toggleTimer(req.params.entityId, contextId));
});

export default router;
