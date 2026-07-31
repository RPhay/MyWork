import express from 'express';
import * as contextTabSettingsService from '../../services/contextTabSettingsService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get a context's tab visibility/order
router.get('/:contextId', async (req, res) => {
  try {
    const settings = await contextTabSettingsService.getTabSettings(req.params.contextId);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Error fetching context tab settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save a context's tab visibility/order
router.put('/:contextId', async (req, res) => {
  try {
    const settings = await contextTabSettingsService.saveTabSettings(req.params.contextId, req.body.settings);
    res.json({ success: true, message: 'Tab settings saved', data: settings });
  } catch (error) {
    logger.error('Error saving context tab settings:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
