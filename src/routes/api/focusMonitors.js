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

// How many monitor zones actually exist right now: not a setting, the highest
// `focus_monitor` any pinned item currently carries. Zero when nothing is
// pinned anywhere - see focusMonitorsService.js's header comment for why this
// isn't stored. Capped defensively at MAX_MONITORS, the same bound the label/
// layout array is built to, though nothing should ever pin past it in practice.
async function currentCount(contextId) {
  const items = await focusService.getFocusItems(contextId);
  const highest = items.reduce((max, i) => Math.max(max, i.monitor), 0);
  return Math.min(focusMonitorsService.MAX_MONITORS, highest);
}

async function settingsWithCount(contextId) {
  const [settings, count] = await Promise.all([
    focusMonitorsService.getMonitorSettings(),
    currentCount(contextId),
  ]);
  return { ...settings, count };
}

// GET /api/focus-monitors - the monitor definitions (numbering, labels,
// layout) plus how many currently exist, derived from what is pinned.
router.get('/', async (req, res) => {
  send(res, (async () => {
    const contextId = await activeContextService.getActiveContextId();
    return settingsWithCount(contextId);
  })());
});

// PUT /api/focus-monitors - save the label/layout/showNumbers definitions.
// `count` in the body, if present, is ignored - it isn't a setting, see above.
router.put('/', async (req, res) => {
  send(res, (async () => {
    const contextId = await activeContextService.getActiveContextId();
    await focusMonitorsService.setMonitorSettings(req.body || {});
    return settingsWithCount(contextId);
  })());
});

// POST /api/focus-monitors/:position/remove - remove that monitor. Later
// ones shift down to fill the gap, and anything pinned to it (or shifted)
// lands on monitor 1.
router.post('/:position/remove', async (req, res) => {
  send(res, (async () => {
    const contextId = await activeContextService.getActiveContextId();
    const count = await currentCount(contextId);
    if (count < 1) throw new ValidationError('There are no monitors to remove');

    const position = Number(req.params.position);
    if (!(position >= 1 && position <= count)) throw new ValidationError('No such monitor');

    const movedCount = await focusService.shiftMonitorsAfterRemoval(position, contextId);

    const prev = await focusMonitorsService.getMonitorSettings();
    const next = focusMonitorsService.withMonitorRemoved(prev, position);
    await focusMonitorsService.setMonitorSettings(next);
    return { ...(await settingsWithCount(contextId)), movedCount };
  })());
});

export default router;
