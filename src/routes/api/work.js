import express from 'express';
import * as workItemService from '../../services/workItemService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get work items by date
router.get('/date/:date', async (req, res) => {
  try {
    const items = await workItemService.getWorkItemsByDate(req.params.date);
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('Error fetching work items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get work items by date range (for week view)
router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const items = await workItemService.getWorkItemsByDateRange(startDate, endDate);
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('Error fetching work items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single work item
router.get('/:id', async (req, res) => {
  try {
    const item = await workItemService.getWorkItemById(req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    logger.error('Error fetching work item:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create work item
router.post('/', async (req, res) => {
  try {
    const item = await workItemService.createWorkItem(req.body);
    res.status(201).json({ success: true, message: 'Work item created', data: item });
  } catch (error) {
    logger.error('Error creating work item:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update work item
router.put('/:id', async (req, res) => {
  try {
    const item = await workItemService.updateWorkItem(req.params.id, req.body);
    res.json({ success: true, message: 'Work item updated', data: item });
  } catch (error) {
    logger.error('Error updating work item:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete work item
router.delete('/:id', async (req, res) => {
  try {
    await workItemService.deleteWorkItem(req.params.id);
    res.json({ success: true, message: 'Work item deleted' });
  } catch (error) {
    logger.error('Error deleting work item:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
