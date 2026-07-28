import express from 'express';
import * as sourceService from '../../services/sourceService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all sources
router.get('/', async (req, res) => {
  try {
    const sources = await sourceService.getAllSources();
    res.json({ success: true, data: sources });
  } catch (error) {
    logger.error('Error fetching sources:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single source
router.get('/:id', async (req, res) => {
  try {
    const source = await sourceService.getSourceById(req.params.id);
    res.json({ success: true, data: source });
  } catch (error) {
    logger.error('Error fetching source:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create source
router.post('/', async (req, res) => {
  try {
    const source = await sourceService.createSource(req.body);
    res.status(201).json({ success: true, message: 'Source created', data: source });
  } catch (error) {
    logger.error('Error creating source:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update source
router.put('/:id', async (req, res) => {
  try {
    const source = await sourceService.updateSource(req.params.id, req.body);
    res.json({ success: true, message: 'Source updated', data: source });
  } catch (error) {
    logger.error('Error updating source:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete source
router.delete('/:id', async (req, res) => {
  try {
    await sourceService.deleteSource(req.params.id);
    res.json({ success: true, message: 'Source deleted' });
  } catch (error) {
    logger.error('Error deleting source:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Test source connection
router.post('/:id/test', async (req, res) => {
  try {
    const result = await sourceService.testSourceConnection(req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Error testing source:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
