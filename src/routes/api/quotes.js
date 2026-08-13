import express from 'express';
import * as quotesService from '../../services/quotesService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get quotes for an object
router.get('/:objectType/:objectId', async (req, res) => {
  try {
    const { objectType, objectId } = req.params;
    const quotes = await quotesService.getQuotesForObject(objectType, objectId);
    res.json({ success: true, data: quotes });
  } catch (error) {
    logger.error('Error fetching quotes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a quote
router.post('/', async (req, res) => {
  try {
    const { objectType, objectId, person, quote } = req.body;
    const newQuote = await quotesService.createQuote(objectType, objectId, person, quote);
    res.status(201).json({ success: true, message: 'Quote created', data: newQuote });
  } catch (error) {
    logger.error('Error creating quote:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update a quote
router.put('/:id', async (req, res) => {
  try {
    const { person, quote } = req.body;
    const updatedQuote = await quotesService.updateQuote(req.params.id, person, quote);
    res.json({ success: true, message: 'Quote updated', data: updatedQuote });
  } catch (error) {
    logger.error('Error updating quote:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete a quote
router.delete('/:id', async (req, res) => {
  try {
    await quotesService.deleteQuote(req.params.id);
    res.json({ success: true, message: 'Quote deleted' });
  } catch (error) {
    logger.error('Error deleting quote:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
