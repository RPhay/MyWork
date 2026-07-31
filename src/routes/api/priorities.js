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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update priority
router.put('/:id', async (req, res) => {
  try {
    const priority = await priorityService.updatePriority(req.params.id, req.body);
    res.json({ success: true, message: 'Priority updated', data: priority });
  } catch (error) {
    logger.error('Error updating priority:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete priority
router.delete('/:id', async (req, res) => {
  try {
    await priorityService.deletePriority(req.params.id);
    res.json({ success: true, message: 'Priority deleted' });
  } catch (error) {
    logger.error('Error deleting priority:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the status (used by the Priority Board)
router.patch('/:id/status', async (req, res) => {
  try {
    const priority = await priorityService.updatePriorityStatus(req.params.id, req.body.status);
    res.json({ success: true, message: 'Status updated', data: priority });
  } catch (error) {
    logger.error('Error updating priority status:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Reorder priorities (shared by the Projects tree, Priority Board, and Weekly
// Priorities - order_index is one global ranking, so all three stay in sync).
// orderedIds is required; draggedId/updates are optional extra field changes
// (status for a Priority Board bay move, is_weekly for Weekly Priorities).
router.patch('/reorder-siblings', async (req, res) => {
  try {
    const { orderedIds, draggedId, updates } = req.body;
    const priorities = await priorityService.reorderPrioritiesAmongSiblings(orderedIds, draggedId, updates);
    res.json({ success: true, message: 'Priorities reordered', data: priorities });
  } catch (error) {
    logger.error('Error reordering priorities:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink a category (area)
router.post('/:id/areas/:areaId', async (req, res) => {
  try {
    const priority = await priorityService.addAreaAssociation(req.params.id, req.params.areaId);
    res.status(201).json({ success: true, message: 'Category linked', data: priority });
  } catch (error) {
    logger.error('Error linking category to project:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/areas/:areaId', async (req, res) => {
  try {
    await priorityService.removeAreaAssociation(req.params.id, req.params.areaId);
    res.json({ success: true, message: 'Category unlinked' });
  } catch (error) {
    logger.error('Error unlinking category from project:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink a goal
router.post('/:id/goals/:goalId', async (req, res) => {
  try {
    const priority = await priorityService.addGoalAssociation(req.params.id, req.params.goalId);
    res.status(201).json({ success: true, message: 'Goal linked', data: priority });
  } catch (error) {
    logger.error('Error linking goal to project:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/goals/:goalId', async (req, res) => {
  try {
    await priorityService.removeGoalAssociation(req.params.id, req.params.goalId);
    res.json({ success: true, message: 'Goal unlinked' });
  } catch (error) {
    logger.error('Error unlinking goal from project:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
