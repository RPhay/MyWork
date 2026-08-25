import express from 'express';
import * as dailyService from '../../services/dailyService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get work items by date
router.get('/date/:date', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const items = await dailyService.getWorkItemsByDate(req.params.date, contextId);
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('Error fetching work items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// The records sitting on a day with no work item wrapped round them. Separate
// from /date/:date rather than folded into it: that route's shape is what the
// dashboard, Reporting and the week view all read, and widening it would make
// every one of them handle a row that has no work-item id.
router.get('/date/:date/roots', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const roots = await dailyService.getDailyRootEntities(req.params.date, contextId);
    res.json({ success: true, data: roots });
  } catch (error) {
    logger.error('Error fetching a day\'s root records:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/date/:date/roots/:entityId', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const result = await dailyService.addEntityToDate(
      Number(req.params.entityId), req.params.date, contextId);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('Error putting a record on a day:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/date/:date/roots/:entityId', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const result = await dailyService.removeEntityFromDate(
      Number(req.params.entityId), req.params.date, contextId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error taking a record off a day:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Get work items by date range (for week view)
router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const contextId = await activeContextService.getActiveContextId();
    const items = await dailyService.getWorkItemsByDateRange(startDate, endDate, contextId);
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
    const contextId = await activeContextService.getActiveContextId();
    const items = await dailyService.reorderWorkItems(date, orderedIds, contextId);
    res.json({ success: true, message: 'Dailies reordered', data: items });
  } catch (error) {
    logger.error('Error reordering work items:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Get single work item
router.get('/:id', async (req, res) => {
  try {
    const item = await dailyService.getWorkItemById(req.params.id);
    res.json({ success: true, data: item });
  } catch (error) {
    logger.error('Error fetching work item:', error);
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create work item
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const item = await dailyService.createWorkItem(req.body, contextId);
    res.status(201).json({ success: true, message: 'Daily created', data: item });
  } catch (error) {
    logger.error('Error creating work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update work item
router.put('/:id', async (req, res) => {
  try {
    const item = await dailyService.updateWorkItem(req.params.id, req.body);
    res.json({ success: true, message: 'Daily updated', data: item });
  } catch (error) {
    logger.error('Error updating work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete work item
router.delete('/:id', async (req, res) => {
  try {
    await dailyService.deleteWorkItem(req.params.id);
    res.json({ success: true, message: 'Daily deleted' });
  } catch (error) {
    logger.error('Error deleting work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the status (used by single-click status cycling)
router.patch('/:id/status', async (req, res) => {
  try {
    const item = await dailyService.updateWorkItemStatus(req.params.id, req.body.status);
    res.json({ success: true, message: 'Status updated', data: item });
  } catch (error) {
    logger.error('Error updating work item status:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the notes (used by the right-click "Edit Notes" quick action)
router.patch('/:id/notes', async (req, res) => {
  try {
    const item = await dailyService.updateWorkItemNotes(req.params.id, req.body.notes);
    res.json({ success: true, message: 'Notes updated', data: item });
  } catch (error) {
    logger.error('Error updating work item notes:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the emoji ("Oh!" column - clicking the cell opens a quick picker)
router.patch('/:id/emoji', async (req, res) => {
  try {
    const item = await dailyService.updateWorkItemEmoji(req.params.id, req.body.emoji);
    res.json({ success: true, message: 'Emoji updated', data: item });
  } catch (error) {
    logger.error('Error updating work item emoji:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update just the time box (clicking the cell cycles through freeform/15/30/45/60)
router.patch('/:id/timebox', async (req, res) => {
  try {
    const item = await dailyService.updateWorkItemTimeBox(req.params.id, req.body.time_box_minutes);
    res.json({ success: true, message: 'Time box updated', data: item });
  } catch (error) {
    logger.error('Error updating work item time box:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Toggle the worked_with_claude flag
router.patch('/:id/claude', async (req, res) => {
  try {
    const item = await dailyService.toggleWorkItemClaude(req.params.id);
    res.json({ success: true, message: 'Claude flag toggled', data: item });
  } catch (error) {
    logger.error('Error toggling claude flag:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Move a work item to a different date
router.post('/:id/move', async (req, res) => {
  try {
    const item = await dailyService.moveWorkItem(req.params.id, req.body.date);
    res.json({ success: true, message: 'Daily moved', data: item });
  } catch (error) {
    logger.error('Error moving work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Clone a work item onto a different date, leaving the original in place
router.post('/:id/clone', async (req, res) => {
  try {
    const item = await dailyService.cloneWorkItem(req.params.id, req.body.date);
    res.status(201).json({ success: true, message: 'Daily cloned', data: item });
  } catch (error) {
    logger.error('Error cloning work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink a priority
// Link/unlink ANY entity, whatever its type. The per-type routes below predate
// this and are kept until their callers move across; this one is what a new
// type uses, since no route can be written in advance for a type that does not
// exist yet.
// PATCH /api/dailies/:id/entities/order - order of a work item's children.
// Declared before /:id/entities/:entityId so "order" is not read as an id.
router.patch('/:id/entities/order', async (req, res) => {
  try {
    const item = await dailyService.reorderEntityAssociations(req.params.id, req.body?.orderedIds || []);
    res.json({ success: true, data: item });
  } catch (error) {
    logger.error('Error reordering work item children:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/:id/entities/:entityId', async (req, res) => {
  try {
    const item = await dailyService.addEntityAssociation(req.params.id, req.params.entityId);
    res.status(201).json({ success: true, message: 'Linked', data: item });
  } catch (error) {
    logger.error('Error linking entity to work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/entities/:entityId', async (req, res) => {
  try {
    await dailyService.removeEntityAssociation(req.params.id, req.params.entityId);
    res.json({ success: true, message: 'Unlinked' });
  } catch (error) {
    logger.error('Error unlinking entity from work item:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/:id/priorities/:priorityId', async (req, res) => {
  try {
    const item = await dailyService.addPriorityAssociation(req.params.id, req.params.priorityId);
    res.status(201).json({ success: true, message: 'Priority linked', data: item });
  } catch (error) {
    logger.error('Error linking priority:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/priorities/:priorityId', async (req, res) => {
  try {
    await dailyService.removePriorityAssociation(req.params.id, req.params.priorityId);
    res.json({ success: true, message: 'Priority unlinked' });
  } catch (error) {
    logger.error('Error unlinking priority:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink a goal
router.post('/:id/goals/:goalId', async (req, res) => {
  try {
    const item = await dailyService.addGoalAssociation(req.params.id, req.params.goalId);
    res.status(201).json({ success: true, message: 'Goal linked', data: item });
  } catch (error) {
    logger.error('Error linking goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/goals/:goalId', async (req, res) => {
  try {
    await dailyService.removeGoalAssociation(req.params.id, req.params.goalId);
    res.json({ success: true, message: 'Goal unlinked' });
  } catch (error) {
    logger.error('Error unlinking goal:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Link/unlink an area
router.post('/:id/categories/:categoryId', async (req, res) => {
  try {
    const item = await dailyService.addCategoryAssociation(req.params.id, req.params.categoryId);
    res.status(201).json({ success: true, message: 'Category linked', data: item });
  } catch (error) {
    logger.error('Error linking area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/categories/:categoryId', async (req, res) => {
  try {
    await dailyService.removeCategoryAssociation(req.params.id, req.params.categoryId);
    res.json({ success: true, message: 'Category unlinked' });
  } catch (error) {
    logger.error('Error unlinking area:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/:id/templates/:templateId', async (req, res) => {
  try {
    const item = await dailyService.addTemplateAssociation(req.params.id, req.params.templateId);
    res.status(201).json({ success: true, message: 'Template associated', data: item });
  } catch (error) {
    logger.error('Error associating template:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/templates/:templateId', async (req, res) => {
  try {
    await dailyService.removeTemplateAssociation(req.params.id, req.params.templateId);
    res.json({ success: true, message: 'Template unlinked' });
  } catch (error) {
    logger.error('Error unlinking template:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/:id/todos/:todoId', async (req, res) => {
  try {
    const item = await dailyService.addTodoAssociation(req.params.id, req.params.todoId);
    res.status(201).json({ success: true, message: 'Todo associated', data: item });
  } catch (error) {
    logger.error('Error associating todo:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/todos/:todoId', async (req, res) => {
  try {
    await dailyService.removeTodoAssociation(req.params.id, req.params.todoId);
    res.json({ success: true, message: 'Todo unlinked' });
  } catch (error) {
    logger.error('Error unlinking todo:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/:id/tasks/:taskId', async (req, res) => {
  try {
    const item = await dailyService.addTaskAssociation(req.params.id, req.params.taskId);
    res.status(201).json({ success: true, message: 'Task associated', data: item });
  } catch (error) {
    logger.error('Error associating task:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    await dailyService.removeTaskAssociation(req.params.id, req.params.taskId);
    res.json({ success: true, message: 'Task unlinked' });
  } catch (error) {
    logger.error('Error unlinking task:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/:id/tickets/:ticketId', async (req, res) => {
  try {
    const item = await dailyService.addTicketAssociation(req.params.id, req.params.ticketId);
    res.status(201).json({ success: true, message: 'Ticket associated', data: item });
  } catch (error) {
    logger.error('Error associating ticket:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/tickets/:ticketId', async (req, res) => {
  try {
    await dailyService.removeTicketAssociation(req.params.id, req.params.ticketId);
    res.json({ success: true, message: 'Ticket unlinked' });
  } catch (error) {
    logger.error('Error unlinking ticket:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/:id/ideas/:ideaId', async (req, res) => {
  try {
    const item = await dailyService.addIdeaAssociation(req.params.id, req.params.ideaId);
    res.status(201).json({ success: true, message: 'Idea associated', data: item });
  } catch (error) {
    logger.error('Error associating idea:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/ideas/:ideaId', async (req, res) => {
  try {
    await dailyService.removeIdeaAssociation(req.params.id, req.params.ideaId);
    res.json({ success: true, message: 'Idea unlinked' });
  } catch (error) {
    logger.error('Error unlinking idea:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
