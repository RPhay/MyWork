import express from 'express';
import * as dayHighlightService from '../../services/dayHighlightService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get highlighted days within a date range (for the calendar's month in view)
router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const contextId = await activeContextService.getActiveContextId();
    const highlights = await dayHighlightService.getHighlightsByDateRange(startDate, endDate, contextId);
    res.json({ success: true, data: highlights });
  } catch (error) {
    logger.error('Error fetching day highlights:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Set (or overwrite) a day's background highlight color
router.put('/:date/background', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const highlight = await dayHighlightService.setBackgroundColor(req.params.date, req.body.color, contextId);
    res.json({ success: true, message: 'Day highlighted', data: highlight });
  } catch (error) {
    logger.error('Error setting day background color:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Set (or overwrite) a day's text color
router.put('/:date/text-color', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const highlight = await dayHighlightService.setTextColor(req.params.date, req.body.color, contextId);
    res.json({ success: true, message: 'Text color set', data: highlight });
  } catch (error) {
    logger.error('Error setting day text color:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Clear both background and text color for a day
router.delete('/:date', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    await dayHighlightService.clearHighlight(req.params.date, contextId);
    res.json({ success: true, message: 'Highlight cleared' });
  } catch (error) {
    logger.error('Error clearing day highlight:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
