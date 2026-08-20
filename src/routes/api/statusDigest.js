import express from 'express';
import * as statusDigestService from '../../services/statusDigestService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

const send = (res, promise) => promise
  .then(data => res.json({ success: true, data }))
  .catch(error => {
    logger.error('Status digest error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  });

// GET /api/status-digest - the schedule and whatever was last generated
router.get('/', async (req, res) => {
  send(res, (async () => ({
    schedule: await statusDigestService.getSchedule(),
    latest: await statusDigestService.getLatest(),
  }))());
});

// PUT /api/status-digest/schedule - when it should run
router.put('/schedule', async (req, res) => {
  send(res, statusDigestService.setSchedule(req.body || {}));
});

// POST /api/status-digest/run - build one now, without waiting for the slot
router.post('/run', async (req, res) => {
  send(res, statusDigestService.generateDigest());
});

export default router;
