import express from 'express';
import * as yearService from '../../services/yearService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all years
router.get('/', async (req, res) => {
  try {
    const years = await yearService.getAllYears();
    res.json({ success: true, data: years });
  } catch (error) {
    logger.error('Error fetching years:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Add a year
router.post('/', async (req, res) => {
  try {
    const year = await yearService.addYear(req.body);
    res.status(201).json({ success: true, message: 'Year added', data: year });
  } catch (error) {
    logger.error('Error adding year:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;