import express from 'express';
import * as focusMonitorsService from '../../services/focusMonitorsService.js';
import * as focusService from '../../services/focusService.js';
import * as activeContextService from '../../services/activeContextService.js';
import { ValidationError } from '../../config/errors.js';
import logger from '../../utils/logger.js';

const router = express.Router();

const send = (res, promise) => promise
  .then(data => res.json({ success: true, data }))
  .catch(error => {
    logger.error('Focus monitors error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });

// GET /api/focus-monitors - the monitor definitions (count, numbering, labels, layout)
router.get('/', async (req, res) => {
  send(res, focusMonitorsService.getMonitorSettings());
});

// PUT /api/focus-monitors - save the definitions. If the count shrinks, any
// pinned items beyond it are moved to monitor 1 first, so settings and
// pinned state never disagree.
router.put('/', async (req, res) => {
  send(res, (async () => {
    const prev = await focusMonitorsService.getMonitorSettings();
    const next = focusMonitorsService.sanitizeSettings({ ...prev, ...(req.body || {}) });

    let reassignedCount = 0;
    if (next.count < prev.count) {
      const contextId = await activeContextService.getActiveContextId();
      reassignedCount = await focusService.reassignOverflow(next.count, contextId);
    }

    const saved = await focusMonitorsService.setMonitorSettings(next);
    return { ...saved, reassignedCount };
  })());
});

// POST /api/focus-monitors/add - one more monitor, up to the cap of 6.
// Declared before /:position/remove is unambiguous either way since the
// literal "add" never matches a numeric :position segment, but kept here to
// read top-to-bottom with the routes it pairs with in the context menu.
router.post('/add', async (req, res) => {
  send(res, (async () => {
    const prev = await focusMonitorsService.getMonitorSettings();
    if (prev.count >= 6) throw new ValidationError('Already at the maximum of 6 monitors');
    return focusMonitorsService.setMonitorSettings({ count: prev.count + 1 });
  })());
});

// POST /api/focus-monitors/:position/remove - remove that monitor. Later
// ones shift down to fill the gap, and anything pinned to it (or shifted)
// lands on monitor 1.
router.post('/:position/remove', async (req, res) => {
  send(res, (async () => {
    const prev = await focusMonitorsService.getMonitorSettings();
    if (prev.count <= 1) throw new ValidationError('At least one monitor is required');

    const position = Number(req.params.position);
    if (!(position >= 1 && position <= prev.count)) throw new ValidationError('No such monitor');

    const contextId = await activeContextService.getActiveContextId();
    const movedCount = await focusService.shiftMonitorsAfterRemoval(position, contextId);

    const next = focusMonitorsService.withMonitorRemoved(prev, position);
    const saved = await focusMonitorsService.setMonitorSettings(next);
    return { ...saved, movedCount };
  })());
});

export default router;
