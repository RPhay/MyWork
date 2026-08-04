import express from 'express';
import * as taskService from '../../services/taskService.js';
import * as activeContextService from '../../services/activeContextService.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const tasks = await taskService.getAllTasks(contextId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single task
router.get('/:id', async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('Error fetching task:', error);
    res.status(error.statusCode || 404).json({ success: false, message: error.message });
  }
});

// Create task
router.post('/', async (req, res) => {
  try {
    const contextId = await activeContextService.getActiveContextId();
    const task = await taskService.createTask(req.body, contextId);
    res.status(201).json({ success: true, message: 'Task created', data: task });
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body);
    res.json({ success: true, message: 'Task updated', data: task });
  } catch (error) {
    logger.error('Error updating task:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    await taskService.deleteTask(req.params.id);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    logger.error('Error deleting task:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

export default router;
