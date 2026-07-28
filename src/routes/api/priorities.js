import express from 'express';
import * as priorityService from '../../services/priorityService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all priorities
router.get('/', async (req, res) => {
  try {
    const priorities = await priorityService.getAllPriorities();
    res.json({ success: true, data: priorities });
  } catch (error) {
    logger.error('Error fetching priorities:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single priority
router.get('/:id', async (req, res) => {
  try {
    const priority = await priorityService.getPriorityById(req.params.id);
    res.json({ success: true, data: priority });
  } catch (error) {
    logger.error('Error fetching priority:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create priority
router.post('/', async (req, res) => {
  try {
    const priority = await priorityService.createPriority(req.body);
    res.status(201).json({ success: true, message: 'Priority created', data: priority });
  } catch (error) {
    logger.error('Error creating priority:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update priority
router.put('/:id', async (req, res) => {
  try {
    const priority = await priorityService.updatePriority(req.params.id, req.body);
    res.json({ success: true, message: 'Priority updated', data: priority });
  } catch (error) {
    logger.error('Error updating priority:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete priority
router.delete('/:id', async (req, res) => {
  try {
    await priorityService.deletePriority(req.params.id);
    res.json({ success: true, message: 'Priority deleted' });
  } catch (error) {
    logger.error('Error deleting priority:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Reorder priority
router.patch('/:id/reorder', async (req, res) => {
  try {
    const { newIndex } = req.body;
    const priority = await priorityService.reorderPriority(req.params.id, newIndex);
    res.json({ success: true, message: 'Priority reordered', data: priority });
  } catch (error) {
    logger.error('Error reordering priority:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
