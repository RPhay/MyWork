import express from 'express';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get the currently active context
router.get('/', async (req, res) => {
  try {
    const context = await activeContextService.getActiveContext();
    res.json({ success: true, data: context });
  } catch (error) {
    logger.error('Error fetching active context:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Set the active context
router.put('/', async (req, res) => {
  try {
    const context = await activeContextService.setActiveContextId(req.body.id);
    res.json({ success: true, message: 'Active context updated', data: context });
  } catch (error) {
    logger.error('Error setting active context:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
