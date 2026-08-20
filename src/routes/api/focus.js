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
  send(res, focusService.addFocus(req.body.entityId, contextId));
});

router.delete('/:entityId', async (req, res) => {
  const contextId = await activeContextService.getActiveContextId();
  send(res, focusService.removeFocus(req.params.entityId, contextId));
});

// One endpoint for start and stop: the clock has two states and the caller
// always wants the other one.
// PATCH /api/focus/order - left-to-right order of the bar
// Declared before /:entityId routes so "order" is not read as an id.
router.patch('/order', async (req, res) => {
  send(res, focusService.reorderFocus(req.body?.orderedIds || []));
});

// PATCH /api/focus/:entityId/color - chip background ('#rrggbb', or null)
router.patch('/:entityId/color', async (req, res) => {
  send(res, focusService.setFocusColor(req.params.entityId, req.body?.color ?? null));
});

router.post('/:entityId/toggle', async (req, res) => {
  const contextId = await activeContextService.getActiveContextId();
  send(res, focusService.toggleTimer(req.params.entityId, contextId));
});

export default router;
