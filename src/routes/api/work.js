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

// Reorder work items within a single date (drag-to-reorder)
router.patch('/reorder', async (req, res) => {
  try {
    const { date, orderedIds } = req.body;
    const items = await workItemService.reorderWorkItems(date, orderedIds);
    res.json({ success: true, message: 'Work items reordered', data: items });
  } catch (error) {
    logger.error('Error reordering work items:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update work item
router.put('/:id', async (req, res) => {
  try {
    const item = await workItemService.updateWorkItem(req.params.id, req.body);
    res.json({ success: true, message: 'Work item updated', data: item });
  } catch (error) {
    logger.error('Error updating work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete work item
router.delete('/:id', async (req, res) => {
  try {
    await workItemService.deleteWorkItem(req.params.id);
    res.json({ success: true, message: 'Work item deleted' });
  } catch (error) {
    logger.error('Error deleting work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the status (used by single-click status cycling)
router.patch('/:id/status', async (req, res) => {
  try {
    const item = await workItemService.updateWorkItemStatus(req.params.id, req.body.status);
    res.json({ success: true, message: 'Status updated', data: item });
  } catch (error) {
    logger.error('Error updating work item status:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the notes (used by the right-click "Edit Notes" quick action)
router.patch('/:id/notes', async (req, res) => {
  try {
    const item = await workItemService.updateWorkItemNotes(req.params.id, req.body.notes);
    res.json({ success: true, message: 'Notes updated', data: item });
  } catch (error) {
    logger.error('Error updating work item notes:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the emoji ("Oh!" column - clicking the cell opens a quick picker)
router.patch('/:id/emoji', async (req, res) => {
  try {
    const item = await workItemService.updateWorkItemEmoji(req.params.id, req.body.emoji);
    res.json({ success: true, message: 'Emoji updated', data: item });
  } catch (error) {
    logger.error('Error updating work item emoji:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the time box (clicking the cell cycles through freeform/15/30/45/60)
router.patch('/:id/timebox', async (req, res) => {
  try {
    const item = await workItemService.updateWorkItemTimeBox(req.params.id, req.body.time_box_minutes);
    res.json({ success: true, message: 'Time box updated', data: item });
  } catch (error) {
    logger.error('Error updating work item time box:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Move a work item to a different date
router.post('/:id/move', async (req, res) => {
  try {
    const item = await workItemService.moveWorkItem(req.params.id, req.body.date);
    res.json({ success: true, message: 'Work item moved', data: item });
  } catch (error) {
    logger.error('Error moving work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Clone a work item onto a different date, leaving the original in place
router.post('/:id/clone', async (req, res) => {
  try {
    const item = await workItemService.cloneWorkItem(req.params.id, req.body.date);
    res.status(201).json({ success: true, message: 'Work item cloned', data: item });
  } catch (error) {
    logger.error('Error cloning work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink a priority
router.post('/:id/priorities/:priorityId', async (req, res) => {
  try {
    const item = await workItemService.addPriorityAssociation(req.params.id, req.params.priorityId);
    res.status(201).json({ success: true, message: 'Priority linked', data: item });
  } catch (error) {
    logger.error('Error linking priority:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/priorities/:priorityId', async (req, res) => {
  try {
    await workItemService.removePriorityAssociation(req.params.id, req.params.priorityId);
    res.json({ success: true, message: 'Priority unlinked' });
  } catch (error) {
    logger.error('Error unlinking priority:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink a goal
router.post('/:id/goals/:goalId', async (req, res) => {
  try {
    const item = await workItemService.addGoalAssociation(req.params.id, req.params.goalId);
    res.status(201).json({ success: true, message: 'Goal linked', data: item });
  } catch (error) {
    logger.error('Error linking goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/goals/:goalId', async (req, res) => {
  try {
    await workItemService.removeGoalAssociation(req.params.id, req.params.goalId);
    res.json({ success: true, message: 'Goal unlinked' });
  } catch (error) {
    logger.error('Error unlinking goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink an area
router.post('/:id/areas/:areaId', async (req, res) => {
  try {
    const item = await workItemService.addAreaAssociation(req.params.id, req.params.areaId);
    res.status(201).json({ success: true, message: 'Area linked', data: item });
  } catch (error) {
    logger.error('Error linking area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/areas/:areaId', async (req, res) => {
  try {
    await workItemService.removeAreaAssociation(req.params.id, req.params.areaId);
    res.json({ success: true, message: 'Area unlinked' });
  } catch (error) {
    logger.error('Error unlinking area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
