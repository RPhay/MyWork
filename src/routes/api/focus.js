import express from 'express';
import * as focusService from '../../services/focusService.js';
import * as activeContextService from '../../services/activeContextService.js';
import { focusEvents, broadcastFocusChange } from '../../services/focusEvents.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Never cached: the focus bar is polled every couple of seconds by every
// view of it (navbar, the desktop wrapper's floating windows), and WKWebView
// in particular serves a cached body instead of revalidating - which left a
// floating window's clock permanently blind to the navbar's changes.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // Ring the change bell after any successful mutation on this router, so
  // every open view of the bar re-reads immediately - see focusEvents.js.
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) broadcastFocusChange();
    });
  }
  next();
});

// GET /api/focus/events - the SSE stream every view of the bar listens to.
// One message per change; the payload carries nothing, "something changed,
// re-read" is the entire protocol. Registered before the other routes so
// '/events' is never read as an entity id.
router.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const onChange = () => res.write('data: change\n\n');
  focusEvents.on('change', onChange);
  // Comment-only heartbeat keeps proxies and the socket itself from
  // deciding the connection is dead.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    focusEvents.off('change', onChange);
  });
});

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
