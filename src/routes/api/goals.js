import express from 'express';
import * as entityService from '../../services/entityService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all goals across all years
router.get('/all', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const goals = await entityService.getAllEntities('goal', contextId);
    res.json({ success: true, data: goals });
  } catch (error) {
    logger.error('Error fetching all goals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get goals by year
router.get('/year/:year', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const goals = await entityService.getAllEntities('goal', contextId);
    res.json({ success: true, data: goals });
  } catch (error) {
    logger.error('Error fetching goals:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reorder goals (drag-and-drop reorder within the Yearly Goals list)
router.patch('/reorder', async (req, res) => {
  try {
    const goals = await entityService.reorderEntitiesBySiblings(req.body.orderedIds);
    res.json({ success: true, message: 'Goals reordered', data: goals });
  } catch (error) {
    logger.error('Error reordering goals:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the status (used by single-click status cycling)
router.patch('/:id/status', async (req, res) => {
  try {
    const goal = await entityService.updateEntity(req.params.id, { status: req.body.status });
    res.json({ success: true, message: 'Status updated', data: goal });
  } catch (error) {
    logger.error('Error updating goal status:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Get single goal
router.get('/:id', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const goal = await entityService.getEntityById(req.params.id, contextId);
    res.json({ success: true, data: goal });
  } catch (error) {
    logger.error('Error fetching goal:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create goal
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const goal = await entityService.createEntity('goal', req.body, contextId);
    res.status(201).json({ success: true, message: 'Goal created', data: goal });
  } catch (error) {
    logger.error('Error creating goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update goal
router.put('/:id', async (req, res) => {
  try {
    const goal = await entityService.updateEntity(req.params.id, req.body);
    res.json({ success: true, message: 'Goal updated', data: goal });
  } catch (error) {
    logger.error('Error updating goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete goal
router.delete('/:id', async (req, res) => {
  try {
    await entityService.deleteEntity(req.params.id);
    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    logger.error('Error deleting goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Get categories - not needed for generic entity engine
router.get('/categories/all', async (req, res) => {
  res.json({ success: true, data: [] });
});

export default router;
